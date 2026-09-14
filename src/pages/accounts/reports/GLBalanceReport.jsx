import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import SearchableSelect from '../../../components/ui/SearchableSelect';

const API = 'http://localhost:5001/api/accounts';

const todayStr = () => new Date().toISOString().slice(0, 10);
const firstOfMonth = () => `${todayStr().slice(0, 8)}01`;

// Matches the 4-level chart of accounts as it exists in this system —
// Main GL > Sub GL > Sub GL 1 (= AccMainAccount) > Account (= AccSubAccount).
// The legacy report's own labels ("Sub GL 1", "Account") are kept here so
// the screen reads the same as what staff are used to, even though the
// underlying tables are named AccMainAccount/AccSubAccount.
const LEVELS = ['Main GL', 'Sub GL', 'Sub GL 1', 'Account'];
const REPORT_TYPES = ['Summary', 'Summary Sub', 'Detail Voucher', 'Detail Summary', 'Account Level Summary'];

const fieldLabelStyle = { fontSize: '0.82rem', fontWeight: 600, color: '#334155', minWidth: 110 };
const rowStyle = { display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.85rem' };
const dateInputStyle = { width: '100%', padding: '0.4rem 0.6rem', border: '1px solid #94a3b8', borderRadius: 4, fontSize: '0.82rem', color: '#1e293b', background: '#fff' };

const fmtDateShort = (d) => {
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, '0')}-${String(dt.getMonth() + 1).padStart(2, '0')}-${dt.getFullYear()}`;
};
const fmtProducedOn = (d) =>
  d.toLocaleDateString('en-GB').split('/').join('/') + ' AT ' +
  d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

const fmt2 = (n) =>
  Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const GL_CSS = `
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:Arial,sans-serif; font-size:11px; color:#000; background:#fff; padding:24px 28px; }
  h2 { font-size:15px; font-weight:800; margin-bottom:2px; }
  .meta { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px; }
  .meta .period { font-size:10.5px; }
  .meta .produced { font-size:9.5px; color:#333; text-align:right; }
  .selection { font-size:10px; color:#333; margin-bottom:10px; }
  table { width:100%; border-collapse:collapse; }
  td { padding:2.5px 6px; font-size:10.5px; vertical-align:top; }
  .amt { text-align:right; white-space:nowrap; font-variant-numeric:tabular-nums; }
  tr.main-row td { font-weight:700; border-top:1px solid #000; padding-top:5px; }
  tr.sub-row td { font-style:italic; padding-left:14px; }
  tr.sub-row td.name { padding-left:20px; }
  tr.detail-row td.name { padding-left:40px; }
  tr.detail-row td { font-size:10px; }
  tr.grand-row td { font-weight:800; border-top:2px solid #000; padding-top:6px; }
`;

function buildSelectionLabel({ mainGl, subGl, mainAcc, subAcc, payeeName }) {
  const parts = [];
  if (mainGl) parts.push(`Main GL: ${mainGl}`);
  if (subGl) parts.push(`Sub GL: ${subGl}`);
  if (mainAcc) parts.push(`Sub GL 1: ${mainAcc}`);
  if (subAcc) parts.push(`Account: ${subAcc}`);
  if (payeeName) parts.push(`Payee: ${payeeName}`);
  return parts.join('  |  ');
}

function printGLBalance({ data, dateFrom, dateTo, selectionLabel }) {
  if (!data || !data.groups.length) { toast.error('No data to print'); return; }
  const { reportType, groups, grandTotal } = data;

  const wantsVoucherRows = reportType === 'Detail Voucher';

  let bodyHTML = '';
  groups.forEach((g) => {
    bodyHTML += `
      <tr class="main-row">
        <td style="width:90px">${g.code}</td>
        <td class="name" colspan="4">${g.name}</td>
        <td class="amt">${fmt2(g.total)}</td>
      </tr>`;
    (g.subGroups || []).forEach((sg) => {
      bodyHTML += `
        <tr class="sub-row">
          <td>${sg.code}</td>
          <td class="name" colspan="4">${sg.name}</td>
          <td class="amt">${fmt2(sg.total)}</td>
        </tr>`;
      (sg.payeeRows || []).forEach((p) => {
        if (wantsVoucherRows) {
          p.rows.forEach((r) => {
            bodyHTML += `
              <tr class="detail-row">
                <td></td>
                <td class="name">${r.payeeName || '—'}</td>
                <td>${r.voucherNo}</td>
                <td>${fmtDateShort(r.voucherDate)}</td>
                <td>${r.chequeNo || ''}</td>
                <td class="amt">${fmt2(r.amount)}</td>
              </tr>`;
          });
        } else {
          bodyHTML += `
            <tr class="detail-row">
              <td></td>
              <td class="name" colspan="4">${p.payeeName || '—'}</td>
              <td class="amt">${fmt2(p.amount)}</td>
            </tr>`;
        }
      });
    });
  });

  const html = `<!DOCTYPE html><html><head><title>General Ledger Balances</title><style>${GL_CSS}</style></head><body>
    <div class="meta">
      <div>
        <h2>General Ledger Balances</h2>
        <div class="period">From : ${fmtDateShort(dateFrom)} To : ${fmtDateShort(dateTo)}</div>
      </div>
      <div class="produced">Produced On : ${fmtProducedOn(new Date())}<br/>${reportType}</div>
    </div>
    <div class="selection">Selection : ${selectionLabel || ''}</div>
    <table>
      <tbody>
        ${bodyHTML}
        <tr class="grand-row"><td colspan="5"></td><td class="amt">${fmt2(grandTotal)}</td></tr>
      </tbody>
    </table>
  </body></html>`;

  const win = window.open('', '_blank');
  if (!win) { toast.error('Popup blocked'); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.onafterprint = () => win.close(); }, 400);
}

export default function GLBalanceReport() {
  const { entityType } = useParams();
  const navigate = useNavigate();

  const [mainGLs, setMainGLs] = useState([]);
  const [subGLs, setSubGLs] = useState([]);
  const [mainAccs, setMainAccs] = useState([]); // "Sub GL 1"
  const [subAccs, setSubAccs] = useState([]);   // "Account"
  const [payeeNames, setPayeeNames] = useState([]);

  const [mainGlId, setMainGlId] = useState('');
  const [subGlId, setSubGlId] = useState('');
  const [mainAccId, setMainAccId] = useState('');
  const [subAccId, setSubAccId] = useState('');
  const [payeeName, setPayeeName] = useState('');

  const [dateFrom, setDateFrom] = useState(firstOfMonth());
  const [dateTo, setDateTo] = useState(todayStr());
  const [level, setLevel] = useState('Sub GL 1');
  const [reportType, setReportType] = useState('Summary');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${API}/main-gl?entityType=${entityType}`)
      .then((r) => r.json())
      .then((j) => setMainGLs(j.data || []))
      .catch(() => {});
    // No per-payee code exists in the chart of accounts (see the Salary head
    // example — every entry shares one Sub Account, only payeeName differs),
    // so this lets Detail Voucher/Detail Summary/Account Level Summary
    // filter and group by the actual real-world payee instead.
    fetch(`${API}/payee-names?entityType=${entityType}`)
      .then((r) => r.json())
      .then((j) => setPayeeNames(j.data || []))
      .catch(() => {});
  }, [entityType]);

  // Cascading lookups — each level clears and refetches everything below it,
  // same pattern Voucher Expense's own Account Allocation picker uses.
  const handleMainGlChange = async (v) => {
    setMainGlId(v); setSubGlId(''); setMainAccId(''); setSubAccId('');
    setSubGLs([]); setMainAccs([]); setSubAccs([]);
    if (!v) return;
    const r = await fetch(`${API}/sub-gl?entityType=${entityType}&mainGlId=${v}`);
    const j = await r.json();
    setSubGLs(j.data || []);
  };

  const handleSubGlChange = async (v) => {
    setSubGlId(v); setMainAccId(''); setSubAccId('');
    setMainAccs([]); setSubAccs([]);
    if (!v) return;
    const r = await fetch(`${API}/main-account?entityType=${entityType}&subGlId=${v}`);
    const j = await r.json();
    setMainAccs(j.data || []);
  };

  const handleMainAccChange = async (v) => {
    setMainAccId(v); setSubAccId('');
    setSubAccs([]);
    if (!v) return;
    const r = await fetch(`${API}/sub-account?entityType=${entityType}&mainAccountId=${v}`);
    const j = await r.json();
    setSubAccs(j.data || []);
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const mainGl = mainGLs.find((g) => String(g.id) === String(mainGlId));
      const subGl = subGLs.find((g) => String(g.id) === String(subGlId));
      const mainAcc = mainAccs.find((a) => String(a.id) === String(mainAccId));
      const subAcc = subAccs.find((a) => String(a.id) === String(subAccId));

      const params = new URLSearchParams({ entityType, dateFrom, dateTo, reportType });
      if (mainGlId) params.set('mainGlId', mainGlId);
      if (subGlId) params.set('subGlId', subGlId);
      if (mainAccId) params.set('mainAccountId', mainAccId);
      if (subAccId) params.set('subAccountId', subAccId);
      if (payeeName) params.set('payeeName', payeeName);

      const r = await fetch(`${API}/gl-balance-report?${params}`);
      const j = await r.json();
      if (!r.ok || j?.ok === false) throw new Error(j?.message || 'Failed');

      const selectionLabel = buildSelectionLabel({
        mainGl: mainGl ? `${mainGl.code} — ${mainGl.name}` : '',
        subGl: subGl ? `${subGl.code} — ${subGl.name}` : '',
        mainAcc: mainAcc ? `${mainAcc.code} — ${mainAcc.name}` : '',
        subAcc: subAcc ? `${subAcc.code} — ${subAcc.name}` : '',
        payeeName,
      });
      printGLBalance({ data: j.data, dateFrom, dateTo, selectionLabel });
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
        <span style={{ color: '#1e293b', fontWeight: 600 }}>GL Balance Report</span>
      </div>

      {/* Title */}
      <div style={{ fontWeight: 800, fontSize: '1.15rem', color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1.5rem' }}>
        GL Balance Report
      </div>

      {/* Main box — Crystal Reports style, mirrors the other two matrices */}
      <div style={{ border: '2px solid #94a3b8', borderRadius: 6, overflow: 'hidden', maxWidth: 640, background: '#fff' }}>

        <div style={{ background: '#e2e8f0', borderBottom: '1px solid #94a3b8', padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BookOpen size={14} color="#475569" />
          <span style={{ fontSize: '0.78rem', color: '#334155', fontWeight: 600 }}>Report › General Ledger › GL Balance Report</span>
        </div>

        <div style={{ padding: '1.25rem 1.5rem 1rem' }}>

          {/* Chart of accounts — 4 cascading levels */}
          <div style={rowStyle}>
            <span style={fieldLabelStyle}>Main GL</span>
            <div style={{ flex: 1 }}>
              <SearchableSelect
                options={mainGLs} value={mainGlId} onChange={handleMainGlChange}
                placeholder="(all)" getLabel={(g) => `${g.code} — ${g.name}`} getKey={(g) => g.id}
              />
            </div>
          </div>

          <div style={rowStyle}>
            <span style={fieldLabelStyle}>Sub GL</span>
            <div style={{ flex: 1 }}>
              <SearchableSelect
                options={subGLs} value={subGlId} onChange={handleSubGlChange}
                placeholder={mainGlId ? '(all under this Main GL)' : '(all)'}
                getLabel={(g) => `${g.code} — ${g.name}`} getKey={(g) => g.id}
              />
            </div>
          </div>

          <div style={rowStyle}>
            <span style={fieldLabelStyle}>Sub GL 1</span>
            <div style={{ flex: 1 }}>
              <SearchableSelect
                options={mainAccs} value={mainAccId} onChange={handleMainAccChange}
                placeholder={subGlId ? '(all under this Sub GL)' : '(all)'}
                getLabel={(a) => `${a.code} — ${a.name}`} getKey={(a) => a.id}
              />
            </div>
          </div>

          <div style={rowStyle}>
            <span style={fieldLabelStyle}>Account</span>
            <div style={{ flex: 1 }}>
              <SearchableSelect
                options={subAccs} value={subAccId} onChange={setSubAccId}
                placeholder={mainAccId ? '(all under this Sub GL 1)' : '(all)'}
                getLabel={(a) => `${a.code} — ${a.name}`} getKey={(a) => a.id}
              />
            </div>
          </div>

          <div style={rowStyle}>
            <span style={fieldLabelStyle}>Payee Name</span>
            <div style={{ flex: 1 }}>
              <SearchableSelect
                options={payeeNames} value={payeeName} onChange={setPayeeName}
                placeholder="(all)"
                getLabel={(p) => p} getKey={(p) => p}
              />
            </div>
          </div>

          {/* Period + Levels */}
          <div style={{ ...rowStyle, marginTop: '1.1rem', paddingTop: '0.9rem', borderTop: '1px solid #e2e8f0' }}>
            <span style={fieldLabelStyle}>Period</span>
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

          <div style={rowStyle}>
            <span style={fieldLabelStyle}>Levels</span>
            <div style={{ flex: 1, maxWidth: 220 }}>
              <select value={level} onChange={(e) => setLevel(e.target.value)} style={dateInputStyle}>
                {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>

          {/* Report Type */}
          <div style={{ marginTop: '0.5rem', paddingTop: '0.9rem', borderTop: '1px solid #e2e8f0' }}>
            <div style={{ ...fieldLabelStyle, marginBottom: '0.6rem' }}>Report Type</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1.4rem' }}>
              {REPORT_TYPES.map((t) => (
                <label key={t} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: '#334155', cursor: 'pointer' }}>
                  <input type="radio" name="reportType" checked={reportType === t} onChange={() => setReportType(t)} />
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
              <BookOpen size={13} /> {loading ? 'Loading…' : 'GL Balance Report'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
