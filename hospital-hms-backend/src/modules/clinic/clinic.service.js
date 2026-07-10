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

  if (paymentTypes && paymentTypes.length > 0) {
    where.paymentType = { in: paymentTypes };
  }

  if (fromConsultant && toConsultant) {
    where.doctor = { gte: fromConsultant, lte: toConsultant };
  } else if (fromConsultant) {
    where.doctor = { gte: fromConsultant };
  } else if (toConsultant) {
    where.doctor = { lte: toConsultant };
  }

  return prisma.patientVisit.findMany({
    where,
    orderBy: [{ doctor: 'asc' }, { visitDate: 'asc' }, { visitTime: 'asc' }],
  });
}

function normNameSvc(s) {
  return (s || '').toLowerCase().replace(/[-._]/g, ' ').replace(/\s+/g, ' ').trim();
}

async function importDoctorSubDeptRates(doctorId, rows, deptTitle, doctorName) {
  let dId = Number(doctorId);

  let doctorExists = await prisma.clinicDoctor.findUnique({ where: { id: dId }, select: { id: true } });

  // Fallback: find by name if ID doesn't match (handles server/dev DB id mismatch)
  if (!doctorExists && doctorName) {
    const byName = await prisma.clinicDoctor.findFirst({
      where: { name: { equals: doctorName, mode: 'insensitive' } },
      select: { id: true },
    });
    if (byName) { dId = byName.id; doctorExists = byName; }
  }

  if (!doctorExists) throw new Error(`Doctor "${doctorName || doctorId}" not found in database`);

  // Load all sub-depts and departments once
  const allSubDepts = await prisma.clinicSubDepartment.findMany({ select: { id: true, name: true, departmentId: true } });
  const allDepts    = await prisma.clinicDepartment.findMany({ select: { id: true, name: true, code: true } });

  // Find department by title from Excel (e.g. "X-RAY", "ULTRA SOUND")
  let dept = null;
  if (deptTitle) {
    dept = allDepts.find((d) => normNameSvc(d.name) === normNameSvc(deptTitle));
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

    if (existing) {
      await prisma.clinicDoctorSubDept.update({
        where: { id: existing.id },
        data: { normalFees: Number(row.normalFees) || 0, oddFees: Number(row.normalFees) || 0, paymentType: 'amount' },
      });
      updated++;
    } else {
      await prisma.clinicDoctorSubDept.create({
        data: {
          doctorId: dId,
          subDeptId: subDept.id,
          paymentType: 'amount',
          normalFees: Number(row.normalFees) || 0,
          oddFees:    Number(row.normalFees) || 0,
          normalCharges: 0,
          oddCharges:    0,
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
};
