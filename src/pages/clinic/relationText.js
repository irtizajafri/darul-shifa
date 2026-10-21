// Relation line on admission prints / screens (owner, 2026-10-21): use the
// admission's own Relation (type + name, filled on Admission / Admission
// Adjustment — or from the panel pick) instead of guessing S/o / D/o from
// Sex and printing Responsible Party. Older admissions saved before the
// Relation field was in use fall back to Responsible Party.
const TYPE_LABEL = { son: 'S/o', daughter: 'D/o', wife: 'W/o', husband: 'H/o', father: 'F/o', mother: 'M/o', self: 'Self' };

export function relationTypeLabel(type, fallback = 'S/o') {
  const v = String(type || '').trim();
  if (!v) return fallback;
  if (/^[a-z]\/o$/i.test(v)) return v.charAt(0).toUpperCase() + '/o';
  return TYPE_LABEL[v.toLowerCase()] || v;
}

// → { label: 'W/o', name: 'ABBAS ALI' }
export function relationParts(admission, fallbackLabel = 'S/o') {
  const name = String(admission?.relationName || '').trim();
  if (name) return { label: relationTypeLabel(admission.relationType, fallbackLabel), name };
  return { label: fallbackLabel, name: admission?.responsibleParty || '' };
}
