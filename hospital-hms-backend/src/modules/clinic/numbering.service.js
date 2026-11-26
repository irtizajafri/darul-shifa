const prisma = require('../../config/db');

// Auto Slip # and Admission # (owner, 2026-11-24; migration 083).
//
// The old software is stopped, so the HMS gives the numbers itself, from one
// counter per series in ClinicNumberCounter:
//   'slip'      — the shared Slip # series (OPD / Emergency / Ambulance /
//                 Antenatal / admission advance / admission receipts / Cash
//                 Pending receipts / OPD balance receipts / provisional bill
//                 lines);
//   'admission' — Admission #.
// A number is taken inside the same database transaction that saves the
// record, with the counter row locked (SELECT … FOR UPDATE): four PCs pressing
// Save at the same moment queue up for a few milliseconds and each gets its
// own number — never the same one twice.
//
// Kept aside per shift: at the shift's first number (or the first screen that
// shows the next number), `reservePerShift` numbers are picked at random among
// the `reserveWindow` free numbers after the next one (slip 4 of 12,
// admission 2 of 6) and the counter skips them. Only the Super Admin uses them — any time, for any
// date. When the next shift starts, kept-aside numbers the counter never
// reached are given back (they become normal numbers again); the ones it
// passed stay kept aside until the Super Admin uses them.
//
// A number typed by hand (only the Super Admin's screens allow it) is saved
// as typed after the usual clash check; if it is a kept-aside number, it is
// marked used — who, when, for what.
//
// The old (legacy) software still issues slips first and skips its own
// numbers one by one during a shift (owner, 2026-11-26). Whoever has
// "Reserved Numbers — reserve" types such a number here (reserveNumbers):
// it is kept aside at once, inside the same counter lock, so no save can take
// it meanwhile. Users with "— use" (and the Super Admin) may then save a slip
// with it. The HMS's own per-shift picks are off (migration 086).

const TX_OPTS = { maxWait: 15000, timeout: 30000 };
const KINDS = ['slip', 'admission'];
const KIND_LABEL = { slip: 'Slip #', admission: 'Admission #' };

const err = (status, message) => Object.assign(new Error(message), { status });
const assertKind = (kind) => { if (!KINDS.includes(kind)) throw err(400, 'Number ki qism sahi nahi'); };
const asInt = (v) => (/^\d{1,9}$/.test(String(v ?? '').trim()) ? Number(String(v).trim()) : null);

// ─── Shifts ──────────────────────────────────────────────────────────────────
// Clinic → Parameters → Shift, in the server's own clock (as
// resolveShiftForTime). Half-open ranges, so the minute a shift starts belongs
// to it: A 09:00–15:00, B 15:00–21:00, C 21:00–09:00. An overnight shift
// belongs to the date it started on.
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function shiftAt(shifts, at) {
  const hhmm = `${pad(at.getHours())}:${pad(at.getMinutes())}`;
  const s = shifts.find((x) => (x.fromTime <= x.toTime
    ? hhmm >= x.fromTime && hhmm < x.toTime
    : hhmm >= x.fromTime || hhmm < x.toTime));
  if (!s) return null;
  const day = new Date(at);
  if (s.fromTime > s.toTime && hhmm < s.toTime) day.setDate(day.getDate() - 1);
  const date = ymd(day);
  return { id: s.id, name: s.name, date, key: `${date}#${s.id}` };
}
const loadShifts = (client) => client.clinicShift.findMany({ orderBy: { id: 'asc' }, select: { id: true, name: true, fromTime: true, toTime: true } });

// ─── Which numbers are already used ─────────────────────────────────────────
// Any record holding the number counts — new-system slips of every kind and
// the old software's rows in Patients List (PatientVisit).
async function usedAmong(client, kind, from, to) {
  const nums = [];
  for (let n = from; n <= to; n++) nums.push(n);
  return usedOf(client, kind, nums);
}
async function usedOf(client, kind, nums) {
  const strs = nums.map(String);
  const used = new Set();
  const add = (rows, key) => rows.forEach((r) => { const n = asInt(r[key]); if (n != null) used.add(n); });
  if (kind === 'slip') {
    const sel = { serialNo: true };
    const inStrs = { serialNo: { in: strs } };
    add(await client.clinicOpdVisit.findMany({ where: inStrs, select: sel }), 'serialNo');
    add(await client.clinicAdmission.findMany({ where: inStrs, select: sel }), 'serialNo');
    add(await client.clinicAdmissionPayment.findMany({ where: inStrs, select: sel }), 'serialNo');
    add(await client.clinicAntenatal.findMany({ where: inStrs, select: sel }), 'serialNo');
    add(await client.clinicProvisionalBillItem.findMany({ where: inStrs, select: sel }), 'serialNo');
    add(await client.clinicPanelOpdBillItem.findMany({ where: inStrs, select: sel }), 'serialNo');
    add(await client.clinicOpdBalancePayment.findMany({ where: inStrs, select: sel }), 'serialNo');
    add(await client.patientVisit.findMany({ where: { serialNo: { in: nums } }, select: sel }), 'serialNo');
  } else {
    add(await client.clinicAdmission.findMany({ where: { admissionNo: { in: strs } }, select: { admissionNo: true } }), 'admissionNo');
    add(await client.patientVisit.findMany({ where: { admitNo: { in: nums } }, select: { admitNo: true } }), 'admitNo');
  }
  return used;
}

// The first `count` numbers from `start` on that are neither used nor in `skip`.
async function freeNumbers(client, kind, start, count, skip = new Set()) {
  const out = [];
  const STEP = 40;
  for (let from = start; out.length < count; from += STEP) {
    if (from - start > 100000) throw err(500, `${KIND_LABEL[kind]}: agla khali number nahi mila`);
    const used = await usedAmong(client, kind, from, from + STEP - 1);
    for (let n = from; n < from + STEP && out.length < count; n++) {
      if (!used.has(n) && !skip.has(n)) out.push(n);
    }
  }
  return out;
}

async function lockCounter(tx, kind) {
  const rows = await tx.$queryRaw`SELECT "kind", "nextValue", "reservePerShift", "reserveWindow", "lastShiftKey" FROM "ClinicNumberCounter" WHERE "kind" = ${kind} FOR UPDATE`;
  if (!rows.length) throw err(500, `${KIND_LABEL[kind]} ka counter nahi mila — migration 083 chalayein`);
  const r = rows[0];
  return { ...r, nextValue: Number(r.nextValue), reservePerShift: Number(r.reservePerShift), reserveWindow: Number(r.reserveWindow) };
}

const freeReservedFrom = async (client, kind, from) => new Set(
  (await client.clinicReservedNumber.findMany({ where: { kind, status: 'free', number: { gte: from } }, select: { number: true } })).map((r) => r.number),
);

// A new shift: give back the earlier shifts' kept-aside numbers the counter
// never reached, then keep this shift's numbers aside. Counter row locked.
async function startShiftIfNew(tx, counter, shift) {
  if (!shift || counter.lastShiftKey === shift.key) return;
  const { kind } = counter;
  await tx.clinicReservedNumber.deleteMany({ where: { kind, status: 'free', number: { gte: counter.nextValue } } });
  const per = Math.max(0, counter.reservePerShift);
  const window = Math.max(per, counter.reserveWindow);
  if (per > 0) {
    // Never the very next number (owner, 2026-11-25: "2888578 se shuru"):
    // the number already on the screens stays the next one given, so the
    // series starts where it was set and doesn't jump at a shift change.
    const pool = (await freeNumbers(tx, kind, counter.nextValue, window + 1)).slice(1);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const picked = pool.slice(0, per).sort((a, b) => a - b);
    if (picked.length) {
      await tx.clinicReservedNumber.createMany({
        data: picked.map((number) => ({ kind, number, shiftDate: shift.date, shiftId: shift.id, shiftName: shift.name })),
        skipDuplicates: true,
      });
    }
  }
  await tx.clinicNumberCounter.update({ where: { kind }, data: { lastShiftKey: shift.key } });
}

// Takes the next number. Must run inside a transaction (tx).
async function draw(tx, kind) {
  const counter = await lockCounter(tx, kind);
  const shift = shiftAt(await loadShifts(tx), new Date());
  await startShiftIfNew(tx, counter, shift);
  const [n] = await freeNumbers(tx, kind, counter.nextValue, 1, await freeReservedFrom(tx, kind, counter.nextValue));
  await tx.clinicNumberCounter.update({ where: { kind }, data: { nextValue: n + 1 } });
  return n;
}

// The number the next save will get — shown on the screens (read-only).
// Nothing is taken; it also keeps this shift's numbers aside if that hasn't
// happened yet, so the number shown already skips them.
async function peek(kind) {
  assertKind(kind);
  let counter = await prisma.clinicNumberCounter.findUnique({ where: { kind } });
  if (!counter) throw err(500, `${KIND_LABEL[kind]} ka counter nahi mila — migration 083 chalayein`);
  const shift = shiftAt(await loadShifts(prisma), new Date());
  if (shift && counter.lastShiftKey !== shift.key) {
    await prisma.$transaction(async (tx) => startShiftIfNew(tx, await lockCounter(tx, kind), shift), TX_OPTS);
    counter = await prisma.clinicNumberCounter.findUnique({ where: { kind } });
  }
  const [n] = await freeNumbers(prisma, kind, counter.nextValue, 1, await freeReservedFrom(prisma, kind, counter.nextValue));
  return n;
}

// Saves a record with its number(s). slots: [{ kind, typed }] — a blank
// `typed` takes the next number from the counter; a typed one is kept as is
// (the caller has checked it for clashes). create(nums, tx) saves the record
// with tx and nums.slip / nums.admission (strings).
// actor: { isSuperAdmin, name } of the logged-in user; usedFor: shown on the
// Reserved Numbers page.
async function withNumbers(slots, { actor = null, usedFor = '' } = {}, create) {
  const list = slots.map((s) => ({ kind: s.kind, typed: String(s.typed ?? '').trim(), reserved: null }));
  for (const s of list) {
    assertKind(s.kind);
    const n = s.typed ? asInt(s.typed) : null;
    if (n == null) continue;
    const row = await prisma.clinicReservedNumber.findUnique({ where: { kind_number: { kind: s.kind, number: n } } });
    if (row?.status !== 'free') continue;
    if (!(actor?.isSuperAdmin || actor?.canUseReserved)) throw err(403, `${KIND_LABEL[s.kind]} ${n} reserved hai — is se slip banane ki ijazat nahi`);
    s.reserved = row;
  }
  return prisma.$transaction(async (tx) => {
    const nums = {};
    // Same order every time (admission before slip), so two saves never wait on each other's lock.
    for (const s of [...list].sort((a, b) => a.kind.localeCompare(b.kind))) {
      nums[s.kind] = s.typed || String(await draw(tx, s.kind));
    }
    const record = await create(nums, tx);
    for (const s of list) {
      if (!s.reserved) continue;
      const { count } = await tx.clinicReservedNumber.updateMany({
        where: { id: s.reserved.id, status: 'free' },
        data: { status: 'used', usedAt: new Date(), usedByName: actor?.name || 'Super Admin', usedFor: usedFor || null },
      });
      if (!count) throw err(409, `${KIND_LABEL[s.kind]} ${s.typed} abhi abhi istemal ho gaya — doosra number chunein`);
    }
    return record;
  }, TX_OPTS);
}

// A number on its own (for records saved elsewhere in one go).
const takeNumber = (kind) => { assertKind(kind); return prisma.$transaction((tx) => draw(tx, kind), TX_OPTS).then(String); };

// ─── Super Admin: Reserved Numbers page / picker, counter settings ──────────
// Free numbers of the back date's shift come first (then that date's), so
// the picker on a back-dated slip opens on the right ones.
async function listReserved({ kind, status = 'free', from, to, backDate } = {}) {
  const where = {};
  if (kind) { assertKind(kind); where.kind = kind; }
  if (status && status !== 'all') where.status = status;
  if (from || to) where.shiftDate = { ...(from ? { gte: String(from) } : {}), ...(to ? { lte: String(to) } : {}) };
  const rows = await prisma.clinicReservedNumber.findMany({ where, orderBy: [{ shiftDate: 'desc' }, { number: 'asc' }], take: 2000 });
  let match = null;
  if (backDate) {
    const d = new Date(backDate);
    if (!Number.isNaN(d.getTime())) match = shiftAt(await loadShifts(prisma), d);
  }
  const rank = (r) => (match && r.shiftDate === match.date ? (r.shiftId === match.id ? 0 : 1) : 2);
  if (match) rows.sort((a, b) => rank(a) - rank(b));
  return { rows: rows.map((r) => ({ ...r, matchesBackDate: rank(r) === 0 })), backDateShift: match };
}

async function getCounters() {
  const rows = await prisma.clinicNumberCounter.findMany({ orderBy: { kind: 'desc' } });
  return Promise.all(rows.map(async (r) => ({ ...r, next: await peek(r.kind) })));
}

async function updateCounter(kind, { nextValue, reservePerShift, reserveWindow } = {}, actor = null) {
  assertKind(kind);
  const data = {};
  if (nextValue !== undefined && nextValue !== '') {
    const n = asInt(nextValue);
    if (!n) throw err(400, 'Agla number sahi likhein');
    data.nextValue = n;
  }
  const per = reservePerShift === undefined || reservePerShift === '' ? undefined : asInt(reservePerShift);
  const win = reserveWindow === undefined || reserveWindow === '' ? undefined : asInt(reserveWindow);
  if (reservePerShift !== undefined && reservePerShift !== '' && per == null) throw err(400, 'Har shift me kitne number — sahi likhein');
  if (reserveWindow !== undefined && reserveWindow !== '' && win == null) throw err(400, 'Pehle kitne numbers me se — sahi likhein');
  return prisma.$transaction(async (tx) => {
    const cur = await lockCounter(tx, kind);
    const p = per ?? cur.reservePerShift;
    const w = win ?? cur.reserveWindow;
    if (w > 200) throw err(400, 'Pehle 200 se zyada numbers me se nahi');
    if (p > w) throw err(400, 'Reserve numbers ki ginti "pehle kitne numbers" se zyada nahi ho sakti');
    if (per !== undefined) data.reservePerShift = p;
    if (win !== undefined) data.reserveWindow = w;
    return tx.clinicNumberCounter.update({ where: { kind }, data: { ...data, updatedAt: new Date(), updatedByName: actor?.name || null } });
  }, TX_OPTS);
}

// Who already holds a number — for the message when it can't be reserved.
async function holderOf(client, kind, n) {
  const str = String(n);
  if (kind === 'admission') {
    const a = await client.clinicAdmission.findFirst({ where: { admissionNo: str }, select: { patientName: true } });
    if (a) return `Admission — ${a.patientName}`;
    const pv = await client.patientVisit.findFirst({ where: { admitNo: n }, select: { patientName: true } });
    return pv ? `Patients List (Excel) — ${pv.patientName}` : 'kisi record pe';
  }
  const checks = [
    async () => { const r = await client.clinicOpdVisit.findFirst({ where: { serialNo: str }, select: { patientName: true, department: true } }); return r && `${r.department || 'OPD'} slip — ${r.patientName}`; },
    async () => { const r = await client.clinicAdmission.findFirst({ where: { serialNo: str }, select: { admissionNo: true, patientName: true } }); return r && `Admission ${r.admissionNo} — ${r.patientName}`; },
    async () => { const r = await client.clinicAdmissionPayment.findFirst({ where: { serialNo: str }, select: { admission: { select: { admissionNo: true, patientName: true } } } }); return r && `Admission ${r.admission?.admissionNo} receipt — ${r.admission?.patientName}`; },
    async () => { const r = await client.clinicAntenatal.findFirst({ where: { serialNo: str }, select: { patientName: true } }); return r && `Antenatal — ${r.patientName}`; },
    async () => { const r = await client.clinicOpdBalancePayment.findFirst({ where: { serialNo: str }, select: { visit: { select: { serialNo: true, patientName: true } } } }); return r && `Balance receipt of slip ${r.visit?.serialNo} — ${r.visit?.patientName}`; },
    async () => { const r = await client.clinicProvisionalBillItem.findFirst({ where: { serialNo: str }, select: { id: true } }); return r && 'Provisional Bill line'; },
    async () => { const r = await client.clinicPanelOpdBillItem.findFirst({ where: { serialNo: str }, select: { id: true } }); return r && 'Panel OPD Bill line'; },
    async () => { const r = await client.patientVisit.findFirst({ where: { serialNo: n }, select: { patientName: true } }); return r && `Patients List (Excel) — ${r.patientName}`; },
  ];
  for (const c of checks) { const found = await c(); if (found) return found; }
  return 'kisi record pe';
}

// Keep numbers aside at once (the old software skipped them). numbers: one or
// more, as a list or "2888612, 2888615". Each comes back as reserved /
// already (reserved before) / taken (a record has it — who).
async function reserveNumbers(kind, numbers, actor = null) {
  assertKind(kind);
  const raw = Array.isArray(numbers) ? numbers : String(numbers ?? '').split(/[\s,;]+/);
  const typed = raw.map((v) => String(v).trim()).filter(Boolean);
  const bad = typed.filter((v) => asInt(v) == null);
  if (bad.length) throw err(400, `Sahi number likhein: ${bad.join(', ')}`);
  const nums = [...new Set(typed.map(asInt))].sort((a, b) => a - b);
  if (!nums.length) throw err(400, 'Number likhein');
  if (nums.length > 50) throw err(400, 'Ek dafa me 50 se zyada nahi');
  return prisma.$transaction(async (tx) => {
    await lockCounter(tx, kind); // no number can be given while these are kept aside
    const shift = shiftAt(await loadShifts(tx), new Date());
    const before = new Map((await tx.clinicReservedNumber.findMany({ where: { kind, number: { in: nums } } })).map((r) => [r.number, r]));
    const used = await usedOf(tx, kind, nums);
    const results = [];
    for (const n of nums) {
      const r = before.get(n);
      if (r) { results.push({ number: n, status: r.status === 'used' ? 'used' : 'already', note: r.status === 'used' ? (r.usedFor || 'istemal ho chuka') : 'pehle se reserved' }); continue; }
      if (used.has(n)) { results.push({ number: n, status: 'taken', note: await holderOf(tx, kind, n) }); continue; }
      await tx.clinicReservedNumber.create({
        data: {
          kind, number: n,
          shiftDate: shift?.date || ymd(new Date()), shiftId: shift?.id || null, shiftName: shift?.name || null,
          source: 'manual', reservedByName: actor?.name || null,
        },
      });
      results.push({ number: n, status: 'reserved' });
    }
    return { kind, results };
  }, TX_OPTS);
}

// A number reserved by mistake goes back to normal — only while unused.
async function releaseReserved(id) {
  const row = await prisma.clinicReservedNumber.findUnique({ where: { id: Number(id) || 0 } });
  if (!row) throw err(404, 'Reserved number nahi mila');
  if (row.status !== 'free') throw err(400, `${KIND_LABEL[row.kind]} ${row.number} istemal ho chuka — wapas nahi ho sakta`);
  await prisma.clinicReservedNumber.deleteMany({ where: { id: row.id, status: 'free' } });
  return { id: row.id, number: row.number, kind: row.kind };
}

module.exports = { withNumbers, takeNumber, peek, listReserved, getCounters, updateCounter, reserveNumbers, releaseReserved, shiftAt, KINDS };
