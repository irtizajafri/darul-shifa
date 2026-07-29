const express = require('express');
const controller = require('./clinic.controller');
const router = express.Router();

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
router.post('/admission', controller.createAdmission);
router.get('/opd/by-serial/:serialNo', controller.getOpdVisitBySerial);

// Consultant Rates
router.get('/doctor-subdept-rates', controller.getDoctorSubDeptRates);
router.get('/consultant-rates', controller.getConsultantRates);
router.post('/consultant-rates', controller.upsertConsultantRate);
router.delete('/consultant-rates/:id', controller.deleteConsultantRate);

// Patient Visits
router.post('/patient-visits/bulk', controller.bulkCreatePatientVisits);
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

module.exports = router;
