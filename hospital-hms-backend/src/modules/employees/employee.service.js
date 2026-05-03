const prisma = require('../../config/db');

let isMasterTableReady = false;
let isExtendedEmployeeColumnsReady = false;

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

function normalizeBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = String(value).trim().toLowerCase();
  return ['true', '1', 'yes', 'y', 'on'].includes(normalized);
}

function setIfDefined(target, key, value) {
  if (value !== undefined) target[key] = value;
}

function employeeModelHasField(fieldName) {
  const fields = prisma?._runtimeDataModel?.models?.Employee?.fields || [];
  return fields.some((f) => f.name === fieldName);
}

function isMissingNightShiftColumnError(error) {
  return error?.code === 'P2022' && String(error?.meta?.column || '').includes('isNightShift');
}

async function ensureEmployeeMasterTables() {
  if (isMasterTableReady) return;

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS employee_departments (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS employee_designations (
      id SERIAL PRIMARY KEY,
      department_id INTEGER NOT NULL REFERENCES employee_departments(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
      UNIQUE (department_id, name)
    )
  `);

  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS idx_employee_designations_department_id ON employee_designations(department_id)');
  isMasterTableReady = true;
}

async function ensureExtendedEmployeeColumns() {
  if (isExtendedEmployeeColumnsReady) return;

  await prisma.$executeRawUnsafe('ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "cnicFrontDoc" TEXT');
  await prisma.$executeRawUnsafe('ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "cnicBackDoc" TEXT');
  await prisma.$executeRawUnsafe('ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "cnicExpiryDate" TEXT');

  await prisma.$executeRawUnsafe('ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "hasEobi" BOOLEAN DEFAULT FALSE');
  await prisma.$executeRawUnsafe('ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "hasSocialSecurity" BOOLEAN DEFAULT FALSE');
  await prisma.$executeRawUnsafe('ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "hasHealthCard" BOOLEAN DEFAULT FALSE');
  await prisma.$executeRawUnsafe('ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "hasOtherBenefit" BOOLEAN DEFAULT FALSE');
  await prisma.$executeRawUnsafe('ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "otherBenefitText" TEXT');

  await prisma.$executeRawUnsafe('ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "eobiContribution" DOUBLE PRECISION DEFAULT 0');
  await prisma.$executeRawUnsafe('ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "socialSecurityContribution" DOUBLE PRECISION DEFAULT 0');
  await prisma.$executeRawUnsafe('ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "healthCardContribution" DOUBLE PRECISION DEFAULT 0');
  await prisma.$executeRawUnsafe('ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "otherBenefitContribution" DOUBLE PRECISION DEFAULT 0');
  await prisma.$executeRawUnsafe('ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "late" BOOLEAN DEFAULT FALSE');
  await prisma.$executeRawUnsafe('ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "short" BOOLEAN DEFAULT FALSE');

  isExtendedEmployeeColumnsReady = true;
}

function normalizeExtendedFields(payload = {}) {
  return {
    cnicFrontDoc: normalizeString(payload.cnicFrontDoc, { emptyToNull: true }),
    cnicBackDoc: normalizeString(payload.cnicBackDoc, { emptyToNull: true }),
    cnicExpiryDate: normalizeString(payload.cnicExpiryDate, { emptyToNull: true }),
    hasEobi: normalizeBoolean(payload.hasEobi, false),
    hasSocialSecurity: normalizeBoolean(payload.hasSocialSecurity, false),
    hasHealthCard: normalizeBoolean(payload.hasHealthCard, false),
    hasOtherBenefit: normalizeBoolean(payload.hasOtherBenefit, false),
    otherBenefitText: normalizeString(payload.otherBenefitText, { emptyToNull: true }),
    eobiContribution: normalizeNumber(payload.eobiContribution, 0),
    socialSecurityContribution: normalizeNumber(payload.socialSecurityContribution, 0),
    healthCardContribution: normalizeNumber(payload.healthCardContribution, 0),
    otherBenefitContribution: normalizeNumber(payload.otherBenefitContribution, 0),
    late: normalizeBoolean(payload.late, false),
    short: normalizeBoolean(payload.short, false),
  };
}

function mergeExtendedFields(base, extended = {}) {
  return {
    ...base,
    cnicFrontDoc: extended.cnicFrontDoc ?? null,
    cnicBackDoc: extended.cnicBackDoc ?? null,
    cnicExpiryDate: extended.cnicExpiryDate ?? null,
    hasEobi: Boolean(extended.hasEobi),
    hasSocialSecurity: Boolean(extended.hasSocialSecurity),
    hasHealthCard: Boolean(extended.hasHealthCard),
    hasOtherBenefit: Boolean(extended.hasOtherBenefit),
    otherBenefitText: extended.otherBenefitText ?? null,
    eobiContribution: normalizeNumber(extended.eobiContribution, 0),
    socialSecurityContribution: normalizeNumber(extended.socialSecurityContribution, 0),
    healthCardContribution: normalizeNumber(extended.healthCardContribution, 0),
    otherBenefitContribution: normalizeNumber(extended.otherBenefitContribution, 0),
    late: Boolean(extended.late),
    short: Boolean(extended.short),
  };
}

async function upsertExtendedEmployeeFields(employeeId, payload = {}) {
  await ensureExtendedEmployeeColumns();
  const id = toIntId(employeeId, 'employee id');
  const f = normalizeExtendedFields(payload);

  await prisma.$executeRaw`
    UPDATE "Employee"
    SET
      "cnicFrontDoc" = ${f.cnicFrontDoc},
      "cnicBackDoc" = ${f.cnicBackDoc},
      "cnicExpiryDate" = ${f.cnicExpiryDate},
      "hasEobi" = ${f.hasEobi},
      "hasSocialSecurity" = ${f.hasSocialSecurity},
      "hasHealthCard" = ${f.hasHealthCard},
      "hasOtherBenefit" = ${f.hasOtherBenefit},
      "otherBenefitText" = ${f.otherBenefitText},
      "eobiContribution" = ${f.eobiContribution},
      "socialSecurityContribution" = ${f.socialSecurityContribution},
      "healthCardContribution" = ${f.healthCardContribution},
      "otherBenefitContribution" = ${f.otherBenefitContribution},
      "late" = ${f.late},
      "short" = ${f.short}
    WHERE id = ${id}
  `;

  return f;
}

async function getExtendedFieldsByEmployeeIds(employeeIds = []) {
  await ensureExtendedEmployeeColumns();
  const ids = (employeeIds || [])
    .map((id) => Number.parseInt(String(id), 10))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (!ids.length) return [];

  return prisma.$queryRawUnsafe(`
    SELECT
      id,
      "cnicFrontDoc",
      "cnicBackDoc",
      "cnicExpiryDate",
      "hasEobi",
      "hasSocialSecurity",
      "hasHealthCard",
      "hasOtherBenefit",
      "otherBenefitText",
      "eobiContribution",
      "socialSecurityContribution",
      "healthCardContribution",
      "otherBenefitContribution",
      "late",
      "short"
    FROM "Employee"
    WHERE id IN (${ids.join(',')})
  `);
}

function normalizeMasterName(value, fieldLabel) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    const err = new Error(`${fieldLabel} is required`);
    err.status = 400;
    throw err;
  }
  return normalized;
}

function toIntId(value, fieldLabel) {
  const id = Number.parseInt(String(value), 10);
  if (!Number.isInteger(id) || id <= 0) {
    const err = new Error(`Invalid ${fieldLabel}`);
    err.status = 400;
    throw err;
  }
  return id;
}

async function createEmployeeWithFallback(data) {
  try {
    return await prisma.employee.create({ data });
  } catch (error) {
    if (!isMissingNightShiftColumnError(error) || !Object.prototype.hasOwnProperty.call(data, 'isNightShift')) {
      throw error;
    }

    const fallbackData = { ...data };
    delete fallbackData.isNightShift;
    return prisma.employee.create({ data: fallbackData });
  }
}

async function updateEmployeeWithFallback(id, data) {
  try {
    return await prisma.employee.update({
      where: { id: parseInt(id) },
      data,
    });
  } catch (error) {
    if (!isMissingNightShiftColumnError(error) || !Object.prototype.hasOwnProperty.call(data, 'isNightShift')) {
      throw error;
    }

    const fallbackData = { ...data };
    delete fallbackData.isNightShift;
    return prisma.employee.update({
      where: { id: parseInt(id) },
      data: fallbackData,
    });
  }
}

async function list() {
  // Do not include attendances here: it forces a join on Attendance and breaks
  // employee listing whenever the Attendance table is behind Prisma schema (e.g. pending migrations).
  const rows = await prisma.employee.findMany({
    orderBy: { id: 'desc' },
  });

  const extras = await getExtendedFieldsByEmployeeIds(rows.map((row) => row.id));
  const extraMap = new Map(extras.map((row) => [Number(row.id), row]));

  return rows.map((row) => mergeExtendedFields(row, extraMap.get(Number(row.id))));
}

async function get(id) {
  const employee = await prisma.employee.findUnique({
    where: { id: parseInt(id) }
  });

  if (!employee) return null;

  const [extended] = await getExtendedFieldsByEmployeeIds([employee.id]);
  return mergeExtendedFields(employee, extended);
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

  if (employeeModelHasField('isNightShift')) {
    data.isNightShift = normalizeBoolean(payload.isNightShift, false);
  }

  const created = await createEmployeeWithFallback(data);
  const extended = await upsertExtendedEmployeeFields(created.id, payload);
  return mergeExtendedFields(created, extended);
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
  if (employeeModelHasField('isNightShift')) {
    setIfDefined(data, 'isNightShift', normalizeBoolean(payload.isNightShift, false));
  }
  setIfDefined(data, 'photo', payload.photo);
  setIfDefined(data, 'emergencyContact', normalizeString(payload.emergencyContact, { emptyToNull: true }));
  setIfDefined(data, 'emergencyPhone', normalizeString(payload.emergencyPhone, { emptyToNull: true }));
  setIfDefined(data, 'emergencyRelation', normalizeString(payload.emergencyRelation, { emptyToNull: true }));
  setIfDefined(data, 'notes', normalizeString(payload.notes, { emptyToNull: true }));

  const updated = await updateEmployeeWithFallback(id, data);
  const extended = await upsertExtendedEmployeeFields(id, payload);
  return mergeExtendedFields(updated, extended);
}

async function remove(id) {
  try {
    await prisma.attendance.deleteMany({ where: { employeeId: parseInt(id) } });
    await prisma.employee.delete({
      where: { id: parseInt(id) }
    });
    return true;
  } catch (error) {
    if (error.code === 'P2025') return false; // Record not found
    throw error;
  }
}

async function listDepartmentHeads() {
  await ensureEmployeeMasterTables();

  const rows = await prisma.$queryRaw`
    SELECT id, name
    FROM employee_departments
    ORDER BY name ASC
  `;

  return rows.map((row) => ({
    id: Number(row.id),
    name: row.name,
  }));
}

async function createDepartmentHead(payload = {}) {
  await ensureEmployeeMasterTables();

  const name = normalizeMasterName(payload.name, 'Department name');

  const duplicate = await prisma.$queryRaw`
    SELECT id
    FROM employee_departments
    WHERE LOWER(name) = LOWER(${name})
    LIMIT 1
  `;

  if (duplicate.length) {
    const err = new Error('Department already exists');
    err.status = 409;
    throw err;
  }

  const created = await prisma.$queryRaw`
    INSERT INTO employee_departments (name)
    VALUES (${name})
    RETURNING id, name
  `;

  return {
    id: Number(created[0].id),
    name: created[0].name,
  };
}

async function removeDepartmentHead(id) {
  await ensureEmployeeMasterTables();

  const departmentId = toIntId(id, 'department id');
  const deleted = await prisma.$queryRaw`
    DELETE FROM employee_departments
    WHERE id = ${departmentId}
    RETURNING id
  `;

  if (!deleted.length) {
    return false;
  }

  return true;
}

async function listDesignationHeadsByDepartment(departmentId) {
  await ensureEmployeeMasterTables();

  const id = toIntId(departmentId, 'department id');
  const rows = await prisma.$queryRaw`
    SELECT id, name
    FROM employee_designations
    WHERE department_id = ${id}
    ORDER BY name ASC
  `;

  return rows.map((row) => ({
    id: Number(row.id),
    name: row.name,
  }));
}

async function createDesignationHead(payload = {}) {
  await ensureEmployeeMasterTables();

  const name = normalizeMasterName(payload.name, 'Designation name');
  const departmentId = toIntId(payload.departmentId, 'department id');

  const departmentExists = await prisma.$queryRaw`
    SELECT id
    FROM employee_departments
    WHERE id = ${departmentId}
    LIMIT 1
  `;

  if (!departmentExists.length) {
    const err = new Error('Department not found');
    err.status = 404;
    throw err;
  }

  const duplicate = await prisma.$queryRaw`
    SELECT id
    FROM employee_designations
    WHERE department_id = ${departmentId}
      AND LOWER(name) = LOWER(${name})
    LIMIT 1
  `;

  if (duplicate.length) {
    const err = new Error('Designation already exists in this department');
    err.status = 409;
    throw err;
  }

  const created = await prisma.$queryRaw`
    INSERT INTO employee_designations (department_id, name)
    VALUES (${departmentId}, ${name})
    RETURNING id, name
  `;

  return {
    id: Number(created[0].id),
    name: created[0].name,
    departmentId,
  };
}

async function removeDesignationHead(id) {
  await ensureEmployeeMasterTables();

  const designationId = toIntId(id, 'designation id');
  const deleted = await prisma.$queryRaw`
    DELETE FROM employee_designations
    WHERE id = ${designationId}
    RETURNING id
  `;

  if (!deleted.length) {
    return false;
  }

  return true;
}

module.exports = {
  list,
  get,
  create,
  update,
  remove,
  listDepartmentHeads,
  createDepartmentHead,
  removeDepartmentHead,
  listDesignationHeadsByDepartment,
  createDesignationHead,
  removeDesignationHead,
};