const express = require('express');
const path = require('path');
const multer = require('multer');
const controller = require('./clinic.controller');
const router = express.Router();

const documentStorage = multer.diskStorage({
  destination: path.join(__dirname, '../../../uploads/patient-documents'),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  },
});
const uploadDocument = multer({ storage: documentStorage, limits: { fileSize: 20 * 1024 * 1024 } });

// Department
router.get('/departments', controller.getDepartments);
router.post('/departments', controller.createDepartment);
router.put('/departments/:id', controller.updateDepartment);
router.delete('/departments/:id', controller.deleteDepartment);

// Sub Department
router.get('/sub-departments', controller.getSubDepartments);
router.post('/sub-departments', controller.createSubDepartment);
router.put('/sub-departments/:id', controller.updateSubDepartment);
router.delete('/sub-departments/:id', controller.deleteSubDepartment);

// Surgery Type
router.get('/surgery-types', controller.getSurgeryTypes);
router.post('/surgery-types', controller.createSurgeryType);
router.put('/surgery-types/:id', controller.updateSurgeryType);
router.delete('/surgery-types/:id', controller.deleteSurgeryType);

// Symptom
router.get('/symptoms', controller.getSymptoms);
router.post('/symptoms', controller.createSymptom);
router.put('/symptoms/:id', controller.updateSymptom);
router.delete('/symptoms/:id', controller.deleteSymptom);

// Disease
router.get('/diseases', controller.getDiseases);
router.post('/diseases', controller.createDisease);
router.put('/diseases/:id', controller.updateDisease);
router.delete('/diseases/:id', controller.deleteDisease);

// Document Type
router.get('/document-types', controller.getDocumentTypes);
router.post('/document-types', controller.createDocumentType);
router.put('/document-types/:id', controller.updateDocumentType);
router.delete('/document-types/:id', controller.deleteDocumentType);

// Upload Patient Document
router.get('/patient-documents/search', controller.searchAdmissionsForDocuments);
router.get('/patient-documents/report', controller.getPatientDocumentsReport);
router.get('/patient-documents/by-admission/:admissionId', controller.getPatientDocuments);
router.post('/patient-documents/upload', uploadDocument.single('file'), controller.uploadPatientDocument);

// Discharge Type
router.get('/discharge-types', controller.getDischargeTypes);
router.post('/discharge-types', controller.createDischargeType);
router.put('/discharge-types/:id', controller.updateDischargeType);
router.delete('/discharge-types/:id', controller.deleteDischargeType);

// Shift
router.get('/shifts', controller.getShifts);
router.post('/shifts', controller.createShift);
router.put('/shifts/:id', controller.updateShift);
router.delete('/shifts/:id', controller.deleteShift);

router.get('/cc-config', controller.getCcConfig);
router.put('/cc-config', controller.updateCcConfig);

// Provisional Bill
router.get('/provisional-bill/:admissionId', controller.getProvisionalBillDetail);
router.post('/provisional-bill/:admissionId/items', controller.addProvisionalBillItem);
router.post('/provisional-bill/:admissionId/add-from-visit', controller.addProvisionalBillItemFromVisit);
router.delete('/provisional-bill/items/:itemId', controller.deleteProvisionalBillItem);
router.put('/provisional-bill/:admissionId/header', controller.updateProvisionalBillHeader);

// Discharge and Refund
router.get('/discharge-bill/:admissionId', controller.getDischargeBillDetail);
router.post('/discharge-bill/:admissionId/items', controller.addDischargeBillItem);
router.delete('/discharge-bill/items/:itemId', controller.deleteDischargeBillItem);
router.put('/discharge-bill/:admissionId/finalize', controller.finalizeDischarge);

// Staff Category
router.get('/staff-categories', controller.getStaffCategories);
router.post('/staff-categories', controller.createStaffCategory);
router.put('/staff-categories/:id', controller.updateStaffCategory);
router.delete('/staff-categories/:id', controller.deleteStaffCategory);

// Doctors
router.get('/doctors', controller.getDoctors);
router.post('/doctors', controller.createDoctor);
router.put('/doctors/:id', controller.updateDoctor);
router.delete('/doctors/:id', controller.deleteDoctor);
router.post('/doctors/:id/import-rates', controller.importDoctorSubDeptRates);

// OPD
router.get('/opd/available-doctors', controller.getAvailableDoctors);
router.get('/opd/next-serial', controller.getNextSerialNo);
router.get('/opd/next-mr', controller.getNextMrNo);
router.get('/opd/employee-search', controller.searchEmployees);
router.get('/opd', controller.getOpdVisits);
router.post('/opd', controller.createOpdVisit);
router.post('/opd/:id/print', controller.printOpdVisit);
router.get('/opd/reprint/:serialNo', controller.reprintOpdVisitBySerial);
router.get('/opd/cancel/today-list', controller.getTodayOpdVisitsForCancel);
router.get('/opd/cancel/:id', controller.getOpdVisitForCancel);
router.post('/opd/cancel/:id', controller.cancelOpdVisit);
router.get('/opd/refund/search', controller.searchVisitsForRefund);
router.get('/opd/refund/:source/:id', controller.getVisitForRefund);
router.post('/opd/refund/:source/:id', controller.refundVisit);
router.get('/opd/adjustment/search', controller.searchVisitsForAdjustment);
router.get('/opd/adjustment/:source/:id', controller.getVisitForAdjustment);
router.put('/opd/adjustment/:source/:id', controller.updateVisitPersonalInfo);

// Slip Transfer
router.get('/opd/slip-transfer/search', controller.searchVisitsForSlipTransfer);
router.get('/opd/slip-transfer/:source/:id', controller.getVisitForSlipTransfer);
router.put('/opd/slip-transfer/:source/:id', controller.transferSlipAdmission);
router.get('/opd/balance-slips', controller.getBalanceSlips);
router.post('/opd/:id/receive-balance', controller.receiveBalancePayment);

// Room Category
router.get('/room-categories', controller.getRoomCategories);
router.post('/room-categories', controller.createRoomCategory);
router.put('/room-categories/:id', controller.updateRoomCategory);
router.delete('/room-categories/:id', controller.deleteRoomCategory);

// Bed
router.get('/beds', controller.getBeds);
router.post('/beds', controller.createBed);
router.put('/beds/:id', controller.updateBed);
router.delete('/beds/:id', controller.deleteBed);

// Bill Head
router.get('/bill-heads', controller.getBillHeads);
router.get('/bill-heads/:id', controller.getBillHead);
router.post('/bill-heads', controller.createBillHead);
router.put('/bill-heads/:id', controller.updateBillHead);
router.delete('/bill-heads/:id', controller.deleteBillHead);

// Panel Company
router.get('/panel-companies', controller.getPanelCompanies);
router.get('/panel-companies/:id', controller.getPanelCompany);
router.post('/panel-companies', controller.createPanelCompany);
router.put('/panel-companies/:id', controller.updatePanelCompany);
router.delete('/panel-companies/:id', controller.deletePanelCompany);

// Panel Employees
router.get('/panel-employees', controller.getPanelEmployees);
router.get('/panel-employees/:id', controller.getPanelEmployee);
router.post('/panel-employees', controller.createPanelEmployee);
router.put('/panel-employees/:id', controller.updatePanelEmployee);
router.delete('/panel-employees/:id', controller.deletePanelEmployee);

// OPD patient lookup by MR#
router.get('/opd/by-mr/:mrNo', controller.getOpdPatientByMrNo);
router.get('/opd/by-phone/:phone', controller.getOpdPatientsByPhone);

// Antenatal
router.get('/antenatal', controller.getAntenatalList);
router.get('/antenatal/by-no/:no', controller.getAntenatalByNo);
router.post('/antenatal', controller.createAntenatal);

// Admission
router.get('/admission/available-beds', controller.getAvailableBeds);
router.get('/admission', controller.getAdmissions);
router.get('/admission/by-number/:admissionNo', controller.getAdmissionByNumber);
router.get('/admission/receiving/search', controller.searchAdmissionsForReceiving);
router.get('/admission/receiving/by-number/:admissionNo', controller.getAdmissionForReceiving);
router.post('/admission/receiving/:admissionId/pay', controller.addAdmissionPayment);
router.get('/admission/receiving/payment/:id/print', controller.getAdmissionPaymentForPrint);

router.get('/admission/discount-refund/by-number/:admissionNo', controller.getAdmissionForDiscountRefund);
router.post('/admission/discount-refund/:admissionId/add', controller.addAdmissionDiscountRefund);

router.get('/admission/ot-register/by-number/:admissionNo', controller.getOtRegisterForAdmission);
router.post('/admission/ot-register/:admissionId/save', controller.saveOtRegister);

router.get('/admission/birth-certificate/by-number/:admissionNo', controller.getBirthCertificateForAdmission);
router.post('/admission/birth-certificate/:admissionId/save', controller.saveBirthCertificate);
router.get('/reports/birth-certificate', controller.getBirthCertificateReport);
router.post('/reports/birth-certificate/import', controller.importBirthCertificates);

router.get('/appointment/search', controller.searchSlipsForAppointment);
router.get('/appointment/by-slip/:slipNo', controller.getAppointmentForSlip);
router.post('/appointment/save', controller.saveAppointment);
router.get('/reports/appointment', controller.getAppointmentReport);
router.post('/admission', controller.createAdmission);
router.get('/opd/by-serial/:serialNo', controller.getOpdVisitBySerial);
router.get('/opd/search-for-admission', controller.searchOpdVisitsForAdmission);

// Admission Adjustment
router.get('/admission/adjustment/search', controller.searchAdmissionsForAdjustment);
router.get('/admission/adjustment/:id', controller.getAdmissionForAdjustment);
router.put('/admission/adjustment/:id', controller.updateAdmissionAdjustment);

// Admission Status Change
router.put('/admission/status/:id', controller.updateAdmissionStatus);
router.get('/admission/status-change-report', controller.getAdmissionWipeoutReport);

// Bed Shifting
router.get('/admission/:id/bed-shifts', controller.getBedShiftHistory);
router.post('/admission/:id/bed-shift', controller.shiftAdmissionBed);

// Bed Status
router.put('/beds/:id/status', controller.setBedStatus);

// Consultant Rates
router.get('/doctor-subdept-rates', controller.getDoctorSubDeptRates);
router.get('/consultant-rates', controller.getConsultantRates);
router.post('/consultant-rates', controller.upsertConsultantRate);
router.delete('/consultant-rates/:id', controller.deleteConsultantRate);

// Patient Visits
router.post('/patient-visits/bulk', controller.bulkCreatePatientVisits);
router.post('/admission/generate-from-visits', controller.generateAdmissionsFromVisits);
router.get('/patient-visits/consultants', controller.getConsultantNames);
router.get('/patient-visits/by-admit/:admitNo', controller.getPatientVisitByAdmitNo);
router.get('/patient-visits', controller.getPatientVisits);

// Bill Comparison
router.post('/bill-comparison/import', controller.importBillComparison);
router.get('/bill-comparison', controller.getBillComparisons);

// Panel Billing Detail (bill-head wise)
router.post('/panel-billing/import', controller.importPanelBillingDetail);
router.get('/panel-billing', controller.getPanelBillingDetails);
router.get('/panel-billing/by-admit/:admitNo', controller.getPanelBillingByAdmit);

// Death Certificate
router.get('/admission/search', controller.searchAdmissions);
router.get('/admission/lookup/:admissionNo', controller.lookupAdmissionByNo);
router.post('/death-certificates/import', controller.bulkImportDeathCertificates);
router.post('/death-certificates', controller.createDeathCertificate);
router.get('/death-certificates', controller.getDeathCertificates);
router.put('/death-certificates/:id', controller.updateDeathCertificate);
router.get('/death-certificates/:admissionNo', controller.getDeathCertificate);

// Consultant Statement
router.get('/consultant-statement', controller.getConsultantStatement);

// Inquiries
router.get('/inquiries/revenue-dashboard', controller.getRevenueDashboard);
router.get('/inquiries/daily-department-statement', controller.getDailyDepartmentStatement);

// Reports
router.get('/reports/department-doctor-performance', controller.getDepartmentDoctorPerformance);
router.get('/reports/admission-wise', controller.getAdmissionWiseReport);
router.get('/reports/ot-register', controller.getOtRegisterReport);
router.post('/reports/ot-register/import', controller.importOtRegister);
router.get('/reports/user-date-summary', controller.getUserDateSummary);

module.exports = router;
