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

export function DischargeBillPrintTemplate({ detail, isDuplicate, printedBy }) {
  if (!detail) return null;
  const { admission, roomCategory, bed, billItems, paymentHistory, amountReceived, billAmount, discountAmount, balance, refund } = detail;

  const now = admission.createdAt ? new Date(admission.createdAt) : new Date();
  const dateStr = `${fmtDate(now)} ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
  const words = balance > 0 ? numToWords(Math.floor(balance)) : (refund > 0 ? numToWords(Math.floor(refund)) : 'zero');

  return (
    <div className="dr-print">
      <div className="dr-print-logo-box">
        <img src={RECEIPT_LOGO_DATA_URI} alt="Darul Shifa" className="dr-print-logo" />
      </div>

      <div className="dr-print-title-row">
        <span className="dr-print-title">DISCHARGE AND REFUND BILL</span>
        {isDuplicate && <span className="dr-print-duplicate">Duplicate</span>}
      </div>

      <table className="dr-print-hdr-tbl">
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
            <td className="l">S/o.</td>
            <td className="v">{admission.responsibleParty || '—'}</td>
            <td className="l">Category:</td>
            <td className="v">{roomCategory?.name || '—'}</td>
            <td className="l">Room#:</td>
            <td className="v">{bed?.name || '—'}</td>
          </tr>
        </tbody>
      </table>

      <div className="dr-print-section-hdr">Payment History</div>
      <table className="dr-print-pay-tbl">
        <thead><tr><th>Date &amp; Time</th><th>Slip#</th><th className="r">Amount</th></tr></thead>
        <tbody>
          {paymentHistory.map((p, i) => (
            <tr key={i}><td>{fmtDateTime(p.date)}</td><td>{p.slipNo}</td><td className="r">{fmt2(p.amount)}</td></tr>
          ))}
          <tr className="dr-print-grand"><td colSpan={2}>Grand Total:</td><td className="r">{fmt2(amountReceived)}</td></tr>
        </tbody>
      </table>

      <div className="dr-print-section-hdr">Discharge Bill</div>
      <table className="dr-print-items-tbl">
        <thead><tr><th>Heads</th><th>Dr./Staff</th><th className="r">Amount</th></tr></thead>
        <tbody>
          {billItems.map((i) => (
            <tr key={i.id}>
              <td>{i.billHead?.description || i.billHead?.headCode || i.description || '—'}</td>
              <td>{i.doctor?.name || '—'}</td>
              <td className="r">{fmt2(i.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="dr-print-summary-tbl">
        <tbody>
          <tr><td className="l">Bill Amount:</td><td className="r">{fmt2(billAmount)}</td></tr>
          <tr><td className="l">Discount:</td><td className="r">{fmt2(discountAmount)}</td></tr>
          <tr><td className="l">Received Amount:</td><td className="r">{fmt2(amountReceived)}</td></tr>
          <tr><td className="l">Refund Amount:</td><td className="r">{fmt2(refund)}</td></tr>
          <tr className="dr-print-balance-row">
            <td className="l"><strong>Balance Amount:</strong></td>
            <td className="r"><strong>{fmt2(balance)}</strong></td>
          </tr>
        </tbody>
      </table>

      <div className="dr-print-words">
        {balance > 0 ? 'Balance' : 'Refund'} Amount: RS. {words.toUpperCase()} ONLY.
      </div>

      <div className="dr-print-sig">
        <span className="dr-print-sig-name">{printedBy || ''}</span>
        <span className="dr-print-sig-lbl">Prepared By</span>
      </div>
    </div>
  );
}
