// Shared Phone No / Age validation for all OPD entry forms (General/Dental/
// Therapy/Lab/etc, Consultant, Emergency, Ambulance) — one place so every
// slip enforces the same rules instead of each page rolling its own.

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

// Age (Years) is required — Months/Days default to 0 (dropdowns) so those
// alone don't count as "filled in". Guards against negative/absurd values too.
export function validateAge(age, ageMonths, ageDays) {
  if (age === '' || age == null) return 'Patient ki Age (Years) daalo';
  const y = Number(age);
  const m = ageMonths === '' || ageMonths == null ? 0 : Number(ageMonths);
  const d = ageDays === '' || ageDays == null ? 0 : Number(ageDays);
  if (!Number.isFinite(y) || y < 0 || y > 120) return 'Age (Years) 0-120 ke darmiyan honi chahiye';
  if (!Number.isFinite(m) || m < 0 || m > 11) return 'Age (Months) 0-11 ke darmiyan honi chahiye';
  if (!Number.isFinite(d) || d < 0 || d > 31) return 'Age (Days) 0-31 ke darmiyan honi chahiye';
  return null;
}
