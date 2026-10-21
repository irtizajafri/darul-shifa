// Panel pick → Relation (owner's rule, 2026-10-21): the relation name is
// always the panel employee — for the employee themself (Self) and for a
// dependent alike. The S/o / W/o type follows the dependent's recorded
// relation when there is one; most dependents have none, so otherwise the
// type already chosen on the form stays (back to the form's W/o default
// when it was Self).
const DEPENDENT_RELATION_TYPE = { wife: 'W/o', son: 'S/o', daughter: 'D/o', mother: 'M/o', father: 'F/o' };
export function panelRelation({ employeeName, isSelf, dependentRelation }, currentType) {
  const type = isSelf ? 'Self' : (DEPENDENT_RELATION_TYPE[String(dependentRelation || '').trim().toLowerCase()] || (currentType === 'Self' ? 'W/o' : currentType));
  return { relationType: type, relationName: employeeName || '' };
}
