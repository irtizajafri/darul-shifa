// Department names for Department wise Patients (filter + report).
//
// Kept identical to canonicalRevenueDept() in the backend's
// getRevenueDashboard/getDailyDepartmentStatement (clinic.service.js) — this
// report and the Revenue Dashboard must show the same department label for
// the same raw data, otherwise the two never visually reconcile even when
// the underlying totals actually match.
export function canonicalDept(raw) {
  const u = (raw || '').trim().toUpperCase();
  if (!u) return 'Unknown';
  if (u.includes('EMERGENCY') || u.includes('CHEST PAIN')) return 'EMR & Chest Pain Clinic';
  if (u.includes('CONSULTANT')) return 'Consultant OPD';
  if (u.includes('GENERAL OPD')) return 'General OPD';
  if (u.includes('LAB')) return 'Laboratory';
  if (u.includes('ULTRA') || u === 'US') return 'Ultrasound';
  if (u.includes('X-RAY') || u.includes('XRAY') || u.includes('RADIOLOGY') || u.includes('C.T.') || u.includes('MRI')) return 'X-Ray & C.T. Scan/M.R.I';
  if (u.includes('BLOOD')) return 'Blood Bank';
  if (u.includes('MISC')) return 'Miscellaneous';
  if (u.includes('DENTAL')) return 'Dental OPD';
  if (u.includes('THERAPY')) return 'Therapy';
  if (u.includes('AMBULANCE')) return 'Ambulance';
  if (u.includes('ADMISSION')) return 'Admission';
  if (u.includes('ANTENATAL')) return 'Antenatal';
  return raw.trim();
}


// The filter's department list, in the order its From / To range runs.
export const DEPARTMENTS = [
  'General OPD', 'Consultant OPD', 'Emergency', 'Dental OPD', 'Therapy',
  'Laboratory', 'Ultra Sound, Echo & Color Doppler', 'Radiology',
  'Blood Bank', 'Miscellaneous', 'Ambulance', 'Admission', 'Antenatal',
];
const ORDER = DEPARTMENTS.map(canonicalDept);

// Position of a department (any spelling) in that order; unknown ones last.
export function deptRank(name) {
  const i = ORDER.indexOf(canonicalDept(name));
  return i === -1 ? ORDER.length : i;
}
