const os = require('os');
const { execFile } = require('child_process');
const prisma = require('../../config/db');

// Connected PCs (owner, 2026-11-20). Every /api call notes the PC it came
// from (by IP); the Super Admin's "Connected PCs" page lists them — online
// now, last user, MAC — and can allow / block a PC's access to the HMS, or
// switch on "approved PCs only" so a new PC waits until it is approved.
//
// Never blocked: the server itself (its own IPs) and PCs marked protected,
// and the Super Admin can't block the PC they are working on — so nobody
// can lock themselves out. DEVICE_GUARD=off in .env turns blocking off.
//
// Notes are kept in memory and written every 20 s (not on every request).

const ONLINE_MS = 3 * 60 * 1000;   // seen in the last 3 minutes = online
const FLUSH_MS = 20 * 1000;
const RELOAD_MS = 15 * 1000;

const fail = (status, message) => Object.assign(new Error(message), { status });

function normIp(raw) {
  let ip = String(raw || '').trim();
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (ip === '::1') ip = '127.0.0.1';
  return ip;
}

function readServerIps() {
  const set = new Set(['127.0.0.1']);
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) if (a.family === 'IPv4' || a.family === 4) set.add(a.address);
  }
  return set;
}
let serverIps = readServerIps();
setInterval(() => { serverIps = readServerIps(); }, 5 * 60 * 1000).unref();
const isServerIp = (ip) => serverIps.has(ip);

// ─── Cached access list ──────────────────────────────────────────────────────
let statusByIp = new Map();
let protectedIps = new Set();
let approvalMode = false;
let loadedAt = 0;
let reloading = null;

function reload() {
  if (reloading) return reloading;
  reloading = Promise.all([
    prisma.hmsDevice.findMany({ select: { ip: true, status: true, protected: true } }),
    prisma.hmsSetting.findUnique({ where: { key: 'approvalMode' } }),
  ]).then(([rows, setting]) => {
    statusByIp = new Map(rows.map((r) => [r.ip, r.status]));
    protectedIps = new Set(rows.filter((r) => r.protected).map((r) => r.ip));
    approvalMode = setting?.value === 'on';
    loadedAt = Date.now();
  }).catch(() => {}).finally(() => { reloading = null; });
  return reloading;
}
reload();

function accessOf(ip) {
  if (String(process.env.DEVICE_GUARD || '').toLowerCase() === 'off') return 'allowed';
  if (isServerIp(ip) || protectedIps.has(ip)) return 'allowed';
  const st = statusByIp.get(ip);
  if (st === 'blocked') return 'blocked';
  if (st === 'pending' || (!st && approvalMode)) return 'pending';
  return 'allowed';
}

// ─── Noting requests ─────────────────────────────────────────────────────────
const pending = new Map(); // ip -> { n, firstSeen, lastSeen, userName, userEmail, ua }

function note(ip, { userName, userEmail, ua } = {}) {
  if (!ip) return;
  const now = new Date();
  const p = pending.get(ip) || { n: 0, firstSeen: now };
  p.n += 1;
  p.lastSeen = now;
  if (userEmail) { p.userEmail = userEmail; p.userName = userName || userEmail; }
  if (ua) p.ua = String(ua).slice(0, 300);
  pending.set(ip, p);
}

let flushing = null;
function flush() {
  if (flushing) return flushing;
  const entries = [...pending.entries()];
  pending.clear();
  if (!entries.length) return Promise.resolve();
  flushing = (async () => {
    for (const [ip, p] of entries) {
      await prisma.hmsDevice.upsert({
        where: { ip },
        create: {
          ip,
          status: approvalMode && !isServerIp(ip) ? 'pending' : 'allowed',
          requestCount: p.n, firstSeenAt: p.firstSeen, lastSeenAt: p.lastSeen,
          lastUserName: p.userName || null, lastUserEmail: p.userEmail || null, userAgent: p.ua || null,
        },
        update: {
          requestCount: { increment: p.n }, lastSeenAt: p.lastSeen,
          ...(p.userEmail ? { lastUserName: p.userName, lastUserEmail: p.userEmail } : {}),
          ...(p.ua ? { userAgent: p.ua } : {}),
        },
      }).catch(() => {});
    }
    await reload();
  })().finally(() => { flushing = null; });
  return flushing;
}
setInterval(() => { flush(); }, FLUSH_MS).unref();

// Express middleware on /api, before the login check: notes the PC and
// stops a blocked / not-yet-approved one (the login too).
function deviceGuard(req, res, next) {
  if (Date.now() - loadedAt > RELOAD_MS) reload();
  const ip = normIp(req.ip || req.socket?.remoteAddress);
  req.clientIp = ip;
  note(ip, { ua: req.headers['user-agent'] });
  const access = accessOf(ip);
  if (access === 'allowed') return next();
  return res.status(403).json({
    ok: false,
    code: 'DEVICE_BLOCKED',
    message: access === 'blocked'
      ? `Yeh PC (${ip}) HMS ke liye block hai — Super Admin se rabta karein`
      : `Yeh PC (${ip}) abhi approve nahi hua — Super Admin "Connected PCs" se approve kare`,
  });
}

// ─── MAC addresses from the server's ARP table (same network only) ───────────
let macsAt = 0;
function readArp() {
  return new Promise((resolve) => {
    execFile('arp', ['-a'], { timeout: 4000, windowsHide: true }, (err, stdout) => {
      if (err || !stdout) return resolve(new Map());
      const out = new Map();
      // Windows: "  192.168.1.5     00-11-22-33-44-55     dynamic"
      for (const m of stdout.matchAll(/(\d{1,3}(?:\.\d{1,3}){3})\s+([0-9a-f]{2}(?:-[0-9a-f]{2}){5})/gi)) out.set(m[1], m[2].toUpperCase().replace(/-/g, ':'));
      // macOS / Linux: "? (192.168.1.5) at 0:11:22:33:44:55 on en0"
      for (const m of stdout.matchAll(/\((\d{1,3}(?:\.\d{1,3}){3})\) at ([0-9a-f]{1,2}(?::[0-9a-f]{1,2}){5})/gi)) {
        out.set(m[1], m[2].split(':').map((x) => x.padStart(2, '0')).join(':').toUpperCase());
      }
      resolve(out);
    });
  });
}
async function refreshMacs() {
  if (Date.now() - macsAt < 60 * 1000) return;
  macsAt = Date.now();
  const macs = await readArp();
  if (!macs.size) return;
  const rows = await prisma.hmsDevice.findMany({ select: { id: true, ip: true, macAddress: true } });
  for (const r of rows) {
    const mac = macs.get(r.ip);
    if (mac && mac !== 'FF:FF:FF:FF:FF:FF' && mac !== r.macAddress) {
      await prisma.hmsDevice.update({ where: { id: r.id }, data: { macAddress: mac } }).catch(() => {});
    }
  }
}

// ─── Super Admin page ────────────────────────────────────────────────────────
async function listDevices(myIp) {
  await flush();
  await refreshMacs().catch(() => {});
  const rows = await prisma.hmsDevice.findMany({ orderBy: [{ lastSeenAt: 'desc' }] });
  const now = Date.now();
  return {
    now: new Date(now),
    myIp,
    approvalMode,
    guardOff: String(process.env.DEVICE_GUARD || '').toLowerCase() === 'off',
    serverIps: [...serverIps],
    devices: rows.map((r) => ({
      ...r,
      online: now - new Date(r.lastSeenAt).getTime() < ONLINE_MS,
      isServer: isServerIp(r.ip),
      isMe: r.ip === myIp,
    })),
  };
}

async function updateDevice(id, { name, status, protected: prot, thermalPrinter, normalPrinter } = {}, { myIp, byName } = {}) {
  const d = await prisma.hmsDevice.findUnique({ where: { id: Number(id) } });
  if (!d) throw fail(404, 'PC not found');
  const data = { changedByName: byName || null, changedAt: new Date() };
  if (name !== undefined) data.name = String(name || '').trim() || null;
  if (prot !== undefined) data.protected = Boolean(prot);
  // Direct printing (migration 084) — the server prints this PC's slips here.
  if (thermalPrinter !== undefined) data.thermalPrinter = String(thermalPrinter || '').trim() || null;
  if (normalPrinter !== undefined) data.normalPrinter = String(normalPrinter || '').trim() || null;
  if (status !== undefined) {
    if (!['allowed', 'blocked', 'pending'].includes(status)) throw fail(400, 'Status allowed / blocked hona chahiye');
    if (status !== 'allowed') {
      if (isServerIp(d.ip)) throw fail(400, 'Server PC block nahi ho sakta');
      if (d.ip === myIp) throw fail(400, 'Jis PC pe aap khud kaam kar rahe hain, usay block nahi kar sakte');
      if (data.protected ?? d.protected) throw fail(400, 'Yeh PC protected hai — pehle "Protected" hatayein');
    }
    data.status = status;
  }
  if (data.protected) data.status = 'allowed';
  const saved = await prisma.hmsDevice.update({ where: { id: d.id }, data });
  await reload();
  return saved;
}

async function forgetDevice(id, { myIp } = {}) {
  const d = await prisma.hmsDevice.findUnique({ where: { id: Number(id) } });
  if (!d) throw fail(404, 'PC not found');
  if (d.ip === myIp) throw fail(400, 'Apna hi PC list se nahi hata sakte');
  await prisma.hmsDevice.delete({ where: { id: d.id } });
  await reload();
  return { id: d.id };
}

async function setApprovalMode(on, { myIp, byName } = {}) {
  if (on && myIp) {
    // The PC turning it on stays in.
    await flush();
    await prisma.hmsDevice.upsert({
      where: { ip: myIp },
      create: { ip: myIp, status: 'allowed', changedByName: byName || null, changedAt: new Date() },
      update: { status: 'allowed', changedByName: byName || null, changedAt: new Date() },
    });
  }
  await prisma.hmsSetting.upsert({
    where: { key: 'approvalMode' },
    create: { key: 'approvalMode', value: on ? 'on' : 'off', updatedAt: new Date() },
    update: { value: on ? 'on' : 'off', updatedAt: new Date() },
  });
  await reload();
  return { approvalMode: on };
}

module.exports = { deviceGuard, note, normIp, listDevices, updateDevice, forgetDevice, setApprovalMode, flush };
