import { relationParts } from './relationText';

// Discharge & Refund's print — the legacy "ITEMISED MEDICAL BILL" on A5
// (owner, 2026-10-26, from a printed Duplicate of admission 174590):
// header block, boxed Payment History, boxed Bill (In Account of /
// Description / Amount) with a boxed Total, amount in words, Administrator /
// Accountant signatures and Created By / Last updated By.

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n) => String(n).padStart(2, '0');
// 03-Jul-2026
function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return `${pad(dt.getDate())}-${MON[dt.getMonth()]}-${dt.getFullYear()}`;
}
// 01/Jul/2026 11:34:31
function fmtPayDateTime(d) {
  if (!d) return '';
  const dt = new Date(d);
  return `${pad(dt.getDate())}/${MON[dt.getMonth()]}/${dt.getFullYear()} ${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;
}
// 07-07-2026  3:29:27PM
function fmtStamp(d) {
  if (!d) return '';
  const dt = new Date(d);
  const h = dt.getHours() % 12 || 12;
  return `${pad(dt.getDate())}-${pad(dt.getMonth() + 1)}-${dt.getFullYear()}  ${h}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}${dt.getHours() < 12 ? 'AM' : 'PM'}`;
}
const fmtAmt = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

const HOSPITAL_STORE_RE = /FAIR PRICE|^PHARMACY$/i;
const SLIP_ACCOUNT = {
  LABORATORY: 'LAB',
  RADIOLOGY: 'RADIOLOGY',
  'ULTRA SOUND, ECHO & COLOR DOPPLER': 'ULTRASOUND',
  'BLOOD BANK': 'BLOOD BANK',
};

// "In Account of" = what the charge is, "Description" = who it goes to /
// which test — e.g. SURGEON CHARGES · Dr. Rubina Zaidi, LAB · Darulshifa
// Diagnostic, MEDICINE FROM HOSPITAL · Fair Price Medical Store.
function billLine(i) {
  if (i.source === 'pharmacy') {
    const hospital = HOSPITAL_STORE_RE.test(String(i.description || '').trim());
    return { account: hospital ? 'MEDICINE FROM HOSPITAL' : 'MEDICINE FROM OUTSIDE', description: hospital && /^PHARMACY$/i.test(i.description) ? 'Fair Price Medical Store' : i.description };
  }
  if (i.source === 'slip') {
    const dept = i.slip?.department || '';
    return {
      account: SLIP_ACCOUNT[dept.toUpperCase()] || dept || 'LAB',
      // a slip with no test breakdown is one "<dept> slip" line — print its slip no instead
      description: /\sslip$/i.test(i.description || '') && i.slip ? `Slip ${i.slip.serialNo}` : i.description,
    };
  }
  const head = i.billHead?.description || i.billHead?.headCode || i.description || '';
  return { account: head, description: i.doctor?.name || i.subDept?.name || '' };
}

export function DischargeBillPrintTemplate({ detail, isDuplicate }) {
  if (!detail) return null;
  const { admission, roomCategory, bed, billItems, paymentHistory, amountReceived, billAmount, discountAmount, otherIncomeAmount, balance, refund, dischargeDate, billLog = {} } = detail;
  const rel = relationParts(admission);
  const total = Math.round(Number(billAmount) || 0);
  const net = Math.max(0, total - Math.round(Number(discountAmount) || 0));
  const extraLines = [
    discountAmount > 0 && ['Discount', -discountAmount],
    discountAmount > 0 && ['Net Amount', net],
    otherIncomeAmount > 0 && ['Goes to Other Income', -otherIncomeAmount],
    refund > 0 && ['Refund', refund],
    balance > 0 && ['Balance', balance],
  ].filter(Boolean);

  return (
    <div className="imb">
      <div className="imb-title-row">
        <span className="imb-title">ITEMISED MEDICAL BILL</span>
        {isDuplicate && <span className="imb-dup">Duplicate</span>}
      </div>

      <table className="imb-hdr">
        <tbody>
          <tr>
            <td className="l">Admission #:</td><td className="v b">{admission.admissionNo}</td>
            <td className="l">Patient:</td><td className="v b" colSpan={2}>{`${admission.patientTitle || ''} ${admission.patientName || ''}`.trim().toUpperCase()}</td>
          </tr>
          <tr>
            <td className="l">{rel.label}.</td><td className="v">{(rel.name || '—').toUpperCase()}</td>
            <td className="l">Category:</td><td className="v" colSpan={2}>{(roomCategory?.name || '—').toUpperCase()}</td>
          </tr>
          <tr>
            <td className="l">Dis Date:</td><td className="v b">{fmtDate(dischargeDate)}</td>
            <td className="l">Closed On:</td><td className="v b">{fmtDate(billLog.closedOn)}</td>
            <td className="room">Room #:{bed?.name || '—'}</td>
          </tr>
        </tbody>
      </table>

      <div className="imb-box">
        <div className="imb-box-title">Payment History</div>
        <table className="imb-pay">
          <thead><tr><th>Date &amp; Time</th><th className="c">Slip #</th><th className="r">Amount</th></tr></thead>
          <tbody>
            {paymentHistory.map((p, n) => (
              <tr key={n}><td>{fmtPayDateTime(p.date)}</td><td className="c">{p.slipNo}</td><td className="r">{fmtAmt(p.amount)}</td></tr>
            ))}
            <tr className="imb-pay-total"><td></td><td className="c">Grand Total:</td><td className="r">{fmtAmt(amountReceived)}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="imb-box imb-bill">
        <div className="imb-box-title">Bill</div>
        <table className="imb-items">
          <thead><tr><th>In Account of</th><th>Description</th><th className="r">Amount</th></tr></thead>
          <tbody>
            {billItems.map((i) => {
              const l = billLine(i);
              return (
                <tr key={i.id}>
                  <td>{String(l.account || '').toUpperCase()}</td>
                  <td>{l.description}</td>
                  <td className="r">{fmtAmt(i.amount)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="imb-total-row">
          <div className="imb-words">RECEIVED WITH THANKS RS. {numToWords(net).toUpperCase()} ONLY.</div>
          <div className="imb-total">
            <span>Total:</span><span className="imb-total-box">{fmtAmt(total)}</span>
          </div>
        </div>
        {extraLines.length > 0 && (
          <table className="imb-extra">
            <tbody>
              {extraLines.map(([k, v]) => <tr key={k}><td>{k}:</td><td className="r">{fmtAmt(v)}</td></tr>)}
            </tbody>
          </table>
        )}
      </div>

      <div className="imb-foot">
        <div className="imb-sigs">
          <div className="imb-sig">Administrator</div>
          <div className="imb-sig">Accountant</div>
        </div>
        <div className="imb-stamps">
          <div className="imb-stamp">
            <span className="k">Created By</span>
            <span className="n">{billLog.createdBy || ''}<br />{fmtStamp(billLog.createdAt)}</span>
          </div>
          <div className="imb-stamp">
            <span className="k">Last updated By</span>
            <span className="n">{billLog.updatedBy || ''}<br />{fmtStamp(billLog.updatedAt)}</span>
          </div>
        </div>
        <div className="imb-form-code">REC/FM/005-00</div>
      </div>
    </div>
  );
}
