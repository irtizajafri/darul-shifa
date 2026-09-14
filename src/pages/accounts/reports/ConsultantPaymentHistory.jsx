import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import SearchableSelect from '../../../components/ui/SearchableSelect';
import { useAuthStore } from '../../../store/useAuthStore';

const CLINIC_API = 'http://localhost:5001/api/clinic';
const ACCOUNTS_API = 'http://localhost:5001/api/accounts';

const todayStr = () => new Date().toISOString().slice(0, 10);
const firstOfMonth = () => `${todayStr().slice(0, 8)}01`;

const fmtDateShort = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, '0')}-${String(dt.getMonth() + 1).padStart(2, '0')}-${dt.getFullYear()}`;
};
const fmt2 = (n) =>
  Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CPH_CSS = `
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:Arial,sans-serif; font-size:10.5px; color:#000; background:#fff; padding:24px 28px; }
  .hdr { display:flex; justify-content:space-between; margin-bottom:10px; }
  .hdr b { font-size:13px; }
  .hdr .sub { font-size:10px; color:#333; }
  table { width:100%; border-collapse:collapse; }
  th { text-align:left; font-size:9.5px; text-decoration:underline; padding:3px 6px; }
  th.amt, td.amt { text-align:right; }
  td { padding:2.5px 6px; font-size:10px; }
  tr.status-row td { background:#c7c7c7; font-weight:700; padding:4px 6px; }
  tr.consultant-row td { font-weight:700; padding-top:6px; }
  tr.sub-total-row td { border-top:1px solid #000; padding-left:22px; }
  tr.grand-total-row td { border-top:1px solid #000; font-weight:700; }
  .footer { margin-top:24px; display:flex; justify-content:space-between; font-size:10px; }
`;

function printConsultantPaymentHistory({ data, printBy }) {
  if (!data || !data.statusGroups.length) { toast.error('No data to print'); return; }
  const { reportType, statusGroups, grandTotal } = data;
  const isDetail = reportType === 'Detail';

  let bodyHTML = '';
  statusGroups.forEach((g) => {
    bodyHTML += `<tr class="status-row"><td colspan="${isDetail ? 5 : 5}">${g.label}</td></tr>`;
    g.consultants.forEach((c) => {
      if (isDetail) {
        bodyHTML += `
          <tr class="consultant-row">
            <td>${c.code}</td><td>${c.name}</td><td></td><td class="amt">${fmt2(c.total)}</td><td></td>
          </tr>`;
        c.rows.forEach((r) => {
          bodyHTML += `
            <tr>
              <td>${r.admitNo}</td>
              <td>${r.patName}</td>
              <td>${fmtDateShort(r.opDate)}</td>
              <td class="amt">${fmt2(r.amount)}</td>
              <td>${r.voucherNo}</td>
            </tr>`;
        });
      } else {
        bodyHTML += `
          <tr class="consultant-row">
            <td>${c.code}</td><td>${c.name}</td><td>${c.count}</td><td class="amt">${fmt2(c.total)}</td><td></td>
          </tr>
          <tr class="sub-total-row">
            <td></td><td>${c.count}</td><td></td><td class="amt">${fmt2(c.total)}</td><td></td>
          </tr>`;
      }
    });
  });

  const cols = isDetail
    ? ['AdmitNo', 'PatName', 'OpDate', 'Amount', 'VOUNO']
    : ['Con Code', 'Cons Name', '# of Files', 'Amount', 'VOUNO'];

  const html = `<!DOCTYPE html><html><head><title>Consultant Payment History</title><style>${CPH_CSS}</style></head><body>
    <div class="hdr">
      <div>
        <b>Consultant Payments</b>
        <div class="sub">${reportType}</div>
      </div>
    </div>
    <table>
      <thead><tr>${cols.map((c, i) => `<th${i >= 3 ? ' class="amt"' : ''}>${c}</th>`).join('')}</tr></thead>
      <tbody>
        ${bodyHTML}
        <tr class="grand-total-row"><td colspan="3"></td><td class="amt">${fmt2(grandTotal)}</td><td></td></tr>
      </tbody>
    </table>
    <div class="footer"><span>${printBy || ''}</span><span>${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</span></div>
  </body></html>`;

  const win = window.open('', '_blank');
  if (!win) { toast.error('Popup blocked'); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.onafterprint = () => win.close(); }, 400);
}

const REPORT_TYPES = ['Detail', 'Summary'];
const OPD_INDOOR = ['OPD', 'IPD'];
const PAYMENT_TYPES = ['Paid', 'Payable', 'Both'];

const fieldLabelStyle = { fontSize: '0.82rem', fontWeight: 600, color: '#334155', minWidth: 120 };
const rowStyle = { display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.85rem' };
const dateInputStyle = { width: '100%', padding: '0.4rem 0.6rem', border: '1px solid #94a3b8', borderRadius: 4, fontSize: '0.82rem', color: '#1e293b', background: '#fff' };
const radioGroupStyle = { display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1.4rem' };
const radioLabelStyle = { display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: '#334155', cursor: 'pointer' };

export default function ConsultantPaymentHistory() {
  const { entityType } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [doctors, setDoctors] = useState([]);
  const [consultantFromId, setConsultantFromId] = useState('');
  const [consultantToId, setConsultantToId] = useState('');

  const [dateFrom, setDateFrom] = useState(firstOfMonth());
  const [dateTo, setDateTo] = useState(todayStr());
  const [voucherFrom, setVoucherFrom] = useState('');
  const [voucherTo, setVoucherTo] = useState('');

  const [reportType, setReportType] = useState('Summary');
  const [opdIndoor, setOpdIndoor] = useState('OPD');
  const [paymentType, setPaymentType] = useState('Both');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${CLINIC_API}/doctors?minimal=true`)
      .then((r) => r.json())
      .then((j) => setDoctors(j.data || []))
      .catch(() => {});
  }, [entityType]);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const from = doctors.find((d) => String(d.id) === String(consultantFromId));
      const to = doctors.find((d) => String(d.id) === String(consultantToId));

      const params = new URLSearchParams({ entityType, dateFrom, dateTo, reportType, opdIndoor, paymentType });
      if (from) params.set('consultantFrom', from.code);
      if (to) params.set('consultantTo', to.code);
      if (voucherFrom) params.set('voucherFrom', voucherFrom);
      if (voucherTo) params.set('voucherTo', voucherTo);

      const r = await fetch(`${ACCOUNTS_API}/consultant-payment-history?${params}`);
      const j = await r.json();
      if (!r.ok || j?.ok === false) throw new Error(j?.message || 'Failed');
      printConsultantPaymentHistory({ data: j.data, printBy: user?.name || '' });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: '#64748b', marginBottom: '1.25rem' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem' }}>
          <ArrowLeft size={13} /> Reports
        </button>
        <span>›</span>
        <span style={{ color: '#1e293b', fontWeight: 600 }}>Consultant Payment History</span>
      </div>

      {/* Title */}
      <div style={{ fontWeight: 800, fontSize: '1.15rem', color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1.5rem' }}>
        Consultant Payment History
      </div>

      {/* Main box — Crystal Reports style, mirrors GL Balance Report */}
      <div style={{ border: '2px solid #94a3b8', borderRadius: 6, overflow: 'hidden', maxWidth: 640, background: '#fff' }}>

        <div style={{ background: '#e2e8f0', borderBottom: '1px solid #94a3b8', padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <UserCheck size={14} color="#475569" />
          <span style={{ fontSize: '0.78rem', color: '#334155', fontWeight: 600 }}>Reports › Consultant Payments</span>
        </div>

        <div style={{ padding: '1.25rem 1.5rem 1rem' }}>

          {/* Consultant code range */}
          <div style={rowStyle}>
            <span style={fieldLabelStyle}>Consultant Code</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>From</span>
              <div style={{ flex: 1 }}>
                <SearchableSelect
                  options={doctors} value={consultantFromId} onChange={setConsultantFromId}
                  placeholder="(first)" getLabel={(d) => `${d.code} — ${d.name}`} getKey={(d) => d.id}
                />
              </div>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>To</span>
              <div style={{ flex: 1 }}>
                <SearchableSelect
                  options={doctors} value={consultantToId} onChange={setConsultantToId}
                  placeholder="(last)" getLabel={(d) => `${d.code} — ${d.name}`} getKey={(d) => d.id}
                />
              </div>
            </div>
          </div>

          {/* Voucher Date range */}
          <div style={rowStyle}>
            <span style={fieldLabelStyle}>Voucher Date</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>From</span>
              <div style={{ flex: 1 }}>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={dateInputStyle} />
              </div>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>To</span>
              <div style={{ flex: 1 }}>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={dateInputStyle} />
              </div>
            </div>
          </div>

          {/* Voucher # range */}
          <div style={rowStyle}>
            <span style={fieldLabelStyle}>Voucher #</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>From</span>
              <div style={{ flex: 1 }}>
                <input value={voucherFrom} onChange={(e) => setVoucherFrom(e.target.value)} placeholder="(all)" style={dateInputStyle} />
              </div>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>To</span>
              <div style={{ flex: 1 }}>
                <input value={voucherTo} onChange={(e) => setVoucherTo(e.target.value)} placeholder="(all)" style={dateInputStyle} />
              </div>
            </div>
          </div>

          {/* Report Type / OPD-Indoor / Payment Type */}
          <div style={{ display: 'flex', gap: '2rem', marginTop: '0.5rem', paddingTop: '0.9rem', borderTop: '1px solid #e2e8f0' }}>
            <div>
              <div style={{ ...fieldLabelStyle, marginBottom: '0.6rem' }}>Report Type</div>
              <div style={radioGroupStyle}>
                {REPORT_TYPES.map((t) => (
                  <label key={t} style={radioLabelStyle}>
                    <input type="radio" name="reportType" checked={reportType === t} onChange={() => setReportType(t)} />
                    {t}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <div style={{ ...fieldLabelStyle, marginBottom: '0.6rem' }}>OPD / IPD</div>
              <div style={radioGroupStyle}>
                {OPD_INDOOR.map((t) => (
                  <label key={t} style={radioLabelStyle}>
                    <input type="radio" name="opdIndoor" checked={opdIndoor === t} onChange={() => setOpdIndoor(t)} />
                    {t}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginTop: '0.9rem', paddingTop: '0.9rem', borderTop: '1px solid #e2e8f0' }}>
            <div style={{ ...fieldLabelStyle, marginBottom: '0.6rem' }}>Payment Type</div>
            <div style={radioGroupStyle}>
              {PAYMENT_TYPES.map((t) => (
                <label key={t} style={radioLabelStyle}>
                  <input type="radio" name="paymentType" checked={paymentType === t} onChange={() => setPaymentType(t)} />
                  {t}
                </label>
              ))}
            </div>
          </div>

          {/* Footer row — button right-aligned */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '0.85rem', marginTop: '1rem' }}>
            <button
              onClick={handleGenerate}
              disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', background: '#334155', color: '#fff', border: 'none', borderRadius: 5, padding: '0.45rem 1.1rem', fontWeight: 700, fontSize: '0.8rem', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, letterSpacing: '0.03em' }}
            >
              <UserCheck size={13} /> {loading ? 'Loading…' : 'Consultant Payment History'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
