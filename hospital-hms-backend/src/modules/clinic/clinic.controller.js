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

// ─── Symptom ────────────────────────────────────────────────────────────────

async function getSymptoms(req, res, next) {
  try {
    const data = await service.getAllSymptoms();
    success(res, data);
  } catch (err) { next(err); }
}

async function createSymptom(req, res, next) {
  try {
    const { name } = req.body;
    if (!name?.trim()) return fail(res, 400, 'Name is required');
    const data = await service.createSymptom({ name });
    success(res, data, 'Symptom created');
  } catch (err) {
    if (err.code === 'P2002') return fail(res, 409, 'Symptom already exists');
    next(err);
  }
}

async function updateSymptom(req, res, next) {
  try {
    const { name } = req.body;
    if (!name?.trim()) return fail(res, 400, 'Name is required');
    const data = await service.updateSymptom(req.params.id, { name });
    success(res, data, 'Symptom updated');
  } catch (err) {
    if (err.code === 'P2002') return fail(res, 409, 'Symptom already exists');
    if (err.code === 'P2025') return fail(res, 404, 'Symptom not found');
    next(err);
  }
}

async function deleteSymptom(req, res, next) {
  try {
    await service.deleteSymptom(req.params.id);
    success(res, null, 'Symptom deleted');
  } catch (err) {
    if (err.code === 'P2025') return fail(res, 404, 'Symptom not found');
    if (err.code === 'P2003') return fail(res, 409, 'Cannot delete — Symptom is linked to existing records');
    next(err);
  }
}

// ─── Disease ────────────────────────────────────────────────────────────────

async function getDiseases(req, res, next) {
  try {
    const data = await service.getAllDiseases();
    success(res, data);
  } catch (err) { next(err); }
}

async function createDisease(req, res, next) {
  try {
    const { name } = req.body;
    if (!name?.trim()) return fail(res, 400, 'Name is required');
    const data = await service.createDisease({ name });
    success(res, data, 'Disease created');
  } catch (err) {
    if (err.code === 'P2002') return fail(res, 409, 'Disease already exists');
    next(err);
  }
}

async function updateDisease(req, res, next) {
  try {
    const { name } = req.body;
    if (!name?.trim()) return fail(res, 400, 'Name is required');
    const data = await service.updateDisease(req.params.id, { name });
    success(res, data, 'Disease updated');
  } catch (err) {
    if (err.code === 'P2002') return fail(res, 409, 'Disease already exists');
    if (err.code === 'P2025') return fail(res, 404, 'Disease not found');
    next(err);
  }
}

async function deleteDisease(req, res, next) {
  try {
    await service.deleteDisease(req.params.id);
    success(res, null, 'Disease deleted');
  } catch (err) {
    if (err.code === 'P2025') return fail(res, 404, 'Disease not found');
    if (err.code === 'P2003') return fail(res, 409, 'Cannot delete — Disease is linked to existing records');
    next(err);
  }
}

// ─── Document Type ────────────────────────────────────────────────────────────

async function getDocumentTypes(req, res, next) {
  try {
    const data = await service.getAllDocumentTypes();
    success(res, data);
  } catch (err) { next(err); }
}

async function createDocumentType(req, res, next) {
  try {
    const { name } = req.body;
    if (!name?.trim()) return fail(res, 400, 'Name is required');
    const data = await service.createDocumentType({ name });
    success(res, data, 'Document Type created');
  } catch (err) {
    if (err.code === 'P2002') return fail(res, 409, 'Document Type already exists');
    next(err);
  }
}

async function updateDocumentType(req, res, next) {
  try {
    const { name } = req.body;
    if (!name?.trim()) return fail(res, 400, 'Name is required');
    const data = await service.updateDocumentType(req.params.id, { name });
    success(res, data, 'Document Type updated');
  } catch (err) {
    if (err.code === 'P2002') return fail(res, 409, 'Document Type already exists');
    if (err.code === 'P2025') return fail(res, 404, 'Document Type not found');
    next(err);
  }
}

async function deleteDocumentType(req, res, next) {
  try {
    await service.deleteDocumentType(req.params.id);
    success(res, null, 'Document Type deleted');
  } catch (err) {
    if (err.code === 'P2025') return fail(res, 404, 'Document Type not found');
    if (err.code === 'P2003') return fail(res, 409, 'Cannot delete — Document Type is linked to existing records');
    next(err);
  }
}

// ─── Discharge Type ───────────────────────────────────────────────────────────

async function getDischargeTypes(req, res, next) {
  try {
    const data = await service.getAllDischargeTypes();
    success(res, data);
  } catch (err) { next(err); }
}

async function createDischargeType(req, res, next) {
  try {
    const { name } = req.body;
    if (!name?.trim()) return fail(res, 400, 'Name is required');
    const data = await service.createDischargeType({ name });
    success(res, data, 'Discharge Type created');
  } catch (err) {
    if (err.code === 'P2002') return fail(res, 409, 'Discharge Type already exists');
    next(err);
  }
}

async function updateDischargeType(req, res, next) {
  try {
    const { name } = req.body;
    if (!name?.trim()) return fail(res, 400, 'Name is required');
    const data = await service.updateDischargeType(req.params.id, { name });
    success(res, data, 'Discharge Type updated');
  } catch (err) {
    if (err.code === 'P2002') return fail(res, 409, 'Discharge Type already exists');
    if (err.code === 'P2025') return fail(res, 404, 'Discharge Type not found');
    next(err);
  }
}

async function deleteDischargeType(req, res, next) {
  try {
    await service.deleteDischargeType(req.params.id);
    success(res, null, 'Discharge Type deleted');
  } catch (err) {
    if (err.code === 'P2025') return fail(res, 404, 'Discharge Type not found');
    if (err.code === 'P2003') return fail(res, 409, 'Cannot delete — Discharge Type is linked to existing records');
    next(err);
  }
}

async function getShifts(req, res, next) {
  try {
    const data = await service.getAllShifts();
    success(res, data);
  } catch (err) { next(err); }
}

async function createShift(req, res, next) {
  try {
    const { name, fromTime, toTime } = req.body;
    if (!name?.trim()) return fail(res, 400, 'Name is required');
    if (!fromTime || !toTime) return fail(res, 400, 'From/To time is required');
    const data = await service.createShift({ name, fromTime, toTime });
    success(res, data, 'Shift created');
  } catch (err) {
    if (err.code === 'P2002') return fail(res, 409, 'Shift already exists');
    next(err);
  }
}

async function updateShift(req, res, next) {
  try {
    const { name, fromTime, toTime } = req.body;
    const data = await service.updateShift(req.params.id, { name, fromTime, toTime });
    success(res, data, 'Shift updated');
  } catch (err) {
    if (err.code === 'P2002') return fail(res, 409, 'Shift already exists');
    if (err.code === 'P2025') return fail(res, 404, 'Shift not found');
    next(err);
  }
}

async function deleteShift(req, res, next) {
  try {
    await service.deleteShift(req.params.id);
    success(res, null, 'Shift deleted');
  } catch (err) {
    if (err.code === 'P2025') return fail(res, 404, 'Shift not found');
    next(err);
  }
}

// ─── Credit Card Surcharge Parameter ──────────────────────────────────────────

async function getCcConfig(req, res, next) {
  try {
    const data = await service.getCcConfig();
    success(res, data);
  } catch (err) { next(err); }
}

async function updateCcConfig(req, res, next) {
  try {
    const { percentage, minAmount } = req.body;
    const data = await service.updateCcConfig({ percentage, minAmount });
    success(res, data, 'Credit Card parameter updated');
  } catch (err) { next(err); }
}

// ─── Upload Patient Document ──────────────────────────────────────────────────

async function searchAdmissionsForDocuments(req, res, next) {
  try {
    success(res, await service.searchAdmissionsForDocuments(req.query.q));
  } catch (err) { next(err); }
}

async function getPatientDocuments(req, res, next) {
  try {
    success(res, await service.getPatientDocuments(req.params.admissionId));
  } catch (err) { next(err); }
}

async function uploadPatientDocument(req, res, next) {
  try {
    if (!req.file) return fail(res, 400, 'File is required');
    const { admissionId, documentTypeId, uploadedBy } = req.body;
    if (!admissionId) return fail(res, 400, 'Admission is required');
    const data = await service.createPatientDocument({
      admissionId,
      documentTypeId,
      uploadedBy,
      fileName: req.file.originalname,
      filePath: `patient-documents/${req.file.filename}`,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
    });
    success(res, data, 'Document uploaded');
  } catch (err) {
    if (err.status === 404) return fail(res, 404, err.message);
    next(err);
  }
}

async function getPatientDocumentsReport(req, res, next) {
  try {
    const { dateFrom, dateTo, q, documentTypeId } = req.query;
    success(res, await service.getPatientDocumentsReport({ dateFrom, dateTo, q, documentTypeId }));
  } catch (err) { next(err); }
}

// ─── Provisional Bill ─────────────────────────────────────────────────────────

async function getProvisionalBillDetail(req, res, next) {
  try {
    success(res, await service.getProvisionalBillDetail(req.params.admissionId));
  } catch (err) {
    if (err.status === 404) return fail(res, 404, err.message);
    next(err);
  }
}

async function addProvisionalBillItem(req, res, next) {
  try {
    const { roomCategoryId, billHeadId, qty, rate, remarks, patientType } = req.body;
    const data = await service.addProvisionalBillItem(req.params.admissionId, { roomCategoryId, billHeadId, qty, rate, remarks, patientType });
    success(res, data, 'Row added');
  } catch (err) {
    if (err.status === 404) return fail(res, 404, err.message);
    next(err);
  }
}

async function addProvisionalBillItemFromVisit(req, res, next) {
  try {
    const data = await service.addProvisionalBillItemFromVisit(req.params.admissionId, req.body.opdVisitId);
    success(res, data, 'Slip Provisional Bill mein add ho gayi');
  } catch (err) {
    if (err.status) return fail(res, err.status, err.message);
    next(err);
  }
}

async function deleteProvisionalBillItem(req, res, next) {
  try {
    await service.deleteProvisionalBillItem(req.params.itemId);
    success(res, null, 'Row deleted');
  } catch (err) {
    if (err.code === 'P2025') return fail(res, 404, 'Row not found');
    next(err);
  }
}

async function updateProvisionalBillHeader(req, res, next) {
  try {
    const { surgery, surgeryTypeId, dischargeTypeId } = req.body;
    const data = await service.updateProvisionalBillHeader(req.params.admissionId, { surgery, surgeryTypeId, dischargeTypeId });
    success(res, data, 'Updated');
  } catch (err) {
    if (err.status === 404) return fail(res, 404, err.message);
    next(err);
  }
}

// ─── Discharge and Refund ────────────────────────────────────────────────────

async function getDischargeBillDetail(req, res, next) {
  try {
    success(res, await service.getDischargeBillDetail(req.params.admissionId));
  } catch (err) {
    if (err.status === 404) return fail(res, 404, err.message);
    next(err);
  }
}

async function addDischargeBillItem(req, res, next) {
  try {
    const { billHeadId, doctorId, amount } = req.body;
    const data = await service.addDischargeBillItem(req.params.admissionId, { billHeadId, doctorId, amount });
    success(res, data, 'Row added');
  } catch (err) {
    if (err.status === 404) return fail(res, 404, err.message);
    next(err);
  }
}

async function deleteDischargeBillItem(req, res, next) {
  try {
    await service.deleteDischargeBillItem(req.params.itemId);
    success(res, null, 'Row deleted');
  } catch (err) {
    if (err.code === 'P2025') return fail(res, 404, 'Row not found');
    next(err);
  }
}

async function finalizeDischarge(req, res, next) {
  try {
    const { discountAmount, closedFiles, changedBy } = req.body;
    const data = await service.finalizeDischarge(req.params.admissionId, { discountAmount, closedFiles, changedBy });
    success(res, data, closedFiles ? 'File closed' : 'Patient discharged');
  } catch (err) {
    if (err.status === 404) return fail(res, 404, err.message);
    if (err.status === 400) return fail(res, 400, err.message);
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
    const data = await service.getAllDoctors({ minimal: req.query.minimal === 'true' });
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

async function searchOpdVisitsForAdmission(req, res, next) {
  try {
    success(res, await service.searchOpdVisitsForAdmission(req.query.q));
  } catch (err) { next(err); }
}

async function getAdmissions(req, res, next) {
  try {
    success(res, await service.getAdmissions());
  } catch (err) { next(err); }
}

async function getAdmissionByNumber(req, res, next) {
  try {
    const data = await service.getAdmissionByNumber(req.params.admissionNo);
    if (!data) return fail(res, 404, 'Is Admission # ka koi record nahi mila');
    success(res, data);
  } catch (err) { next(err); }
}

async function searchAdmissionsForReceiving(req, res, next) {
  try { success(res, await service.searchAdmissionsForReceiving(req.query.q)); } catch (err) { next(err); }
}

async function getAdmissionForReceiving(req, res, next) {
  try {
    const data = await service.getAdmissionForReceiving(req.params.admissionNo);
    success(res, data);
  } catch (err) {
    if (err.status) return fail(res, err.status, err.message);
    next(err);
  }
}

async function addAdmissionPayment(req, res, next) {
  try {
    const { serialNo, amount, paymentType, receivedBy } = req.body;
    const data = await service.addAdmissionPayment(req.params.admissionId, { serialNo, amount, paymentType, receivedBy });
    success(res, data, 'Payment receive ho gayi');
  } catch (err) {
    if (err.status) return fail(res, err.status, err.message);
    next(err);
  }
}

async function getAdmissionPaymentForPrint(req, res, next) {
  try {
    const data = await service.getAdmissionPaymentForPrint(req.params.id);
    success(res, data);
  } catch (err) {
    if (err.status) return fail(res, err.status, err.message);
    next(err);
  }
}

async function getAdmissionForDiscountRefund(req, res, next) {
  try {
    const data = await service.getAdmissionForDiscountRefund(req.params.admissionNo);
    success(res, data);
  } catch (err) {
    if (err.status) return fail(res, err.status, err.message);
    next(err);
  }
}

async function addAdmissionDiscountRefund(req, res, next) {
  try {
    const { billAmount, receivedAmount, discountAmount, discountType, permissionBy, netBalance, refundAmount, createdByUserId, createdByName } = req.body;
    const data = await service.addAdmissionDiscountRefund(req.params.admissionId, {
      billAmount, receivedAmount, discountAmount, discountType, permissionBy, netBalance, refundAmount, createdByUserId, createdByName,
    });
    success(res, data, 'Discount/Refund save ho gaya');
  } catch (err) {
    if (err.status) return fail(res, err.status, err.message);
    next(err);
  }
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
    const { roomCategoryId, excludeAdmissionId } = req.query;
    if (!roomCategoryId) return success(res, []);
    success(res, await service.getAvailableBeds(roomCategoryId, excludeAdmissionId));
  } catch (err) { next(err); }
}

// ─── Admission Adjustment ────────────────────────────────────────────────────

async function searchAdmissionsForAdjustment(req, res, next) {
  try {
    success(res, await service.searchAdmissionsForAdjustment(req.query.q));
  } catch (err) { next(err); }
}

async function getAdmissionForAdjustment(req, res, next) {
  try {
    success(res, await service.getAdmissionForAdjustment(req.params.id));
  } catch (err) {
    if (err.status === 404) return fail(res, 404, err.message);
    next(err);
  }
}

async function updateAdmissionAdjustment(req, res, next) {
  try {
    const data = await service.updateAdmissionAdjustment(req.params.id, req.body);
    success(res, data, 'Admission updated');
  } catch (err) {
    if (err.status === 404) return fail(res, 404, err.message);
    next(err);
  }
}

// ─── Admission Status Change ─────────────────────────────────────────────────

async function updateAdmissionStatus(req, res, next) {
  try {
    const { status, reason, changedBy } = req.body;
    const data = await service.updateAdmissionStatus(req.params.id, { status, reason, changedBy });
    success(res, data, status === 'wipeout' ? 'Admission wiped out' : 'Admission status updated');
  } catch (err) {
    if (err.status === 404) return fail(res, 404, err.message);
    if (err.status === 400) return fail(res, 400, err.message);
    next(err);
  }
}

async function getAdmissionWipeoutReport(req, res, next) {
  try {
    success(res, await service.getAdmissionWipeoutReport());
  } catch (err) { next(err); }
}

// ─── Bed Shifting ─────────────────────────────────────────────────────────────

async function getBedShiftHistory(req, res, next) {
  try {
    success(res, await service.getBedShiftHistory(req.params.id));
  } catch (err) { next(err); }
}

async function shiftAdmissionBed(req, res, next) {
  try {
    const { newBedId, shiftedBy } = req.body;
    const data = await service.shiftAdmissionBed(req.params.id, { newBedId, shiftedBy });
    success(res, data, 'Bed shifted');
  } catch (err) {
    if (err.status === 404) return fail(res, 404, err.message);
    if (err.status === 400) return fail(res, 400, err.message);
    if (err.status === 409) return fail(res, 409, err.message);
    next(err);
  }
}

// ─── Bed Status ───────────────────────────────────────────────────────────────

async function setBedStatus(req, res, next) {
  try {
    const data = await service.setBedStatus(req.params.id, req.body.status);
    success(res, data, 'Bed status updated');
  } catch (err) {
    if (err.status === 404) return fail(res, 404, err.message);
    if (err.status === 400) return fail(res, 400, err.message);
    next(err);
  }
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

async function reprintOpdVisitBySerial(req, res, next) {
  try {
    const data = await service.reprintOpdVisitBySerial(req.params.serialNo);
    success(res, data);
  } catch (err) {
    if (err.status) return fail(res, err.status, err.message);
    next(err);
  }
}

async function getTodayOpdVisitsForCancel(req, res, next) {
  try { success(res, await service.getTodayOpdVisitsForCancel()); } catch (err) { next(err); }
}

async function getOpdVisitForCancel(req, res, next) {
  try {
    const data = await service.getOpdVisitForCancel(req.params.id);
    success(res, data);
  } catch (err) {
    if (err.status) return fail(res, err.status, err.message);
    next(err);
  }
}

async function cancelOpdVisit(req, res, next) {
  try {
    const { reason, note, cancelledBy } = req.body;
    const data = await service.cancelOpdVisit(req.params.id, { reason, note, cancelledBy });
    success(res, data, 'Slip cancel ho gayi');
  } catch (err) {
    if (err.status) return fail(res, err.status, err.message);
    next(err);
  }
}

async function searchVisitsForRefund(req, res, next) {
  try { success(res, await service.searchVisitsForRefund(req.query.q)); } catch (err) { next(err); }
}

async function getVisitForRefund(req, res, next) {
  try {
    const data = await service.getVisitForRefund(req.params.source, req.params.id);
    success(res, data);
  } catch (err) {
    if (err.status) return fail(res, err.status, err.message);
    next(err);
  }
}

async function refundVisit(req, res, next) {
  try {
    const { amount, reason, note, refundedBy } = req.body;
    const data = await service.refundVisit(req.params.source, req.params.id, { amount, reason, note, refundedBy });
    success(res, data, 'Refund process ho gaya');
  } catch (err) {
    if (err.status) return fail(res, err.status, err.message);
    next(err);
  }
}

async function searchVisitsForAdjustment(req, res, next) {
  try { success(res, await service.searchVisitsForAdjustment(req.query.q)); } catch (err) { next(err); }
}

async function getVisitForAdjustment(req, res, next) {
  try {
    const data = await service.getVisitForAdjustment(req.params.source, req.params.id);
    success(res, data);
  } catch (err) {
    if (err.status) return fail(res, err.status, err.message);
    next(err);
  }
}

async function updateVisitPersonalInfo(req, res, next) {
  try {
    const data = await service.updateVisitPersonalInfo(req.params.source, req.params.id, req.body);
    success(res, data, 'Slip update ho gayi');
  } catch (err) {
    if (err.status) return fail(res, err.status, err.message);
    next(err);
  }
}

// ─── Slip Transfer ────────────────────────────────────────────────────────────

async function searchVisitsForSlipTransfer(req, res, next) {
  try {
    success(res, await service.searchVisitsForSlipTransfer(req.query.q));
  } catch (err) { next(err); }
}

async function getVisitForSlipTransfer(req, res, next) {
  try {
    success(res, await service.getVisitForSlipTransfer(req.params.source, req.params.id));
  } catch (err) {
    if (err.status) return fail(res, err.status, err.message);
    next(err);
  }
}

async function transferSlipAdmission(req, res, next) {
  try {
    const data = await service.transferSlipAdmission(req.params.source, req.params.id, req.body.admitNo);
    success(res, data, 'Slip transfer ho gayi');
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

async function getDepartmentDoctorPerformance(req, res, next) {
  try {
    const { fromDate, toDate, fromDoctorCode, toDoctorCode, activeOnly } = req.query;
    const data = await service.getDepartmentDoctorPerformance({
      fromDate, toDate, fromDoctorCode, toDoctorCode,
      activeOnly: activeOnly === '1' || activeOnly === 'true',
    });
    success(res, data);
  } catch (err) { next(err); }
}

async function getAdmissionWiseReport(req, res, next) {
  try {
    const { fromDate, toDate, statusMode, patientType } = req.query;
    const data = await service.getAdmissionWiseReport({ fromDate, toDate, statusMode, patientType });
    success(res, data);
  } catch (err) { next(err); }
}

async function getUserDateSummary(req, res, next) {
  try {
    const { userId, date, shift } = req.query;
    const data = await service.getUserDateSummary({ userId, date, shift });
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
  getSymptoms,
  createSymptom,
  updateSymptom,
  deleteSymptom,
  getDiseases,
  createDisease,
  updateDisease,
  deleteDisease,
  getDocumentTypes,
  createDocumentType,
  updateDocumentType,
  deleteDocumentType,
  getDischargeTypes,
  createDischargeType,
  updateDischargeType,
  deleteDischargeType,
  getShifts,
  createShift,
  updateShift,
  deleteShift,
  getCcConfig,
  updateCcConfig,
  searchAdmissionsForDocuments,
  getPatientDocuments,
  uploadPatientDocument,
  getPatientDocumentsReport,
  getProvisionalBillDetail,
  addProvisionalBillItem,
  addProvisionalBillItemFromVisit,
  deleteProvisionalBillItem,
  updateProvisionalBillHeader,
  getDischargeBillDetail,
  addDischargeBillItem,
  deleteDischargeBillItem,
  finalizeDischarge,
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
  createAntenatal,
  getAntenatalList,
  getAntenatalByNo,
  getOpdPatientByMrNo,
  getOpdPatientsByPhone,
  getOpdVisitBySerial,
  searchOpdVisitsForAdmission,
  getAdmissions,
  getAdmissionByNumber,
  searchAdmissionsForReceiving,
  getAdmissionForReceiving,
  addAdmissionPayment,
  getAdmissionPaymentForPrint,
  getAdmissionForDiscountRefund,
  addAdmissionDiscountRefund,
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
  getDepartmentDoctorPerformance,
  getAdmissionWiseReport,
  getUserDateSummary,
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

// ─── Panel Billing Detail (bill-head wise) ───────────────────────────────────
async function importPanelBillingDetail(req, res, next) {
  try {
    const { rows, periodFrom, periodTo } = req.body;
    if (!Array.isArray(rows) || !rows.length) return fail(res, 400, 'No rows provided');
    const result = await service.importPanelBillingDetail({ rows, periodFrom, periodTo });
    success(res, result, `${result.rowsInserted} bills imported (${result.billHeadsCreated} bill heads, ${result.companiesCreated} companies auto-created)`);
  } catch (err) { next(err); }
}

async function getPanelBillingDetails(req, res, next) {
  try {
    const { organisation, person, consultant } = req.query;
    const data = await service.getPanelBillingDetails({ organisation, person, consultant });
    success(res, data);
  } catch (err) { next(err); }
}

async function getPanelBillingByAdmit(req, res, next) {
  try {
    const data = await service.getPanelBillingByAdmit(req.params.admitNo);
    success(res, data);
  } catch (err) { next(err); }
}

// ─── Death Certificate ────────────────────────────────────────────────────────
async function lookupAdmissionByNo(req, res, next) {
  try {
    const data = await service.lookupAdmissionByNo(req.params.admissionNo);
    if (!data) return fail(res, 404, 'Is admission # ka koi record nahi mila');
    success(res, data);
  } catch (err) { next(err); }
}

async function searchAdmissions(req, res, next) {
  try {
    const data = await service.searchAdmissions(req.query.q);
    success(res, data);
  } catch (err) { next(err); }
}

async function createDeathCertificate(req, res, next) {
  try {
    if (!req.body.admissionNo) return fail(res, 400, 'Admission # zaroori hai');
    const data = await service.createDeathCertificate(req.body);
    success(res, data, 'Death Certificate saved');
  } catch (err) { next(err); }
}

async function getDeathCertificates(req, res, next) {
  try {
    const { fromDate, toDate } = req.query;
    success(res, await service.getDeathCertificates({ fromDate, toDate }));
  } catch (err) { next(err); }
}

async function getDeathCertificate(req, res, next) {
  try {
    success(res, await service.getDeathCertificate(req.params.admissionNo));
  } catch (err) { next(err); }
}

async function updateDeathCertificate(req, res, next) {
  try {
    const data = await service.updateDeathCertificate(req.params.id, req.body);
    success(res, data, 'Death Certificate updated');
  } catch (err) { next(err); }
}

async function bulkImportDeathCertificates(req, res, next) {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || !rows.length) return fail(res, 400, 'No rows provided');
    const result = await service.bulkImportDeathCertificates(rows);
    success(res, result, `${result.created} naye, ${result.updated} update, ${result.skipped} skip, ${result.doctorsCreated} naye doctors auto-created`);
  } catch (err) { next(err); }
}
