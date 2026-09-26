// Shared Phone No / Age validation for all OPD entry forms (General/Dental/
// Therapy/Lab/etc, Consultant, Emergency, Ambulance) — one place so every
// slip enforces the same rules instead of each page rolling its own.

// MAST/MR unambiguously mean male, MISS/MRS/MS unambiguously mean female —
// auto-fill Gender when the Patient Name title makes it obvious, so staff
// don't have to also click the Gender radio for the common case. BABY/
// BABY OF/INFANT stay untouched since the title alone doesn't say which
// gender the baby is.
export function genderForPatientType(patientType) {
  if (patientType === 'MAST' || patientType === 'MR') return 'male';
  if (patientType === 'MISS' || patientType === 'MRS' || patientType === 'MS') return 'female';
  return null;
}

export function validateAdmissionNo(admissionNo) {
  const a = String(admissionNo || '').trim();
  if (!a) return 'Admission # is required';
  if (!/^[0-9]{6}$/.test(a)) return 'Admission # sirf digits mein aur exactly 6 digits ka hona chahiye';
  return null;
}

// Phone is required everywhere (including Emergency) — must look like a real
// Pakistani number: digits only, 7-11 characters (covers both landline and
// 03XXXXXXXXX mobile formats).
export function validatePhoneNo(phone) {
  const p = String(phone || '').trim();
  if (!p) return 'Phone number likhna zaroori hai';
  if (!/^[0-9]{7,11}$/.test(p)) {
    return 'Phone number sirf digits mein aur 7-11 digits ka hona chahiye';
  }
  return null;
}

// At least one of Years/Months/Days must convey a real age — Years alone
// is NOT mandatory, since a newborn's age is properly recorded as Years
// blank + Days only (e.g. a 1-day-old baby). Only reject when all three
// are blank/zero, i.e. no age was entered at all. Guards against
// negative/absurd values too.
export function validateAge(age, ageMonths, ageDays) {
  const yBlank = age === '' || age == null;
  const y = yBlank ? 0 : Number(age);
  const m = ageMonths === '' || ageMonths == null ? 0 : Number(ageMonths);
  const d = ageDays === '' || ageDays == null ? 0 : Number(ageDays);
  if (yBlank && m === 0 && d === 0) return 'Patient ki Age daalo (Years, Months ya Days mein se koi ek)';
  if (!Number.isFinite(y) || y < 0 || y > 120) return 'Age (Years) 0-120 ke darmiyan honi chahiye';
  if (!Number.isFinite(m) || m < 0 || m > 11) return 'Age (Months) 0-11 ke darmiyan honi chahiye';
  if (!Number.isFinite(d) || d < 0 || d > 31) return 'Age (Days) 0-31 ke darmiyan honi chahiye';
  return null;
}
