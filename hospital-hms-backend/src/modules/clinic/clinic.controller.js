const service = require('./clinic.service');
const { success, fail } = require('../../utils/response');

// ─── Department ───────────────────────────────────────────────────────────────

async function getDepartments(req, res, next) {
  try {
    const data = await service.getAllDepartments();
    success(res, data);
  } catch (err) { next(err); }
}

async function createDepartment(req, res, next) {
  try {
    const { name } = req.body;
    if (!name?.trim()) return fail(res, 400, 'Name is required');
    const data = await service.createDepartment({ name });
    success(res, data, 'Department created');
  } catch (err) {
    if (err.code === 'P2002') return fail(res, 409, 'Department name already exists');
    next(err);
  }
}

async function updateDepartment(req, res, next) {
  try {
    const { name } = req.body;
    if (!name?.trim()) return fail(res, 400, 'Name is required');
    const data = await service.updateDepartment(req.params.id, { name });
    success(res, data, 'Department updated');
  } catch (err) {
    if (err.code === 'P2002') return fail(res, 409, 'Department name already exists');
    if (err.code === 'P2025') return fail(res, 404, 'Department not found');
    next(err);
  }
}

async function deleteDepartment(req, res, next) {
  try {
    await service.deleteDepartment(req.params.id);
    success(res, null, 'Department deleted');
  } catch (err) {
    if (err.code === 'P2025') return fail(res, 404, 'Department not found');
    if (err.code === 'P2003') return fail(res, 409, 'Cannot delete department — its sub-departments are linked to panel or other records');
    next(err);
  }
}

// ─── Sub Department ───────────────────────────────────────────────────────────

async function getSubDepartments(req, res, next) {
  try {
    const data = await service.getAllSubDepartments();
    success(res, data);
  } catch (err) { next(err); }
}

async function createSubDepartment(req, res, next) {
  try {
    const { name, departmentId } = req.body;
    if (!name?.trim()) return fail(res, 400, 'Name is required');
    if (!departmentId) return fail(res, 400, 'Department is required');
    const data = await service.createSubDepartment({ name, departmentId });
    success(res, data, 'Sub Department created');
  } catch (err) {
    if (err.code === 'P2002') return fail(res, 409, 'Sub Department already exists in this department');
    if (err.code === 'P2003') return fail(res, 404, 'Department not found');
    next(err);
  }
}

async function updateSubDepartment(req, res, next) {
  try {
    const { name, departmentId } = req.body;
    if (!name?.trim()) return fail(res, 400, 'Name is required');
    if (!departmentId) return fail(res, 400, 'Department is required');
    const data = await service.updateSubDepartment(req.params.id, { name, departmentId });
    success(res, data, 'Sub Department updated');
  } catch (err) {
    if (err.code === 'P2002') return fail(res, 409, 'Sub Department already exists in this department');
    if (err.code === 'P2025') return fail(res, 404, 'Sub Department not found');
    next(err);
  }
}

async function deleteSubDepartment(req, res, next) {
  try {
    await service.deleteSubDepartment(req.params.id);
    success(res, null, 'Sub Department deleted');
  } catch (err) {
    if (err.code === 'P2025') return fail(res, 404, 'Sub Department not found');
    next(err);
  }
}

// ─── Surgery Type ─────────────────────────────────────────────────────────────

async function getSurgeryTypes(req, res, next) {
  try {
    const data = await service.getAllSurgeryTypes();
    success(res, data);
  } catch (err) { next(err); }
}

async function createSurgeryType(req, res, next) {
  try {
    const { name } = req.body;
    if (!name?.trim()) return fail(res, 400, 'Name is required');
    const data = await service.createSurgeryType({ name });
    success(res, data, 'Surgery Type created');
  } catch (err) {
    if (err.code === 'P2002') return fail(res, 409, 'Surgery Type already exists');
    next(err);
  }
}

async function updateSurgeryType(req, res, next) {
  try {
    const { name } = req.body;
    if (!name?.trim()) return fail(res, 400, 'Name is required');
    const data = await service.updateSurgeryType(req.params.id, { name });
    success(res, data, 'Surgery Type updated');
  } catch (err) {
    if (err.code === 'P2002') return fail(res, 409, 'Surgery Type already exists');
    if (err.code === 'P2025') return fail(res, 404, 'Surgery Type not found');
    next(err);
  }
}

async function deleteSurgeryType(req, res, next) {
  try {
    await service.deleteSurgeryType(req.params.id);
    success(res, null, 'Surgery Type deleted');
  } catch (err) {
    if (err.code === 'P2025') return fail(res, 404, 'Surgery Type not found');
    if (err.code === 'P2003') return fail(res, 409, 'Cannot delete — Surgery Type is linked to existing records');
    next(err);
  }
}

// ─── Staff Category ───────────────────────────────────────────────────────────

async function getStaffCategories(req, res, next) {
  try {
    const data = await service.getAllStaffCategories();
    success(res, data);
  } catch (err) { next(err); }
}

async function createStaffCategory(req, res, next) {
  try {
    const { name } = req.body;
    if (!name?.trim()) return fail(res, 400, 'Name is required');
    const data = await service.createStaffCategory({ name });
    success(res, data, 'Staff Category created');
  } catch (err) {
    if (err.code === 'P2002') return fail(res, 409, 'Staff Category already exists');
    next(err);
  }
}

async function updateStaffCategory(req, res, next) {
  try {
    const { name } = req.body;
    if (!name?.trim()) return fail(res, 400, 'Name is required');
    const data = await service.updateStaffCategory(req.params.id, { name });
    success(res, data, 'Staff Category updated');
  } catch (err) {
    if (err.code === 'P2002') return fail(res, 409, 'Staff Category already exists');
    if (err.code === 'P2025') return fail(res, 404, 'Staff Category not found');
    next(err);
  }
}

async function deleteStaffCategory(req, res, next) {
  try {
    await service.deleteStaffCategory(req.params.id);
    success(res, null, 'Staff Category deleted');
  } catch (err) {
    if (err.code === 'P2025') return fail(res, 404, 'Staff Category not found');
    next(err);
  }
}

// ─── Doctor ───────────────────────────────────────────────────────────────────

async function getDoctors(req, res, next) {
  try {
    const data = await service.getAllDoctors();
    success(res, data);
  } catch (err) { next(err); }
}

async function createDoctor(req, res, next) {
  try {
    const { code, name, speciality, qualification, staffCategoryId, status, consultantDays, subDepts } = req.body;
    if (!code?.trim()) return fail(res, 400, 'Code is required');
    if (!name?.trim()) return fail(res, 400, 'Name is required');
    const data = await service.createDoctor({ code, name, speciality, qualification, staffCategoryId, status, consultantDays, subDepts });
    success(res, data, 'Doctor created');
  } catch (err) {
    if (err.code === 'P2002') return fail(res, 409, 'Doctor code already exists');
    next(err);
  }
}

async function updateDoctor(req, res, next) {
  try {
    const { code, name, speciality, qualification, staffCategoryId, status, consultantDays, subDepts } = req.body;
    if (!code?.trim()) return fail(res, 400, 'Code is required');
    if (!name?.trim()) return fail(res, 400, 'Name is required');
    const data = await service.updateDoctor(req.params.id, { code, name, speciality, qualification, staffCategoryId, status, consultantDays, subDepts });
    success(res, data, 'Doctor updated');
  } catch (err) {
    if (err.code === 'P2002') return fail(res, 409, 'Doctor code already exists');
    if (err.code === 'P2025') return fail(res, 404, 'Doctor not found');
    next(err);
  }
}

async function deleteDoctor(req, res, next) {
  try {
    await service.deleteDoctor(req.params.id);
    success(res, null, 'Doctor deleted');
  } catch (err) {
    if (err.code === 'P2025') return fail(res, 404, 'Doctor not found');
    if (err.code === 'P2003') return fail(res, 409, 'Cannot delete doctor — they have existing OPD visit records');
    next(err);
  }
}

// ─── OPD ─────────────────────────────────────────────────────────────────────

async function getAvailableDoctors(req, res, next) {
  try {
    const { day, time, onCall, departmentName } = req.query;
    const data = await service.getAvailableDoctors({
      day: day || '',
      time: time || '',
      onCall: onCall === 'true',
      departmentName: departmentName || '',
    });
    success(res, data);
  } catch (err) { next(err); }
}

async function getNextSerialNo(req, res, next) {
  try {
    const data = await service.getNextSerialNo();
    success(res, { serialNo: data });
  } catch (err) { next(err); }
}

async function getNextMrNo(req, res, next) {
  try {
    const data = await service.getNextMrNo();
    success(res, { mrNo: data });
  } catch (err) { next(err); }
}

async function searchEmployees(req, res, next) {
  try {
    const data = await service.searchEmployees(req.query.q);
    success(res, data);
  } catch (err) { next(err); }
}

async function createOpdVisit(req, res, next) {
  try {
    const { serialNo, patientName } = req.body;
    if (!serialNo?.trim()) return fail(res, 400, 'Serial No is required');
    if (!patientName?.trim()) return fail(res, 400, 'Patient Name is required');
    const data = await service.createOpdVisit(req.body);
    success(res, data, 'OPD Visit saved');
  } catch (err) {
    if (err.code === 'P2002') return fail(res, 409, 'Serial No already exists');
    next(err);
  }
}

async function getOpdVisits(req, res, next) {
  try {
    const data = await service.getOpdVisits();
    success(res, data);
  } catch (err) { next(err); }
}

// ─── Room Category ────────────────────────────────────────────────────────────

async function getRoomCategories(req, res, next) {
  try {
    const data = await service.getAllRoomCategories();
    success(res, data);
  } catch (err) { next(err); }
}

async function createRoomCategory(req, res, next) {
  try {
    const { code, name, rate } = req.body;
    if (!code?.trim()) return fail(res, 400, 'Code is required');
    if (!name?.trim()) return fail(res, 400, 'Name is required');
    const data = await service.createRoomCategory({ code, name, rate });
    success(res, data, 'Room Category created');
  } catch (err) {
    if (err.code === 'P2002') return fail(res, 409, 'Code or Name already exists');
    next(err);
  }
}

async function updateRoomCategory(req, res, next) {
  try {
    const { code, name, rate } = req.body;
    if (!code?.trim()) return fail(res, 400, 'Code is required');
    if (!name?.trim()) return fail(res, 400, 'Name is required');
    const data = await service.updateRoomCategory(req.params.id, { code, name, rate });
    success(res, data, 'Room Category updated');
  } catch (err) {
    if (err.code === 'P2002') return fail(res, 409, 'Code or Name already exists');
    if (err.code === 'P2025') return fail(res, 404, 'Room Category not found');
    next(err);
  }
}

async function deleteRoomCategory(req, res, next) {
  try {
    await service.deleteRoomCategory(req.params.id);
    success(res, null, 'Room Category deleted');
  } catch (err) {
    if (err.code === 'P2025') return fail(res, 404, 'Room Category not found');
    next(err);
  }
}

// ─── Bed ──────────────────────────────────────────────────────────────────────

async function getBeds(req, res, next) {
  try {
    const data = await service.getAllBeds();
    success(res, data);
  } catch (err) { next(err); }
}

async function createBed(req, res, next) {
  try {
    const { name, roomCategoryId } = req.body;
    if (!name?.trim()) return fail(res, 400, 'Bed name is required');
    if (!roomCategoryId) return fail(res, 400, 'Room Category is required');
    const data = await service.createBed({ name, roomCategoryId });
    success(res, data, 'Bed created');
  } catch (err) {
    if (err.code === 'P2002') return fail(res, 409, 'Bed already exists in this room category');
    if (err.code === 'P2003') return fail(res, 404, 'Room Category not found');
    next(err);
  }
}

async function updateBed(req, res, next) {
  try {
    const { name, roomCategoryId } = req.body;
    if (!name?.trim()) return fail(res, 400, 'Bed name is required');
    if (!roomCategoryId) return fail(res, 400, 'Room Category is required');
    const data = await service.updateBed(req.params.id, { name, roomCategoryId });
    success(res, data, 'Bed updated');
  } catch (err) {
    if (err.code === 'P2002') return fail(res, 409, 'Bed already exists in this room category');
    if (err.code === 'P2025') return fail(res, 404, 'Bed not found');
    next(err);
  }
}

async function deleteBed(req, res, next) {
  try {
    await service.deleteBed(req.params.id);
    success(res, null, 'Bed deleted');
  } catch (err) {
    if (err.code === 'P2025') return fail(res, 404, 'Bed not found');
    next(err);
  }
}

// ─── Bill Head ────────────────────────────────────────────────────────────────

async function getBillHeads(req, res, next) {
  try { success(res, await service.getAllBillHeads()); } catch (err) { next(err); }
}

async function getBillHead(req, res, next) {
  try {
    const data = await service.getBillHeadById(req.params.id);
    if (!data) return fail(res, 404, 'Bill Head not found');
    success(res, data);
  } catch (err) { next(err); }
}

async function createBillHead(req, res, next) {
  try {
    const { headCode } = req.body;
    if (!headCode?.trim()) return fail(res, 400, 'Head Code is required');
    const data = await service.createBillHead(req.body);
    success(res, data, 'Bill Head created');
  } catch (err) {
    if (err.code === 'P2002') return fail(res, 409, 'Head Code already exists');
    next(err);
  }
}

async function updateBillHead(req, res, next) {
  try {
    const { headCode } = req.body;
    if (!headCode?.trim()) return fail(res, 400, 'Head Code is required');
    const data = await service.updateBillHead(req.params.id, req.body);
    success(res, data, 'Bill Head updated');
  } catch (err) {
    if (err.code === 'P2002') return fail(res, 409, 'Head Code already exists');
    if (err.code === 'P2025') return fail(res, 404, 'Bill Head not found');
    next(err);
  }
}

async function deleteBillHead(req, res, next) {
  try {
    await service.deleteBillHead(req.params.id);
    success(res, null, 'Bill Head deleted');
  } catch (err) {
    if (err.code === 'P2025') return fail(res, 404, 'Bill Head not found');
    next(err);
  }
}

// ─── Panel Company ────────────────────────────────────────────────────────────

async function getPanelCompanies(req, res, next) {
  try { success(res, await service.getAllPanelCompanies()); } catch (err) { next(err); }
}

async function getPanelCompany(req, res, next) {
  try {
    const data = await service.getPanelCompanyById(req.params.id);
    if (!data) return fail(res, 404, 'Panel Company not found');
    success(res, data);
  } catch (err) { next(err); }
}

async function createPanelCompany(req, res, next) {
  try {
    const { code, name } = req.body;
    if (!code?.trim()) return fail(res, 400, 'Code is required');
    if (!name?.trim()) return fail(res, 400, 'Name is required');
    const data = await service.createPanelCompany(req.body);
    success(res, data, 'Panel Company created');
  } catch (err) {
    if (err.code === 'P2002') return fail(res, 409, 'Code already exists');
    next(err);
  }
}

async function updatePanelCompany(req, res, next) {
  try {
    const { code, name } = req.body;
    if (!code?.trim()) return fail(res, 400, 'Code is required');
    if (!name?.trim()) return fail(res, 400, 'Name is required');
    const data = await service.updatePanelCompany(req.params.id, req.body);
    success(res, data, 'Panel Company updated');
  } catch (err) {
    if (err.code === 'P2002') return fail(res, 409, 'Code already exists');
    if (err.code === 'P2025') return fail(res, 404, 'Panel Company not found');
    next(err);
  }
}

async function deletePanelCompany(req, res, next) {
  try {
    await service.deletePanelCompany(req.params.id);
    success(res, null, 'Panel Company deleted');
  } catch (err) {
    if (err.code === 'P2025') return fail(res, 404, 'Panel Company not found');
    next(err);
  }
}

// ─── Panel Employees ──────────────────────────────────────────────────────────

async function getPanelEmployees(req, res, next) {
  try {
    const data = await service.getAllPanelEmployees();
    success(res, data);
  } catch (err) { next(err); }
}

async function getPanelEmployee(req, res, next) {
  try {
    const data = await service.getPanelEmployeeById(req.params.id);
    if (!data) return fail(res, 404, 'Panel Employee not found');
    success(res, data);
  } catch (err) { next(err); }
}

async function createPanelEmployee(req, res, next) {
  try {
    const { companyId, empCode, name } = req.body;
    if (!companyId) return fail(res, 400, 'Company is required');
    if (!empCode?.trim()) return fail(res, 400, 'Employee code is required');
    if (!name?.trim()) return fail(res, 400, 'Name is required');
    const data = await service.createPanelEmployee(req.body);
    success(res, data, 'Panel Employee created');
  } catch (err) {
    if (err.code === 'P2002') return fail(res, 409, 'Employee code already exists');
    next(err);
  }
}

async function updatePanelEmployee(req, res, next) {
  try {
    const { companyId, empCode, name } = req.body;
    if (!companyId) return fail(res, 400, 'Company is required');
    if (!empCode?.trim()) return fail(res, 400, 'Employee code is required');
    if (!name?.trim()) return fail(res, 400, 'Name is required');
    const data = await service.updatePanelEmployee(req.params.id, req.body);
    success(res, data, 'Panel Employee updated');
  } catch (err) {
    if (err.code === 'P2025') return fail(res, 404, 'Panel Employee not found');
    if (err.code === 'P2002') return fail(res, 409, 'Employee code already exists');
    next(err);
  }
}

async function deletePanelEmployee(req, res, next) {
  try {
    await service.deletePanelEmployee(req.params.id);
    success(res, null, 'Panel Employee deleted');
  } catch (err) {
    if (err.code === 'P2025') return fail(res, 404, 'Panel Employee not found');
    next(err);
  }
}

// ─── Antenatal ────────────────────────────────────────────────────────────────

async function createAntenatal(req, res, next) {
  try {
    const { patientName } = req.body;
    if (!patientName?.trim()) return fail(res, 400, 'Patient Name is required');
    const data = await service.createAntenatal(req.body);
    success(res, data, 'Antenatal registration saved');
  } catch (err) { next(err); }
}

async function getAntenatalList(req, res, next) {
  try {
    success(res, await service.getAntenatalList());
  } catch (err) { next(err); }
}

async function getAntenatalByNo(req, res, next) {
  try {
    const record = await service.getAntenatalByNo(req.params.no);
    if (!record) return fail(res, 404, 'No antenatal found');
    success(res, record);
  } catch (err) { next(err); }
}

async function getOpdPatientByMrNo(req, res, next) {
  try {
    const record = await service.getOpdPatientByMrNo(req.params.mrNo);
    if (!record) return fail(res, 404, 'No patient found with this MR number');
    success(res, record);
  } catch (err) { next(err); }
}

async function getOpdPatientsByPhone(req, res, next) {
  try {
    const records = await service.getOpdPatientsByPhone(req.params.phone);
    success(res, records);
  } catch (err) { next(err); }
}

async function getOpdVisitBySerial(req, res, next) {
  try {
    const record = await service.getOpdVisitBySerial(req.params.serialNo);
    if (!record) return fail(res, 404, 'No OPD visit found with this slip number');
    success(res, record);
  } catch (err) { next(err); }
}

async function getAdmissions(req, res, next) {
  try {
    success(res, await service.getAdmissions());
  } catch (err) { next(err); }
}

async function createAdmission(req, res, next) {
  try {
    if (!req.body.admissionNo?.trim()) return fail(res, 400, 'Admission # is required');
    if (!req.body.patientName?.trim()) return fail(res, 400, 'Patient Name is required');
    const data = await service.createAdmission(req.body);
    success(res, data, 'Admission saved');
  } catch (err) { next(err); }
}

async function getAvailableBeds(req, res, next) {
  try {
    const { roomCategoryId } = req.query;
    if (!roomCategoryId) return success(res, []);
    success(res, await service.getAvailableBeds(roomCategoryId));
  } catch (err) { next(err); }
}

async function printOpdVisit(req, res, next) {
  try {
    const data = await service.printOpdVisit(req.params.id);
    success(res, data);
  } catch (err) {
    if (err.status) return fail(res, err.status, err.message);
    next(err);
  }
}

// ─── Patient Visits ───────────────────────────────────────────────────────────

async function getConsultantRates(req, res, next) {
  try { success(res, await service.getAllConsultantRates()); } catch (err) { next(err); }
}

async function upsertConsultantRate(req, res, next) {
  try {
    const { consultantName, rate } = req.body;
    if (!consultantName?.trim()) return fail(res, 400, 'Consultant name required');
    if (rate === undefined || rate === '') return fail(res, 400, 'Rate required');
    const data = await service.upsertConsultantRate(consultantName.trim(), rate);
    success(res, data, 'Rate saved');
  } catch (err) { next(err); }
}

async function deleteConsultantRate(req, res, next) {
  try {
    await service.deleteConsultantRate(req.params.id);
    success(res, null, 'Rate deleted');
  } catch (err) { next(err); }
}

async function getConsultantNames(req, res, next) {
  try {
    success(res, await service.getConsultantNames());
  } catch (err) { next(err); }
}

async function getPatientVisitByAdmitNo(req, res, next) {
  try {
    const record = await service.getPatientVisitByAdmitNo(req.params.admitNo);
    if (!record) return fail(res, 404, 'No patient visit found with this admission number');
    success(res, record);
  } catch (err) { next(err); }
}

async function getDoctorSubDeptRates(req, res, next) {
  try { success(res, await service.getDoctorSubDeptRates()); } catch (err) { next(err); }
}

async function importDoctorSubDeptRates(req, res, next) {
  try {
    const { rows, deptTitle, doctorName } = req.body;
    if (!Array.isArray(rows) || rows.length === 0)
      return fail(res, 400, 'rows array required');
    const result = await service.importDoctorSubDeptRates(req.params.id, rows, deptTitle || '', doctorName || '');
    success(res, result, `${result.matched} sub-depts imported (${result.created} new, ${result.updated} updated, ${result.autoCreatedSubDepts} sub-depts auto-created)`);
  } catch (err) { next(err); }
}

async function bulkCreatePatientVisits(req, res, next) {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0)
      return fail(res, 400, 'rows array required');
    const result = await service.bulkCreatePatientVisits(rows);
    success(res, { inserted: result.count }, `${result.count} records imported`);
  } catch (err) { next(err); }
}

async function getPatientVisits(req, res, next) {
  try {
    const { fromDate, toDate, fromTime, toTime, paymentTypes, fromConsultant, toConsultant } = req.query;
    const types = paymentTypes ? paymentTypes.split(',').filter(Boolean) : [];
    const data = await service.getPatientVisits({ fromDate, toDate, fromTime, toTime, paymentTypes: types, fromConsultant, toConsultant });
    success(res, data);
  } catch (err) { next(err); }
}

async function getConsultantStatement(req, res, next) {
  try {
    const { consultantId, fromDate, toDate, fromTime, toTime } = req.query;
    const data = await service.getConsultantStatement({ consultantId, fromDate, toDate, fromTime, toTime });
    success(res, data);
  } catch (err) { next(err); }
}

async function getRevenueDashboard(req, res, next) {
  try {
    const { period, year, month, department, subDept, consultant, paymentType } = req.query;
    const data = await service.getRevenueDashboard({ period, year, month, department, subDept, consultant, paymentType });
    success(res, data);
  } catch (err) { next(err); }
}

async function getBalanceSlips(req, res, next) {
  try {
    success(res, await service.getBalanceSlips());
  } catch (err) { next(err); }
}

async function receiveBalancePayment(req, res, next) {
  try {
    const { amount } = req.body;
    if (!amount || Number(amount) <= 0) return fail(res, 400, 'Valid amount required');
    const data = await service.receiveBalancePayment(req.params.id, Number(amount));
    success(res, data, 'Balance received successfully');
  } catch (err) {
    if (err.message === 'Visit not found') return fail(res, 404, err.message);
    if (err.message === 'Invalid amount') return fail(res, 400, err.message);
    next(err);
  }
}

module.exports = {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getSubDepartments,
  createSubDepartment,
  updateSubDepartment,
  deleteSubDepartment,
  getSurgeryTypes,
  createSurgeryType,
  updateSurgeryType,
  deleteSurgeryType,
  getStaffCategories,
  createStaffCategory,
  updateStaffCategory,
  deleteStaffCategory,
  getDoctors,
  createDoctor,
  updateDoctor,
  deleteDoctor,
  getAvailableDoctors,
  getNextMrNo,
  getNextSerialNo,
  searchEmployees,
  createOpdVisit,
  getOpdVisits,
  getRoomCategories,
  createRoomCategory,
  updateRoomCategory,
  deleteRoomCategory,
  getBeds,
  createBed,
  updateBed,
  deleteBed,
  getBillHeads,
  getBillHead,
  createBillHead,
  updateBillHead,
  deleteBillHead,
  getPanelCompanies,
  getPanelCompany,
  createPanelCompany,
  updatePanelCompany,
  deletePanelCompany,
  getPanelEmployees,
  getPanelEmployee,
  createPanelEmployee,
  updatePanelEmployee,
  deletePanelEmployee,
  printOpdVisit,
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
  getConsultantRates,
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

async function importBillComparison(req, res, next) {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || !rows.length) return fail(res, 400, 'No rows provided');
    const result = await service.importBillComparison(rows);
    success(res, result, `Imported ${result.rowsInserted} rows`);
  } catch (err) { next(err); }
}

async function getBillComparisons(req, res, next) {
  try {
    const data = await service.getBillComparisons();
    success(res, data);
  } catch (err) { next(err); }
}
