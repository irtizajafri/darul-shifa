const prisma = require('../../config/db');

// ─── Department ───────────────────────────────────────────────────────────────

async function getAllDepartments() {
  return prisma.clinicDepartment.findMany({ orderBy: { name: 'asc' } });
}

async function createDepartment({ name }) {
  const count = await prisma.clinicDepartment.count();
  const code = String(count + 1).padStart(2, '0');
  return prisma.clinicDepartment.create({ data: { code, name: name.trim() } });
}

async function updateDepartment(id, { name }) {
  return prisma.clinicDepartment.update({
    where: { id: Number(id) },
    data: { name: name.trim() },
  });
}

async function deleteDepartment(id) {
  return prisma.clinicDepartment.delete({ where: { id: Number(id) } });
}

// ─── Sub Department ───────────────────────────────────────────────────────────

async function getAllSubDepartments() {
  return prisma.clinicSubDepartment.findMany({
    include: { department: { select: { id: true, name: true } } },
    orderBy: [{ department: { name: 'asc' } }, { name: 'asc' }],
  });
}

async function createSubDepartment({ name, departmentId }) {
  const dept = await prisma.clinicDepartment.findUnique({ where: { id: Number(departmentId) } });
  if (!dept) throw Object.assign(new Error('Department not found'), { status: 404 });
  const count = await prisma.clinicSubDepartment.count({ where: { departmentId: Number(departmentId) } });
  const code = dept.code + String(count + 1).padStart(2, '0');
  return prisma.clinicSubDepartment.create({
    data: { code, name: name.trim(), departmentId: Number(departmentId) },
    include: { department: { select: { id: true, name: true } } },
  });
}

async function updateSubDepartment(id, { name, departmentId }) {
  return prisma.clinicSubDepartment.update({
    where: { id: Number(id) },
    data: { name: name.trim(), departmentId: Number(departmentId) },
    include: { department: { select: { id: true, name: true } } },
  });
}

async function deleteSubDepartment(id) {
  return prisma.clinicSubDepartment.delete({ where: { id: Number(id) } });
}

// ─── Surgery Type ─────────────────────────────────────────────────────────────

async function getAllSurgeryTypes() {
  return prisma.clinicSurgeryType.findMany({ orderBy: { code: 'asc' } });
}

async function createSurgeryType({ name }) {
  const count = await prisma.clinicSurgeryType.count();
  const code = `SU${String(count + 1).padStart(3, '0')}`;
  return prisma.clinicSurgeryType.create({ data: { code, name: name.trim() } });
}

async function updateSurgeryType(id, { name }) {
  return prisma.clinicSurgeryType.update({
    where: { id: Number(id) },
    data: { name: name.trim() },
  });
}

async function deleteSurgeryType(id) {
  return prisma.clinicSurgeryType.delete({ where: { id: Number(id) } });
}

// ─── Symptom ───────────────────────────────────────────────────────────────────

async function getAllSymptoms() {
  return prisma.clinicSymptom.findMany({ orderBy: { code: 'asc' } });
}

async function createSymptom({ name }) {
  const count = await prisma.clinicSymptom.count();
  const code = `SY${String(count + 1).padStart(3, '0')}`;
  return prisma.clinicSymptom.create({ data: { code, name: name.trim() } });
}

async function updateSymptom(id, { name }) {
  return prisma.clinicSymptom.update({
    where: { id: Number(id) },
    data: { name: name.trim() },
  });
}

async function deleteSymptom(id) {
  return prisma.clinicSymptom.delete({ where: { id: Number(id) } });
}

// ─── Disease ───────────────────────────────────────────────────────────────────

async function getAllDiseases() {
  return prisma.clinicDisease.findMany({ orderBy: { code: 'asc' } });
}

async function createDisease({ name }) {
  const count = await prisma.clinicDisease.count();
  const code = `DI${String(count + 1).padStart(3, '0')}`;
  return prisma.clinicDisease.create({ data: { code, name: name.trim() } });
}

async function updateDisease(id, { name }) {
  return prisma.clinicDisease.update({
    where: { id: Number(id) },
    data: { name: name.trim() },
  });
}

async function deleteDisease(id) {
  return prisma.clinicDisease.delete({ where: { id: Number(id) } });
}

// ─── Document Type ──────────────────────────────────────────────────────────────

async function getAllDocumentTypes() {
  return prisma.clinicDocumentType.findMany({ orderBy: { code: 'asc' } });
}

async function createDocumentType({ name }) {
  const count = await prisma.clinicDocumentType.count();
  const code = `DT${String(count + 1).padStart(3, '0')}`;
  return prisma.clinicDocumentType.create({ data: { code, name: name.trim() } });
}

async function updateDocumentType(id, { name }) {
  return prisma.clinicDocumentType.update({
    where: { id: Number(id) },
    data: { name: name.trim() },
  });
}

async function deleteDocumentType(id) {
  return prisma.clinicDocumentType.delete({ where: { id: Number(id) } });
}

// ─── Discharge Type ─────────────────────────────────────────────────────────────

async function getAllDischargeTypes() {
  return prisma.clinicDischargeType.findMany({ orderBy: { code: 'asc' } });
}

async function createDischargeType({ name }) {
  const count = await prisma.clinicDischargeType.count();
  const code = `DC${String(count + 1).padStart(3, '0')}`;
  return prisma.clinicDischargeType.create({ data: { code, name: name.trim() } });
}

async function updateDischargeType(id, { name }) {
  return prisma.clinicDischargeType.update({
    where: { id: Number(id) },
    data: { name: name.trim() },
  });
}

async function deleteDischargeType(id) {
  return prisma.clinicDischargeType.delete({ where: { id: Number(id) } });
}

// ─── Staff Category ───────────────────────────────────────────────────────────

async function getAllStaffCategories() {
  return prisma.clinicStaffCategory.findMany({ orderBy: { name: 'asc' } });
}

async function createStaffCategory({ name }) {
  return prisma.clinicStaffCategory.create({ data: { name: name.trim() } });
}

async function updateStaffCategory(id, { name }) {
  return prisma.clinicStaffCategory.update({
    where: { id: Number(id) },
    data: { name: name.trim() },
  });
}

async function deleteStaffCategory(id) {
  return prisma.clinicStaffCategory.delete({ where: { id: Number(id) } });
}

// ─── Doctor ───────────────────────────────────────────────────────────────────

const DOCTOR_INCLUDE = {
  staffCategory: { select: { id: true, name: true } },
  subDepts: {
    include: {
      subDept: {
        include: { department: { select: { id: true, name: true } } },
      },
    },
    orderBy: { id: 'asc' },
  },
};

// minimal=true skips the nested subDepts/rates tree — used by dropdown-only screens
// (Death Certificate, Revenue Dashboard filters, etc.) that just need id/code/name.
// Default (full) behavior is unchanged for screens that edit doctor rates.
async function getAllDoctors({ minimal } = {}) {
  if (minimal) {
    return prisma.clinicDoctor.findMany({
      select: { id: true, code: true, name: true, status: true },
      orderBy: { name: 'asc' },
    });
  }
  return prisma.clinicDoctor.findMany({
    include: DOCTOR_INCLUDE,
    orderBy: { name: 'asc' },
  });
}

async function getDoctorById(id) {
  return prisma.clinicDoctor.findUnique({
    where: { id: Number(id) },
    include: DOCTOR_INCLUDE,
  });
}

function mapSubDept(s) {
  return {
    subDeptId: Number(s.subDeptId),
    fromTime: s.fromTime || null,
    toTime: s.toTime || null,
    normalCharges: Number(s.normalCharges) || 0,
    oddCharges: Number(s.oddCharges) || 0,
    paymentType: s.paymentType || 'amount',
    normalFees: Number(s.normalFees) || 0,
    oddFees: Number(s.oddFees) || 0,
    onCall: Boolean(s.onCall),
    consultantDays: s.consultantDays || [],
  };
}

async function createDoctor({ code, name, speciality, qualification, staffCategoryId, status, consultantDays, subDepts = [] }) {
  return prisma.clinicDoctor.create({
    data: {
      code: code.trim(),
      name: name.trim(),
      speciality: speciality?.trim() || null,
      qualification: qualification?.trim() || null,
      staffCategoryId: staffCategoryId ? Number(staffCategoryId) : null,
      status: status || 'active',
      consultantDays: consultantDays || [],
      subDepts: { create: subDepts.map(mapSubDept) },
    },
    include: DOCTOR_INCLUDE,
  });
}

async function updateDoctor(id, { code, name, speciality, qualification, staffCategoryId, status, consultantDays, subDepts = [] }) {
  return prisma.$transaction(async (tx) => {
    await tx.clinicDoctorSubDept.deleteMany({ where: { doctorId: Number(id) } });
    return tx.clinicDoctor.update({
      where: { id: Number(id) },
      data: {
        code: code.trim(),
        name: name.trim(),
        speciality: speciality?.trim() || null,
        qualification: qualification?.trim() || null,
        staffCategoryId: staffCategoryId ? Number(staffCategoryId) : null,
        status: status || 'active',
        consultantDays: consultantDays || [],
        subDepts: { create: subDepts.map(mapSubDept) },
      },
      include: DOCTOR_INCLUDE,
    });
  });
}

async function deleteDoctor(id) {
  return prisma.clinicDoctor.delete({ where: { id: Number(id) } });
}

// ─── OPD ─────────────────────────────────────────────────────────────────────

const SUBDEPT_INCLUDE = {
  doctor: { select: { id: true, code: true, name: true, consultantDays: true, status: true } },
  subDept: {
    include: { department: { select: { id: true, name: true } } },
  },
};

async function getAvailableDoctors({ day, time, onCall, departmentName }) {
  const where = { doctor: { status: 'active' } };
  if (departmentName) {
    // Department ko NORMALIZED tareeqe se match karo (case, spaces, punctuation ignore).
    // Isse "Blood Bank" ↔ "BLOOD BANK", "Dental OPD" ↔ "DENTAL OPD" jaise minor farak khud
    // handle ho jaate hain — har baar exact naam match ki zaroorat nahi (kam breakage).
    const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const target = norm(departmentName);
    const depts = await prisma.clinicDepartment.findMany({ select: { id: true, name: true } });
    const ids = depts.filter((d) => norm(d.name) === target).map((d) => d.id);
    if (ids.length === 0) return [];
    where.subDept = { departmentId: { in: ids } };
  }
  const rows = await prisma.clinicDoctorSubDept.findMany({
    where,
    include: SUBDEPT_INCLUDE,
    orderBy: [{ doctor: { name: 'asc' } }],
  });

  if (onCall) return rows;

  return rows.filter(r => {
    const days = r.consultantDays?.length > 0 ? r.consultantDays : (r.doctor.consultantDays || []);
    if (days.length > 0 && !days.includes(day)) return false;
    if (!r.fromTime || !r.toTime) return true;
    return time >= r.fromTime && time <= r.toTime;
  });
}

async function getNextMrNo() {
  const last = await prisma.clinicOpdVisit.findFirst({ orderBy: { mrNo: 'desc' }, select: { mrNo: true } });
  return ((last?.mrNo || 0) + 1);
}

// Serial # sequence is shared across ClinicOpdVisit (General/Emergency/Clinic OPD)
// and ClinicAdmission — both draw from the same running number so Admission and
// OPD slips never collide, even though they live in separate tables.
async function getNextSerialNo() {
  const [lastOpd, lastAdm, lastAdmPay] = await Promise.all([
    prisma.clinicOpdVisit.findFirst({ orderBy: { id: 'desc' }, select: { serialNo: true } }),
    prisma.clinicAdmission.findFirst({ where: { serialNo: { not: null } }, orderBy: { id: 'desc' }, select: { serialNo: true } }),
    prisma.clinicAdmissionPayment.findFirst({ orderBy: { id: 'desc' }, select: { serialNo: true } }),
  ]);
  const BASE = 2826016;
  const lastOpdNum    = lastOpd    ? parseInt(lastOpd.serialNo, 10)    || 0 : 0;
  const lastAdmNum     = lastAdm    ? parseInt(lastAdm.serialNo, 10)    || 0 : 0;
  const lastAdmPayNum = lastAdmPay ? parseInt(lastAdmPay.serialNo, 10) || 0 : 0;
  const n = Math.max(lastOpdNum + 1, lastAdmNum + 1, lastAdmPayNum + 1, BASE);
  return String(n);
}

async function searchEmployees(q) {
  const term = (q || '').trim();
  if (!term) return [];
  return prisma.employee.findMany({
    where: {
      OR: [
        { firstName: { contains: term, mode: 'insensitive' } },
        { lastName: { contains: term, mode: 'insensitive' } },
        { empCode: { contains: term, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true, empCode: true, firstName: true, middleName: true, lastName: true,
      phone: true, dob: true,
      dependents: { select: { id: true, code: true, name: true, relation: true, dob: true, gender: true }, orderBy: { id: 'asc' } },
    },
    take: 20,
  });
}

async function createOpdVisit({
  mrNo, serialNo, patientType, patientName, admitPatient, admitNo, adjustPayment, antenatal, antenatalNo,
  age, ageMonths, ageDays, gender, phoneNo, referredBy, driver, location, hospitalPatient, advisedBy,
  paymentType, visitType, onCall, employeeId, employeeName,
  totalAmount, discount, receive, refund,
  panelCompanyId, panelEmployeeId, panelDependentId,
  department,
  doctors = [],
}) {
  return prisma.clinicOpdVisit.create({
    data: {
      mrNo: mrNo ? Number(mrNo) : null,
      serialNo,
      department: department || 'General OPD',
      patientType: patientType || 'MAST',
      patientName: patientName || '',
      admitPatient: Boolean(admitPatient),
      admitNo: admitPatient ? (admitNo?.trim() || null) : null,
      adjustPayment: admitPatient ? Boolean(adjustPayment) : false,
      antenatal: Boolean(antenatal),
      antenatalNo: antenatalNo || null,
      age: age ? Number(age) : null,
      ageMonths: Number(ageMonths) || 0,
      ageDays: Number(ageDays) || 0,
      gender: gender || 'male',
      phoneNo: phoneNo || null,
      referredBy: hospitalPatient === false ? null : (referredBy || null),
      driver: driver || null,
      location: location || null,
      hospitalPatient: hospitalPatient === undefined ? true : Boolean(hospitalPatient),
      advisedBy: hospitalPatient === false ? null : (advisedBy || null),
      paymentType: paymentType || 'cash',
      visitType: visitType || 'opd',
      onCall: Boolean(onCall),
      employeeId: employeeId ? Number(employeeId) : null,
      employeeName: employeeName || null,
      totalAmount: Number(totalAmount) || 0,
      discount: Number(discount) || 0,
      receive: Number(receive) || 0,
      refund: Number(refund) || 0,
      panelCompanyId:  panelCompanyId  ? Number(panelCompanyId)  : null,
      panelEmployeeId: panelEmployeeId ? Number(panelEmployeeId) : null,
      panelDependentId: panelDependentId ? Number(panelDependentId) : null,
      doctors: {
        create: doctors.map(d => ({
          doctorId: Number(d.doctorId),
          subDeptId: Number(d.subDeptId),
          amount: Number(d.amount) || 0,
          extAmount: Number(d.extAmount) || 0,
        })),
      },
    },
    include: { doctors: true },
  });
}

async function enrichOpdPatient(visit) {
  if (!visit) return null;
  let patientCategory = 'private';
  let panelLabel = '';
  if (visit.employeeId) {
    patientCategory = 'staff';
  } else if (visit.panelCompanyId) {
    patientCategory = 'panel';
    const company = await prisma.clinicPanelCompany.findUnique({ where: { id: visit.panelCompanyId }, select: { code: true } });
    const employee = visit.panelEmployeeId
      ? await prisma.clinicPanelEmployee.findUnique({ where: { id: visit.panelEmployeeId }, select: { empCode: true } })
      : null;
    panelLabel = [company?.code, employee?.empCode].filter(Boolean).join(' / ');
  }
  return { ...visit, patientCategory, panelLabel };
}

async function getOpdPatientByMrNo(mrNo) {
  const mrInt = parseInt(mrNo, 10);
  if (isNaN(mrInt)) return null;
  const visit = await prisma.clinicOpdVisit.findFirst({
    where: { mrNo: mrInt },
    orderBy: { id: 'desc' },
    select: { serialNo: true, mrNo: true, patientName: true, age: true, ageMonths: true, ageDays: true, gender: true, phoneNo: true, referredBy: true, employeeId: true, panelCompanyId: true, panelEmployeeId: true, panelDependentId: true },
  });
  return enrichOpdPatient(visit);
}

async function getOpdPatientsByPhone(phoneNo) {
  const phone = (phoneNo || '').trim();
  if (!phone) return [];
  const visits = await prisma.clinicOpdVisit.findMany({
    where: { phoneNo: { contains: phone, mode: 'insensitive' } },
    orderBy: { id: 'desc' },
    select: { mrNo: true, patientType: true, patientName: true, age: true, ageMonths: true, ageDays: true, gender: true, phoneNo: true, referredBy: true, employeeId: true, panelCompanyId: true, panelEmployeeId: true, panelDependentId: true },
  });
  const seen = new Set();
  const unique = [];
  for (const v of visits) {
    const key = v.mrNo != null ? String(v.mrNo) : `nophone_${v.patientName}`;
    if (!seen.has(key)) { seen.add(key); unique.push(v); }
  }
  return unique;
}

async function getOpdVisitBySerial(serialNo) {
  const no = serialNo.trim();
  const visit = await prisma.clinicOpdVisit.findFirst({
    where: { serialNo: { equals: no, mode: 'insensitive' } },
    select: { serialNo: true, mrNo: true, patientName: true, age: true, ageMonths: true, ageDays: true, gender: true, phoneNo: true, referredBy: true, employeeId: true, panelCompanyId: true, panelEmployeeId: true, panelDependentId: true },
  });
  if (visit) return enrichOpdPatient(visit);

  // Fallback: Patients List (old bulk-imported Excel data) — only patientName is
  // available there; MR#, phone, age and gender were never captured in that import.
  const pvSerial = Number(no);
  if (pvSerial > 0 && pvSerial <= 2147483647) {
    const pv = await prisma.patientVisit.findFirst({ where: { serialNo: pvSerial } });
    if (pv) {
      return {
        serialNo: no, mrNo: null, patientName: pv.patientName,
        age: null, ageMonths: 0, ageDays: 0, gender: null,
        phoneNo: null, referredBy: null,
        employeeId: null, panelCompanyId: null, panelEmployeeId: null, panelDependentId: null,
        patientCategory: 'private', panelLabel: '',
      };
    }
  }
  return null;
}

async function getOpdVisits() {
  return prisma.clinicOpdVisit.findMany({
    orderBy: { id: 'desc' },
    include: {
      doctors: {
        include: {
          doctor: { select: { id: true, code: true, name: true } },
          subDept: { select: { id: true, name: true } },
        },
      },
    },
  });
}

// ─── Room Category ────────────────────────────────────────────────────────────

async function getAllRoomCategories() {
  return prisma.clinicRoomCategory.findMany({ orderBy: { name: 'asc' } });
}

async function createRoomCategory({ code, name, rate }) {
  return prisma.clinicRoomCategory.create({ data: { code: code.trim().toUpperCase(), name: name.trim(), rate: Number(rate) || 0 } });
}

async function updateRoomCategory(id, { code, name, rate }) {
  return prisma.clinicRoomCategory.update({
    where: { id: Number(id) },
    data: { code: code.trim().toUpperCase(), name: name.trim(), rate: Number(rate) || 0 },
  });
}

async function deleteRoomCategory(id) {
  return prisma.clinicRoomCategory.delete({ where: { id: Number(id) } });
}

// ─── Bed ──────────────────────────────────────────────────────────────────────

async function getAllBeds() {
  const beds = await prisma.clinicBed.findMany({
    include: { roomCategory: { select: { id: true, name: true, rate: true } } },
    orderBy: [{ roomCategory: { name: 'asc' } }, { name: 'asc' }],
  });
  const activeAdmissions = await prisma.clinicAdmission.findMany({
    where: { status: 'active', bedId: { not: null } },
    select: {
      bedId: true, admissionNo: true, mrNo: true,
      patientName: true, patientTitle: true,
      consultantId: true, createdAt: true,
    },
  });
  const admissionByBed = {};
  activeAdmissions.forEach(a => { admissionByBed[a.bedId] = a; });
  return beds.map(b => ({ ...b, admission: admissionByBed[b.id] || null }));
}

async function createBed({ name, roomCategoryId }) {
  return prisma.clinicBed.create({
    data: { name: name.trim(), roomCategoryId: Number(roomCategoryId) },
    include: { roomCategory: { select: { id: true, name: true, rate: true } } },
  });
}

async function updateBed(id, { name, roomCategoryId }) {
  return prisma.clinicBed.update({
    where: { id: Number(id) },
    data: { name: name.trim(), roomCategoryId: Number(roomCategoryId) },
    include: { roomCategory: { select: { id: true, name: true, rate: true } } },
  });
}

async function deleteBed(id) {
  return prisma.clinicBed.delete({ where: { id: Number(id) } });
}

// ─── Bill Head ────────────────────────────────────────────────────────────────

const BILL_HEAD_INCLUDE = {
  refDepartment: { select: { id: true, name: true } },
  wardRates: { include: { roomCategory: { select: { id: true, code: true, name: true } } }, orderBy: { roomCategory: { name: 'asc' } } },
  staffCategories: { include: { staffCategory: { select: { id: true, name: true } } } },
};

async function getAllBillHeads() {
  return prisma.clinicBillHead.findMany({
    include: {
      refDepartment: { select: { id: true, name: true } },
      wardRates: { include: { roomCategory: { select: { id: true, code: true, name: true } } } },
    },
    orderBy: { headCode: 'asc' },
  });
}

async function getBillHeadById(id) {
  return prisma.clinicBillHead.findUnique({ where: { id: Number(id) }, include: BILL_HEAD_INCLUDE });
}

function mapWardRate(w) {
  return {
    roomCategoryId: Number(w.roomCategoryId),
    enabled: Boolean(w.enabled),
    rate: Number(w.rate) || 0,
    unit: w.unit?.trim() || null,
    status: w.status || 'active',
    payContractor: Boolean(w.payContractor),
    disSeq: Number(w.disSeq) || 0,
  };
}

async function createBillHead({ headCode, accountReceivable, description, type, refDepartmentId, staffCategoryRequired, discountApply, discountSeq, status, wardRates = [], staffCategoryIds = [] }) {
  return prisma.clinicBillHead.create({
    data: {
      headCode: headCode.trim(),
      accountReceivable: accountReceivable?.trim() || null,
      description: description?.trim() || '',
      type: type || 'both',
      refDepartmentId: refDepartmentId ? Number(refDepartmentId) : null,
      staffCategoryRequired: Boolean(staffCategoryRequired),
      discountApply: Boolean(discountApply),
      discountSeq: Number(discountSeq) || 0,
      status: status || 'active',
      wardRates: { create: wardRates.map(mapWardRate) },
      staffCategories: staffCategoryIds.length > 0
        ? { create: staffCategoryIds.map(id => ({ staffCategoryId: Number(id) })) }
        : undefined,
    },
    include: BILL_HEAD_INCLUDE,
  });
}

async function updateBillHead(id, { headCode, accountReceivable, description, type, refDepartmentId, staffCategoryRequired, discountApply, discountSeq, status, wardRates = [], staffCategoryIds = [] }) {
  return prisma.$transaction(async (tx) => {
    await tx.clinicBillHeadWard.deleteMany({ where: { billHeadId: Number(id) } });
    await tx.clinicBillHeadStaffCat.deleteMany({ where: { billHeadId: Number(id) } });
    return tx.clinicBillHead.update({
      where: { id: Number(id) },
      data: {
        headCode: headCode.trim(),
        accountReceivable: accountReceivable?.trim() || null,
        description: description?.trim() || '',
        type: type || 'both',
        refDepartmentId: refDepartmentId ? Number(refDepartmentId) : null,
        staffCategoryRequired: Boolean(staffCategoryRequired),
        discountApply: Boolean(discountApply),
        discountSeq: Number(discountSeq) || 0,
        status: status || 'active',
        wardRates: { create: wardRates.map(mapWardRate) },
        staffCategories: staffCategoryIds.length > 0
          ? { create: staffCategoryIds.map(scId => ({ staffCategoryId: Number(scId) })) }
          : undefined,
      },
      include: BILL_HEAD_INCLUDE,
    });
  });
}

async function deleteBillHead(id) {
  return prisma.clinicBillHead.delete({ where: { id: Number(id) } });
}

// ─── Panel Company ────────────────────────────────────────────────────────────

const PANEL_INCLUDE = {
  subDeptRates: {
    include: {
      subDept: { include: { department: { select: { id: true, name: true } } } },
    },
    orderBy: [{ subDept: { department: { name: 'asc' } } }, { subDept: { name: 'asc' } }],
  },
  admissionRates: {
    include: { billHead: { select: { id: true, headCode: true, description: true } } },
    orderBy: { billHead: { headCode: 'asc' } },
  },
  roomEntitlements: {
    include: { roomCategory: { select: { id: true, code: true, name: true } } },
    orderBy: { roomCategory: { name: 'asc' } },
  },
};

async function getAllPanelCompanies() {
  return prisma.clinicPanelCompany.findMany({ orderBy: { code: 'asc' } });
}

async function getPanelCompanyById(id) {
  return prisma.clinicPanelCompany.findUnique({ where: { id: Number(id) }, include: PANEL_INCLUDE });
}

function mapSubDeptRate(r) {
  return {
    subDeptId: Number(r.subDeptId),
    enabled: Boolean(r.enabled),
    rate: Number(r.rate) || 0,
    status: r.status || 'active',
  };
}

function mapAdmissionRate(r) {
  return {
    billHeadId: Number(r.billHeadId),
    enabled: Boolean(r.enabled),
    rate: Number(r.rate) || 0,
    status: r.status || 'active',
  };
}

function mapRoomEntitlement(r) {
  return {
    roomCategoryId: Number(r.roomCategoryId),
    enabled: Boolean(r.enabled),
  };
}

async function createPanelCompany({ code, name, billingTo, status, subDeptRates = [], admissionRates = [], roomEntitlements = [] }) {
  return prisma.clinicPanelCompany.create({
    data: {
      code: code.trim().toUpperCase(),
      name: name.trim(),
      billingTo: billingTo || 'same',
      status: status || 'active',
      subDeptRates: { create: subDeptRates.map(mapSubDeptRate) },
      admissionRates: { create: admissionRates.map(mapAdmissionRate) },
      roomEntitlements: { create: roomEntitlements.map(mapRoomEntitlement) },
    },
    include: PANEL_INCLUDE,
  });
}

async function updatePanelCompany(id, { code, name, billingTo, status, subDeptRates = [], admissionRates = [], roomEntitlements = [] }) {
  return prisma.$transaction(async (tx) => {
    await tx.clinicPanelSubDeptRate.deleteMany({ where: { panelCompanyId: Number(id) } });
    await tx.clinicPanelAdmissionRate.deleteMany({ where: { panelCompanyId: Number(id) } });
    await tx.clinicPanelRoomEntitlement.deleteMany({ where: { panelCompanyId: Number(id) } });
    return tx.clinicPanelCompany.update({
      where: { id: Number(id) },
      data: {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        billingTo: billingTo || 'same',
        status: status || 'active',
        subDeptRates: { create: subDeptRates.map(mapSubDeptRate) },
        admissionRates: { create: admissionRates.map(mapAdmissionRate) },
        roomEntitlements: { create: roomEntitlements.map(mapRoomEntitlement) },
      },
      include: PANEL_INCLUDE,
    });
  });
}

async function deletePanelCompany(id) {
  return prisma.clinicPanelCompany.delete({ where: { id: Number(id) } });
}

// ─── Panel Employees ──────────────────────────────────────────────────────────

const EMP_INCLUDE = {
  company:     { select: { id: true, code: true, name: true } },
  billCompany: { select: { id: true, code: true, name: true } },
  dependents:  { orderBy: { id: 'asc' } },
  subDeptRates: {
    include: {
      subDept: {
        include: { department: { select: { id: true, name: true } } },
      },
    },
    orderBy: { subDept: { name: 'asc' } },
  },
  admissionRates: {
    include: { billHead: { select: { id: true, headCode: true, description: true } } },
    orderBy: { billHead: { headCode: 'asc' } },
  },
  roomEntitlements: {
    include: { roomCategory: { select: { id: true, code: true, name: true } } },
    orderBy: { roomCategory: { name: 'asc' } },
  },
};

function mapEmpSubDeptRate(r) {
  return { subDeptId: Number(r.subDeptId), enabled: Boolean(r.enabled), rate: Number(r.rate) || 0, status: r.status || 'active' };
}
function mapEmpAdmissionRate(r) {
  return { billHeadId: Number(r.billHeadId), enabled: Boolean(r.enabled), rate: Number(r.rate) || 0, status: r.status || 'active' };
}
function mapEmpRoomEntitlement(r) {
  return { roomCategoryId: Number(r.roomCategoryId), enabled: Boolean(r.enabled) };
}

async function getAllPanelEmployees() {
  return prisma.clinicPanelEmployee.findMany({
    include: {
      company:    { select: { id: true, code: true, name: true } },
      dependents: { orderBy: { id: 'asc' } },
    },
    orderBy: [{ company: { code: 'asc' } }, { empCode: 'asc' }],
  });
}

async function getPanelEmployeeById(id) {
  return prisma.clinicPanelEmployee.findUnique({ where: { id: Number(id) }, include: EMP_INCLUDE });
}

async function createPanelEmployee({
  companyId, empCode, title, name, dob, compCardNo, billCompanyId,
  gender, insuranceExpOn, entitlement, status,
  dependents = [], subDeptRates = [], admissionRates = [], roomEntitlements = [],
}) {
  return prisma.clinicPanelEmployee.create({
    data: {
      companyId:     Number(companyId),
      empCode:       empCode.trim().toUpperCase(),
      title:         title || 'MR',
      name:          name.trim(),
      dob:           dob ? new Date(dob) : null,
      compCardNo:    compCardNo || null,
      billCompanyId: billCompanyId ? Number(billCompanyId) : null,
      gender:        gender || 'male',
      insuranceExpOn: insuranceExpOn ? new Date(insuranceExpOn) : null,
      entitlement:   entitlement || 'general',
      status:        status || 'active',
      dependents:    { create: dependents.map((d) => ({ ...d, dob: d.dob ? new Date(d.dob) : null })) },
      subDeptRates:  { create: subDeptRates.map(mapEmpSubDeptRate) },
      admissionRates: { create: admissionRates.map(mapEmpAdmissionRate) },
      roomEntitlements: { create: roomEntitlements.map(mapEmpRoomEntitlement) },
    },
    include: EMP_INCLUDE,
  });
}

async function updatePanelEmployee(id, {
  companyId, empCode, title, name, dob, compCardNo, billCompanyId,
  gender, insuranceExpOn, entitlement, status,
  dependents = [], subDeptRates = [], admissionRates = [], roomEntitlements = [],
}) {
  return prisma.$transaction(async (tx) => {
    await tx.clinicPanelEmployeeDependent.deleteMany({ where: { employeeId: Number(id) } });
    await tx.clinicPanelEmpSubDeptRate.deleteMany({ where: { employeeId: Number(id) } });
    await tx.clinicPanelEmpAdmissionRate.deleteMany({ where: { employeeId: Number(id) } });
    await tx.clinicPanelEmpRoomEntitlement.deleteMany({ where: { employeeId: Number(id) } });
    return tx.clinicPanelEmployee.update({
      where: { id: Number(id) },
      data: {
        companyId:     Number(companyId),
        empCode:       empCode.trim().toUpperCase(),
        title:         title || 'MR',
        name:          name.trim(),
        dob:           dob ? new Date(dob) : null,
        compCardNo:    compCardNo || null,
        billCompanyId: billCompanyId ? Number(billCompanyId) : null,
        gender:        gender || 'male',
        insuranceExpOn: insuranceExpOn ? new Date(insuranceExpOn) : null,
        entitlement:   entitlement || 'general',
        status:        status || 'active',
        dependents:    { create: dependents.map((d) => ({ ...d, dob: d.dob ? new Date(d.dob) : null })) },
        subDeptRates:  { create: subDeptRates.map(mapEmpSubDeptRate) },
        admissionRates: { create: admissionRates.map(mapEmpAdmissionRate) },
        roomEntitlements: { create: roomEntitlements.map(mapEmpRoomEntitlement) },
      },
      include: EMP_INCLUDE,
    });
  });
}

async function deletePanelEmployee(id) {
  return prisma.clinicPanelEmployee.delete({ where: { id: Number(id) } });
}

// ─── Antenatal ────────────────────────────────────────────────────────────────

async function createAntenatal({
  mrNo, antenatalNo, registrationDate, paymentType,
  patientName, age, husbandName, phoneNo, address,
  lmpDate, edd, underTreatmentId, para, gravidia, amount,
  employeeId, panelCompanyId, panelEmployeeId, panelDependentId,
}) {
  return prisma.clinicAntenatal.create({
    data: {
      mrNo:             mrNo || '',
      antenatalNo:      antenatalNo || '',
      registrationDate: registrationDate ? new Date(registrationDate) : new Date(),
      paymentType:      paymentType || 'private',
      patientName:      patientName || '',
      age:              age ? Number(age) : null,
      husbandName:      husbandName || null,
      phoneNo:          phoneNo || null,
      address:          address || null,
      lmpDate:          lmpDate ? new Date(lmpDate) : null,
      edd:              edd ? new Date(edd) : null,
      underTreatmentId: underTreatmentId ? Number(underTreatmentId) : null,
      para:             para !== undefined ? Number(para) : 0,
      gravidia:         gravidia !== undefined ? Number(gravidia) : 0,
      amount:           amount !== undefined ? Number(amount) : 0,
      employeeId:       employeeId ? Number(employeeId) : null,
      panelCompanyId:   panelCompanyId ? Number(panelCompanyId) : null,
      panelEmployeeId:  panelEmployeeId ? Number(panelEmployeeId) : null,
      panelDependentId: panelDependentId ? Number(panelDependentId) : null,
    },
  });
}

async function getAntenatalList() {
  return prisma.clinicAntenatal.findMany({ orderBy: { id: 'desc' } });
}

async function getAntenatalByNo(antenatalNo) {
  return prisma.clinicAntenatal.findFirst({
    where: { antenatalNo: { equals: antenatalNo, mode: 'insensitive' } },
    orderBy: { id: 'desc' },
  });
}

// ─── Receipt ─────────────────────────────────────────────────────────────────

async function getOpdVisitForReceipt(id) {
  return prisma.clinicOpdVisit.findUnique({
    where: { id: Number(id) },
    include: {
      doctors: {
        include: {
          doctor: { include: { staffCategory: { select: { name: true } } } },
          subDept: { select: { id: true, name: true } },
        },
      },
    },
  });
}

async function getTokenNumber(doctorId, dateStr) {
  const start = new Date(dateStr);
  start.setHours(0, 0, 0, 0);
  const end = new Date(dateStr);
  end.setHours(23, 59, 59, 999);
  return prisma.clinicOpdVisitDoctor.count({
    where: { doctorId: Number(doctorId), createdAt: { gte: start, lte: end } },
  });
}

// Transactions > Cancel Slip: list today's (business-day) active slips to pick from.
// Business day = 8:00 AM to 7:59:59 AM next day, same convention as the revenue dashboard.
async function getTodayOpdVisitsForCancel() {
  const now = new Date();
  const bizDate = new Date(now.getTime() - 8 * 60 * 60 * 1000);
  const y = bizDate.getFullYear(), m = bizDate.getMonth(), d = bizDate.getDate();
  const start = new Date(y, m, d, 8, 0, 0, 0);
  const end = new Date(y, m, d + 1, 7, 59, 59, 999);

  // Cancelled slips bhi list mein rehti hain (status ke saath dikhti hain) —
  // sirf revenue dashboard side amount exclude hota hai, list se nahi hatai jati.
  return prisma.clinicOpdVisit.findMany({
    where: { createdAt: { gte: start, lte: end } },
    select: {
      id: true, serialNo: true, patientName: true, department: true,
      totalAmount: true, paymentType: true, createdAt: true, status: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function getOpdVisitForCancel(id) {
  const visit = await prisma.clinicOpdVisit.findUnique({
    where: { id: Number(id) },
    include: {
      doctors: {
        include: {
          doctor: { select: { code: true, name: true } },
          subDept: { select: { code: true, name: true } },
        },
      },
    },
  });
  if (!visit) throw Object.assign(new Error('Slip not found'), { status: 404 });
  return visit;
}

async function cancelOpdVisit(id, { reason, note, cancelledBy }) {
  if (!reason) throw Object.assign(new Error('Cancel reason zaroori hai'), { status: 400 });
  const visit = await prisma.clinicOpdVisit.findUnique({ where: { id: Number(id) } });
  if (!visit) throw Object.assign(new Error('Slip not found'), { status: 404 });
  if (visit.status === 'cancelled') throw Object.assign(new Error('Ye slip pehle se cancelled hai'), { status: 400 });

  return prisma.clinicOpdVisit.update({
    where: { id: Number(id) },
    data: {
      status: 'cancelled',
      cancelReason: reason,
      cancelNote: note || null,
      cancelledAt: new Date(),
      cancelledBy: cancelledBy || null,
    },
  });
}

// Transactions > Slip Refund: full list (no date restriction, unlike Cancel Slip),
// searches BOTH ClinicOpdVisit (new system) and PatientVisit (old bulk import).
async function searchVisitsForRefund(q) {
  const term = String(q || '').trim();

  const ovWhere = term
    ? { OR: [{ serialNo: { contains: term, mode: 'insensitive' } }, { patientName: { contains: term, mode: 'insensitive' } }] }
    : {};
  const ovRows = await prisma.clinicOpdVisit.findMany({
    where: ovWhere,
    select: { id: true, serialNo: true, patientName: true, department: true, receive: true, refund: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const pvOr = [{ patientName: { contains: term, mode: 'insensitive' } }];
  const pvTermNum = Number(term);
  if (term && pvTermNum > 0 && pvTermNum <= 2147483647) pvOr.push({ serialNo: pvTermNum });
  const pvWhere = term ? { OR: pvOr } : {};
  const pvRows = await prisma.patientVisit.findMany({
    where: pvWhere,
    select: { id: true, serialNo: true, patientName: true, department: true, received: true, refund: true, visitDate: true },
    orderBy: { visitDate: 'desc' },
    take: 100,
  });

  const ov = ovRows.map(r => ({
    source: 'opd', id: r.id, serialNo: r.serialNo, patientName: r.patientName,
    department: r.department, receive: Number(r.receive), refund: Number(r.refund) || 0,
    createdAt: r.createdAt,
  }));
  const pv = pvRows.map(r => ({
    source: 'pv', id: r.id, serialNo: String(r.serialNo ?? ''), patientName: r.patientName,
    department: r.department || '', receive: Number(r.received), refund: Number(r.refund) || 0,
    createdAt: r.visitDate,
  }));

  return [...ov, ...pv].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 150);
}

async function getVisitForRefund(source, id) {
  if (source === 'opd') {
    const visit = await prisma.clinicOpdVisit.findUnique({
      where: { id: Number(id) },
      include: {
        doctors: {
          include: {
            doctor: { select: { code: true, name: true } },
            subDept: { select: { code: true, name: true } },
          },
        },
      },
    });
    if (!visit) throw Object.assign(new Error('Slip not found'), { status: 404 });
    return { source: 'opd', ...visit };
  }

  if (source === 'pv') {
    const pv = await prisma.patientVisit.findUnique({ where: { id: Number(id) } });
    if (!pv) throw Object.assign(new Error('Slip not found'), { status: 404 });
    return {
      source: 'pv', id: pv.id, serialNo: String(pv.serialNo ?? ''), patientName: pv.patientName,
      department: pv.department, receive: Number(pv.received), refund: Number(pv.refund) || 0,
      createdAt: pv.visitDate,
      doctors: [{
        id: 0,
        doctor:  { code: '', name: pv.doctor || '' },
        subDept: { code: '', name: pv.subDepartment || pv.department || '' },
        amount:  Number(pv.received),
      }],
    };
  }

  throw Object.assign(new Error('Invalid source'), { status: 400 });
}

async function refundVisit(source, id, { amount, reason, note, refundedBy }) {
  const amt = Number(amount);
  if (!amt || amt <= 0) throw Object.assign(new Error('Refund amount 0 se zyada hona chahiye'), { status: 400 });
  if (!reason) throw Object.assign(new Error('Refund reason zaroori hai'), { status: 400 });

  if (source === 'opd') {
    const visit = await prisma.clinicOpdVisit.findUnique({ where: { id: Number(id) } });
    if (!visit) throw Object.assign(new Error('Slip not found'), { status: 404 });
    const remaining = Number(visit.receive) - Number(visit.refund || 0);
    if (amt > remaining + 0.01) throw Object.assign(new Error(`Maximum ${remaining.toFixed(2)} refund ho sakta hai`), { status: 400 });
    return prisma.clinicOpdVisit.update({
      where: { id: Number(id) },
      data: {
        refund: Number(visit.refund || 0) + amt,
        refundReason: reason, refundNote: note || null,
        refundedAt: new Date(), refundedBy: refundedBy || null,
      },
    });
  }

  if (source === 'pv') {
    const pv = await prisma.patientVisit.findUnique({ where: { id: Number(id) } });
    if (!pv) throw Object.assign(new Error('Slip not found'), { status: 404 });
    const remaining = Number(pv.received) - Number(pv.refund || 0);
    if (amt > remaining + 0.01) throw Object.assign(new Error(`Maximum ${remaining.toFixed(2)} refund ho sakta hai`), { status: 400 });
    return prisma.patientVisit.update({
      where: { id: Number(id) },
      data: {
        refund: Number(pv.refund || 0) + amt,
        refundReason: reason, refundNote: note || null,
        refundedAt: new Date(), refundedBy: refundedBy || null,
      },
    });
  }

  throw Object.assign(new Error('Invalid source'), { status: 400 });
}

// Transactions > Slip Adjustment: same full search/detail as Slip Refund (both
// ClinicOpdVisit and PatientVisit, no date restriction) — just delegates to the
// same lookups so the two screens never drift apart.
async function searchVisitsForAdjustment(q) {
  return searchVisitsForRefund(q);
}

async function getVisitForAdjustment(source, id) {
  return getVisitForRefund(source, id);
}

// Only patient-identity fields are editable here — department, sub-department,
// doctor and amount/rate are intentionally never accepted, even if sent.
async function updateVisitPersonalInfo(source, id, fields) {
  if (source === 'opd') {
    const visit = await prisma.clinicOpdVisit.findUnique({ where: { id: Number(id) } });
    if (!visit) throw Object.assign(new Error('Slip not found'), { status: 404 });

    const patientName = fields.patientName?.trim();
    if (!patientName) throw Object.assign(new Error('Patient Name khali nahi ho sakta'), { status: 400 });

    return prisma.clinicOpdVisit.update({
      where: { id: Number(id) },
      data: {
        patientName,
        patientType: fields.patientType?.trim() || visit.patientType,
        age:         fields.age === '' || fields.age == null ? null : Number(fields.age),
        ageMonths:   Number(fields.ageMonths) || 0,
        ageDays:     Number(fields.ageDays) || 0,
        gender:      fields.gender || visit.gender,
        phoneNo:     fields.phoneNo?.trim() || null,
        referredBy:  fields.referredBy?.trim() || null,
        antenatalNo: fields.antenatalNo?.trim() || null,
      },
    });
  }

  if (source === 'pv') {
    const pv = await prisma.patientVisit.findUnique({ where: { id: Number(id) } });
    if (!pv) throw Object.assign(new Error('Slip not found'), { status: 404 });

    const patientName = fields.patientName?.trim();
    if (!patientName) throw Object.assign(new Error('Patient Name khali nahi ho sakta'), { status: 400 });

    return prisma.patientVisit.update({
      where: { id: Number(id) },
      data: { patientName },
    });
  }

  throw Object.assign(new Error('Invalid source'), { status: 400 });
}

// ─── Transactions > Slip Transfer ─────────────────────────────────────────────
// Corrects a slip that was accidentally billed against the wrong Admission #
// (e.g. via the "Admit Patient" checkbox in General/Consultant/Emergency OPD) —
// search by Slip # (not Admission #), then move it to the right admission.

async function searchVisitsForSlipTransfer(q) {
  return searchVisitsForRefund(q);
}

async function getVisitForSlipTransfer(source, id) {
  const visit = await getVisitForRefund(source, id);
  if (source === 'pv') {
    const pv = await prisma.patientVisit.findUnique({ where: { id: Number(id) } });
    visit.admitNo = pv?.admitNo != null ? String(pv.admitNo) : null;
  }
  return visit;
}

async function transferSlipAdmission(source, id, admitNo) {
  const no = admitNo?.trim() || null;

  if (source === 'opd') {
    const visit = await prisma.clinicOpdVisit.findUnique({ where: { id: Number(id) } });
    if (!visit) throw Object.assign(new Error('Slip not found'), { status: 404 });
    return prisma.clinicOpdVisit.update({
      where: { id: Number(id) },
      data: { admitNo: no, admitPatient: Boolean(no) },
    });
  }

  if (source === 'pv') {
    const pv = await prisma.patientVisit.findUnique({ where: { id: Number(id) } });
    if (!pv) throw Object.assign(new Error('Slip not found'), { status: 404 });
    const numNo = no ? Number(no) : null;
    if (no && (!Number.isFinite(numNo) || numNo <= 0)) {
      throw Object.assign(new Error('Admission # numeric hona chahiye is purane record ke liye'), { status: 400 });
    }
    return prisma.patientVisit.update({
      where: { id: Number(id) },
      data: { admitNo: numNo },
    });
  }

  throw Object.assign(new Error('Invalid source'), { status: 400 });
}

async function printOpdVisit(id) {
  const visit = await getOpdVisitForReceipt(id);
  if (!visit) throw Object.assign(new Error('Visit not found'), { status: 404 });
  const isDuplicate = (visit.printCount || 0) > 0;
  await prisma.$executeRaw`UPDATE "ClinicOpdVisit" SET "printCount" = COALESCE("printCount", 0) + 1 WHERE id = ${Number(id)}`;
  const doctorId = visit.doctors[0]?.doctorId;
  const tokenNo = doctorId
    ? await getTokenNumber(doctorId, new Date().toISOString().slice(0, 10))
    : 0;
  return { visit, tokenNo, isDuplicate };
}

// Normalize a PatientVisit.paymentType string (from the old bulk Excel import) into
// the lowercase codes buildReceiptHtml/invoiceLabel expects.
function normalizePvPaymentType(pt) {
  const p = (pt || '').trim().toLowerCase();
  if (p === 'panel') return 'panel';
  if (p === 'complem.' || p === 'complementary') return 'complementary';
  if (p === 'jazzcash') return 'jazzcash';
  if (p === 'cc' || p === 'c card') return 'cc';
  return 'cash';
}

// Reprint screen (Report > Reprint) — looks a visit up by Serial # instead of id,
// then reuses the exact same print/duplicate logic as printOpdVisit.
// Checks ClinicOpdVisit (new system) first, then falls back to PatientVisit
// (the old bulk-imported "Patients List" — 6000+ rows, a different flat structure),
// adapting it into the same shape buildReceiptHtml expects so the same slip
// template renders either way.
async function reprintOpdVisitBySerial(serialNo) {
  const no = String(serialNo).trim();

  const visit = await prisma.clinicOpdVisit.findFirst({
    where: { serialNo: { equals: no, mode: 'insensitive' } },
    include: {
      doctors: {
        include: {
          doctor: { include: { staffCategory: { select: { name: true } } } },
          subDept: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (visit) {
    await prisma.$executeRaw`UPDATE "ClinicOpdVisit" SET "printCount" = COALESCE("printCount", 0) + 1 WHERE id = ${visit.id}`;
    const doctorId = visit.doctors[0]?.doctorId;
    const tokenNo = doctorId
      ? await getTokenNumber(doctorId, new Date().toISOString().slice(0, 10))
      : 0;
    return { visit, tokenNo, isDuplicate: true, source: 'opd' };
  }

  const pvSerial = Number(no);
  if (pvSerial > 0 && pvSerial <= 2147483647) {
    const pv = await prisma.patientVisit.findFirst({ where: { serialNo: pvSerial } });
    if (pv) {
      const total = Number(pv.received || 0) + Number(pv.discount || 0) + Number(pv.balance || 0);
      const dateStr = pv.visitDate.toISOString().slice(0, 10);
      const createdAt = pv.visitTime ? new Date(`${dateStr}T${pv.visitTime}:00`) : pv.visitDate;
      const adapted = {
        serialNo:    String(pv.serialNo),
        patientType: '',
        patientName: pv.patientName,
        age: null, ageMonths: 0, ageDays: 0,
        createdAt,
        referredBy:  '',
        antenatalNo: '',
        totalAmount: total,
        discount:    Number(pv.discount) || 0,
        receive:     Number(pv.received) || 0,
        paymentType: normalizePvPaymentType(pv.paymentType),
        doctors: [{
          doctor:  { name: pv.doctor || '' },
          subDept: { name: pv.subDepartment || pv.department || '' },
          amount:  total,
        }],
      };
      return { visit: adapted, tokenNo: 0, isDuplicate: true, source: 'patientVisit' };
    }
  }

  throw Object.assign(new Error('Is Slip # ka koi record nahi mila (na naye system mein, na Patients List mein)'), { status: 404 });
}

// ─── Admission ────────────────────────────────────────────────────────────────

async function getAdmissions() {
  return prisma.clinicAdmission.findMany({ orderBy: { id: 'desc' } });
}

// Full admission record by its Admission # — used by the Reprint screen to reload
// and re-print an existing Admission Form (unlike lookupAdmissionByNo, which only
// returns a small snapshot for the Death Certificate screen).
async function getAdmissionByNumber(admissionNo) {
  const no = String(admissionNo).trim();
  const admission = await prisma.clinicAdmission.findFirst({
    where: { admissionNo: no },
    orderBy: { id: 'desc' },
  });
  if (admission) return admission;

  // Fallback: old bulk-imported Patients List — most real historical admissions
  // only live here (ClinicAdmission only has ones created in the new system).
  // Only patientName, doctor, amount and date were ever captured for these;
  // room/bed/age/gender/phone/address etc. were never part of that Excel import.
  const admNo = Number(no);
  if (admNo > 0 && admNo <= 2147483647) {
    const pv = await prisma.patientVisit.findFirst({ where: { admitNo: admNo } });
    if (pv) {
      return {
        id: null,
        serialNo: null,
        admissionNo: no,
        mrNo: null,
        arrivedSlipNo: pv.serialNo != null ? String(pv.serialNo) : null,
        patientTitle: 'Mr',
        patientCategory: 'private',
        patientName: pv.patientName,
        ageYears: 0, ageMonths: 0, ageDays: 0,
        gender: 'male',
        address: null, phoneNo: null,
        arrivedUnderRmo: null,
        consultantId: null,
        referredBy: pv.doctor || null,
        authorityLetter: false,
        responsibleParty: null,
        previousAdmission: null,
        advancePayment: Number(pv.received) || null,
        roomCategoryId: null, bedId: null,
        surgery: false, surgeryTypeId: null,
        referralPatient: false, referralNote: null,
        antenatal: false, antenatalNo: null,
        status: 'active',
        createdAt: pv.visitDate,
        updatedAt: pv.visitDate,
        _source: 'patientVisit',
      };
    }
  }

  return null;
}

// ─── Transactions > Receiving against Admission ──────────────────────────────
function admPaidSoFar(admission) {
  const adv = Number(admission.advancePayment) || 0;
  const paid = (admission.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
  return adv + paid;
}

async function searchAdmissionsForReceiving(q) {
  const term = String(q || '').trim();
  const where = term
    ? { OR: [{ admissionNo: { contains: term, mode: 'insensitive' } }, { patientName: { contains: term, mode: 'insensitive' } }] }
    : {};
  const rows = await prisma.clinicAdmission.findMany({
    where,
    include: { payments: { select: { amount: true } } },
    orderBy: { id: 'desc' },
    take: 100,
  });
  return rows.map(a => ({
    id: a.id,
    admissionNo: a.admissionNo,
    patientName: `${a.patientTitle || ''} ${a.patientName}`.trim(),
    createdAt: a.createdAt,
    paidSoFar: admPaidSoFar(a),
  }));
}

async function getAdmissionForReceiving(admissionNo) {
  const admission = await prisma.clinicAdmission.findFirst({
    where: { admissionNo: String(admissionNo).trim() },
    include: { payments: { orderBy: { id: 'desc' } } },
    orderBy: { id: 'desc' },
  });
  if (!admission) throw Object.assign(new Error('Is Admission # ka koi record nahi mila'), { status: 404 });
  return { ...admission, paidSoFar: admPaidSoFar(admission) };
}

async function addAdmissionPayment(admissionId, { serialNo, amount, paymentType, receivedBy }) {
  const amt = Number(amount);
  if (!amt || amt <= 0) throw Object.assign(new Error('Amount 0 se zyada hona chahiye'), { status: 400 });
  const admission = await prisma.clinicAdmission.findUnique({ where: { id: Number(admissionId) } });
  if (!admission) throw Object.assign(new Error('Admission not found'), { status: 404 });

  const no = serialNo?.trim() || await getNextSerialNo();
  const payment = await prisma.clinicAdmissionPayment.create({
    data: {
      serialNo: no,
      admissionId: Number(admissionId),
      amount: amt,
      paymentType: paymentType === 'cc' ? 'cc' : 'cash',
    },
  });
  return { payment, receivedBy, admission };
}

async function getAdmissionPaymentForPrint(id) {
  const payment = await prisma.clinicAdmissionPayment.findUnique({
    where: { id: Number(id) },
    include: { admission: true },
  });
  if (!payment) throw Object.assign(new Error('Payment not found'), { status: 404 });
  const isDuplicate = (payment.printCount || 0) > 0;
  await prisma.clinicAdmissionPayment.update({ where: { id: Number(id) }, data: { printCount: { increment: 1 } } });
  return { payment, isDuplicate };
}

async function createAdmission(data) {
  const admission = await prisma.clinicAdmission.create({
    data: {
      serialNo:          data.serialNo?.trim() || null,
      admissionNo:       data.admissionNo?.trim() || '',
      mrNo:              data.mrNo ? Number(data.mrNo) : null,
      arrivedSlipNo:     data.arrivedSlipNo?.trim() || null,
      patientTitle:      data.patientTitle || 'Mr',
      patientCategory:   data.patientCategory || 'private',
      patientName:       data.patientName?.trim() || '',
      ageYears:          data.ageYears ? Number(data.ageYears) : 0,
      ageMonths:         data.ageMonths ? Number(data.ageMonths) : 0,
      ageDays:           data.ageDays ? Number(data.ageDays) : 0,
      gender:            data.gender || 'male',
      address:           data.address?.trim() || null,
      phoneNo:           data.phoneNo?.trim() || null,
      arrivedUnderRmo:   data.arrivedUnderRmo?.trim() || null,
      consultantId:      data.consultantId ? Number(data.consultantId) : null,
      referredBy:        data.referredBy?.trim() || null,
      authorityLetter:   Boolean(data.authorityLetter),
      responsibleParty:  data.responsibleParty?.trim() || null,
      previousAdmission: data.previousAdmission?.trim() || null,
      advancePayment:    data.advancePayment ? Number(data.advancePayment) : null,
      roomCategoryId:    data.roomCategoryId ? Number(data.roomCategoryId) : null,
      bedId:             data.bedId ? Number(data.bedId) : null,
      surgery:           Boolean(data.surgery),
      surgeryTypeId:     data.surgeryTypeId ? Number(data.surgeryTypeId) : null,
      referralPatient:   Boolean(data.referralPatient),
      referralNote:      data.referralNote?.trim() || null,
      antenatal:         Boolean(data.antenatal),
      antenatalNo:       data.antenatalNo?.trim() || null,
    },
  });
  if (admission.bedId) {
    await prisma.clinicBed.update({
      where: { id: admission.bedId },
      data: { status: 'occupied' },
    });
  }
  return admission;
}

async function getAvailableBeds(roomCategoryId, excludeAdmissionId) {
  const where = { status: 'active', bedId: { not: null } };
  if (excludeAdmissionId) where.id = { not: Number(excludeAdmissionId) };
  const activeBedIds = await prisma.clinicAdmission.findMany({
    where,
    select: { bedId: true },
  });
  const occupiedIds = activeBedIds.map((r) => r.bedId).filter(Boolean);
  return prisma.clinicBed.findMany({
    where: {
      roomCategoryId: Number(roomCategoryId),
      status: { not: 'not_working' },
      id: { notIn: occupiedIds.length > 0 ? occupiedIds : [-1] },
    },
    orderBy: { name: 'asc' },
  });
}

// ─── Transactions > Admission Adjustment ─────────────────────────────────────
// Reopens an existing admission for editing — every field is editable except
// advancePayment (locked: it's the original receipt amount, already reflected
// in Revenue Dashboard / Patients List; changing it here would silently alter
// past financial records without a corresponding payment trail).

async function searchAdmissionsForAdjustment(q) {
  const term = String(q || '').trim();
  const where = {
    status: 'active',
    ...(term
      ? { OR: [{ admissionNo: { contains: term, mode: 'insensitive' } }, { patientName: { contains: term, mode: 'insensitive' } }] }
      : {}),
  };
  const rows = await prisma.clinicAdmission.findMany({
    where,
    orderBy: { id: 'desc' },
    take: 100,
  });
  return rows.map((a) => ({
    id: a.id,
    admissionNo: a.admissionNo,
    patientName: `${a.patientTitle || ''} ${a.patientName}`.trim(),
    createdAt: a.createdAt,
  }));
}

async function getAdmissionForAdjustment(id) {
  const admission = await prisma.clinicAdmission.findUnique({ where: { id: Number(id) } });
  if (!admission) throw Object.assign(new Error('Admission not found'), { status: 404 });
  return admission;
}

async function updateAdmissionAdjustment(id, data) {
  const admission = await prisma.clinicAdmission.findUnique({ where: { id: Number(id) } });
  if (!admission) throw Object.assign(new Error('Admission not found'), { status: 404 });

  const newBedId = data.bedId ? Number(data.bedId) : null;
  const oldBedId = admission.bedId;

  const updated = await prisma.clinicAdmission.update({
    where: { id: Number(id) },
    data: {
      serialNo:          data.serialNo?.trim() || null,
      admissionNo:       data.admissionNo?.trim() || '',
      mrNo:              data.mrNo ? Number(data.mrNo) : null,
      arrivedSlipNo:     data.arrivedSlipNo?.trim() || null,
      patientTitle:      data.patientTitle || 'Mr',
      patientCategory:   data.patientCategory || 'private',
      patientName:       data.patientName?.trim() || '',
      ageYears:          data.ageYears ? Number(data.ageYears) : 0,
      ageMonths:         data.ageMonths ? Number(data.ageMonths) : 0,
      ageDays:           data.ageDays ? Number(data.ageDays) : 0,
      gender:            data.gender || 'male',
      address:           data.address?.trim() || null,
      phoneNo:           data.phoneNo?.trim() || null,
      arrivedUnderRmo:   data.arrivedUnderRmo?.trim() || null,
      consultantId:      data.consultantId ? Number(data.consultantId) : null,
      referredBy:        data.referredBy?.trim() || null,
      authorityLetter:   Boolean(data.authorityLetter),
      responsibleParty:  data.responsibleParty?.trim() || null,
      previousAdmission: data.previousAdmission?.trim() || null,
      // advancePayment intentionally omitted — not editable here
      roomCategoryId:    data.roomCategoryId ? Number(data.roomCategoryId) : null,
      bedId:             newBedId,
      surgery:           Boolean(data.surgery),
      surgeryTypeId:     data.surgeryTypeId ? Number(data.surgeryTypeId) : null,
      referralPatient:   Boolean(data.referralPatient),
      referralNote:      data.referralNote?.trim() || null,
      antenatal:         Boolean(data.antenatal),
      antenatalNo:       data.antenatalNo?.trim() || null,
    },
  });

  if (newBedId !== oldBedId) {
    if (oldBedId) {
      await prisma.clinicBed.update({ where: { id: oldBedId }, data: { status: 'available' } }).catch(() => {});
    }
    if (newBedId) {
      await prisma.clinicBed.update({ where: { id: newBedId }, data: { status: 'occupied' } }).catch(() => {});
    }
  }

  return updated;
}

// ─── Transactions > Admission Status Change ──────────────────────────────────
// File Status dropdown: active ("Admit") / discharge / closed / wipeout.
// Wipeout deletes the admission (and its payments, via cascade) after saving
// a full snapshot + reason into ClinicAdmissionWipeoutLog for the report.

const WIPEOUT_REASONS = ['Baby file not allowed', 'Billing to other admission', 'Cancelled file', 'Cash Received', 'Panel closed'];

async function updateAdmissionStatus(id, { status, reason, changedBy }) {
  const admission = await prisma.clinicAdmission.findUnique({ where: { id: Number(id) } });
  if (!admission) throw Object.assign(new Error('Admission not found'), { status: 404 });

  if (!['active', 'discharge', 'closed', 'wipeout'].includes(status)) {
    throw Object.assign(new Error('Invalid file status'), { status: 400 });
  }

  if (status === 'wipeout') {
    if (!reason?.trim() || !WIPEOUT_REASONS.includes(reason)) {
      throw Object.assign(new Error('A valid Reason is required for Wipeout'), { status: 400 });
    }

    await prisma.clinicAdmissionWipeoutLog.create({
      data: {
        admissionNo:       admission.admissionNo,
        serialNo:          admission.serialNo,
        mrNo:              admission.mrNo,
        arrivedSlipNo:     admission.arrivedSlipNo,
        patientTitle:      admission.patientTitle,
        patientCategory:   admission.patientCategory,
        patientName:       admission.patientName,
        ageYears:          admission.ageYears,
        ageMonths:         admission.ageMonths,
        ageDays:           admission.ageDays,
        gender:            admission.gender,
        address:           admission.address,
        phoneNo:           admission.phoneNo,
        arrivedUnderRmo:   admission.arrivedUnderRmo,
        consultantId:      admission.consultantId,
        referredBy:        admission.referredBy,
        authorityLetter:   admission.authorityLetter,
        responsibleParty:  admission.responsibleParty,
        previousAdmission: admission.previousAdmission,
        advancePayment:    admission.advancePayment,
        roomCategoryId:    admission.roomCategoryId,
        bedId:             admission.bedId,
        surgery:           admission.surgery,
        surgeryTypeId:     admission.surgeryTypeId,
        referralPatient:   admission.referralPatient,
        referralNote:      admission.referralNote,
        antenatal:         admission.antenatal,
        antenatalNo:       admission.antenatalNo,
        admittedAt:        admission.createdAt,
        reason:            reason.trim(),
        wipedOutBy:        changedBy || null,
      },
    });

    if (admission.bedId) {
      await prisma.clinicBed.update({ where: { id: admission.bedId }, data: { status: 'available' } }).catch(() => {});
    }
    await prisma.clinicAdmission.delete({ where: { id: Number(id) } });
    return { wiped: true };
  }

  const updated = await prisma.clinicAdmission.update({ where: { id: Number(id) }, data: { status } });

  if (admission.bedId) {
    await prisma.clinicBed.update({
      where: { id: admission.bedId },
      data: { status: status === 'active' ? 'occupied' : 'available' },
    }).catch(() => {});
  }

  return updated;
}

async function getAdmissionWipeoutReport() {
  return prisma.clinicAdmissionWipeoutLog.findMany({ orderBy: { wipedOutAt: 'desc' } });
}

// ─── Transactions > Bed Shifting ──────────────────────────────────────────────

async function getBedShiftHistory(admissionId) {
  return prisma.clinicBedShiftHistory.findMany({
    where: { admissionId: Number(admissionId) },
    orderBy: { id: 'desc' },
  });
}

async function shiftAdmissionBed(admissionId, { newBedId, shiftedBy }) {
  const admission = await prisma.clinicAdmission.findUnique({ where: { id: Number(admissionId) } });
  if (!admission) throw Object.assign(new Error('Admission not found'), { status: 404 });

  const newBed = await prisma.clinicBed.findUnique({ where: { id: Number(newBedId) } });
  if (!newBed) throw Object.assign(new Error('Bed not found'), { status: 404 });
  if (newBed.status === 'not_working') throw Object.assign(new Error('Yeh bed "Not Working" hai — select nahi ho sakta'), { status: 400 });
  if (newBed.id === admission.bedId) throw Object.assign(new Error('Patient pehle se isi bed par hai'), { status: 400 });

  const conflict = await prisma.clinicAdmission.findFirst({
    where: { status: 'active', bedId: newBed.id, id: { not: admission.id } },
  });
  if (conflict) throw Object.assign(new Error('Yeh bed pehle se kisi aur active patient ke pass hai'), { status: 409 });

  const oldBedId = admission.bedId;

  await prisma.clinicBedShiftHistory.create({
    data: { admissionId: admission.id, fromBedId: oldBedId, toBedId: newBed.id, shiftedBy: shiftedBy || null },
  });

  const updated = await prisma.clinicAdmission.update({
    where: { id: admission.id },
    data: { bedId: newBed.id, roomCategoryId: newBed.roomCategoryId },
  });

  if (oldBedId) {
    await prisma.clinicBed.update({ where: { id: oldBedId }, data: { status: 'available' } }).catch(() => {});
  }
  await prisma.clinicBed.update({ where: { id: newBed.id }, data: { status: 'occupied' } }).catch(() => {});

  return updated;
}

// ─── Bed Status (manual free / not-working toggle) ────────────────────────────

async function setBedStatus(bedId, status) {
  if (!['available', 'occupied', 'not_working'].includes(status)) {
    throw Object.assign(new Error('Invalid bed status'), { status: 400 });
  }
  const bed = await prisma.clinicBed.findUnique({ where: { id: Number(bedId) } });
  if (!bed) throw Object.assign(new Error('Bed not found'), { status: 404 });
  return prisma.clinicBed.update({ where: { id: Number(bedId) }, data: { status } });
}

// ─── Transactions > Upload Patient Document ──────────────────────────────────
// Documents attach to an existing ClinicAdmission (searchable by Admission #,
// MR #, phone, or patient name). documentTypeId is a loose reference (like
// surgeryTypeId/consultantId elsewhere) — resolved manually below rather than
// via a Prisma relation, since ClinicDocumentType rows can be added/removed
// independently of ClinicPatientDocument's own lifecycle.

function mapAdmissionForDocSearch(a) {
  return {
    id: a.id,
    admissionNo: a.admissionNo,
    mrNo: a.mrNo,
    phoneNo: a.phoneNo,
    patientName: `${a.patientTitle || ''} ${a.patientName}`.trim(),
    createdAt: a.createdAt,
  };
}

async function searchAdmissionsForDocuments(q) {
  const term = String(q || '').trim();
  if (!term) {
    const rows = await prisma.clinicAdmission.findMany({ orderBy: { id: 'desc' }, take: 50 });
    return rows.map(mapAdmissionForDocSearch);
  }
  const or = [
    { admissionNo: { contains: term, mode: 'insensitive' } },
    { patientName: { contains: term, mode: 'insensitive' } },
    { phoneNo: { contains: term, mode: 'insensitive' } },
  ];
  const asNum = Number(term);
  if (!Number.isNaN(asNum)) or.push({ mrNo: asNum });
  const rows = await prisma.clinicAdmission.findMany({ where: { OR: or }, orderBy: { id: 'desc' }, take: 100 });
  return rows.map(mapAdmissionForDocSearch);
}

async function getDocumentTypeMap() {
  const types = await prisma.clinicDocumentType.findMany();
  const byId = {};
  types.forEach((t) => { byId[t.id] = t; });
  return byId;
}

async function getPatientDocuments(admissionId) {
  const docs = await prisma.clinicPatientDocument.findMany({
    where: { admissionId: Number(admissionId) },
    orderBy: { id: 'desc' },
  });
  const typeById = await getDocumentTypeMap();
  return docs.map((d) => ({ ...d, documentType: typeById[d.documentTypeId] || null }));
}

async function createPatientDocument(data) {
  const admission = await prisma.clinicAdmission.findUnique({ where: { id: Number(data.admissionId) } });
  if (!admission) throw Object.assign(new Error('Admission not found'), { status: 404 });
  return prisma.clinicPatientDocument.create({
    data: {
      admissionId:    Number(data.admissionId),
      documentTypeId: data.documentTypeId ? Number(data.documentTypeId) : null,
      fileName:       data.fileName,
      filePath:       data.filePath,
      mimeType:       data.mimeType || null,
      fileSize:       data.fileSize || null,
      uploadedBy:     data.uploadedBy || null,
    },
  });
}

async function getPatientDocumentsReport({ dateFrom, dateTo, q, documentTypeId }) {
  const where = {};

  if (dateFrom || dateTo) {
    where.uploadedAt = {};
    if (dateFrom) where.uploadedAt.gte = new Date(`${dateFrom}T00:00:00`);
    if (dateTo) where.uploadedAt.lte = new Date(`${dateTo}T23:59:59`);
  }
  if (documentTypeId) where.documentTypeId = Number(documentTypeId);

  const term = String(q || '').trim();
  if (term) {
    const or = [
      { admission: { admissionNo: { contains: term, mode: 'insensitive' } } },
      { admission: { patientName: { contains: term, mode: 'insensitive' } } },
      { admission: { phoneNo: { contains: term, mode: 'insensitive' } } },
    ];
    const asNum = Number(term);
    if (!Number.isNaN(asNum)) or.push({ admission: { mrNo: asNum } });
    where.OR = or;
  }

  const docs = await prisma.clinicPatientDocument.findMany({
    where,
    include: { admission: true },
    orderBy: { uploadedAt: 'desc' },
  });
  const typeById = await getDocumentTypeMap();
  return docs.map((d) => ({ ...d, documentType: typeById[d.documentTypeId] || null }));
}

// ─── Transactions > Provisional Bill ──────────────────────────────────────────
// "Diagnostic Bill" rows are NOT stored anywhere separately — they're computed
// live from ClinicOpdVisit rows whose admitNo matches this admission's
// admissionNo (set via the "Admit Patient" lookup added to General/Consultant/
// Emergency OPD), one row per doctor/sub-department entry on each such visit.

async function getProvisionalBillDetail(admissionId) {
  const admission = await prisma.clinicAdmission.findUnique({ where: { id: Number(admissionId) } });
  if (!admission) throw Object.assign(new Error('Admission not found'), { status: 404 });

  const [roomCategory, bed, surgeryType, dischargeType, billItems, labVisits, otherVisits, payments, salesInvoiceItems] = await Promise.all([
    admission.roomCategoryId ? prisma.clinicRoomCategory.findUnique({ where: { id: admission.roomCategoryId } }) : null,
    admission.bedId ? prisma.clinicBed.findUnique({ where: { id: admission.bedId } }) : null,
    admission.surgeryTypeId ? prisma.clinicSurgeryType.findUnique({ where: { id: admission.surgeryTypeId } }) : null,
    admission.dischargeTypeId ? prisma.clinicDischargeType.findUnique({ where: { id: admission.dischargeTypeId } }) : null,
    prisma.clinicProvisionalBillItem.findMany({ where: { admissionId: Number(admissionId) }, orderBy: { id: 'asc' } }),
    // Diagnostic Bill tab — only Laboratory counts toward this admission's
    // bill, auto-shown. Only visits with "Adjust Payment" checked count — an
    // admitNo-linked visit whose OPD slip was already paid for separately
    // (Adjust Payment left unchecked) must not be billed twice.
    prisma.clinicOpdVisit.findMany({
      where: { admitNo: admission.admissionNo, adjustPayment: true, department: 'Laboratory' },
      include: { doctors: { include: { doctor: true, subDept: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    // Everything else (Consultant OPD, Emergency, Ambulance, etc.) shows as a
    // "pending slip" the user must double-click to add to the Provisional
    // Bill tab — never auto-counted into billAmount.
    prisma.clinicOpdVisit.findMany({
      where: { admitNo: admission.admissionNo, adjustPayment: true, department: { not: 'Laboratory' } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.clinicAdmissionPayment.findMany({ where: { admissionId: Number(admissionId) }, orderBy: { id: 'asc' } }),
    // Pharmacy Bill — Inventory Sales Invoices billed against this admission
    // (Search by Admission Number → Save Invoice flow); Clinic and Inventory
    // share one Prisma client/DB so this is a direct query, no HTTP call.
    prisma.inventorySalesInvoice.findMany({
      where: { customerType: 'admission', customerName: admission.admissionNo },
      include: { item: true },
      orderBy: { invoiceDate: 'asc' },
    }),
  ]);

  const roomCategoryIds = [...new Set(billItems.map((i) => i.roomCategoryId).filter(Boolean))];
  const billHeadIds = [...new Set(billItems.map((i) => i.billHeadId).filter(Boolean))];
  const [wardRows, headRows] = await Promise.all([
    roomCategoryIds.length ? prisma.clinicRoomCategory.findMany({ where: { id: { in: roomCategoryIds } } }) : [],
    billHeadIds.length ? prisma.clinicBillHead.findMany({ where: { id: { in: billHeadIds } } }) : [],
  ]);
  const wardById = {}; wardRows.forEach((w) => { wardById[w.id] = w; });
  const headById = {}; headRows.forEach((h) => { headById[h.id] = h; });

  const resolvedBillItems = billItems.map((item) => ({
    ...item,
    roomCategory: item.roomCategoryId ? wardById[item.roomCategoryId] || null : null,
    billHead: item.billHeadId ? headById[item.billHeadId] || null : null,
  }));

  const diagnosticRows = [];
  labVisits.forEach((v) => {
    (v.doctors || []).forEach((d) => {
      diagnosticRows.push({
        id: `${v.id}-${d.id}`,
        date: v.createdAt,
        conCode: d.doctor?.code || null,
        department: v.department,
        particulars: d.subDept?.name || null,
        amount: d.amount || 0,
      });
    });
    if (!v.doctors?.length) {
      diagnosticRows.push({
        id: `${v.id}`,
        date: v.createdAt,
        conCode: null,
        department: v.department,
        particulars: null,
        amount: v.totalAmount || 0,
      });
    }
  });

  const addedVisitIds = new Set(resolvedBillItems.map((i) => i.sourceOpdVisitId).filter(Boolean));
  const pendingSlips = otherVisits
    .filter((v) => !addedVisitIds.has(v.id))
    .map((v) => ({
      id: v.id,
      date: v.createdAt,
      department: v.department,
      patientName: v.patientName,
      amount: v.totalAmount || 0,
    }));

  const pharmacyRows = salesInvoiceItems.map((si) => ({
    id: si.id,
    date: si.invoiceDate,
    medicine: si.item?.name || '—',
    qty: si.quantity,
    rate: si.saleRate,
    amount: si.totalAmount,
  }));

  const provisionalAmount = resolvedBillItems.reduce((s, i) => s + Number(i.amount || 0), 0);
  const diagnosticAmount  = diagnosticRows.reduce((s, r) => s + Number(r.amount || 0), 0);
  const pharmacyAmount    = pharmacyRows.reduce((s, r) => s + Number(r.amount || 0), 0);
  const billAmount = provisionalAmount + diagnosticAmount + pharmacyAmount;

  const paymentHistory = [];
  if (Number(admission.advancePayment) > 0) {
    paymentHistory.push({ date: admission.createdAt, slipNo: admission.serialNo, amount: Number(admission.advancePayment) });
  }
  payments.forEach((p) => paymentHistory.push({ date: p.receivedAt, slipNo: p.serialNo, amount: Number(p.amount) }));
  const amountReceived = paymentHistory.reduce((s, p) => s + p.amount, 0);

  return {
    admission,
    roomCategory,
    bed,
    surgeryType,
    dischargeType,
    billItems: resolvedBillItems,
    diagnosticRows,
    pendingSlips,
    pharmacyRows,
    patientInfo: { paymentHistory, amountReceived },
    balanceInfo: {
      billAmount,
      amountReceived,
      balance: Math.max(0, billAmount - amountReceived),
      refund: Math.max(0, amountReceived - billAmount),
    },
  };
}

async function addProvisionalBillItem(admissionId, { roomCategoryId, billHeadId, qty, rate, remarks, patientType }) {
  const admission = await prisma.clinicAdmission.findUnique({ where: { id: Number(admissionId) } });
  if (!admission) throw Object.assign(new Error('Admission not found'), { status: 404 });
  const q = Number(qty) || 1;
  const r = Number(rate) || 0;
  return prisma.clinicProvisionalBillItem.create({
    data: {
      admissionId: Number(admissionId),
      roomCategoryId: roomCategoryId ? Number(roomCategoryId) : null,
      billHeadId: billHeadId ? Number(billHeadId) : null,
      qty: q,
      rate: r,
      amount: q * r,
      remarks: remarks?.trim() || null,
      patientType: patientType || null,
    },
  });
}

// First-4-letters-of-first-word match (e.g. "Consultant" vs "Const Fee" both
// start "cons") — a deliberately simple heuristic, not a configured mapping;
// falls back to no head (billHeadId null) when nothing lines up, rather than
// guessing wrong.
function firstWordKey(s) {
  return String(s || '').trim().split(/\s+/)[0]?.toLowerCase().slice(0, 4) || '';
}

async function addProvisionalBillItemFromVisit(admissionId, opdVisitId) {
  const admission = await prisma.clinicAdmission.findUnique({ where: { id: Number(admissionId) } });
  if (!admission) throw Object.assign(new Error('Admission not found'), { status: 404 });

  const visit = await prisma.clinicOpdVisit.findUnique({ where: { id: Number(opdVisitId) } });
  if (!visit) throw Object.assign(new Error('Slip not found'), { status: 404 });
  if (visit.admitNo !== admission.admissionNo || !visit.adjustPayment) {
    throw Object.assign(new Error('Yeh slip is admission se linked nahi hai'), { status: 400 });
  }
  if (visit.department === 'Laboratory') {
    throw Object.assign(new Error('Laboratory slips khud-ba-khud Diagnostic Bill mein aati hain'), { status: 400 });
  }

  const already = await prisma.clinicProvisionalBillItem.findFirst({ where: { sourceOpdVisitId: visit.id } });
  if (already) throw Object.assign(new Error('Yeh slip pehle se add ho chuki hai'), { status: 409 });

  const heads = await prisma.clinicBillHead.findMany({ where: { type: { in: ['provisional', 'both'] } } });
  const deptKey = firstWordKey(visit.department);
  const matchedHead = heads.find((h) => firstWordKey(h.description) === deptKey) || null;

  const amount = Number(visit.totalAmount) || 0;
  return prisma.clinicProvisionalBillItem.create({
    data: {
      admissionId: Number(admissionId),
      roomCategoryId: admission.roomCategoryId || null,
      billHeadId: matchedHead?.id || null,
      qty: 1,
      rate: amount,
      amount,
      remarks: `Auto-added from ${visit.department} slip (${visit.serialNo})`,
      sourceOpdVisitId: visit.id,
    },
  });
}

async function deleteProvisionalBillItem(itemId) {
  return prisma.clinicProvisionalBillItem.delete({ where: { id: Number(itemId) } });
}

async function updateProvisionalBillHeader(admissionId, { surgery, surgeryTypeId, dischargeTypeId }) {
  const admission = await prisma.clinicAdmission.findUnique({ where: { id: Number(admissionId) } });
  if (!admission) throw Object.assign(new Error('Admission not found'), { status: 404 });
  return prisma.clinicAdmission.update({
    where: { id: Number(admissionId) },
    data: {
      surgery: Boolean(surgery),
      surgeryTypeId: surgery && surgeryTypeId ? Number(surgeryTypeId) : null,
      dischargeTypeId: dischargeTypeId ? Number(dischargeTypeId) : null,
    },
  });
}

// ─── Transactions > Discharge and Refund ─────────────────────────────────────
// A separate, standalone final bill (not the running Provisional Bill) — when
// finalized it discharges (or, if Closed Files is checked, closes) the file.

async function getDischargeBillDetail(admissionId) {
  const admission = await prisma.clinicAdmission.findUnique({ where: { id: Number(admissionId) } });
  if (!admission) throw Object.assign(new Error('Admission not found'), { status: 404 });

  const [roomCategory, bed, billItems, payments] = await Promise.all([
    admission.roomCategoryId ? prisma.clinicRoomCategory.findUnique({ where: { id: admission.roomCategoryId } }) : null,
    admission.bedId ? prisma.clinicBed.findUnique({ where: { id: admission.bedId } }) : null,
    prisma.clinicDischargeBillItem.findMany({ where: { admissionId: Number(admissionId) }, orderBy: { id: 'asc' } }),
    prisma.clinicAdmissionPayment.findMany({ where: { admissionId: Number(admissionId) }, orderBy: { id: 'asc' } }),
  ]);

  const billHeadIds = [...new Set(billItems.map((i) => i.billHeadId).filter(Boolean))];
  const doctorIds = [...new Set(billItems.map((i) => i.doctorId).filter(Boolean))];
  const [headRows, doctorRows] = await Promise.all([
    billHeadIds.length ? prisma.clinicBillHead.findMany({ where: { id: { in: billHeadIds } } }) : [],
    doctorIds.length ? prisma.clinicDoctor.findMany({ where: { id: { in: doctorIds } } }) : [],
  ]);
  const headById = {}; headRows.forEach((h) => { headById[h.id] = h; });
  const doctorById = {}; doctorRows.forEach((d) => { doctorById[d.id] = d; });

  const resolvedBillItems = billItems.map((item) => ({
    ...item,
    billHead: item.billHeadId ? headById[item.billHeadId] || null : null,
    doctor: item.doctorId ? doctorById[item.doctorId] || null : null,
  }));

  const paymentHistory = [];
  if (Number(admission.advancePayment) > 0) {
    paymentHistory.push({ date: admission.createdAt, slipNo: admission.serialNo, amount: Number(admission.advancePayment) });
  }
  payments.forEach((p) => paymentHistory.push({ date: p.receivedAt, slipNo: p.serialNo, amount: Number(p.amount) }));
  const amountReceived = paymentHistory.reduce((s, p) => s + p.amount, 0);

  const billAmount = resolvedBillItems.reduce((s, i) => s + Number(i.amount || 0), 0);
  const discountAmount = Number(admission.dischargeDiscount) || 0;
  const netAmount = Math.max(0, billAmount - discountAmount);

  return {
    admission,
    roomCategory,
    bed,
    billItems: resolvedBillItems,
    paymentHistory,
    amountReceived,
    billAmount,
    discountAmount,
    balance: Math.max(0, netAmount - amountReceived),
    refund: Math.max(0, amountReceived - netAmount),
  };
}

async function addDischargeBillItem(admissionId, { billHeadId, doctorId, amount }) {
  const admission = await prisma.clinicAdmission.findUnique({ where: { id: Number(admissionId) } });
  if (!admission) throw Object.assign(new Error('Admission not found'), { status: 404 });
  return prisma.clinicDischargeBillItem.create({
    data: {
      admissionId: Number(admissionId),
      billHeadId: billHeadId ? Number(billHeadId) : null,
      doctorId: doctorId ? Number(doctorId) : null,
      amount: Number(amount) || 0,
    },
  });
}

async function deleteDischargeBillItem(itemId) {
  return prisma.clinicDischargeBillItem.delete({ where: { id: Number(itemId) } });
}

async function finalizeDischarge(admissionId, { discountAmount, closedFiles, changedBy }) {
  const admission = await prisma.clinicAdmission.findUnique({ where: { id: Number(admissionId) } });
  if (!admission) throw Object.assign(new Error('Admission not found'), { status: 404 });

  await prisma.clinicAdmission.update({
    where: { id: Number(admissionId) },
    data: { dischargeDiscount: discountAmount != null ? Number(discountAmount) : null },
  });

  return updateAdmissionStatus(admissionId, {
    status: closedFiles ? 'closed' : 'discharge',
    changedBy,
  });
}

// ─── Patient Visits ───────────────────────────────────────────────────────────

async function bulkCreatePatientVisits(rows) {
  const data = rows.map((r) => ({
    serialNo:       r.serialNo       ? Number(r.serialNo)           : null,
    admitNo:        r.admitNo        ? Number(r.admitNo)            : null,
    visitDate:      new Date(r.visitDate),
    visitTime:      r.visitTime      || null,
    patientName:    String(r.patientName).trim(),
    department:     r.department     ? String(r.department).trim()     : null,
    subDepartment:  r.subDepartment  ? String(r.subDepartment).trim()  : null,
    doctor:         r.doctor         ? String(r.doctor).trim()         : null,
    paymentType:    r.paymentType    ? String(r.paymentType).trim()    : null,
    received:       Number(r.received)  || 0,
    balance:        Number(r.balance)   || 0,
    discount:       Number(r.discount)  || 0,
  }));

  const result = await prisma.patientVisit.createMany({ data });

  // Auto-create new doctors in ClinicDoctor from imported doctor names
  const uniqueDoctorNames = [...new Set(
    data.map(r => r.doctor).filter(Boolean).map(n => n.trim())
  )];

  if (uniqueDoctorNames.length > 0) {
    const existing = await prisma.clinicDoctor.findMany({ select: { name: true } });
    const existingNames = new Set(existing.map(d => d.name.toLowerCase()));

    for (const name of uniqueDoctorNames) {
      if (existingNames.has(name.toLowerCase())) continue;

      const initials = name.split(/\s+/).filter(Boolean)
        .map(w => w[0].toUpperCase()).join('').substring(0, 6) || 'DR';
      let code = initials;
      let i = 1;
      while (await prisma.clinicDoctor.findUnique({ where: { code } })) {
        code = `${initials}${i++}`;
      }

      await prisma.clinicDoctor.create({ data: { code, name, consultantDays: [] } });
      existingNames.add(name.toLowerCase());
    }
  }

  // Auto-create new departments in ClinicDepartment from imported department names
  const uniqueDeptNames = [...new Set(
    data.map(r => r.department).filter(Boolean).map(n => n.trim())
  )];

  if (uniqueDeptNames.length > 0) {
    const existingDepts = await prisma.clinicDepartment.findMany({ select: { name: true } });
    const existingDeptNames = new Set(existingDepts.map(d => d.name.toLowerCase()));

    for (const name of uniqueDeptNames) {
      if (existingDeptNames.has(name.toLowerCase())) continue;

      const words = name.split(/\s+/).filter(Boolean);
      const initials = words.map(w => w[0].toUpperCase()).join('').substring(0, 6) || 'DEPT';
      let code = initials;
      let i = 1;
      while (await prisma.clinicDepartment.findFirst({ where: { code } })) {
        code = `${initials}${i++}`;
      }

      await prisma.clinicDepartment.create({ data: { code, name } });
      existingDeptNames.add(name.toLowerCase());
    }
  }

  return result;
}

async function getAllConsultantRates() {
  return prisma.consultantRate.findMany({ orderBy: { consultantName: 'asc' } });
}

async function upsertConsultantRate(consultantName, rate) {
  return prisma.consultantRate.upsert({
    where:  { consultantName },
    update: { rate: Number(rate) },
    create: { consultantName, rate: Number(rate) },
  });
}

async function deleteConsultantRate(id) {
  return prisma.consultantRate.delete({ where: { id: Number(id) } });
}

async function getConsultantNames() {
  const rows = await prisma.patientVisit.findMany({
    where: { doctor: { not: null } },
    select: { doctor: true },
    distinct: ['doctor'],
    orderBy: { doctor: 'asc' },
  });
  return rows.map(r => r.doctor).filter(Boolean);
}

async function getPatientVisitByAdmitNo(admitNo) {
  const num = parseInt(admitNo, 10);
  if (isNaN(num)) return null;
  return prisma.patientVisit.findFirst({
    where: { admitNo: num },
    orderBy: { id: 'desc' },
  });
}

async function getDoctorSubDeptRates() {
  const rows = await prisma.clinicDoctorSubDept.findMany({
    include: {
      doctor:  { select: { name: true } },
      subDept: { select: { name: true } },
    },
  });
  return rows.map(r => ({
    doctorName:  r.doctor.name,
    subDeptName: r.subDept.name,
    paymentType: r.paymentType,
    normalFees:  Number(r.normalFees),
    oddFees:     Number(r.oddFees),
  }));
}

async function getPatientVisits({ fromDate, toDate, fromTime, toTime, paymentTypes, fromConsultant, toConsultant }) {
  const where = {};

  if (fromDate && toDate) {
    where.visitDate = {
      gte: new Date(fromDate),
      lte: new Date(toDate),
    };
  }

  // Build case-insensitive variants + map Complem. ↔ complementary
  let typeVariants = null;
  if (paymentTypes && paymentTypes.length > 0) {
    const variants = new Set();
    for (const t of paymentTypes) {
      variants.add(t);
      variants.add(t.toLowerCase());
      if (t.toLowerCase() === 'complem.') variants.add('complementary');
      if (t.toLowerCase() === 'complementary') variants.add('complem.');
    }
    typeVariants = [...variants];
    where.paymentType = { in: typeVariants };
  }

  if (fromConsultant && toConsultant) {
    where.doctor = { gte: fromConsultant, lte: toConsultant };
  } else if (fromConsultant) {
    where.doctor = { gte: fromConsultant };
  } else if (toConsultant) {
    where.doctor = { lte: toConsultant };
  }

  const oldVisits = await prisma.patientVisit.findMany({
    where,
    orderBy: [{ visitDate: 'asc' }, { visitTime: 'asc' }],
  });

  // Also fetch from ClinicOpdVisit (new General OPD)
  const opdWhere = {};
  if (fromDate && toDate) {
    const from = new Date(fromDate + 'T00:00:00');
    const to   = new Date(toDate   + 'T23:59:59');
    opdWhere.createdAt = { gte: from, lte: to };
  }
  if (typeVariants) {
    opdWhere.paymentType = { in: typeVariants };
  }
  const opdVisits = await prisma.clinicOpdVisit.findMany({
    where: opdWhere,
    include: {
      doctors: {
        include: {
          doctor:  { select: { name: true } },
          subDept: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const toHHMM = (dt) => {
    const d = new Date(dt);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  const mapped = opdVisits.map((v) => {
    const firstDoc = v.doctors[0];
    return {
      id:            `opd_${v.id}`,
      serialNo:      v.serialNo,
      admitNo:       null,
      visitDate:     v.createdAt,
      visitTime:     toHHMM(v.createdAt),
      patientName:   v.patientName,
      department:    v.department || 'General OPD',
      subDepartment: firstDoc?.subDept?.name || null,
      doctor:        firstDoc?.doctor?.name  || null,
      paymentType:   v.paymentType,
      received:      v.receive,
      balance:       v.totalAmount - v.receive,
      discount:      v.discount,
      _source:       'opd',
    };
  });

  // Also fetch from ClinicAdmission
  const admWhere = {};
  if (fromDate && toDate) {
    admWhere.createdAt = {
      gte: new Date(fromDate + 'T00:00:00'),
      lte: new Date(toDate   + 'T23:59:59'),
    };
  }
  if (typeVariants) {
    // Map filter types to admission patientCategory values
    const admCats = new Set();
    for (const t of typeVariants) {
      const lower = t.toLowerCase();
      admCats.add(lower);
      admCats.add(t);
      if (lower === 'cash') admCats.add('private');
      if (lower === 'private') admCats.add('private');
    }
    admWhere.patientCategory = { in: [...admCats] };
  }
  const admissions = await prisma.clinicAdmission.findMany({
    where: admWhere,
    orderBy: { createdAt: 'asc' },
  });

  // Fetch consultant names for admissions
  const consultantIds = [...new Set(admissions.map(a => a.consultantId).filter(Boolean))];
  const consultants = consultantIds.length
    ? await prisma.clinicDoctor.findMany({ where: { id: { in: consultantIds } }, select: { id: true, name: true } })
    : [];
  const consultantMap = Object.fromEntries(consultants.map(c => [c.id, c.name]));

  const mappedAdm = admissions.map((v) => ({
    id:            `adm_${v.id}`,
    // Serial # is the shared running number (same sequence as General/Emergency
    // OPD); older admissions created before that existed fall back to their
    // Admission # so the row isn't blank. Admit No is always the Admission #.
    serialNo:      v.serialNo || v.admissionNo,
    admitNo:       v.admissionNo || null,
    visitDate:     v.createdAt,
    visitTime:     toHHMM(v.createdAt),
    patientName:   `${v.patientTitle || ''} ${v.patientName}`.trim(),
    department:    'Admission',
    subDepartment: null,
    doctor:        v.consultantId ? (consultantMap[v.consultantId] || null) : null,
    paymentType:   v.patientCategory === 'private' ? 'cash' : (v.patientCategory || null),
    received:      Number(v.advancePayment) || 0,
    balance:       0,
    discount:      0,
    _source:       'admission',
  }));

  // Also fetch Receiving-against-Admission payments — each one is its own
  // transaction (own Serial #), counted on the day it was actually RECEIVED,
  // not the admission's original date. Without this, money taken via that
  // screen never showed up anywhere in the Patients List.
  const admPayWhere = {};
  if (fromDate && toDate) {
    admPayWhere.receivedAt = {
      gte: new Date(fromDate + 'T00:00:00'),
      lte: new Date(toDate   + 'T23:59:59'),
    };
  }
  if (typeVariants) {
    const wantsCash = typeVariants.some(t => t.toLowerCase() === 'cash');
    const wantsCc   = typeVariants.some(t => ['c card', 'cc', 'credit card'].includes(t.toLowerCase()));
    const allowed = [...(wantsCash ? ['cash'] : []), ...(wantsCc ? ['cc'] : [])];
    admPayWhere.paymentType = { in: allowed.length ? allowed : ['__none__'] };
  }
  const admPayments = await prisma.clinicAdmissionPayment.findMany({
    where: admPayWhere,
    include: { admission: { select: { admissionNo: true, patientTitle: true, patientName: true } } },
    orderBy: { receivedAt: 'asc' },
  });

  const mappedAdmPay = admPayments.map((p) => ({
    id:            `admpay_${p.id}`,
    serialNo:      p.serialNo,
    admitNo:       p.admission?.admissionNo || null,
    visitDate:     p.receivedAt,
    visitTime:     toHHMM(p.receivedAt),
    patientName:   `${p.admission?.patientTitle || ''} ${p.admission?.patientName || ''}`.trim(),
    department:    'Admission',
    subDepartment: null,
    doctor:        null,
    paymentType:   p.paymentType,
    received:      Number(p.amount) || 0,
    balance:       0,
    discount:      0,
    _source:       'admission-payment',
  }));

  // Merge all sources and sort chronologically (date + time) instead of
  // stacking them as separate blocks — otherwise the list reads as "source-wise"
  // even when each block is individually date-sorted.
  const merged = [...oldVisits.map(v => ({ ...v, _source: 'old' })), ...mapped, ...mappedAdm, ...mappedAdmPay];
  const sortMs = (v) => {
    const d = new Date(v.visitDate);
    const [h, m] = String(v.visitTime || '00:00').split(':').map((n) => Number(n) || 0);
    d.setHours(h, m, 0, 0);
    return d.getTime();
  };
  merged.sort((a, b) => sortMs(a) - sortMs(b));
  return merged;
}

function normNameSvc(s) {
  return (s || '').toLowerCase().replace(/[-._]/g, ' ').replace(/\s+/g, ' ').trim();
}

async function importDoctorSubDeptRates(doctorId, rows, deptTitle, doctorName) {
  let dId = Number(doctorId);

  // Try by ID first
  let doctor = await prisma.clinicDoctor.findUnique({ where: { id: dId }, select: { id: true, name: true } });

  // Fallback: partial/fuzzy name match
  if (!doctor) {
    const allDoctors = await prisma.clinicDoctor.findMany({ select: { id: true, name: true } });
    if (doctorName) {
      const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
      const sentName = norm(doctorName);
      doctor = allDoctors.find((d) => norm(d.name) === sentName)
            || allDoctors.find((d) => norm(d.name).includes(sentName) || sentName.includes(norm(d.name)));
    }
    if (!doctor) {
      const allDoctors2 = await prisma.clinicDoctor.findMany({ select: { id: true, name: true } });
      throw new Error(`Doctor not found. DB mein yeh doctors hain: ${allDoctors2.map((d) => `[${d.id}] ${d.name}`).join(' | ')}`);
    }
  }

  dId = doctor.id;

  // Load all sub-depts and departments once
  const allSubDepts = await prisma.clinicSubDepartment.findMany({ select: { id: true, name: true, departmentId: true } });
  const allDepts    = await prisma.clinicDepartment.findMany({ select: { id: true, name: true, code: true } });

  // Find department by title from Excel (e.g. "X-RAY", "ULTRA SOUND")
  let dept = null;
  if (deptTitle) {
    dept = allDepts.find((d) => normNameSvc(d.name) === normNameSvc(deptTitle));
    if (!dept) {
      const deptCount = await prisma.clinicDepartment.count();
      const newCode = String(deptCount + 1).padStart(2, '0');
      dept = await prisma.clinicDepartment.create({
        data: { code: newCode, name: deptTitle.trim() },
        select: { id: true, name: true, code: true },
      });
      allDepts.push(dept);
    }
  }

  let matched = 0, created = 0, updated = 0, autoCreatedSubDepts = 0;
  const notFound = [];

  for (const row of rows) {
    const normTest = normNameSvc(row.testName);

    // Try to find existing sub-dept — SIRF selected department ke andar (poore DB mein nahi).
    // Warna ek test jo kisi aur department mein mojood ho, wo galti se reuse ho jaata tha aur
    // selected department khali reh jaata (phantom empty department). Isliye dept.id se scope.
    let subDept = dept
      ? allSubDepts.find((sd) => sd.departmentId === dept.id && normNameSvc(sd.name) === normTest)
      : allSubDepts.find((sd) => normNameSvc(sd.name) === normTest);

    // If not found and we have a department → auto-create sub-dept
    if (!subDept && dept) {
      const count = await prisma.clinicSubDepartment.count({ where: { departmentId: dept.id } });
      const code  = dept.code + String(count + 1).padStart(2, '0');
      const newSd = await prisma.clinicSubDepartment.create({
        data: { code, name: row.testName.trim(), departmentId: dept.id },
        select: { id: true, name: true, departmentId: true },
      });
      allSubDepts.push(newSd); // update local cache
      subDept = newSd;
      autoCreatedSubDepts++;
    }

    if (!subDept) { notFound.push(row.testName); continue; }

    const existing = await prisma.clinicDoctorSubDept.findFirst({
      where: { doctorId: dId, subDeptId: subDept.id },
    });

    const rate = Number(row.normalFees) || 0;
    if (existing) {
      // Only update patient charges — preserve doctor's % (normalFees/paymentType) set via UI
      await prisma.clinicDoctorSubDept.update({
        where: { id: existing.id },
        data: { normalCharges: rate, oddCharges: rate },
      });
      updated++;
    } else {
      await prisma.clinicDoctorSubDept.create({
        data: {
          doctorId: dId,
          subDeptId: subDept.id,
          paymentType: 'percent',
          normalFees: 0,
          oddFees:    0,
          normalCharges: rate,
          oddCharges:    rate,
          onCall:        false,
          consultantDays: [],
        },
      });
      created++;
    }
    matched++;
  }

  return { matched, created, updated, autoCreatedSubDepts, notFound };
}

async function getConsultantStatement({ consultantId, fromDate, toDate, fromTime, toTime }) {
  const doctorId = Number(consultantId);
  if (!doctorId) throw new Error('consultantId required');

  const consultant = await prisma.clinicDoctor.findUnique({
    where: { id: doctorId },
    select: { id: true, code: true, name: true, speciality: true },
  });
  if (!consultant) throw new Error('Consultant not found');

  // Build rate maps: by subDeptId (for new OPD) and by normalised subDept name (for old PatientVisit)
  const rateRows = await prisma.clinicDoctorSubDept.findMany({
    where: { doctorId },
    include: { subDept: { select: { id: true, name: true } } },
  });
  const rateBySubDeptId = {};
  const rateBySubDeptName = {};
  for (const r of rateRows) {
    const info = { paymentType: r.paymentType, normalFees: Number(r.normalFees) };
    rateBySubDeptId[r.subDeptId] = info;
    rateBySubDeptName[normNameSvc(r.subDept.name)] = info;
  }

  const calcCons = (amount, admitPatient, rateInfo) => {
    if (admitPatient || !rateInfo?.normalFees) return 0;
    return rateInfo.paymentType === 'percent'
      ? amount * rateInfo.normalFees / 100
      : rateInfo.normalFees;
  };

  const fromDt = fromDate ? new Date(fromDate + 'T00:00:00') : null;
  const toDt   = toDate   ? new Date(toDate   + 'T23:59:59') : null;

  const timeInRange = (t) => {
    if (!fromTime || !toTime || fromTime === toTime) return true;
    if (fromTime <= toTime) return t >= fromTime && t <= toTime;
    return t >= fromTime || t <= toTime;   // overnight
  };

  const toHHMM = (dt) => {
    const d = new Date(dt);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  const result = [];

  // ── 1. Old PatientVisit table (imported data) ──────────────────────────────
  const oldWhere = { doctor: { equals: consultant.name, mode: 'insensitive' } };
  if (fromDt && toDt) oldWhere.visitDate = { gte: fromDt, lte: toDt };
  const oldVisits = await prisma.patientVisit.findMany({
    where: oldWhere,
    orderBy: [{ visitDate: 'asc' }, { visitTime: 'asc' }],
  });
  for (const v of oldVisits) {
    const t = v.visitTime || '00:00';
    if (!timeInRange(t)) continue;
    const rateInfo = rateBySubDeptName[normNameSvc(v.subDepartment || '')] || null;
    const amount   = Number(v.received || 0);
    result.push({
      id:            `old_${v.id}`,
      serialNo:      v.serialNo ? String(v.serialNo) : '—',
      mrNo:          v.admitNo || null,
      visitTime:     t,
      patientName:   v.patientName,
      paymentType:   (v.paymentType || 'Cash').toLowerCase(),
      amount,
      consAmt:       calcCons(amount, false, rateInfo),
      admitPatient:  false,
      department:    v.department,
      subDepartment: v.subDepartment,
    });
  }

  // ── 2. New ClinicOpdVisit table ────────────────────────────────────────────
  const newWhere = { doctors: { some: { doctorId } } };
  if (fromDt && toDt) newWhere.createdAt = { gte: fromDt, lte: toDt };
  const newVisits = await prisma.clinicOpdVisit.findMany({
    where: newWhere,
    include: {
      doctors: {
        where: { doctorId },
        include: { subDept: { select: { id: true, name: true } } },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
  for (const v of newVisits) {
    const docEntry = v.doctors[0];
    if (!docEntry) continue;
    const t = toHHMM(v.createdAt);
    if (!timeInRange(t)) continue;
    const rateInfo = rateBySubDeptId[docEntry.subDeptId] || null;
    result.push({
      id:            `new_${v.id}`,
      serialNo:      v.serialNo,
      mrNo:          v.mrNo,
      visitTime:     t,
      patientName:   v.patientName,
      paymentType:   (v.paymentType || 'cash').toLowerCase(),
      amount:        v.totalAmount,
      consAmt:       calcCons(v.totalAmount, v.admitPatient, rateInfo),
      admitPatient:  v.admitPatient,
      department:    v.department,
      subDepartment: docEntry.subDept?.name || null,
    });
  }

  return { consultant, visits: result };
}

// ─── Revenue Dashboard (Inquiries) ───────────────────────────────────────────

async function getRevenueDashboard({ period, year, month, department, subDept, consultant, paymentType }) {
  year   = parseInt(year)  || new Date().getFullYear();
  month  = parseInt(month) || (new Date().getMonth() + 1);
  period = period || 'monthly_daily';

  // ── PatientVisit WHERE ────────────────────────────────────────────────────
  // Cancelled slips revenue dashboard mein NAHI aayengi (case-insensitive, dono spellings).
  const pvConds  = [`LOWER("paymentType") NOT IN ('canceled','cancelled')`];
  const pvParams = [];
  if (department && department !== 'ALL') { pvParams.push(department);             pvConds.push(`department ILIKE $${pvParams.length}`); }
  if (subDept    && subDept    !== 'ALL') { pvParams.push(subDept);                pvConds.push(`"subDepartment" ILIKE $${pvParams.length}`); }
  if (consultant && consultant !== 'ALL') { pvParams.push(consultant);             pvConds.push(`doctor ILIKE $${pvParams.length}`); }
  if (paymentType && paymentType !== 'ALL') { pvParams.push(paymentType);          pvConds.push(`"paymentType" = $${pvParams.length}`); }
  const pvWhere = pvConds.join(' AND ');

  // ── ClinicOpdVisit WHERE ──────────────────────────────────────────────────
  // Cancelled slips ka patient dashboard mein dikhta rehta hai (count nahi ghatta) —
  // sirf uska amount contribution 0 kar dete hain (OV_AMT fragment neeche).
  const ovConds  = [];
  const ovParams = [];
  if (department && department !== 'ALL') { ovParams.push(department);             ovConds.push(`department ILIKE $${ovParams.length}`); }
  if (subDept    && subDept    !== 'ALL') { ovParams.push(subDept);                ovConds.push(`EXISTS (SELECT 1 FROM "ClinicOpdVisitDoctor" cod JOIN "ClinicSubDept" sd ON sd.id = cod."subDeptId" WHERE cod."visitId" = "ClinicOpdVisit".id AND sd.name ILIKE $${ovParams.length})`); }
  if (consultant && consultant !== 'ALL') { ovParams.push(consultant);             ovConds.push(`EXISTS (SELECT 1 FROM "ClinicOpdVisitDoctor" cod JOIN "ClinicDoctor" d ON d.id = cod."doctorId" WHERE cod."visitId" = "ClinicOpdVisit".id AND d.name ILIKE $${ovParams.length})`); }
  if (paymentType && paymentType !== 'ALL') { ovParams.push(paymentType.toLowerCase()); ovConds.push(`LOWER("paymentType") = $${ovParams.length}`); }
  const ovWhere = ovConds.length > 0 ? ovConds.join(' AND ') : 'TRUE';

  // ── ClinicAdmission WHERE ─────────────────────────────────────────────────
  // Advance payment taken at admission is real revenue but previously wasn't
  // included here at all. Admission rows have no real department/sub-dept —
  // they're always treated as the "Admission" department; paymentType maps
  // onto patientCategory (private=Cash, cc=C Card, etc.).
  const ADM_PAYTYPE_MAP = { cash: 'private', staff: 'staff', panel: 'panel', complementary: 'complementary', 'c card': 'cc' };
  const admConds  = [];
  const admParams = [];
  if (department && department !== 'ALL') { admParams.push(department);           admConds.push(`'Admission' ILIKE $${admParams.length}`); }
  if (subDept    && subDept    !== 'ALL') { admConds.push('FALSE'); } // admission has no sub-department
  if (consultant && consultant !== 'ALL') { admParams.push(consultant);           admConds.push(`EXISTS (SELECT 1 FROM "ClinicDoctor" d WHERE d.id = "ClinicAdmission"."consultantId" AND d.name ILIKE $${admParams.length})`); }
  if (paymentType && paymentType !== 'ALL') {
    const mapped = ADM_PAYTYPE_MAP[paymentType.toLowerCase()];
    if (mapped) { admParams.push(mapped); admConds.push(`"patientCategory" = $${admParams.length}`); }
    else { admConds.push('FALSE'); }
  }
  const admWhere = admConds.length > 0 ? admConds.join(' AND ') : 'TRUE';

  // ── ClinicAdmissionPayment WHERE (Receiving against Admission) ───────────
  // Later top-up payments count as revenue on the day they're actually
  // RECEIVED (not the original admission day) — but don't count as an extra
  // "patient" since it's the same admission, not a new one.
  const admPayConds  = [];
  const admPayParams = [];
  if (department && department !== 'ALL') { admPayParams.push(department); admPayConds.push(`'Admission' ILIKE $${admPayParams.length}`); }
  if (subDept    && subDept    !== 'ALL') { admPayConds.push('FALSE'); }
  if (consultant && consultant !== 'ALL') { admPayParams.push(consultant); admPayConds.push(`EXISTS (SELECT 1 FROM "ClinicAdmission" a JOIN "ClinicDoctor" d ON d.id = a."consultantId" WHERE a.id = "ClinicAdmissionPayment"."admissionId" AND d.name ILIKE $${admPayParams.length})`); }
  if (paymentType && paymentType !== 'ALL') {
    const ptl = paymentType.toLowerCase();
    const mapped = ptl === 'cash' ? 'cash' : (ptl === 'c card' || ptl === 'cc' ? 'cc' : null);
    if (mapped) { admPayParams.push(mapped); admPayConds.push(`"paymentType" = $${admPayParams.length}`); }
    else { admPayConds.push('FALSE'); }
  }
  const admPayWhere = admPayConds.length > 0 ? admPayConds.join(' AND ') : 'TRUE';

  // ── Business day (hospital day) ───────────────────────────────────────────
  // Hospital ka din subah 8:00 AM se shuru ho kar agle din 7:59:59 AM tak chalta hai,
  // aur wo START waale din ke naam se count hota hai. To kisi visit ka business date =
  // DATE(timestamp - 8 hours). e.g. 3 July 07:59 AM → 2 July; 3 July 08:00 AM → 3 July.
  //   PatientVisit: visitDate (date) + visitTime (text "HH:MM") ko jodo, phir 8h ghatao.
  //                 time null/blank ho to midday maan lo taake apne hi visitDate par rahe.
  //   ClinicOpdVisit: createdAt timestamp se seedha 8h ghatao.
  const PV_BIZ      = `(("visitDate" + COALESCE(NULLIF("visitTime",'')::time, '12:00'::time)) - INTERVAL '8 hours')::date`;
  const OV_BIZ      = `("createdAt" - INTERVAL '8 hours')::date`;
  const ADM_BIZ     = `("createdAt" - INTERVAL '8 hours')::date`;
  const ADM_PAY_BIZ = `("receivedAt" - INTERVAL '8 hours')::date`;

  // Cancelled ClinicOpdVisit rows: patient still counts (COUNT(*) untouched), amount is 0.
  const OV_AMT = `(CASE WHEN LOWER(COALESCE(status,'')) IN ('canceled','cancelled') THEN 0 ELSE (receive - COALESCE(refund,0)) END)`;

  // ── Helper: aggregate row → object ───────────────────────────────────────
  const toObj = (r, keyField) => ({
    [keyField]:    r[keyField],
    totalPatients: Number(r.totalPatients),
    totalAmount:   Number(r.totalAmount),
    cashPatients:  Number(r.cashPatients),
    cashAmount:    Number(r.cashAmount),
    panelPatients: Number(r.panelPatients),
    panelAmount:   Number(r.panelAmount),
    ccPatients:    Number(r.ccPatients),
    ccAmount:      Number(r.ccAmount),
  });

  // ── Helper: merge two maps by key ─────────────────────────────────────────
  const mergeMap = (pvMap, ovMap, keyField) => {
    const keys = new Set([...Object.keys(pvMap), ...Object.keys(ovMap)]);
    const out  = {};
    for (const k of keys) {
      const a = pvMap[k] || {}, b = ovMap[k] || {};
      out[k] = {
        [keyField]:    a[keyField] ?? b[keyField],
        totalPatients: (a.totalPatients||0) + (b.totalPatients||0),
        totalAmount:   (a.totalAmount  ||0) + (b.totalAmount  ||0),
        cashPatients:  (a.cashPatients ||0) + (b.cashPatients ||0),
        cashAmount:    (a.cashAmount   ||0) + (b.cashAmount   ||0),
        panelPatients: (a.panelPatients||0) + (b.panelPatients||0),
        panelAmount:   (a.panelAmount  ||0) + (b.panelAmount  ||0),
        ccPatients:    (a.ccPatients   ||0) + (b.ccPatients   ||0),
        ccAmount:      (a.ccAmount     ||0) + (b.ccAmount     ||0),
      };
    }
    return out;
  };

  // ── SQL fragments shared across periods ───────────────────────────────────
  const pvAggCols = `
    COUNT(*)::int AS "totalPatients",
    COALESCE(SUM(received - COALESCE(refund,0)),0) AS "totalAmount",
    COUNT(*) FILTER (WHERE "paymentType" = 'Cash')::int  AS "cashPatients",
    COALESCE(SUM(received - COALESCE(refund,0)) FILTER (WHERE "paymentType" = 'Cash'),0)  AS "cashAmount",
    COUNT(*) FILTER (WHERE "paymentType" = 'Panel')::int AS "panelPatients",
    COALESCE(SUM(received - COALESCE(refund,0)) FILTER (WHERE "paymentType" = 'Panel'),0) AS "panelAmount",
    COUNT(*) FILTER (WHERE "paymentType" = 'C Card')::int AS "ccPatients",
    COALESCE(SUM(received - COALESCE(refund,0)) FILTER (WHERE "paymentType" = 'C Card'),0) AS "ccAmount"`;

  const ovAggCols = `
    COUNT(*)::int AS "totalPatients",
    COALESCE(SUM(${OV_AMT}),0) AS "totalAmount",
    COUNT(*) FILTER (WHERE LOWER("paymentType") = 'cash')::int  AS "cashPatients",
    COALESCE(SUM(${OV_AMT}) FILTER (WHERE LOWER("paymentType") = 'cash'),0)  AS "cashAmount",
    COUNT(*) FILTER (WHERE LOWER("paymentType") = 'panel')::int AS "panelPatients",
    COALESCE(SUM(${OV_AMT}) FILTER (WHERE LOWER("paymentType") = 'panel'),0) AS "panelAmount",
    COUNT(*) FILTER (WHERE LOWER("paymentType") IN ('c card','cc','credit card'))::int AS "ccPatients",
    COALESCE(SUM(${OV_AMT}) FILTER (WHERE LOWER("paymentType") IN ('c card','cc','credit card')),0) AS "ccAmount"`;

  const admAggCols = `
    COUNT(*)::int AS "totalPatients",
    COALESCE(SUM("advancePayment"),0) AS "totalAmount",
    COUNT(*) FILTER (WHERE "patientCategory" = 'private')::int AS "cashPatients",
    COALESCE(SUM("advancePayment") FILTER (WHERE "patientCategory" = 'private'),0) AS "cashAmount",
    COUNT(*) FILTER (WHERE "patientCategory" = 'panel')::int AS "panelPatients",
    COALESCE(SUM("advancePayment") FILTER (WHERE "patientCategory" = 'panel'),0) AS "panelAmount",
    COUNT(*) FILTER (WHERE "patientCategory" = 'cc')::int AS "ccPatients",
    COALESCE(SUM("advancePayment") FILTER (WHERE "patientCategory" = 'cc'),0) AS "ccAmount"`;

  // Receiving-against-Admission payments: amount only, never counted as a patient.
  const admPayAggCols = `
    0::int AS "totalPatients",
    COALESCE(SUM(amount),0) AS "totalAmount",
    0::int AS "cashPatients",
    COALESCE(SUM(amount) FILTER (WHERE "paymentType" = 'cash'),0) AS "cashAmount",
    0::int AS "panelPatients",
    0::numeric AS "panelAmount",
    0::int AS "ccPatients",
    COALESCE(SUM(amount) FILTER (WHERE "paymentType" = 'cc'),0) AS "ccAmount"`;

  let data = [];

  if (period === 'monthly_daily') {
    const daysInMonth = new Date(year, month, 0).getDate();
    const startDate   = `${year}-${String(month).padStart(2,'0')}-01`;
    const endDate     = `${year}-${String(month).padStart(2,'0')}-${String(daysInMonth).padStart(2,'0')}`;

    const pvP = [...pvParams, startDate, endDate];
    const pvSi = pvParams.length + 1, pvEi = pvParams.length + 2;
    const pvRows = await prisma.$queryRawUnsafe(`
      SELECT ${PV_BIZ}::text AS date, ${pvAggCols}
      FROM "PatientVisit"
      WHERE ${pvWhere} AND ${PV_BIZ} >= $${pvSi}::date AND ${PV_BIZ} <= $${pvEi}::date
      GROUP BY ${PV_BIZ} ORDER BY ${PV_BIZ}
    `, ...pvP);

    const ovP = [...ovParams, startDate, endDate];
    const ovSi = ovParams.length + 1, ovEi = ovParams.length + 2;
    const ovRows = await prisma.$queryRawUnsafe(`
      SELECT ${OV_BIZ}::text AS date, ${ovAggCols}
      FROM "ClinicOpdVisit"
      WHERE ${ovWhere} AND ${OV_BIZ} >= $${ovSi}::date AND ${OV_BIZ} <= $${ovEi}::date
      GROUP BY ${OV_BIZ} ORDER BY date
    `, ...ovP);

    const admP = [...admParams, startDate, endDate];
    const admSi = admParams.length + 1, admEi = admParams.length + 2;
    const admRows = await prisma.$queryRawUnsafe(`
      SELECT ${ADM_BIZ}::text AS date, ${admAggCols}
      FROM "ClinicAdmission"
      WHERE ${admWhere} AND ${ADM_BIZ} >= $${admSi}::date AND ${ADM_BIZ} <= $${admEi}::date
      GROUP BY ${ADM_BIZ} ORDER BY date
    `, ...admP);

    const admPayP = [...admPayParams, startDate, endDate];
    const admPaySi = admPayParams.length + 1, admPayEi = admPayParams.length + 2;
    const admPayRows = await prisma.$queryRawUnsafe(`
      SELECT ${ADM_PAY_BIZ}::text AS date, ${admPayAggCols}
      FROM "ClinicAdmissionPayment"
      WHERE ${admPayWhere} AND ${ADM_PAY_BIZ} >= $${admPaySi}::date AND ${ADM_PAY_BIZ} <= $${admPayEi}::date
      GROUP BY ${ADM_PAY_BIZ} ORDER BY date
    `, ...admPayP);

    const pvMap = {}, ovMap = {}, admMap = {}, admPayMap = {};
    for (const r of pvRows) pvMap[r.date] = toObj(r, 'date');
    for (const r of ovRows) ovMap[r.date] = toObj(r, 'date');
    for (const r of admRows) admMap[r.date] = toObj(r, 'date');
    for (const r of admPayRows) admPayMap[r.date] = toObj(r, 'date');

    const merged = mergeMap(mergeMap(mergeMap(pvMap, ovMap, 'date'), admMap, 'date'), admPayMap, 'date');
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      if (!merged[key]) merged[key] = { date: key, totalPatients:0, totalAmount:0, cashPatients:0, cashAmount:0, panelPatients:0, panelAmount:0, ccPatients:0, ccAmount:0 };
    }
    data = Object.values(merged).sort((a,b) => a.date.localeCompare(b.date));

  } else if (period === 'yearly_monthly' || period === 'yearly_daily') {
    const pvP = [...pvParams, year];
    const pvYi = pvParams.length + 1;
    const pvRows = await prisma.$queryRawUnsafe(`
      SELECT EXTRACT(MONTH FROM ${PV_BIZ})::int AS month, ${pvAggCols}
      FROM "PatientVisit"
      WHERE ${pvWhere} AND EXTRACT(YEAR FROM ${PV_BIZ}) = $${pvYi}
      GROUP BY EXTRACT(MONTH FROM ${PV_BIZ}) ORDER BY month
    `, ...pvP);

    const ovP = [...ovParams, year];
    const ovYi = ovParams.length + 1;
    const ovRows = await prisma.$queryRawUnsafe(`
      SELECT EXTRACT(MONTH FROM ${OV_BIZ})::int AS month, ${ovAggCols}
      FROM "ClinicOpdVisit"
      WHERE ${ovWhere} AND EXTRACT(YEAR FROM ${OV_BIZ}) = $${ovYi}
      GROUP BY EXTRACT(MONTH FROM ${OV_BIZ}) ORDER BY month
    `, ...ovP);

    const admP = [...admParams, year];
    const admYi = admParams.length + 1;
    const admRows = await prisma.$queryRawUnsafe(`
      SELECT EXTRACT(MONTH FROM ${ADM_BIZ})::int AS month, ${admAggCols}
      FROM "ClinicAdmission"
      WHERE ${admWhere} AND EXTRACT(YEAR FROM ${ADM_BIZ}) = $${admYi}
      GROUP BY EXTRACT(MONTH FROM ${ADM_BIZ}) ORDER BY month
    `, ...admP);

    const admPayYP = [...admPayParams, year];
    const admPayYi = admPayParams.length + 1;
    const admPayRows = await prisma.$queryRawUnsafe(`
      SELECT EXTRACT(MONTH FROM ${ADM_PAY_BIZ})::int AS month, ${admPayAggCols}
      FROM "ClinicAdmissionPayment"
      WHERE ${admPayWhere} AND EXTRACT(YEAR FROM ${ADM_PAY_BIZ}) = $${admPayYi}
      GROUP BY EXTRACT(MONTH FROM ${ADM_PAY_BIZ}) ORDER BY month
    `, ...admPayYP);

    const pvMap = {}, ovMap = {}, admMap = {}, admPayMap = {};
    for (const r of pvRows) pvMap[r.month] = toObj(r, 'month');
    for (const r of ovRows) ovMap[r.month] = toObj(r, 'month');
    for (const r of admRows) admMap[r.month] = toObj(r, 'month');
    for (const r of admPayRows) admPayMap[r.month] = toObj(r, 'month');

    const merged = mergeMap(mergeMap(mergeMap(pvMap, ovMap, 'month'), admMap, 'month'), admPayMap, 'month');
    for (let m = 1; m <= 12; m++) {
      if (!merged[m]) merged[m] = { month: m, totalPatients:0, totalAmount:0, cashPatients:0, cashAmount:0, panelPatients:0, panelAmount:0, ccPatients:0, ccAmount:0 };
    }
    data = Object.values(merged).sort((a,b) => a.month - b.month);

  } else if (period === 'multi_year') {
    const pvRows = await prisma.$queryRawUnsafe(`
      SELECT EXTRACT(YEAR FROM ${PV_BIZ})::int AS year, ${pvAggCols}
      FROM "PatientVisit" WHERE ${pvWhere}
      GROUP BY EXTRACT(YEAR FROM ${PV_BIZ}) ORDER BY year
    `, ...pvParams);

    const ovRows = await prisma.$queryRawUnsafe(`
      SELECT EXTRACT(YEAR FROM ${OV_BIZ})::int AS year, ${ovAggCols}
      FROM "ClinicOpdVisit" WHERE ${ovWhere}
      GROUP BY EXTRACT(YEAR FROM ${OV_BIZ}) ORDER BY year
    `, ...ovParams);

    const admRows = await prisma.$queryRawUnsafe(`
      SELECT EXTRACT(YEAR FROM ${ADM_BIZ})::int AS year, ${admAggCols}
      FROM "ClinicAdmission" WHERE ${admWhere}
      GROUP BY EXTRACT(YEAR FROM ${ADM_BIZ}) ORDER BY year
    `, ...admParams);

    const admPayRows = await prisma.$queryRawUnsafe(`
      SELECT EXTRACT(YEAR FROM ${ADM_PAY_BIZ})::int AS year, ${admPayAggCols}
      FROM "ClinicAdmissionPayment" WHERE ${admPayWhere}
      GROUP BY EXTRACT(YEAR FROM ${ADM_PAY_BIZ}) ORDER BY year
    `, ...admPayParams);

    const pvMap = {}, ovMap = {}, admMap = {}, admPayMap = {};
    for (const r of pvRows) pvMap[r.year] = toObj(r, 'year');
    for (const r of ovRows) ovMap[r.year] = toObj(r, 'year');
    for (const r of admRows) admMap[r.year] = toObj(r, 'year');
    for (const r of admPayRows) admPayMap[r.year] = toObj(r, 'year');

    const merged = mergeMap(mergeMap(mergeMap(pvMap, ovMap, 'year'), admMap, 'year'), admPayMap, 'year');
    data = Object.values(merged).sort((a,b) => a.year - b.year);
  }

  const totalPatients = data.reduce((s,d) => s + d.totalPatients, 0);
  const totalAmount   = data.reduce((s,d) => s + d.totalAmount,   0);
  const daysWithData  = data.filter(d => d.totalPatients > 0).length;
  const dailyAvg      = daysWithData > 0 ? totalAmount / daysWithData : 0;
  const daysInMonth   = new Date(year, month, 0).getDate();
  const prognosis     = period === 'monthly_daily' ? dailyAvg * daysInMonth : 0;

  // Last year same month
  let lastYearAmount = 0;
  if (period === 'monthly_daily') {
    const dim2    = new Date(year-1, month, 0).getDate();
    const lyStart = `${year-1}-${String(month).padStart(2,'0')}-01`;
    const lyEnd   = `${year-1}-${String(month).padStart(2,'0')}-${String(dim2).padStart(2,'0')}`;
    const pvLyP   = [...pvParams, lyStart, lyEnd];
    const pvLySi  = pvParams.length + 1, pvLyEi = pvParams.length + 2;
    const ovLyP   = [...ovParams, lyStart, lyEnd];
    const ovLySi  = ovParams.length + 1, ovLyEi = ovParams.length + 2;
    const admLyP  = [...admParams, lyStart, lyEnd];
    const admLySi = admParams.length + 1, admLyEi = admParams.length + 2;
    const admPayLyP  = [...admPayParams, lyStart, lyEnd];
    const admPayLySi = admPayParams.length + 1, admPayLyEi = admPayParams.length + 2;
    const [pvLy, ovLy, admLy, admPayLy] = await Promise.all([
      prisma.$queryRawUnsafe(`SELECT COALESCE(SUM(received - COALESCE(refund,0)),0) AS total FROM "PatientVisit" WHERE ${pvWhere} AND ${PV_BIZ} >= $${pvLySi}::date AND ${PV_BIZ} <= $${pvLyEi}::date`, ...pvLyP),
      prisma.$queryRawUnsafe(`SELECT COALESCE(SUM(${OV_AMT}),0) AS total FROM "ClinicOpdVisit" WHERE ${ovWhere} AND ${OV_BIZ} >= $${ovLySi}::date AND ${OV_BIZ} <= $${ovLyEi}::date`, ...ovLyP),
      prisma.$queryRawUnsafe(`SELECT COALESCE(SUM("advancePayment"),0) AS total FROM "ClinicAdmission" WHERE ${admWhere} AND ${ADM_BIZ} >= $${admLySi}::date AND ${ADM_BIZ} <= $${admLyEi}::date`, ...admLyP),
      prisma.$queryRawUnsafe(`SELECT COALESCE(SUM(amount),0) AS total FROM "ClinicAdmissionPayment" WHERE ${admPayWhere} AND ${ADM_PAY_BIZ} >= $${admPayLySi}::date AND ${ADM_PAY_BIZ} <= $${admPayLyEi}::date`, ...admPayLyP),
    ]);
    lastYearAmount = Number(pvLy[0]?.total||0) + Number(ovLy[0]?.total||0) + Number(admLy[0]?.total||0) + Number(admPayLy[0]?.total||0);
  }

  // Trend: last 12 months (all three sources)
  const [pvTrend, ovTrend, admTrend, admPayTrend] = await Promise.all([
    prisma.$queryRawUnsafe(`
      SELECT EXTRACT(YEAR FROM ${PV_BIZ})::int AS year, EXTRACT(MONTH FROM ${PV_BIZ})::int AS month,
        COUNT(*)::int AS "totalPatients", COALESCE(SUM(received - COALESCE(refund,0)),0) AS "totalAmount"
      FROM "PatientVisit"
      WHERE ${pvWhere} AND ${PV_BIZ} >= (CURRENT_DATE - INTERVAL '12 months')
      GROUP BY EXTRACT(YEAR FROM ${PV_BIZ}), EXTRACT(MONTH FROM ${PV_BIZ}) ORDER BY year, month
    `, ...pvParams),
    prisma.$queryRawUnsafe(`
      SELECT EXTRACT(YEAR FROM ${OV_BIZ})::int AS year, EXTRACT(MONTH FROM ${OV_BIZ})::int AS month,
        COUNT(*)::int AS "totalPatients", COALESCE(SUM(${OV_AMT}),0) AS "totalAmount"
      FROM "ClinicOpdVisit"
      WHERE ${ovWhere} AND ${OV_BIZ} >= (CURRENT_DATE - INTERVAL '12 months')
      GROUP BY EXTRACT(YEAR FROM ${OV_BIZ}), EXTRACT(MONTH FROM ${OV_BIZ}) ORDER BY year, month
    `, ...ovParams),
    prisma.$queryRawUnsafe(`
      SELECT EXTRACT(YEAR FROM ${ADM_BIZ})::int AS year, EXTRACT(MONTH FROM ${ADM_BIZ})::int AS month,
        COUNT(*)::int AS "totalPatients", COALESCE(SUM("advancePayment"),0) AS "totalAmount"
      FROM "ClinicAdmission"
      WHERE ${admWhere} AND ${ADM_BIZ} >= (CURRENT_DATE - INTERVAL '12 months')
      GROUP BY EXTRACT(YEAR FROM ${ADM_BIZ}), EXTRACT(MONTH FROM ${ADM_BIZ}) ORDER BY year, month
    `, ...admParams),
    prisma.$queryRawUnsafe(`
      SELECT EXTRACT(YEAR FROM ${ADM_PAY_BIZ})::int AS year, EXTRACT(MONTH FROM ${ADM_PAY_BIZ})::int AS month,
        0::int AS "totalPatients", COALESCE(SUM(amount),0) AS "totalAmount"
      FROM "ClinicAdmissionPayment"
      WHERE ${admPayWhere} AND ${ADM_PAY_BIZ} >= (CURRENT_DATE - INTERVAL '12 months')
      GROUP BY EXTRACT(YEAR FROM ${ADM_PAY_BIZ}), EXTRACT(MONTH FROM ${ADM_PAY_BIZ}) ORDER BY year, month
    `, ...admPayParams),
  ]);

  const trendMap = {};
  for (const r of pvTrend) { const k = `${r.year}-${r.month}`; trendMap[k] = { year: r.year, month: r.month, totalPatients: Number(r.totalPatients), totalAmount: Number(r.totalAmount) }; }
  for (const r of [...ovTrend, ...admTrend, ...admPayTrend]) {
    const k = `${r.year}-${r.month}`;
    if (trendMap[k]) { trendMap[k].totalPatients += Number(r.totalPatients); trendMap[k].totalAmount += Number(r.totalAmount); }
    else trendMap[k] = { year: r.year, month: r.month, totalPatients: Number(r.totalPatients), totalAmount: Number(r.totalAmount) };
  }

  const MN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const trendData = Object.values(trendMap)
    .sort((a,b) => a.year !== b.year ? a.year - b.year : a.month - b.month)
    .map(r => ({ label: `${MN[r.month-1]} ${r.year}`, totalPatients: r.totalPatients, totalAmount: r.totalAmount }));

  return { period, year, month, data, summary: { totalPatients, totalAmount, dailyAvg, prognosis, lastYearAmount, daysWithData }, trendData };
}

async function getBalanceSlips() {
  // Sirf admitted patients ki slips (jin par General OPD form mein "Admit Patient"
  // checkbox tick tha) — walk-in OPD balance is feature ka scope nahi hai.
  const rows = await prisma.$queryRaw`
    SELECT id, "serialNo", "patientType", "patientName", "totalAmount", receive, "createdAt", department
    FROM "ClinicOpdVisit"
    WHERE "totalAmount" > receive AND "totalAmount" > 0 AND status != 'CANCELED' AND "admitPatient" = true
    ORDER BY "createdAt" DESC
  `;
  return rows.map(r => ({
    id:          Number(r.id),
    serialNo:    r.serialNo,
    patientType: r.patientType,
    patientName: r.patientName,
    totalAmount: Number(r.totalAmount),
    receive:     Number(r.receive),
    balance:     Number(r.totalAmount) - Number(r.receive),
    createdAt:   r.createdAt,
    department:  r.department,
  }));
}

async function receiveBalancePayment(id, amount) {
  const visit = await prisma.clinicOpdVisit.findUnique({ where: { id: Number(id) } });
  if (!visit) throw new Error('Visit not found');
  const balance = visit.totalAmount - visit.receive;
  if (amount <= 0 || amount > balance + 0.01) throw new Error('Invalid amount');
  return prisma.clinicOpdVisit.update({
    where: { id: Number(id) },
    data:  { receive: visit.receive + amount },
    select: { id: true, serialNo: true, patientName: true, totalAmount: true, receive: true },
  });
}

module.exports = {
  getAllDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getAllSubDepartments,
  createSubDepartment,
  updateSubDepartment,
  deleteSubDepartment,
  getAllSurgeryTypes,
  createSurgeryType,
  updateSurgeryType,
  deleteSurgeryType,
  getAllSymptoms,
  createSymptom,
  updateSymptom,
  deleteSymptom,
  getAllDiseases,
  createDisease,
  updateDisease,
  deleteDisease,
  getAllDocumentTypes,
  createDocumentType,
  updateDocumentType,
  deleteDocumentType,
  getAllDischargeTypes,
  createDischargeType,
  updateDischargeType,
  deleteDischargeType,
  searchAdmissionsForDocuments,
  getPatientDocuments,
  createPatientDocument,
  getProvisionalBillDetail,
  addProvisionalBillItem,
  addProvisionalBillItemFromVisit,
  deleteProvisionalBillItem,
  updateProvisionalBillHeader,
  getDischargeBillDetail,
  addDischargeBillItem,
  deleteDischargeBillItem,
  finalizeDischarge,
  getPatientDocumentsReport,
  getAllStaffCategories,
  createStaffCategory,
  updateStaffCategory,
  deleteStaffCategory,
  getAllDoctors,
  getDoctorById,
  createDoctor,
  updateDoctor,
  deleteDoctor,
  getAvailableDoctors,
  getNextMrNo,
  getNextSerialNo,
  searchEmployees,
  createOpdVisit,
  getOpdVisits,
  printOpdVisit,
  reprintOpdVisitBySerial,
  getTodayOpdVisitsForCancel,
  getOpdVisitForCancel,
  cancelOpdVisit,
  searchVisitsForRefund,
  getVisitForRefund,
  refundVisit,
  searchVisitsForAdjustment,
  getVisitForAdjustment,
  updateVisitPersonalInfo,
  searchVisitsForSlipTransfer,
  getVisitForSlipTransfer,
  transferSlipAdmission,
  getAllRoomCategories,
  createRoomCategory,
  updateRoomCategory,
  deleteRoomCategory,
  getAllBeds,
  createBed,
  updateBed,
  deleteBed,
  getAllBillHeads,
  getBillHeadById,
  createBillHead,
  updateBillHead,
  deleteBillHead,
  getAllPanelCompanies,
  getPanelCompanyById,
  createPanelCompany,
  updatePanelCompany,
  deletePanelCompany,
  getAllPanelEmployees,
  getPanelEmployeeById,
  createPanelEmployee,
  updatePanelEmployee,
  deletePanelEmployee,
  createAntenatal,
  getAntenatalList,
  getAntenatalByNo,
  getOpdPatientByMrNo,
  getOpdPatientsByPhone,
  getOpdVisitBySerial,
  getAdmissions,
  getAdmissionByNumber,
  searchAdmissionsForReceiving,
  getAdmissionForReceiving,
  addAdmissionPayment,
  getAdmissionPaymentForPrint,
  createAdmission,
  getAvailableBeds,
  searchAdmissionsForAdjustment,
  getAdmissionForAdjustment,
  updateAdmissionAdjustment,
  updateAdmissionStatus,
  getAdmissionWipeoutReport,
  getBedShiftHistory,
  shiftAdmissionBed,
  setBedStatus,
  bulkCreatePatientVisits,
  getAllConsultantRates,
  upsertConsultantRate,
  deleteConsultantRate,
  getConsultantNames,
  getPatientVisitByAdmitNo,
  getPatientVisits,
  getDoctorSubDeptRates,
  importDoctorSubDeptRates,
  importBillComparison,
  getBillComparisons,
  getConsultantStatement,
  getRevenueDashboard,
  getBalanceSlips,
  receiveBalancePayment,
  importPanelBillingDetail,
  getPanelBillingDetails,
  getPanelBillingByAdmit,
  lookupAdmissionByNo,
  searchAdmissions,
  createDeathCertificate,
  getDeathCertificates,
  getDeathCertificate,
  updateDeathCertificate,
  bulkImportDeathCertificates,
};

// ─── Panel Billing Detail (bill-head wise) ───────────────────────────────────
const PANEL_BILL_HEADS = [
  { key: 'constFee',        label: 'Const Fee' },
  { key: 'followUp',        label: 'Follow-up' },
  { key: 'anesthesia',      label: 'Anesthesia' },
  { key: 'medicine',        label: 'Medicine' },
  { key: 'laboratory',      label: 'Laboratory' },
  { key: 'costOfBlood',     label: 'Cost of Blood' },
  { key: 'echocardiograph', label: 'Echocardiograph' },
  { key: 'ultrasound',      label: 'Ultrasound' },
  { key: 'xRay',            label: 'X-Ray' },
  { key: 'physiotherapy',   label: 'Physiotherapy' },
  { key: 'ctScan',          label: 'C.T. Scan' },
  { key: 'surgeonFee',      label: 'Surgeon Fee' },
];

async function generateBillHeadCode(label) {
  const base = label.split(/\s+/).filter(Boolean).map(w => w[0]).join('')
    .toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 8) || 'BH';
  if (!(await prisma.clinicBillHead.findUnique({ where: { headCode: base } }))) return base;
  for (let i = 1; i <= 999; i++) {
    const c = `${base}${i}`;
    if (!(await prisma.clinicBillHead.findUnique({ where: { headCode: c } }))) return c;
  }
  return `${base}_${Date.now()}`;
}

const dnum = (v) => (v == null ? 0 : Number(v));
function panelRowToNum(r) {
  return {
    id: r.id, admitNo: r.admitNo, patientName: r.patientName, consCode: r.consCode,
    companyName: r.companyName, panelCompanyId: r.panelCompanyId,
    constFee: dnum(r.constFee), followUp: dnum(r.followUp), anesthesia: dnum(r.anesthesia),
    medicine: dnum(r.medicine), laboratory: dnum(r.laboratory), costOfBlood: dnum(r.costOfBlood),
    echocardiograph: dnum(r.echocardiograph), ultrasound: dnum(r.ultrasound), xRay: dnum(r.xRay),
    physiotherapy: dnum(r.physiotherapy), ctScan: dnum(r.ctScan), surgeonFee: dnum(r.surgeonFee),
    totalAmount: dnum(r.totalAmount), periodFrom: r.periodFrom, periodTo: r.periodTo,
  };
}

// Upload: auto-create 12 bill heads + panel companies, then REPLACE all rows (cumulative snapshot)
async function importPanelBillingDetail({ rows, periodFrom, periodTo }) {
  const result = { billHeadsCreated: 0, companiesCreated: 0, rowsInserted: 0 };
  if (!Array.isArray(rows) || rows.length === 0) return result;

  // 1. Auto-create the 12 bill heads (find-or-create by description)
  for (const bh of PANEL_BILL_HEADS) {
    const existing = await prisma.clinicBillHead.findFirst({
      where: { description: { equals: bh.label, mode: 'insensitive' } },
    });
    if (!existing) {
      const headCode = await generateBillHeadCode(bh.label);
      await prisma.clinicBillHead.create({ data: { headCode, description: bh.label, type: 'both', status: 'active' } });
      result.billHeadsCreated++;
    }
  }

  // 2. Auto-create panel companies (find-or-create by name)
  const companyMap = {};
  const uniqueCompanies = [...new Set(rows.map(r => (r.companyName || '').trim()).filter(Boolean))];
  for (const name of uniqueCompanies) {
    let co = await prisma.clinicPanelCompany.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } });
    if (!co) {
      const code = await generateCompanyCode(name);
      co = await prisma.clinicPanelCompany.create({ data: { name, code, status: 'active' } });
      result.companiesCreated++;
    }
    companyMap[name.toLowerCase()] = co.id;
  }

  // 3. Replace all existing rows with this upload
  const pf = periodFrom ? new Date(periodFrom) : null;
  const pt = periodTo   ? new Date(periodTo)   : null;
  const data = rows.map(r => ({
    admitNo:        r.admitNo != null && r.admitNo !== '' ? String(r.admitNo) : null,
    patientName:    r.patientName || '',
    consCode:       (r.consCode && r.consCode !== '.') ? r.consCode : null,
    companyName:    r.companyName || null,
    panelCompanyId: r.companyName ? (companyMap[r.companyName.trim().toLowerCase()] || null) : null,
    constFee: dnum(r.constFee), followUp: dnum(r.followUp), anesthesia: dnum(r.anesthesia),
    medicine: dnum(r.medicine), laboratory: dnum(r.laboratory), costOfBlood: dnum(r.costOfBlood),
    echocardiograph: dnum(r.echocardiograph), ultrasound: dnum(r.ultrasound), xRay: dnum(r.xRay),
    physiotherapy: dnum(r.physiotherapy), ctScan: dnum(r.ctScan), surgeonFee: dnum(r.surgeonFee),
    totalAmount: dnum(r.totalAmount), periodFrom: pf, periodTo: pt,
  }));

  await prisma.clinicPanelBillingDetail.deleteMany({});
  const CHUNK = 1000;
  for (let i = 0; i < data.length; i += CHUNK) {
    await prisma.clinicPanelBillingDetail.createMany({ data: data.slice(i, i + CHUNK) });
  }
  result.rowsInserted = data.length;
  return result;
}

// Report list with filters (organisation / person / consultant)
async function getPanelBillingDetails({ organisation, person, consultant } = {}) {
  const where = {};
  if (organisation && organisation !== 'ALL') where.companyName = { equals: organisation, mode: 'insensitive' };
  if (consultant && consultant !== 'ALL' && consultant.trim()) where.consCode = { contains: consultant.trim(), mode: 'insensitive' };
  if (person && person.trim()) where.patientName = { contains: person.trim(), mode: 'insensitive' };

  const rows = await prisma.clinicPanelBillingDetail.findMany({ where, orderBy: { id: 'asc' } });
  const periodRow = await prisma.clinicPanelBillingDetail.findFirst({ select: { periodFrom: true, periodTo: true } });

  const HEAD_KEYS = PANEL_BILL_HEADS.map(h => h.key).concat('totalAmount');
  const totals = {};
  for (const k of HEAD_KEYS) totals[k] = 0;
  const mapped = rows.map(r => {
    const m = panelRowToNum(r);
    for (const k of HEAD_KEYS) totals[k] += m[k];
    return m;
  });
  return {
    rows: mapped,
    count: mapped.length,
    totals,
    period: periodRow ? { from: periodRow.periodFrom, to: periodRow.periodTo } : null,
    heads: PANEL_BILL_HEADS,
  };
}

// Single admission lookup for the Provisional Bill screen
async function getPanelBillingByAdmit(admitNo) {
  const row = await prisma.clinicPanelBillingDetail.findFirst({ where: { admitNo: String(admitNo) } });
  return row ? panelRowToNum(row) : null;
}

// ─── Panel Bill Comparison ────────────────────────────────────────────────────

async function generateCompanyCode(name) {
  const base = name.split(/\s+/).filter(Boolean).map(w => w[0]).join('').toUpperCase().substring(0, 8) || 'CO';
  const exists = await prisma.clinicPanelCompany.findUnique({ where: { code: base } });
  if (!exists) return base;
  for (let i = 1; i <= 999; i++) {
    const c = `${base}${i}`;
    const ex = await prisma.clinicPanelCompany.findUnique({ where: { code: c } });
    if (!ex) return c;
  }
  return `${base}_${Date.now()}`;
}

async function generateEmpCode(companyId, name) {
  const base = `${companyId}-${name.split(/\s+/).filter(Boolean).map(w => w[0]).join('').toUpperCase().substring(0, 6) || 'EMP'}`;
  const exists = await prisma.clinicPanelEmployee.findUnique({ where: { empCode: base } });
  if (!exists) return base;
  for (let i = 1; i <= 999; i++) {
    const c = `${base}${i}`;
    const ex = await prisma.clinicPanelEmployee.findUnique({ where: { empCode: c } });
    if (!ex) return c;
  }
  return `${base}_${Date.now()}`;
}

const TITLES_RE = /^(MRS?\.?|MS\.?|MISS|DR\.?|PROF\.?|COL\.?|GEN\.?|BRIG\.?|MAJ\.?|CPT\.?|LT\.?|SQN\.?|SGT\.?|CH\.?|HAFIZ|HAFIZA|HAJI|HAJIA|MIAN|BEGUM|SYED)\s+/i;
const FEMALE_TITLES = new Set(['MRS', 'MS', 'MISS', 'BEGUM', 'HAFIZA', 'HAJIA']);

function stripTitle(name) {
  return (name || '').replace(TITLES_RE, '').trim().toLowerCase();
}

function extractTitleInfo(rawName) {
  const m = (rawName || '').match(TITLES_RE);
  const rawTitle = m ? m[1].replace('.', '').toUpperCase() : 'MR';
  const title = rawTitle === 'MRS' ? 'MRS' : rawTitle === 'MS' ? 'MS' : rawTitle;
  const cleanName = (rawName || '').replace(TITLES_RE, '').trim().toUpperCase();
  const gender = FEMALE_TITLES.has(title) ? 'female' : 'male';
  return { title, cleanName, gender };
}

async function importBillComparison(rows) {
  const result = { companiesCreated: 0, employeesCreated: 0, dependentsCreated: 0, rowsInserted: 0 };

  // ── Step 1: find-or-create companies ──
  const companyMap = {};
  const uniqueCompanies = [...new Set(rows.map(r => (r.companyName || '').trim()).filter(Boolean))];
  for (const name of uniqueCompanies) {
    let co = await prisma.clinicPanelCompany.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });
    if (!co) {
      const code = await generateCompanyCode(name);
      co = await prisma.clinicPanelCompany.create({ data: { name, code, status: 'active' } });
      result.companiesCreated++;
    }
    companyMap[name.toLowerCase()] = co.id;
  }

  // ── Step 2: find-or-create employees + auto-add dependents from patient names ──
  const employeeMap = {};
  const uniqueEmps = [
    ...new Map(
      rows
        .filter(r => r.employeeName && r.companyName)
        .map(r => [`${r.companyName.trim().toLowerCase()}||${r.employeeName.trim().toLowerCase()}`, r])
    ).values(),
  ];

  for (const row of uniqueEmps) {
    const companyId = companyMap[row.companyName.trim().toLowerCase()];
    if (!companyId) continue;
    const empName = row.employeeName.trim();
    let emp = await prisma.clinicPanelEmployee.findFirst({
      where: { companyId, name: { equals: empName, mode: 'insensitive' } },
      include: { dependents: true },
    });
    if (!emp) {
      const empCode = await generateEmpCode(companyId, empName);
      emp = await prisma.clinicPanelEmployee.create({
        data: { companyId, name: empName, empCode, status: 'active' },
        include: { dependents: true },
      });
      result.employeesCreated++;
    }

    const empKey = `${companyId}||${empName.toLowerCase()}`;
    const empEntry = {
      id:         emp.id,
      empCode:    emp.empCode,
      nameLower:  stripTitle(emp.name),
      dependents: (emp.dependents || []).map(d => ({
        nameLower: stripTitle(d.name),
        relation:  (d.relation || 'DEPENDENT').toUpperCase(),
      })),
    };
    employeeMap[empKey] = empEntry;

    // Auto-add dependents: patient names that differ from employee name
    const empRows = rows.filter(r =>
      r.companyName?.trim().toLowerCase() === row.companyName.trim().toLowerCase() &&
      r.employeeName?.trim().toLowerCase() === empName.toLowerCase() &&
      r.patientName?.trim() &&
      stripTitle(r.patientName) !== empEntry.nameLower
    );

    const seenPatients = new Set();
    for (const empRow of empRows) {
      const patientNorm = stripTitle(empRow.patientName);
      if (seenPatients.has(patientNorm)) continue;
      seenPatients.add(patientNorm);

      // Skip if already a dependent
      if (empEntry.dependents.some(d => d.nameLower === patientNorm)) continue;

      const { title, cleanName, gender } = extractTitleInfo(empRow.patientName);
      const existingCount = await prisma.clinicPanelEmployeeDependent.count({ where: { employeeId: empEntry.id } });
      const depCode = `${emp.empCode}-D${existingCount + 1}`;

      await prisma.clinicPanelEmployeeDependent.create({
        data: {
          employeeId: empEntry.id,
          code:       depCode,
          title,
          name:       cleanName,
          relation:   '',
          gender,
          status:     'active',
        },
      });

      empEntry.dependents.push({ nameLower: patientNorm, relation: 'DEPENDENT' });
      result.dependentsCreated++;
    }
  }

  // ── Step 3: replace all bill rows ──
  // All lookups (companyId, empEntry) are already resolved from in-memory maps
  // built above — no per-row DB reads here, so this batches as one createMany
  // instead of N sequential inserts (same result, far fewer round trips).
  await prisma.clinicPanelBillRow.deleteMany({});
  const billRowsData = rows.map((row) => {
    const companyId = row.companyName ? companyMap[row.companyName.trim().toLowerCase()] : null;
    const empName   = row.employeeName?.trim().toLowerCase();
    const empKey    = companyId && empName ? `${companyId}||${empName}` : null;
    const empEntry  = empKey ? (employeeMap[empKey] || null) : null;
    const panelEmployeeId = empEntry?.id || null;

    let relation = 'SELF';
    if (empEntry && row.patientName) {
      const patientNorm = stripTitle(row.patientName);
      if (patientNorm === empEntry.nameLower) {
        relation = 'SELF';
      } else {
        const depMatch = empEntry.dependents.find(d => d.nameLower === patientNorm);
        relation = depMatch ? depMatch.relation : 'DEPENDENT';
      }
    }

    return {
      sno:            row.sno       || null,
      admitNo:        row.admitNo   || null,
      patientName:    row.patientName || '',
      employeeName:   row.employeeName || null,
      companyName:    row.companyName  || null,
      panelCompanyId: companyId || null,
      panelEmployeeId,
      relation,
      amount:         row.amount     ?? 0,
      billAmount:     row.billAmount ?? 0,
      diff:           row.diff       ?? 0,
    };
  });

  const CHUNK = 1000;
  for (let i = 0; i < billRowsData.length; i += CHUNK) {
    await prisma.clinicPanelBillRow.createMany({ data: billRowsData.slice(i, i + CHUNK) });
  }
  result.rowsInserted = billRowsData.length;
  return result;
}

async function getBillComparisons() {
  return prisma.clinicPanelBillRow.findMany({ orderBy: { sno: 'asc' } });
}

// ─── Death Certificate ────────────────────────────────────────────────────────

// Lookup an admission by its admission number — used by the Death Certificate
// screen's Admission # search. Priority:
//   1. ClinicDeathCertificate — a certificate already exists (manual entry earlier,
//      or bulk-imported from the report's Excel format) → return the FULL record
//      so the form auto-fills everything (Death Time, Place, Relation, Religion,
//      Occupation, Cause, Medical Officer, Dr Address), not just the admission snapshot.
//   2. ClinicAdmission — new admissions created via the Admission screen.
//   3. PatientVisit.admitNo — old bulk-imported patient list (no age/gender/slip#,
//      those stay blank for manual entry).
async function lookupAdmissionByNo(admissionNo) {
  const no = String(admissionNo).trim();

  // Many legacy "Brought Dead" certificates share a placeholder admissionNo ("1"),
  // so also match on arrivedSlipNo (the hospital's real unique certificate/slip #).
  const cert = await prisma.clinicDeathCertificate.findFirst({
    where: { OR: [{ admissionNo: no }, { arrivedSlipNo: no }] },
    orderBy: { id: 'desc' },
  });
  if (cert) {
    return {
      admissionId: cert.admissionId, admissionNo: cert.admissionNo, arrivedSlipNo: cert.arrivedSlipNo,
      patientName: cert.patientName, ageYears: cert.ageYears, ageMonths: cert.ageMonths,
      ageDays: cert.ageDays, gender: cert.gender, source: 'certificate',
      existingCertificateId: cert.id,
      deathTime: cert.deathTime, deathPlace: cert.deathPlace,
      relationType: cert.relationType, relationName: cert.relationName,
      religion: cert.religion, occupation: cert.occupation, causeOfDeath: cert.causeOfDeath,
      medicalOfficerId: cert.medicalOfficerId, drAddress: cert.drAddress,
    };
  }

  const adm = await prisma.clinicAdmission.findFirst({ where: { admissionNo: no }, orderBy: { id: 'desc' } });
  if (adm) {
    return {
      admissionId: adm.id, admissionNo: adm.admissionNo, arrivedSlipNo: adm.arrivedSlipNo,
      patientName: adm.patientName, ageYears: adm.ageYears, ageMonths: adm.ageMonths,
      ageDays: adm.ageDays, gender: adm.gender, source: 'admission',
    };
  }

  const admitNoNum = Number(no);
  if (admitNoNum) {
    const pv = await prisma.patientVisit.findFirst({ where: { admitNo: admitNoNum }, orderBy: { id: 'asc' } });
    if (pv) {
      return {
        admissionId: null, admissionNo: no, arrivedSlipNo: null,
        patientName: pv.patientName, ageYears: 0, ageMonths: 0, ageDays: 0,
        gender: 'male', source: 'patientVisit',
      };
    }
  }
  return null;
}

// Searchable suggestions for the Admission # combobox — merges existing
// ClinicDeathCertificate records (already on file), ClinicAdmission records,
// and distinct PatientVisit.admitNo values, so the user can see & pick from
// what actually exists instead of guessing a number.
async function searchAdmissions(q) {
  const term = (q || '').trim();
  const LIMIT = 20;

  const certs = await prisma.clinicDeathCertificate.findMany({
    where: term ? { OR: [
      { admissionNo: { contains: term, mode: 'insensitive' } },
      { arrivedSlipNo: { contains: term, mode: 'insensitive' } },
      { patientName: { contains: term, mode: 'insensitive' } },
    ] } : undefined,
    select: { admissionNo: true, arrivedSlipNo: true, patientName: true },
    orderBy: { id: 'desc' },
    take: LIMIT,
  });

  const admissions = await prisma.clinicAdmission.findMany({
    where: term ? { OR: [
      { admissionNo: { contains: term, mode: 'insensitive' } },
      { patientName: { contains: term, mode: 'insensitive' } },
    ] } : undefined,
    select: { admissionNo: true, patientName: true },
    orderBy: { id: 'desc' },
    take: LIMIT,
  });

  const pvWhere = term
    ? `WHERE "admitNo" IS NOT NULL AND (CAST("admitNo" AS TEXT) ILIKE $1 OR "patientName" ILIKE $1)`
    : `WHERE "admitNo" IS NOT NULL`;
  const pvParams = term ? [`%${term}%`] : [];
  const pvRows = await prisma.$queryRawUnsafe(`
    SELECT DISTINCT ON ("admitNo") "admitNo", "patientName"
    FROM "PatientVisit" ${pvWhere}
    ORDER BY "admitNo" DESC
    LIMIT ${LIMIT}
  `, ...pvParams);

  const seen = new Set();
  const certSeen = new Set(); // separate dedup key: many legacy "Brought Dead" certs
                              // share admissionNo="1", so dedupe by arrivedSlipNo instead
  const results = [];
  for (const c of certs) {
    const lookupKey = c.arrivedSlipNo || c.admissionNo;
    if (certSeen.has(lookupKey)) continue;
    certSeen.add(lookupKey);
    results.push({
      admissionNo: c.admissionNo, arrivedSlipNo: c.arrivedSlipNo, patientName: c.patientName,
      source: 'certificate', lookupKey,
    });
  }
  for (const a of admissions) {
    if (seen.has(a.admissionNo) || certSeen.has(a.admissionNo)) continue;
    seen.add(a.admissionNo);
    results.push({ admissionNo: a.admissionNo, patientName: a.patientName, source: 'admission', lookupKey: a.admissionNo });
  }
  for (const r of pvRows) {
    const no = String(r.admitNo);
    if (seen.has(no) || certSeen.has(no)) continue;
    seen.add(no);
    results.push({ admissionNo: no, patientName: r.patientName, source: 'patientVisit', lookupKey: no });
  }
  return results.slice(0, LIMIT);
}

async function createDeathCertificate(data) {
  return prisma.clinicDeathCertificate.create({
    data: {
      admissionId:      data.admissionId ? Number(data.admissionId) : null,
      admissionNo:       data.admissionNo,
      arrivedSlipNo:     data.arrivedSlipNo || null,
      patientName:       data.patientName || '',
      ageYears:          Number(data.ageYears) || 0,
      ageMonths:         Number(data.ageMonths) || 0,
      ageDays:           Number(data.ageDays) || 0,
      gender:            data.gender || 'male',
      deathTime:         data.deathTime ? new Date(data.deathTime) : null,
      deathPlace:        data.deathPlace || null,
      relationType:      data.relationType || 'S/o',
      relationName:      data.relationName || null,
      religion:          data.religion || null,
      occupation:        data.occupation || null,
      causeOfDeath:      data.causeOfDeath || null,
      medicalOfficerId:  data.medicalOfficerId ? Number(data.medicalOfficerId) : null,
      drAddress:         data.drAddress || null,
    },
  });
}

async function getDeathCertificates({ fromDate, toDate } = {}) {
  const where = {};
  if (fromDate && toDate) {
    where.deathTime = { gte: new Date(`${fromDate}T00:00:00`), lte: new Date(`${toDate}T23:59:59`) };
  }
  return prisma.clinicDeathCertificate.findMany({ where, orderBy: { deathTime: 'desc' } });
}

async function getDeathCertificate(admissionNo) {
  return prisma.clinicDeathCertificate.findFirst({
    where: { admissionNo: String(admissionNo).trim() },
    orderBy: { id: 'desc' },
  });
}

async function updateDeathCertificate(id, data) {
  return prisma.clinicDeathCertificate.update({
    where: { id: Number(id) },
    data: {
      patientName:       data.patientName || '',
      ageYears:          Number(data.ageYears) || 0,
      ageMonths:         Number(data.ageMonths) || 0,
      ageDays:           Number(data.ageDays) || 0,
      gender:            data.gender || 'male',
      deathTime:         data.deathTime ? new Date(data.deathTime) : null,
      deathPlace:        data.deathPlace || null,
      relationType:      data.relationType || 'S/o',
      relationName:      data.relationName || null,
      religion:          data.religion || null,
      occupation:        data.occupation || null,
      causeOfDeath:      data.causeOfDeath || null,
      medicalOfficerId:  data.medicalOfficerId ? Number(data.medicalOfficerId) : null,
      drAddress:         data.drAddress || null,
    },
  });
}

async function generateDoctorCode(name) {
  const initials = name.split(/\s+/).filter(Boolean)
    .map(w => w[0].toUpperCase()).join('').substring(0, 6) || 'DR';
  let code = initials;
  let i = 1;
  while (await prisma.clinicDoctor.findUnique({ where: { code } })) {
    code = `${initials}${i++}`;
  }
  return code;
}

// Bulk import — same layout as the Death Certificate Report / its Excel export
// (Certificate = "arrivedSlipNo/admissionNo", Reason = cause of death, Date/Time,
// Place of death, Address of doctor, Patient name, W/o./S/o./D/o., Gender, Age,
// Religion, Occupation, plus a raw Doctor name from the source file).
//
// Real legacy exports show most "Brought Dead" certificates (no proper admission)
// share a placeholder admissionNo like "1" — that can't be used as a unique key or
// hundreds of unrelated certificates would collide. arrivedSlipNo is the hospital's
// actual unique certificate/slip number, so upserts are keyed on THAT (falling back
// to admissionNo only when a row has no slip number at all).
//
// doctorName (free text from the sheet) is matched against existing ClinicDoctor by
// normalized name; unmatched names auto-create a new doctor, same pattern used for
// bulk patient-list imports, so Medical Officer stays a proper linked record.
async function bulkImportDeathCertificates(rows) {
  const result = { created: 0, updated: 0, skipped: 0, doctorsCreated: 0 };

  const doctors = await prisma.clinicDoctor.findMany({ select: { id: true, name: true } });
  const doctorMap = new Map(doctors.map(d => [d.name.toLowerCase().trim(), d.id]));

  for (const row of rows) {
    const arrivedSlipNo = row.arrivedSlipNo ? String(row.arrivedSlipNo).trim() : '';
    const admissionNo = String(row.admissionNo || '').trim();
    const upsertKey = arrivedSlipNo || admissionNo;
    if (!upsertKey) { result.skipped++; continue; }

    let medicalOfficerId = null;
    const doctorName = (row.doctorName || '').trim();
    if (doctorName) {
      const key = doctorName.toLowerCase();
      if (doctorMap.has(key)) {
        medicalOfficerId = doctorMap.get(key);
      } else {
        const code = await generateDoctorCode(doctorName);
        const newDoc = await prisma.clinicDoctor.create({ data: { code, name: doctorName, consultantDays: [] } });
        doctorMap.set(key, newDoc.id);
        medicalOfficerId = newDoc.id;
        result.doctorsCreated++;
      }
    }

    const data = {
      admissionNo:      admissionNo || upsertKey,
      arrivedSlipNo:    arrivedSlipNo || null,
      patientName:      row.patientName || '',
      ageYears:         Number(row.ageYears) || 0,
      ageMonths:        Number(row.ageMonths) || 0,
      ageDays:          Number(row.ageDays) || 0,
      gender:           row.gender || 'male',
      deathTime:        row.deathTime ? new Date(row.deathTime) : null,
      deathPlace:       row.deathPlace || null,
      relationType:     row.relationType || 'S/o',
      relationName:     row.relationName || null,
      religion:         row.religion || null,
      occupation:       row.occupation || null,
      causeOfDeath:     row.causeOfDeath || null,
      drAddress:        row.drAddress || null,
      medicalOfficerId,
    };

    const existing = arrivedSlipNo
      ? await prisma.clinicDeathCertificate.findFirst({ where: { arrivedSlipNo } })
      : await prisma.clinicDeathCertificate.findFirst({ where: { admissionNo } });
    if (existing) {
      await prisma.clinicDeathCertificate.update({ where: { id: existing.id }, data });
      result.updated++;
    } else {
      await prisma.clinicDeathCertificate.create({ data });
      result.created++;
    }
  }
  return result;
}
