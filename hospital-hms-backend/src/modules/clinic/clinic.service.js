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

async function getAllDoctors() {
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
    where.subDept = { department: { name: { equals: departmentName, mode: 'insensitive' } } };
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

async function getNextSerialNo() {
  const last = await prisma.clinicOpdVisit.findFirst({ orderBy: { id: 'desc' }, select: { serialNo: true } });
  const BASE = 2826016;
  const n = last ? Math.max((parseInt(last.serialNo, 10) || 0) + 1, BASE) : BASE;
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
  mrNo, serialNo, patientType, patientName, admitPatient, antenatal, antenatalNo,
  age, ageMonths, ageDays, gender, phoneNo, referredBy,
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
      antenatal: Boolean(antenatal),
      antenatalNo: antenatalNo || null,
      age: age ? Number(age) : null,
      ageMonths: Number(ageMonths) || 0,
      ageDays: Number(ageDays) || 0,
      gender: gender || 'male',
      phoneNo: phoneNo || null,
      referredBy: referredBy || null,
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
  const visit = await prisma.clinicOpdVisit.findFirst({
    where: { serialNo: { equals: serialNo.trim(), mode: 'insensitive' } },
    select: { serialNo: true, mrNo: true, patientName: true, age: true, ageMonths: true, ageDays: true, gender: true, phoneNo: true, referredBy: true, employeeId: true, panelCompanyId: true, panelEmployeeId: true, panelDependentId: true },
  });
  return enrichOpdPatient(visit);
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
    include: { refDepartment: { select: { id: true, name: true } } },
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

// ─── Admission ────────────────────────────────────────────────────────────────

async function getAdmissions() {
  return prisma.clinicAdmission.findMany({ orderBy: { id: 'desc' } });
}

async function createAdmission(data) {
  const admission = await prisma.clinicAdmission.create({
    data: {
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

async function getAvailableBeds(roomCategoryId) {
  const activeBedIds = await prisma.clinicAdmission.findMany({
    where: { status: 'active', bedId: { not: null } },
    select: { bedId: true },
  });
  const occupiedIds = activeBedIds.map((r) => r.bedId).filter(Boolean);
  return prisma.clinicBed.findMany({
    where: {
      roomCategoryId: Number(roomCategoryId),
      id: { notIn: occupiedIds.length > 0 ? occupiedIds : [-1] },
    },
    orderBy: { name: 'asc' },
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
  const uniqueNames = [...new Set(
    data.map(r => r.doctor).filter(Boolean).map(n => n.trim())
  )];

  if (uniqueNames.length > 0) {
    const existing = await prisma.clinicDoctor.findMany({
      select: { name: true },
    });
    const existingNames = new Set(existing.map(d => d.name.toLowerCase()));

    for (const name of uniqueNames) {
      if (existingNames.has(name.toLowerCase())) continue;

      // Generate unique code from name initials
      const initials = name.split(/\s+/).filter(Boolean)
        .map(w => w[0].toUpperCase()).join('').substring(0, 6) || 'DR';
      let code = initials;
      let i = 1;
      while (await prisma.clinicDoctor.findUnique({ where: { code } })) {
        code = `${initials}${i++}`;
      }

      await prisma.clinicDoctor.create({ data: { code, name } });
      existingNames.add(name.toLowerCase());
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
    orderBy: [{ doctor: 'asc' }, { visitDate: 'asc' }, { visitTime: 'asc' }],
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
    serialNo:      v.admissionNo,
    admitNo:       v.mrNo ? String(v.mrNo) : null,
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

  // Merge: old first, then OPD, then admissions
  return [...oldVisits.map(v => ({ ...v, _source: 'old' })), ...mapped, ...mappedAdm];
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

    // Try to find existing sub-dept
    let subDept = allSubDepts.find((sd) => normNameSvc(sd.name) === normTest);

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
  const pvConds  = [`"paymentType" != 'CANCELED'`];
  const pvParams = [];
  if (department && department !== 'ALL') { pvParams.push(department);             pvConds.push(`department ILIKE $${pvParams.length}`); }
  if (subDept    && subDept    !== 'ALL') { pvParams.push(subDept);                pvConds.push(`"subDepartment" ILIKE $${pvParams.length}`); }
  if (consultant && consultant !== 'ALL') { pvParams.push(consultant);             pvConds.push(`doctor ILIKE $${pvParams.length}`); }
  if (paymentType && paymentType !== 'ALL') { pvParams.push(paymentType);          pvConds.push(`"paymentType" = $${pvParams.length}`); }
  const pvWhere = pvConds.join(' AND ');

  // ── ClinicOpdVisit WHERE ──────────────────────────────────────────────────
  const ovConds  = [];
  const ovParams = [];
  if (department && department !== 'ALL') { ovParams.push(department);             ovConds.push(`department ILIKE $${ovParams.length}`); }
  if (subDept    && subDept    !== 'ALL') { ovParams.push(subDept);                ovConds.push(`EXISTS (SELECT 1 FROM "ClinicOpdVisitDoctor" cod JOIN "ClinicSubDept" sd ON sd.id = cod."subDeptId" WHERE cod."visitId" = "ClinicOpdVisit".id AND sd.name ILIKE $${ovParams.length})`); }
  if (consultant && consultant !== 'ALL') { ovParams.push(consultant);             ovConds.push(`EXISTS (SELECT 1 FROM "ClinicOpdVisitDoctor" cod JOIN "ClinicDoctor" d ON d.id = cod."doctorId" WHERE cod."visitId" = "ClinicOpdVisit".id AND d.name ILIKE $${ovParams.length})`); }
  if (paymentType && paymentType !== 'ALL') { ovParams.push(paymentType.toLowerCase()); ovConds.push(`LOWER("paymentType") = $${ovParams.length}`); }
  const ovWhere = ovConds.length > 0 ? ovConds.join(' AND ') : 'TRUE';

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
    COALESCE(SUM(received),0) AS "totalAmount",
    COUNT(*) FILTER (WHERE "paymentType" = 'Cash')::int  AS "cashPatients",
    COALESCE(SUM(received) FILTER (WHERE "paymentType" = 'Cash'),0)  AS "cashAmount",
    COUNT(*) FILTER (WHERE "paymentType" = 'Panel')::int AS "panelPatients",
    COALESCE(SUM(received) FILTER (WHERE "paymentType" = 'Panel'),0) AS "panelAmount",
    COUNT(*) FILTER (WHERE "paymentType" = 'C Card')::int AS "ccPatients",
    COALESCE(SUM(received) FILTER (WHERE "paymentType" = 'C Card'),0) AS "ccAmount"`;

  const ovAggCols = `
    COUNT(*)::int AS "totalPatients",
    COALESCE(SUM(receive),0) AS "totalAmount",
    COUNT(*) FILTER (WHERE LOWER("paymentType") = 'cash')::int  AS "cashPatients",
    COALESCE(SUM(receive) FILTER (WHERE LOWER("paymentType") = 'cash'),0)  AS "cashAmount",
    COUNT(*) FILTER (WHERE LOWER("paymentType") = 'panel')::int AS "panelPatients",
    COALESCE(SUM(receive) FILTER (WHERE LOWER("paymentType") = 'panel'),0) AS "panelAmount",
    COUNT(*) FILTER (WHERE LOWER("paymentType") IN ('c card','cc','credit card'))::int AS "ccPatients",
    COALESCE(SUM(receive) FILTER (WHERE LOWER("paymentType") IN ('c card','cc','credit card')),0) AS "ccAmount"`;

  let data = [];

  if (period === 'monthly_daily') {
    const daysInMonth = new Date(year, month, 0).getDate();
    const startDate   = `${year}-${String(month).padStart(2,'0')}-01`;
    const endDate     = `${year}-${String(month).padStart(2,'0')}-${String(daysInMonth).padStart(2,'0')}`;

    const pvP = [...pvParams, startDate, endDate];
    const pvSi = pvParams.length + 1, pvEi = pvParams.length + 2;
    const pvRows = await prisma.$queryRawUnsafe(`
      SELECT "visitDate"::text AS date, ${pvAggCols}
      FROM "PatientVisit"
      WHERE ${pvWhere} AND "visitDate" >= $${pvSi}::date AND "visitDate" <= $${pvEi}::date
      GROUP BY "visitDate" ORDER BY "visitDate"
    `, ...pvP);

    const ovP = [...ovParams, startDate, endDate];
    const ovSi = ovParams.length + 1, ovEi = ovParams.length + 2;
    const ovRows = await prisma.$queryRawUnsafe(`
      SELECT DATE("createdAt")::text AS date, ${ovAggCols}
      FROM "ClinicOpdVisit"
      WHERE ${ovWhere} AND DATE("createdAt") >= $${ovSi}::date AND DATE("createdAt") <= $${ovEi}::date
      GROUP BY DATE("createdAt") ORDER BY date
    `, ...ovP);

    const pvMap = {}, ovMap = {};
    for (const r of pvRows) pvMap[r.date] = toObj(r, 'date');
    for (const r of ovRows) ovMap[r.date] = toObj(r, 'date');

    const merged = mergeMap(pvMap, ovMap, 'date');
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      if (!merged[key]) merged[key] = { date: key, totalPatients:0, totalAmount:0, cashPatients:0, cashAmount:0, panelPatients:0, panelAmount:0, ccPatients:0, ccAmount:0 };
    }
    data = Object.values(merged).sort((a,b) => a.date.localeCompare(b.date));

  } else if (period === 'yearly_monthly' || period === 'yearly_daily') {
    const pvP = [...pvParams, year];
    const pvYi = pvParams.length + 1;
    const pvRows = await prisma.$queryRawUnsafe(`
      SELECT EXTRACT(MONTH FROM "visitDate")::int AS month, ${pvAggCols}
      FROM "PatientVisit"
      WHERE ${pvWhere} AND EXTRACT(YEAR FROM "visitDate") = $${pvYi}
      GROUP BY EXTRACT(MONTH FROM "visitDate") ORDER BY month
    `, ...pvP);

    const ovP = [...ovParams, year];
    const ovYi = ovParams.length + 1;
    const ovRows = await prisma.$queryRawUnsafe(`
      SELECT EXTRACT(MONTH FROM "createdAt")::int AS month, ${ovAggCols}
      FROM "ClinicOpdVisit"
      WHERE ${ovWhere} AND EXTRACT(YEAR FROM "createdAt") = $${ovYi}
      GROUP BY EXTRACT(MONTH FROM "createdAt") ORDER BY month
    `, ...ovP);

    const pvMap = {}, ovMap = {};
    for (const r of pvRows) pvMap[r.month] = toObj(r, 'month');
    for (const r of ovRows) ovMap[r.month] = toObj(r, 'month');

    const merged = mergeMap(pvMap, ovMap, 'month');
    for (let m = 1; m <= 12; m++) {
      if (!merged[m]) merged[m] = { month: m, totalPatients:0, totalAmount:0, cashPatients:0, cashAmount:0, panelPatients:0, panelAmount:0, ccPatients:0, ccAmount:0 };
    }
    data = Object.values(merged).sort((a,b) => a.month - b.month);

  } else if (period === 'multi_year') {
    const pvRows = await prisma.$queryRawUnsafe(`
      SELECT EXTRACT(YEAR FROM "visitDate")::int AS year, ${pvAggCols}
      FROM "PatientVisit" WHERE ${pvWhere}
      GROUP BY EXTRACT(YEAR FROM "visitDate") ORDER BY year
    `, ...pvParams);

    const ovRows = await prisma.$queryRawUnsafe(`
      SELECT EXTRACT(YEAR FROM "createdAt")::int AS year, ${ovAggCols}
      FROM "ClinicOpdVisit" WHERE ${ovWhere}
      GROUP BY EXTRACT(YEAR FROM "createdAt") ORDER BY year
    `, ...ovParams);

    const pvMap = {}, ovMap = {};
    for (const r of pvRows) pvMap[r.year] = toObj(r, 'year');
    for (const r of ovRows) ovMap[r.year] = toObj(r, 'year');

    const merged = mergeMap(pvMap, ovMap, 'year');
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
    const [pvLy, ovLy] = await Promise.all([
      prisma.$queryRawUnsafe(`SELECT COALESCE(SUM(received),0) AS total FROM "PatientVisit" WHERE ${pvWhere} AND "visitDate" >= $${pvLySi}::date AND "visitDate" <= $${pvLyEi}::date`, ...pvLyP),
      prisma.$queryRawUnsafe(`SELECT COALESCE(SUM(receive),0) AS total FROM "ClinicOpdVisit" WHERE ${ovWhere} AND DATE("createdAt") >= $${ovLySi}::date AND DATE("createdAt") <= $${ovLyEi}::date`, ...ovLyP),
    ]);
    lastYearAmount = Number(pvLy[0]?.total||0) + Number(ovLy[0]?.total||0);
  }

  // Trend: last 12 months (both tables)
  const [pvTrend, ovTrend] = await Promise.all([
    prisma.$queryRawUnsafe(`
      SELECT EXTRACT(YEAR FROM "visitDate")::int AS year, EXTRACT(MONTH FROM "visitDate")::int AS month,
        COUNT(*)::int AS "totalPatients", COALESCE(SUM(received),0) AS "totalAmount"
      FROM "PatientVisit"
      WHERE ${pvWhere} AND "visitDate" >= (CURRENT_DATE - INTERVAL '12 months')
      GROUP BY EXTRACT(YEAR FROM "visitDate"), EXTRACT(MONTH FROM "visitDate") ORDER BY year, month
    `, ...pvParams),
    prisma.$queryRawUnsafe(`
      SELECT EXTRACT(YEAR FROM "createdAt")::int AS year, EXTRACT(MONTH FROM "createdAt")::int AS month,
        COUNT(*)::int AS "totalPatients", COALESCE(SUM(receive),0) AS "totalAmount"
      FROM "ClinicOpdVisit"
      WHERE ${ovWhere} AND "createdAt" >= (CURRENT_DATE - INTERVAL '12 months')
      GROUP BY EXTRACT(YEAR FROM "createdAt"), EXTRACT(MONTH FROM "createdAt") ORDER BY year, month
    `, ...ovParams),
  ]);

  const trendMap = {};
  for (const r of pvTrend) { const k = `${r.year}-${r.month}`; trendMap[k] = { year: r.year, month: r.month, totalPatients: Number(r.totalPatients), totalAmount: Number(r.totalAmount) }; }
  for (const r of ovTrend) {
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
  const rows = await prisma.$queryRaw`
    SELECT id, "serialNo", "patientType", "patientName", "totalAmount", receive, "createdAt", department
    FROM "ClinicOpdVisit"
    WHERE "totalAmount" > receive AND "totalAmount" > 0 AND status != 'CANCELED'
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
  createAdmission,
  getAvailableBeds,
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
};

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
  await prisma.clinicPanelBillRow.deleteMany({});
  for (const row of rows) {
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

    await prisma.clinicPanelBillRow.create({
      data: {
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
      },
    });
    result.rowsInserted++;
  }
  return result;
}

async function getBillComparisons() {
  return prisma.clinicPanelBillRow.findMany({ orderBy: { sno: 'asc' } });
}
