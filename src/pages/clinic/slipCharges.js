// The rate a doctor / test line gets on a slip (owner, 2026-11-13): an On Call
// slip takes the Odd Charges set in Doctor Parameters → Sub Dept Info, any
// other slip takes Normal Charges. A line whose Odd Charges is left at 0 keeps
// Normal Charges, so it never comes out free.
export function slipRate(row, onCall) {
  const normal = Number(row.listNormalCharges ?? row.normalCharges) || 0;
  const odd = Number(row.oddCharges) || 0;
  return onCall && odd > 0 ? odd : normal;
}

// A doctor-list row priced for the slip. normalCharges carries the rate the
// screen uses everywhere (list, total, saved amount); listNormalCharges keeps
// Doctor Parameters' own Normal Charges, so the rate can be worked out again.
export const withSlipRate = (row, onCall) => ({
  ...row,
  listNormalCharges: Number(row.listNormalCharges ?? row.normalCharges) || 0,
  normalCharges: slipRate(row, onCall),
});

// Lines already picked, when On Call is ticked or unticked: each takes the
// new rate × its quantity. A price typed at slip time (Miscellaneous "Price")
// stays as typed.
export const repriceLine = (line, onCall) => (line.typedPrice != null
  ? line
  : { ...line, normalCharges: slipRate(line, onCall) * (Number(line.quantity) || 1) });
