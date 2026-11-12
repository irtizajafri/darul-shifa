// Medical Store dropdown for the Medicine Report / Medicine Issuance screens.
// The same list feeds the filter screen and the report header, and the id it
// yields goes straight to the backend's storeFilter ('ALL' | 'hospital' | id).
const HOSPITAL_STORE_LABEL = 'HOSPITAL STORE';

// Only the entry actually called "HOSPITAL STORE" is the In-House store — the
// backend's isHospitalStoreName uses the same exact test, so both sides agree
// on which store also carries the In-House (Sales Invoice) medicine.
export function isHospitalStoreName(name) {
  return String(name || '').trim().toUpperCase() === HOSPITAL_STORE_LABEL;
}

export function buildStoreOptions(pharmacyStores) {
  return [
    { id: 'ALL', label: 'ALL' },
    // Pharmacy Stores usually already has a "HOSPITAL STORE" — only add our
    // own In-House option when it doesn't.
    ...(pharmacyStores.some((s) => isHospitalStoreName(s.name)) ? [] : [{ id: 'hospital', label: 'Hospital Store' }]),
    ...pharmacyStores.map((s) => ({ id: String(s.id), label: s.status === 'inactive' ? `${s.name} (inactive)` : s.name })),
  ];
}
