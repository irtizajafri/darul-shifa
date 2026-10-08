import { RECEIPT_LOGO_DATA_URI } from './receiptLogo';

function fmtDateTime(d) {
  if (!d) return '';
  const dt = new Date(d);
  const day   = String(dt.getDate()).padStart(2, '0');
  const month = dt.toLocaleString('en-GB', { month: 'short' });
  const year  = dt.getFullYear();
  const time  = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return `${day}-${month}-${year} ${time}`;
}
function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, '0')}-${dt.toLocaleString('en-GB', { month: 'short' })}-${dt.getFullYear()}`;
}
function fmt2(n) { return Number(n || 0).toFixed(2); }

function numToWords(n) {
  if (n === 0) return 'zero';
  const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
    'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  function cvt(num) {
    if (num === 0) return '';
    if (num < 20) return ones[num] + ' ';
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? '-' + ones[num % 10] : '') + ' ';
    if (num < 1000) return ones[Math.floor(num / 100)] + ' hundred ' + cvt(num % 100);
    if (num < 100000) return cvt(Math.floor(num / 1000)) + 'thousand ' + cvt(num % 1000);
    return cvt(Math.floor(num / 100000)) + 'lakh ' + cvt(num % 100000);
  }
  return cvt(Math.abs(Math.floor(n))).trim();
}

// "W/o" / "wife" → "W/o"; blank → "S/o" (the bill's default label).
function relationLabel(type) {
  const v = String(type || '').trim();
  if (!v) return 'S/o';
  if (/^[a-z]\/o$/i.test(v)) return v.charAt(0).toUpperCase() + '/o';
  return { son: 'S/o', daughter: 'D/o', wife: 'W/o', husband: 'H/o' }[v.toLowerCase()] || v;
}

export function ProvisionalBillPrintTemplate({ detail, isDuplicate, printedBy }) {
  if (!detail) return null;
  const { admission, roomCategory, bed, surgeryType, billItems, wardHistory, diagnosticRows, pharmacyAmount, balanceInfo } = detail;

  const now = admission.createdAt ? new Date(admission.createdAt) : new Date();
  const dateStr = `${fmtDate(now)} ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`;

  const groups = {};
  // Ward History is computed/read-only (not a billItems row) — synthesized
  // into the same "Amount Distribution" grouping the existing bill format
  // already uses, exactly like Diagnostic/Pharmacy below, so the printed
  // layout itself never changes.
  (wardHistory || []).forEach((seg, idx) => {
    const label = seg.roomCategory?.name || 'Ward';
    if (!groups[label]) groups[label] = [];
    groups[label].push({
      id: `ward-${idx}`,
      billHead: { description: `Ward Stay${seg.transferredAt ? '' : ' (Current)'} — ${seg.days} day${seg.days !== 1 ? 's' : ''}` },
      qty: seg.days,
      rate: seg.rate,
      amount: seg.charges,
    });
  });
  billItems.forEach((item) => {
    const label = item.roomCategory?.name || 'Other';
    if (!groups[label]) groups[label] = [];
    groups[label].push(item);
  });
  // Print keeps only one summed line per diagnostic department (e.g. a single
  // "Laboratory" row for 4785) — the individual test/particular breakdown is
  // intentionally not shown on the printed bill, only in-app. These land in
  // the "Other" bucket (same as room-category-less bill items, e.g. NG TUBE)
  // rather than each getting its own box — a Laboratory-only box would repeat
  // "Laboratory" as both the box title and its single row's head, which reads
  // as a duplicate.
  const diagTotalsByDept = {};
  diagnosticRows.forEach((row) => {
    const dept = row.department || 'Diagnostic';
    diagTotalsByDept[dept] = (diagTotalsByDept[dept] || 0) + Number(row.amount || 0);
  });
  Object.entries(diagTotalsByDept).forEach(([dept, total]) => {
    if (!groups.Other) groups.Other = [];
    groups.Other.push({
      id: `diag-${dept}`,
      billHead: { description: dept },
      qty: 1,
      rate: total,
      amount: total,
    });
  });
  // Pharmacy is intentionally excluded from the printed bill's line items —
  // it's tracked only in-app on the Pharmacy tab, per explicit instruction —
  // EXCEPT for Panel patients: Bill Amount/Balance already fold pharmacyAmount
  // in (see getProvisionalBillDetail), and a Panel company needs its claim's
  // Medicine cost visible on the printed bill, not silently baked into the
  // total. Same "Other" bucket as the Diagnostic dept lines above (a
  // Medicine-titled box repeating "Medicine" as its own row would read as a
  // duplicate, same reasoning as the Laboratory case).
  if (admission.patientCategory === 'panel' && pharmacyAmount > 0) {
    if (!groups.Other) groups.Other = [];
    groups.Other.push({
      id: 'pharmacy-medicine',
      billHead: { description: 'Medicine' },
      qty: 1,
      rate: pharmacyAmount,
      amount: pharmacyAmount,
    });
  }

  const isPanel = admission.patientCategory === 'panel';
  const categoryLabel = { private: 'Private Patient', staff: 'Staff Patient', panel: 'Panel Patient', cc: 'CC Patient', complementary: 'Complementary Patient' }[admission.patientCategory] || 'Private Patient';
  const balanceWords = balanceInfo.balance > 0 ? numToWords(Math.floor(balanceInfo.balance)) : (balanceInfo.refund > 0 ? numToWords(Math.floor(balanceInfo.refund)) : 'zero');

  return (
    <div className="pb-print">
      <div className="pb-print-logo-box">
        <img src={RECEIPT_LOGO_DATA_URI} alt="Darul Shifa" className="pb-print-logo" />
      </div>

      <div className="pb-print-title-row">
        <span className="pb-print-title">MEDICAL BILL</span>
        {isDuplicate && <span className="pb-print-duplicate">Duplicate</span>}
      </div>

      <table className="pb-print-hdr-tbl">
        <tbody>
          <tr>
            <td className="l">Patient:</td>
            <td className="v">{admission.patientTitle} {admission.patientName}</td>
            <td className="l">Admission #:</td>
            <td className="v">{admission.admissionNo}</td>
            <td className="l">Date:</td>
            <td className="v">{dateStr}</td>
          </tr>
          <tr>
            {/* Panel files often have the company typed into Responsible Party,
                so for panel the S/o line uses the admission's own relation
                (S/o / W/o / D/o + name) and the company gets its own line. */}
            <td className="l">{isPanel ? `${relationLabel(admission.relationType)}.` : 'S/o.'}</td>
            <td className="v">{isPanel ? (admission.relationName || '—') : (admission.responsibleParty || '—')}</td>
            <td className="l">Surgery:</td>
            <td className="v">{admission.surgery ? (surgeryType?.name || 'Yes') : 'General Admission'}</td>
          </tr>
          {isPanel && (
            <tr>
              <td className="l">Company:</td>
              <td className="v" colSpan={3}>{detail.panelCompanyName || '—'}</td>
            </tr>
          )}
          <tr>
            <td className="l">Category:</td>
            <td className="v">{roomCategory?.name || '—'}</td>
            <td className="l">Room#:</td>
            <td className="v">{bed?.name || '—'}</td>
          </tr>
        </tbody>
      </table>

      <div className="pb-print-box">
        <div className="pb-print-box-hdr">Payment History</div>
        <table className="pb-print-pay-tbl">
          <thead><tr><th>Date &amp; Time</th><th>Slip#</th><th className="r">Amount</th></tr></thead>
          <tbody>
            {detail.patientInfo.paymentHistory.map((p, i) => (
              <tr key={i}><td>{fmtDateTime(p.date)}</td><td>{p.slipNo}</td><td className="r">{fmt2(p.amount)}</td></tr>
            ))}
            <tr className="pb-print-grand"><td colSpan={2}>Grand Total:</td><td className="r">{fmt2(detail.patientInfo.amountReceived)}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="pb-print-box">
        <div className="pb-print-box-hdr">Amount Distribution</div>
        {Object.entries(groups).map(([label, items]) => {
          const subtotal = items.reduce((s, i) => s + Number(i.amount || 0), 0);
          return (
            <div key={label} className="pb-print-ward-block">
              <div className="pb-print-ward-name">{label}</div>
              <table className="pb-print-items-tbl">
                <thead><tr><th>Head</th><th className="r">Qty</th><th className="r">Rate</th><th className="r">Amount</th></tr></thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.id}>
                      <td>{(i.billHead?.description || i.billHead?.headCode || '—').toString().toUpperCase()}</td>
                      <td className="r">{i.qty}</td>
                      <td className="r">{fmt2(i.rate)}</td>
                      <td className="r">{fmt2(i.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="pb-print-subtotal"><td colSpan={3}>Total for This Ward:</td><td className="r">{fmt2(subtotal)}</td></tr>
                </tfoot>
              </table>
            </div>
          );
        })}
        {!Object.keys(groups).length && <div className="pb-print-no-items">Koi bill item nahi hai</div>}

        <table className="pb-print-summary-tbl">
          <tbody>
            <tr>
              <td className="l">{categoryLabel}</td>
              <td className="l">Bill Amount:</td>
              <td className="r">{fmt2(balanceInfo.billAmount)}</td>
            </tr>
            <tr>
              <td></td>
              <td className="l">Discount{balanceInfo.discountPermissionBy ? ` (${balanceInfo.discountPermissionBy})` : ''}:</td>
              <td className="r">-{fmt2(balanceInfo.discount)}</td>
            </tr>
            <tr>
              <td></td>
              <td className="l">Received Amount:</td>
              <td className="r">{fmt2(balanceInfo.amountReceived)}</td>
            </tr>
            <tr>
              <td className="l"><strong>Admitted</strong></td>
              <td className="l">Refund Amount:</td>
              <td className="r">{fmt2(balanceInfo.refund)}</td>
            </tr>
            <tr className="pb-print-balance-row">
              <td></td>
              <td className="l"><strong>Balance Amount:</strong></td>
              <td className="r"><strong>{fmt2(balanceInfo.balance)}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="pb-print-words">
        {balanceInfo.balance > 0 ? 'Balance' : 'Refund'} Amount: RS. {balanceWords.toUpperCase()} ONLY.
      </div>

      <div className="pb-print-sig">
        <span className="pb-print-sig-name">{printedBy || ''}</span>
        <span className="pb-print-sig-lbl">Prepared By</span>
      </div>
    </div>
  );
}
