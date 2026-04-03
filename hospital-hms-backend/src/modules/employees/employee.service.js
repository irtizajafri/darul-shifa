const prisma = require('../../config/db');

function normalizeString(value, { emptyToNull = false } = {}) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const normalized = String(value).trim();
  if (!normalized) return emptyToNull ? null : '';
  return normalized;
}

function normalizeNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeJsonArray(value, fallback = []) {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value : fallback;
}

function setIfDefined(target, key, value) {
  if (value !== undefined) target[key] = value;
}

async function list() {
  return prisma.employee.findMany({
    orderBy: { id: 'desc' },
    include: { attendances: true } // Example: include relations if needed
  });
}

async function get(id) {
  return prisma.employee.findUnique({
    where: { id: parseInt(id) }
  });
}

async function create(payload) {
  const data = {
    empCode: normalizeString(payload.empCode, { emptyToNull: true }),
    firstName: normalizeString(payload.firstName),
    middleName: normalizeString(payload.middleName, { emptyToNull: true }),
    lastName: normalizeString(payload.lastName),
    fatherName: normalizeString(payload.fatherName, { emptyToNull: true }),
    dob: normalizeString(payload.dob, { emptyToNull: true }),
    gender: normalizeString(payload.gender, { emptyToNull: true }),
    maritalStatus: normalizeString(payload.maritalStatus, { emptyToNull: true }),
    spouseName: normalizeString(payload.spouseName, { emptyToNull: true }),
    nic: normalizeString(payload.nic, { emptyToNull: true }),
    birthPlace: normalizeString(payload.birthPlace, { emptyToNull: true }),
    beneficiaryName: normalizeString(payload.beneficiaryName, { emptyToNull: true }),
    beneficiaryRelation: normalizeString(payload.beneficiaryRelation, { emptyToNull: true }),
    address: normalizeString(payload.address, { emptyToNull: true }),
    city: normalizeString(payload.city, { emptyToNull: true }),
    phone: normalizeString(payload.phone, { emptyToNull: true }),
    email: normalizeString(payload.email, { emptyToNull: true }),
    reference1: normalizeString(payload.reference1, { emptyToNull: true }),
    reference2: normalizeString(payload.reference2, { emptyToNull: true }),

    departmentText: normalizeString(payload.department, { emptyToNull: true }),
    role: normalizeString(payload.designation, { emptyToNull: true }),
    status: normalizeString(payload.status, { emptyToNull: true }),
    appointmentDate: normalizeString(payload.appointmentDate, { emptyToNull: true }),
    weeklyHoliday: normalizeString(payload.weeklyHoliday, { emptyToNull: true }),
    workingDays: normalizeString(payload.workingDays, { emptyToNull: true }),
    disbursement: normalizeString(payload.disbursement, { emptyToNull: true }),
    salaryMonthly: normalizeNumber(payload.basicSalary, 0),
    allowances: normalizeJsonArray(payload.allowances, []),

    dutyType: normalizeString(payload.dutyType, { emptyToNull: true }),
    dutyRoster: normalizeJsonArray(payload.dutyRoster, []),

    photo: payload.photo ?? null,
    emergencyContact: normalizeString(payload.emergencyContact, { emptyToNull: true }),
    emergencyPhone: normalizeString(payload.emergencyPhone, { emptyToNull: true }),
    emergencyRelation: normalizeString(payload.emergencyRelation, { emptyToNull: true }),
    notes: normalizeString(payload.notes, { emptyToNull: true })
  };

  return prisma.employee.create({
    data
  });
}

async function update(id, payload) {
  const data = {};

  setIfDefined(data, 'empCode', normalizeString(payload.empCode, { emptyToNull: true }));
  setIfDefined(data, 'firstName', normalizeString(payload.firstName));
  setIfDefined(data, 'middleName', normalizeString(payload.middleName, { emptyToNull: true }));
  setIfDefined(data, 'lastName', normalizeString(payload.lastName));
  setIfDefined(data, 'fatherName', normalizeString(payload.fatherName, { emptyToNull: true }));
  setIfDefined(data, 'dob', normalizeString(payload.dob, { emptyToNull: true }));
  setIfDefined(data, 'gender', normalizeString(payload.gender, { emptyToNull: true }));
  setIfDefined(data, 'maritalStatus', normalizeString(payload.maritalStatus, { emptyToNull: true }));
  setIfDefined(data, 'spouseName', normalizeString(payload.spouseName, { emptyToNull: true }));
  setIfDefined(data, 'nic', normalizeString(payload.nic, { emptyToNull: true }));
  setIfDefined(data, 'birthPlace', normalizeString(payload.birthPlace, { emptyToNull: true }));
  setIfDefined(data, 'beneficiaryName', normalizeString(payload.beneficiaryName, { emptyToNull: true }));
  setIfDefined(data, 'beneficiaryRelation', normalizeString(payload.beneficiaryRelation, { emptyToNull: true }));
  setIfDefined(data, 'address', normalizeString(payload.address, { emptyToNull: true }));
  setIfDefined(data, 'city', normalizeString(payload.city, { emptyToNull: true }));
  setIfDefined(data, 'phone', normalizeString(payload.phone, { emptyToNull: true }));
  setIfDefined(data, 'email', normalizeString(payload.email, { emptyToNull: true }));
  setIfDefined(data, 'reference1', normalizeString(payload.reference1, { emptyToNull: true }));
  setIfDefined(data, 'reference2', normalizeString(payload.reference2, { emptyToNull: true }));
  setIfDefined(data, 'departmentText', normalizeString(payload.department, { emptyToNull: true }));
  setIfDefined(data, 'role', normalizeString(payload.role || payload.designation, { emptyToNull: true }));
  setIfDefined(data, 'status', normalizeString(payload.status, { emptyToNull: true }));
  setIfDefined(data, 'appointmentDate', normalizeString(payload.appointmentDate, { emptyToNull: true }));
  setIfDefined(data, 'weeklyHoliday', normalizeString(payload.weeklyHoliday, { emptyToNull: true }));
  setIfDefined(data, 'workingDays', normalizeString(payload.workingDays, { emptyToNull: true }));
  setIfDefined(data, 'disbursement', normalizeString(payload.disbursement, { emptyToNull: true }));

  if (payload.salaryMonthly !== undefined) {
    data.salaryMonthly = normalizeNumber(payload.salaryMonthly, 0);
  } else if (payload.basicSalary !== undefined) {
    data.salaryMonthly = normalizeNumber(payload.basicSalary, 0);
  }

  setIfDefined(data, 'allowances', normalizeJsonArray(payload.allowances, []));
  setIfDefined(data, 'dutyType', normalizeString(payload.dutyType, { emptyToNull: true }));
  setIfDefined(data, 'dutyRoster', normalizeJsonArray(payload.dutyRoster, []));
  setIfDefined(data, 'photo', payload.photo);
  setIfDefined(data, 'emergencyContact', normalizeString(payload.emergencyContact, { emptyToNull: true }));
  setIfDefined(data, 'emergencyPhone', normalizeString(payload.emergencyPhone, { emptyToNull: true }));
  setIfDefined(data, 'emergencyRelation', normalizeString(payload.emergencyRelation, { emptyToNull: true }));
  setIfDefined(data, 'notes', normalizeString(payload.notes, { emptyToNull: true }));

  return prisma.employee.update({
    where: { id: parseInt(id) },
    data
  });
}

async function remove(id) {
  try {
    await prisma.employee.delete({
      where: { id: parseInt(id) }
    });
    return true;
  } catch (error) {
    if (error.code === 'P2025') return false; // Record not found
    throw error;
  }
}

module.exports = {
  list,
  get,
  create,
  update,
  remove,
};