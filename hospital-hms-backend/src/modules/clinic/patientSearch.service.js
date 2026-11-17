const prisma = require('../../config/db');
const { resolveDepartment, departmentKey } = require('./clinic.service');

// Clinic → Inquiries → Patient Search (owner, 2026-11-17), after the old
// system's screen: Patient Name, Visit Date from–to, Phone #, Sex, Department,
// Sub Dep. and Patient Type. Looks in every place a visit lives:
//   - Clinic slips (ClinicOpdVisit, every department)
//   - Antenatal registrations (ClinicAntenatal)
//   - Admission files (ClinicAdmission)
//   - Excel Patients List rows (PatientVisit) — these carry no phone, sex,
//     age or MR #, so a Phone or Sex filter leaves them out.
// Cancelled slips are left out. Read-only.

const DAY_MS = 24 * 3600 * 1000;
const isIsoDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
const digits = (s) => String(s || '').replace(/\D/g, '');
const lower = (s) => String(s || '').trim().toLowerCase();

// Hospital business day (08:00 → 07:59 PKT, named for its start). A file
// imported with only a date is stored as midnight UTC: that date is its day.
function bizDay(ts) {
  const t = new Date(ts);
  if (!t.getUTCHours() && !t.getUTCMinutes() && !t.getUTCSeconds() && !t.getUTCMilliseconds()) return t.toISOString().slice(0, 10);
  return new Date(t.getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}
// An Excel row: its calendar date + typed PKT time; before 08:00 is the
// previous day's.
function excelBizDay(v) {
  const date = new Date(v.visitDate).toISOString().slice(0, 10);
  const [h, m] = String(v.visitTime || '12:00').slice(0, 5).split(':').map((n) => Number(n) || 0);
  return h * 60 + m >= 480 ? date : addDays(date, -1);
}
// Sort key for an Excel row: its date + typed time as PKT.
function excelMs(v) {
  const date = new Date(v.visitDate).toISOString().slice(0, 10);
  const [h, m] = String(v.visitTime || '00:00').slice(0, 5).split(':').map((n) => Number(n) || 0);
  return Date.parse(`${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+05:00`);
}

// The four Patient Type choices, as stored across the tables (OPD uses
// "cash", Admission/Antenatal "private"; Excel has "Cash", "C Card", …).
const PATIENT_TYPES = {
  cash: ['cash', 'private', 'cc', 'c card', 'credit card', 'jazzcash', 'jazz cash', 'easypaisa'],
  panel: ['panel'],
  staff: ['staff'],
  complementary: ['complementary', 'complem.', 'complimentary'],
};
const TYPE_LABEL = { cash: 'Cash', panel: 'Panel', staff: 'Staff', complementary: 'Complementary' };
const typeOf = (raw) => Object.keys(PATIENT_TYPES).find((k) => PATIENT_TYPES[k].includes(lower(raw))) || null;
const typeLabel = (raw) => TYPE_LABEL[typeOf(raw)] || (raw ? String(raw) : '');
const CANCELLED = ['canceled', 'cancelled'];

async function searchPatients({ name, fromDate, toDate, phone, sex, departmentId, subDeptId, patientType } = {}) {
  if (!isIsoDate(fromDate) || !isIsoDate(toDate)) throw Object.assign(new Error('Select the visit dates'), { status: 400 });
  if (fromDate > toDate) throw Object.assign(new Error('From date is after To date'), { status: 400 });
  const term = String(name || '').trim();
  const phoneDigits = digits(phone);
  const gender = ['male', 'female'].includes(lower(sex)) ? lower(sex) : null;
  const wantType = PATIENT_TYPES[lower(patientType)] ? lower(patientType) : null; // null = all

  const [dept, subDept] = await Promise.all([
    departmentId ? prisma.clinicDepartment.findUnique({ where: { id: Number(departmentId) }, select: { id: true, name: true } }) : null,
    subDeptId ? prisma.clinicSubDepartment.findUnique({ where: { id: Number(subDeptId) }, select: { id: true, name: true } }) : null,
  ]);
  if (departmentId && !dept) throw Object.assign(new Error('Department not found'), { status: 400 });
  if (subDeptId && !subDept) throw Object.assign(new Error('Sub department not found'), { status: 400 });

  // Fetch a day either side, then keep the business days asked for.
  const created = { gte: new Date(`${addDays(fromDate, -1)}T00:00:00Z`), lt: new Date(`${addDays(toDate, 2)}T00:00:00Z`) };
  const inRange = (day) => day >= fromDate && day <= toDate;
  const nameWhere = term ? { patientName: { contains: term, mode: 'insensitive' } } : {};

  const [visits, antenatals, admissions, excel, doctors] = await Promise.all([
    prisma.clinicOpdVisit.findMany({
      where: {
        createdAt: created, ...nameWhere, status: { notIn: CANCELLED },
        ...(gender ? { gender } : {}),
        ...(subDept ? { doctors: { some: { subDeptId: subDept.id } } } : {}),
      },
      select: {
        id: true, serialNo: true, mrNo: true, patientType: true, patientName: true, age: true, ageMonths: true, ageDays: true,
        gender: true, phoneNo: true, department: true, paymentType: true, totalAmount: true, admitNo: true, createdAt: true,
        doctors: { orderBy: { id: 'asc' }, select: { subDept: { select: { name: true } }, doctor: { select: { name: true } } } },
      },
    }),
    // Antenatal: female only, and not a sub-department line.
    gender === 'male' || subDept ? [] : prisma.clinicAntenatal.findMany({
      where: { createdAt: created, ...nameWhere, status: { notIn: CANCELLED } },
      select: { id: true, serialNo: true, mrNo: true, antenatalNo: true, patientName: true, age: true, phoneNo: true, paymentType: true, amount: true, underTreatmentId: true, createdAt: true },
    }),
    subDept ? [] : prisma.clinicAdmission.findMany({
      where: { createdAt: created, ...nameWhere, status: { notIn: CANCELLED }, ...(gender ? { gender } : {}) },
      select: {
        id: true, admissionNo: true, serialNo: true, mrNo: true, patientTitle: true, patientName: true, ageYears: true, ageMonths: true, ageDays: true,
        gender: true, phoneNo: true, patientCategory: true, advancePayment: true, consultantId: true, createdAt: true,
      },
    }),
    // Excel rows have no phone or sex to match.
    phoneDigits || gender ? [] : prisma.patientVisit.findMany({
      where: {
        visitDate: { gte: new Date(`${fromDate}T00:00:00Z`), lte: new Date(`${addDays(toDate, 1)}T00:00:00Z`) },
        ...nameWhere,
        NOT: { paymentType: { in: ['CANCELED', 'canceled', 'Cancelled', 'cancelled'] } },
      },
      select: {
        id: true, serialNo: true, admitNo: true, visitDate: true, visitTime: true, patientName: true, department: true,
        subDepartment: true, doctor: true, paymentType: true, received: true, balance: true,
      },
    }),
    prisma.clinicDoctor.findMany({ select: { id: true, name: true } }),
  ]);
  const doctorName = new Map(doctors.map((d) => [d.id, d.name]));

  // Department match, by the same name rules the rest of Clinic uses
  // (case/spacing/"and" ignored, plus the alias list).
  const deptCache = new Map();
  const deptIdOf = async (text) => {
    const k = departmentKey(text);
    if (!deptCache.has(k)) deptCache.set(k, (await resolveDepartment(text))?.id ?? null);
    return deptCache.get(k);
  };
  const deptMatches = async (text) => !dept || (await deptIdOf(text)) === dept.id;
  // An Excel row whose department spelling isn't known ("LABORATOTY") still
  // matches when its test is one of the chosen department's sub-departments.
  const deptSubKeys = dept
    ? new Set((await prisma.clinicSubDepartment.findMany({ where: { departmentId: dept.id }, select: { name: true } })).map((s) => departmentKey(s.name)))
    : null;
  const excelDeptMatches = async (v) => !dept || (await deptIdOf(v.department)) === dept.id
    || ((await deptIdOf(v.department)) == null && deptSubKeys.has(departmentKey(v.subDepartment)));
  const typeMatches = (raw) => !wantType || typeOf(raw) === wantType;
  const phoneMatches = (p) => !phoneDigits || digits(p).includes(phoneDigits);
  const ageText = (y, mo, d) => [y ? `${y}Y` : '', mo ? `${mo}M` : '', d ? `${d}D` : ''].filter(Boolean).join(' ');

  const rows = [];
  for (const v of visits) {
    if (!inRange(bizDay(v.createdAt)) || !typeMatches(v.paymentType) || !phoneMatches(v.phoneNo)) continue;
    if (lower(v.paymentType) === 'canceled' || !(await deptMatches(v.department))) continue;
    rows.push({
      key: `opd-${v.id}`, source: 'Slip', at: v.createdAt, slipNo: v.serialNo, admitNo: v.admitNo || null, mrNo: v.mrNo ?? null,
      patientName: `${v.patientType || ''} ${v.patientName || ''}`.trim(), age: ageText(v.age, v.ageMonths, v.ageDays), gender: v.gender || '',
      phone: v.phoneNo || '', department: v.department || '',
      subDept: [...new Set(v.doctors.map((d) => d.subDept?.name).filter(Boolean))].join(', '),
      doctor: [...new Set(v.doctors.map((d) => d.doctor?.name).filter(Boolean))].join(', '),
      patientType: typeLabel(v.paymentType), amount: Number(v.totalAmount) || 0,
    });
  }
  for (const a of antenatals) {
    if (!inRange(bizDay(a.createdAt)) || !typeMatches(a.paymentType) || !phoneMatches(a.phoneNo)) continue;
    if (!(await deptMatches('Antenatal'))) continue;
    rows.push({
      key: `ant-${a.id}`, source: 'Antenatal', at: a.createdAt, slipNo: a.serialNo || a.antenatalNo || '', admitNo: null, mrNo: a.mrNo || null,
      patientName: a.patientName || '', age: a.age ? `${a.age}Y` : '', gender: 'female', phone: a.phoneNo || '',
      department: 'Antenatal', subDept: '', doctor: doctorName.get(a.underTreatmentId) || '',
      patientType: typeLabel(a.paymentType), amount: Number(a.amount) || 0,
    });
  }
  for (const a of admissions) {
    if (!inRange(bizDay(a.createdAt)) || !typeMatches(a.patientCategory) || !phoneMatches(a.phoneNo)) continue;
    if (!(await deptMatches('Admission'))) continue;
    rows.push({
      key: `adm-${a.id}`, source: 'Admission', at: a.createdAt, slipNo: a.serialNo || '', admitNo: a.admissionNo, mrNo: a.mrNo ?? null,
      patientName: `${a.patientTitle || ''} ${a.patientName || ''}`.trim(), age: ageText(a.ageYears, a.ageMonths, a.ageDays), gender: a.gender || '',
      phone: a.phoneNo || '', department: 'Admission', subDept: '', doctor: doctorName.get(a.consultantId) || '',
      patientType: typeLabel(a.patientCategory), amount: Number(a.advancePayment) || 0,
    });
  }
  // Excel: one row per slip (its lines share Slip #, date and name).
  const excelGroups = new Map();
  for (const v of excel) {
    if (!inRange(excelBizDay(v)) || !typeMatches(v.paymentType)) continue;
    if (subDept && departmentKey(v.subDepartment) !== departmentKey(subDept.name)) continue;
    if (!(await excelDeptMatches(v))) continue;
    const key = v.serialNo != null ? `${v.serialNo}|${new Date(v.visitDate).toISOString().slice(0, 10)}|${lower(v.patientName)}` : `id${v.id}`;
    if (!excelGroups.has(key)) excelGroups.set(key, { first: v, lines: [] });
    excelGroups.get(key).lines.push(v);
  }
  for (const [k, g] of excelGroups) {
    const v = g.first;
    rows.push({
      key: `pv-${k}`, source: 'Patients List', at: new Date(excelMs(v)), slipNo: v.serialNo != null ? String(v.serialNo) : '', admitNo: v.admitNo ?? null, mrNo: null,
      patientName: String(v.patientName || '').toUpperCase(), age: '', gender: '', phone: '',
      department: [...new Set(g.lines.map((l) => l.department).filter(Boolean))].join(', '),
      subDept: [...new Set(g.lines.map((l) => l.subDepartment).filter(Boolean))].join(', '),
      doctor: [...new Set(g.lines.map((l) => l.doctor).filter(Boolean))].join(', '),
      patientType: typeLabel(v.paymentType),
      amount: g.lines.reduce((s, l) => s + (Number(l.received) || 0) + (Number(l.balance) || 0), 0),
    });
  }

  rows.sort((a, b) => new Date(a.at) - new Date(b.at));
  return {
    rows,
    total: { patients: rows.length, amount: rows.reduce((s, r) => s + r.amount, 0) },
    filters: { name: term, fromDate, toDate, phone: phoneDigits, sex: gender || 'both', department: dept?.name || null, subDept: subDept?.name || null, patientType: wantType ? TYPE_LABEL[wantType] : 'All' },
  };
}

module.exports = { searchPatients };
