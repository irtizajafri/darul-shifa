const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const prisma = require('../../config/db');

// Direct printing (owner, 2026-11-24; migration 084).
// "Thermal & Save" must go straight to the PC's thermal printer and "Save &
// Print" straight to its normal printer — no printer-choice dialog. A web page
// can't choose a printer, so the server prints: the screen sends the slip's
// HTML, the server turns it into an image (the same headless Chrome WhatsApp
// uses) and prints it on the printer set for that PC in Connected PCs (by IP)
// — on Windows through print-image.ps1 (.NET printing, nothing to install).
// A PC with no printer set keeps the browser's print dialog (the screens ask
// /config first).

const TARGETS = { thermal: 'Thermal', normal: 'Normal' };
// Width the slip is laid out at and printed at (mm), and the image's
// pixels per CSS pixel (≈ 203 dpi thermal head, ≈ 288 dpi normal printer).
const LAYOUT = { thermal: { widthMm: 80, scale: 2.12 }, normal: { widthMm: 210, scale: 3 } };
const PX_PER_MM = 96 / 25.4;
const PS1 = path.join(__dirname, 'print-image.ps1');
const isWindows = process.platform === 'win32';

const fail = (status, message) => Object.assign(new Error(message), { status });

let browserPromise = null;
async function getBrowser() {
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    if (b && b.connected) return b;
  }
  const puppeteer = require('puppeteer');
  browserPromise = puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  return browserPromise;
}

// The page margin the slip asks for (its last "@page { … margin: Nmm }"),
// as the browser would leave it; 0 when none.
function pageMarginMm(html) {
  const rules = String(html).match(/@page\s*{[^}]*}/g) || [];
  const m = /margin\s*:\s*([\d.]+)\s*mm/.exec(rules[rules.length - 1] || '');
  return m ? Math.min(20, Number(m[1]) || 0) : 0;
}

// The slip asks for A4 paper (CRF / ECG / Emergency forms: "@page { size: A4 … }").
function wantsA4(html) {
  const rules = String(html).match(/@page\s*{[^}]*}/g) || [];
  return /size\s*:\s*A4\b/i.test(rules[rules.length - 1] || '');
}

// The slip as it prints (print CSS), one long PNG, and its size on paper.
// Thermal: the full 80 mm roll. Normal: laid out on A4's width inside the
// slip's own page margin; a slip narrower than that (the 148 mm OPD slip) is
// cut to its own width, so the printer script can centre it on whatever
// paper is loaded, as the browser did.
async function renderPng(html, target) {
  const { scale } = LAYOUT[target];
  const marginMm = target === 'thermal' ? 0 : pageMarginMm(html);
  const layoutMm = LAYOUT[target].widthMm - 2 * marginMm;
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    // The slips' own "window.onload → print()" must not run here.
    await page.setJavaScriptEnabled(false);
    const viewW = Math.round(layoutMm * PX_PER_MM);
    await page.setViewport({ width: viewW, height: 100, deviceScaleFactor: scale });
    await page.emulateMediaType('print');
    await page.setContent(String(html), { waitUntil: 'load', timeout: 20000 });
    const box = await page.evaluate(() => {
      const r = document.body.getBoundingClientRect();
      return { left: r.left, right: r.right, height: Math.ceil(document.documentElement.scrollHeight) };
    });
    let widthMm = layoutMm;
    let png;
    if (target === 'normal' && box.right - box.left > 10 && box.right - box.left < viewW - 2) {
      const x = Math.max(0, Math.floor(box.left));
      const width = Math.min(viewW - x, Math.ceil(box.right) - x);
      png = await page.screenshot({ type: 'png', clip: { x, y: 0, width, height: Math.max(1, box.height) }, captureBeyondViewport: true });
      widthMm = width / PX_PER_MM;
    } else {
      png = await page.screenshot({ type: 'png', fullPage: true });
    }
    return { png, widthMm, marginMm, a4: target === 'normal' && wantsA4(html) };
  } finally {
    await page.close().catch(() => {});
  }
}

function run(cmd, args, extraEnv = null) {
  return new Promise((resolve, reject) => {
    const opts = { windowsHide: true, timeout: 90000, ...(extraEnv ? { env: { ...process.env, ...extraEnv } } : {}) };
    execFile(cmd, args, opts, (err, stdout, stderr) => {
      // Never the command line in the message — it carries the counter's print password.
      if (err) {
        const said = String(stderr || stdout || '').trim().split('\n').pop();
        return reject(fail(502, said || (err.killed ? 'Printer ne waqt pe jawab nahi diya' : 'Print nahi hua')));
      }
      resolve(String(stdout || ''));
    });
  });
}

// cred: the counter's print user ({ host, user, password }) — the backend runs
// as a Windows service (Session 0) that can't see credentials saved by
// cmdkey, so each print first opens its own connection to the counter with
// them (owner's server, 2026-11-27: "account is currently disabled" / jobs
// stuck from the service, fine from a desktop session).
async function sendToPrinter({ png, widthMm, marginMm, a4 }, printer, target, cred = null) {
  const file = path.join(os.tmpdir(), `hms-print-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`);
  fs.writeFileSync(file, png);
  try {
    if (isWindows) {
      await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', PS1,
        '-Image', file, '-Printer', printer, '-WidthMm', widthMm.toFixed(2), '-MarginMm', String(marginMm), '-PaperA4', a4 ? '1' : '0', '-Thermal', target === 'thermal' ? '1' : '0',
        ...(cred ? ['-ShareHost', cred.host, '-ShareUser', cred.user] : [])],
        // The password goes in the environment, not on the command line (other
        // processes on the server can read a process's command line).
        cred ? { HMS_SHARE_PASS: cred.password } : null);
    } else {
      // Dev PC (Mac / Linux): CUPS.
      await run('lp', ['-d', printer, '-o', 'fit-to-page', file]);
    }
  } finally {
    fs.unlink(file, () => {});
  }
}

const deviceOf = (ip) => (ip ? prisma.hmsDevice.findUnique({ where: { ip } }) : null);

// Which of this PC's printers the server can print on.
async function getConfig(ip) {
  const d = await deviceOf(ip);
  return { pc: d?.name || ip || null, thermal: !!d?.thermalPrinter, normal: !!d?.normalPrinter };
}

// docs: [{ html, target: 'thermal' | 'normal' }] — printed in order.
async function printDocs(ip, docs) {
  const list = Array.isArray(docs) ? docs : [];
  if (!list.length || list.length > 4) throw fail(400, 'Print ke liye slip nahi mili');
  const d = await deviceOf(ip);
  const jobs = list.map((doc) => {
    const target = doc?.target === 'thermal' ? 'thermal' : doc?.target === 'normal' ? 'normal' : null;
    if (!target || typeof doc.html !== 'string' || !doc.html.trim()) throw fail(400, 'Print ki slip sahi nahi');
    const printer = target === 'thermal' ? d?.thermalPrinter : d?.normalPrinter;
    if (!printer) throw fail(409, `Is PC ka ${TARGETS[target]} printer set nahi — Super Admin Connected PCs me set kare`);
    return { html: doc.html, target, printer };
  });
  // The counter's print user (counter-printers script), for printers on that PC:
  // a \\host\printer path's host, else this PC (a server printer on a local
  // port that writes to the counter's share).
  const credFor = (printer) => {
    if (!d?.printShareUser || !d?.printSharePassword) return null;
    const m = /^\\\\([^\\]+)\\/.exec(String(printer));
    return { host: m ? m[1] : ip, user: d.printShareUser, password: d.printSharePassword };
  };
  for (const job of jobs) {
    const image = await renderPng(job.html, job.target);
    await sendToPrinter(image, job.printer, job.target, credFor(job.printer));
  }
  return { printed: jobs.length, printers: jobs.map((j) => j.printer) };
}

// Printers installed on the server — the Super Admin picks from these.
async function listServerPrinters() {
  try {
    if (isWindows) {
      const out = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
        'Add-Type -AssemblyName System.Drawing; [System.Drawing.Printing.PrinterSettings]::InstalledPrinters']);
      return out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    }
    const out = await run('lpstat', ['-e']);
    return out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

// ─── Printer setup by script (owner, 2026-11-26; migration 087) ─────────────
// counter-printers (on the counter) shares its printers as HMS-THERMAL /
// HMS-NORMAL, makes a print-only user and reports here; server-printers (on
// the server) reads the list, connects the printers, prints a test page and
// reports back. Both log in as the Super Admin.
const clean = (v, max = 200) => String(v ?? '').replace(/[\r\n|]+/g, ' ').trim().slice(0, max);

async function registerCounter(ip, body = {}) {
  if (!ip) throw fail(400, 'PC ka IP nahi mila');
  const thermalShare = clean(body.thermalShare, 80);
  const normalShare = clean(body.normalShare, 80);
  if (!thermalShare && !normalShare) throw fail(400, 'Koi printer share nahi hua');
  const user = clean(body.user, 40);
  const password = String(body.password ?? '');
  if (!user || !password) throw fail(400, 'Print user ka naam / password nahi aaya');
  const names = [thermalShare && `Thermal: ${clean(body.thermalName)}`, normalShare && `Normal: ${clean(body.normalName)}`].filter(Boolean).join(' · ');
  // Only the printers this run shared; one left out (0) keeps what is set.
  const data = {
    ...(thermalShare ? { thermalPrinter: `\\\\${ip}\\${thermalShare}` } : {}),
    ...(normalShare ? { normalPrinter: `\\\\${ip}\\${normalShare}` } : {}),
    printSetup: 'counter-done',
    printNote: `Counter tayar (${names}) — ab server pe server-printers chalayein`,
    printShareUser: user,
    printSharePassword: password,
    printSetupAt: new Date(),
  };
  const pcName = clean(body.pcName, 60);
  const row = await prisma.hmsDevice.upsert({
    where: { ip },
    create: { ip, name: pcName || null, ...data },
    update: data,
  });
  // Name the PC after Windows' computer name if nobody has named it yet.
  if (!row.name && pcName) await prisma.hmsDevice.update({ where: { id: row.id }, data: { name: pcName } });
  return { ip, thermalPrinter: row.thermalPrinter, normalPrinter: row.normalPrinter };
}

// For the server script: one line per counter — id|ip|thermal share|normal share|user|password|name
// (plain lines: PowerShell 2.0 on Windows 7 has no JSON reader).
async function setupList() {
  const rows = await prisma.hmsDevice.findMany({
    where: { printShareUser: { not: null } },
    orderBy: { ip: 'asc' },
  });
  const shareOf = (unc) => (unc ? String(unc).split('\\').pop() : '');
  return rows.map((r) => [r.id, r.ip, shareOf(r.thermalPrinter), shareOf(r.normalPrinter), r.printShareUser, r.printSharePassword, clean(r.name || '')].join('|')).join('\n');
}

async function setupReport(id, { status, note, thermalPrinter, normalPrinter } = {}) {
  const st = ['ready', 'failed'].includes(status) ? status : null;
  if (!st) throw fail(400, 'Status ready / failed hona chahiye');
  const row = await prisma.hmsDevice.findUnique({ where: { id: Number(id) || 0 } });
  if (!row) throw fail(404, 'PC nahi mila');
  // The names Windows gave the connections (\\ip\<printer name>) — what printing uses.
  const names = {};
  if (clean(thermalPrinter)) names.thermalPrinter = clean(thermalPrinter);
  if (clean(normalPrinter)) names.normalPrinter = clean(normalPrinter);
  await prisma.hmsDevice.update({ where: { id: row.id }, data: { printSetup: st, printNote: clean(note, 500) || null, printSetupAt: new Date(), ...names } });
  return { id: row.id, printSetup: st };
}

module.exports = { getConfig, printDocs, listServerPrinters, renderPng, registerCounter, setupList, setupReport };
