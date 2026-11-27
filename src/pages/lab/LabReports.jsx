import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileSpreadsheet, Printer, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import PageHeader from '../../components/shared/PageHeader';
import SearchableSelect from '../../components/ui/SearchableSelect';
import { useAuthStore } from '../../store/useAuthStore';
import { hasPermission } from '../../utils/permissions';
import { openPrintWindow } from '../../utils/printRelay';
import { labApi, pktToday } from './labApi';
import './Lab.scss';

// Laboratories → Reports (owner, 2026-11-27), from the Clinic lab slips
// (the ones Result Entry lists; cancelled slips left out):
//   Test-wise — each test's count and amount, or every slip line;
//   Panel / Mode of Payment — by mode of payment, or by panel company;
//   Department-wise — by the Lab setup's categories (Haematology …).
// Filters: dates (PKT), mode of payment, panel company, OPD / Admission,
// test, category. Print (A4) and Excel, like the other reports.

const HOSPITAL = 'DARUL SHIFA IMAM KHOMEINI — LABORATORY';
const REPORTS = [
  { key: 'test-wise', label: 'Test-wise', views: [['summary', 'Summary'], ['details', 'Details (every slip)']] },
  { key: 'panel-wise', label: 'Panel / Mode of Payment', views: [['mode', 'By mode of payment'], ['company', 'By panel company']] },
  { key: 'department-wise', label: 'Department-wise', views: [['category', 'By category'], ['tests', 'Category + Test']] },
];
const MODE_LABEL = { cash: 'Cash', jazzcash: 'JazzCash', online: 'Online', cc: 'Credit Card', complementary: 'Complementary', panel: 'Panel' };
const MODE_ORDER = Object.keys(MODE_LABEL);
const NO_CATEGORY = '(not in a category)';
const NO_COMPANY = '(company not set)';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDay = (iso) => (iso ? `${iso.slice(8, 10)}-${MONTHS[Number(iso.slice(5, 7)) - 1]}-${iso.slice(0, 4)}` : '');
const fmtQty = (n) => Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 });
const fmtAmt = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const monthStart = (iso) => `${iso.slice(0, 8)}01`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const modeLabel = (m) => MODE_LABEL[m] || m;
const companyOf = (l) => l.company || (l.mode === 'panel' ? NO_COMPANY : '');
const categoryOf = (l) => l.category || NO_CATEGORY;
const byText = (a, b) => String(a).localeCompare(String(b));

// Columns: [heading, kind] — kind 'text' | 'int' | 'qty' | 'amt'.
function makeTable(cols, rows, foot) {
  const kinds = cols.map((c) => c[1]);
  return {
    head: cols.map((c) => c[0]),
    num: kinds.map((k, i) => (k === 'text' ? -1 : i)).filter((i) => i >= 0),
    rows, foot,
    fmt: (i, v) => (v === '' || v == null ? '' : kinds[i] === 'amt' ? fmtAmt(v) : kinds[i] === 'qty' ? fmtQty(v) : v),
  };
}
function groupBy(lines, key) {
  const m = new Map();
  for (const l of lines) {
    const k = key(l);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(l);
  }
  return [...m.entries()];
}

export default function LabReports() {
  const { user } = useAuthStore();
  const userName = user?.name || user?.username || user?.email || '';
  const [params, setParams] = useSearchParams();
  const allowed = REPORTS.filter((r) => user?.isSuperAdmin || hasPermission(user, 'lab', 'reports', r.key));
  const report = allowed.find((r) => r.key === params.get('report')) || allowed[0];
  const [views, setViews] = useState({});
  const view = views[report?.key] || report?.views[0][0];
  const [f, setF] = useState({ from: monthStart(pktToday()), to: pktToday(), mode: '', company: '', patient: '', test: '', category: '' });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const run = async () => {
    if (f.to < f.from) { toast.error('"To" date is before "From" date'); return; }
    setLoading(true);
    try {
      setData(await labApi(`/report-lines?from=${f.from}&to=${f.to}`));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (allowed.length) run(); }, []);

  // Filter choices from what the dates brought.
  const choices = useMemo(() => {
    const ls = data?.lines || [];
    return {
      companies: [...new Set(ls.map(companyOf).filter(Boolean))].sort(byText),
      tests: [...new Set(ls.map((l) => l.test).filter(Boolean))].sort(byText),
      categories: [...new Set(ls.map(categoryOf))].sort(byText),
      modes: MODE_ORDER.filter((m) => ls.some((l) => l.mode === m)).concat([...new Set(ls.map((l) => l.mode))].filter((m) => !MODE_ORDER.includes(m))),
    };
  }, [data]);

  const panelOnly = report?.key === 'panel-wise' && view === 'company';
  const table = useMemo(() => {
    if (!data || !report) return null;
    const mode = panelOnly ? 'panel' : f.mode;
    const lines = data.lines.filter((l) => (!mode || l.mode === mode)
      && (!f.company || companyOf(l) === f.company)
      && (!f.patient || l.patient === f.patient)
      && (!f.test || l.test === f.test)
      && (!f.category || categoryOf(l) === f.category));
    const slipDiscount = new Map(data.slips.map((s) => [s.visitId, s.discount]));
    const stat = (ls) => {
      const ids = new Set(ls.map((l) => l.visitId));
      return {
        slips: ids.size,
        tests: new Set(ls.map((l) => l.subDeptId)).size,
        qty: ls.reduce((s, l) => s + l.qty, 0),
        amount: ls.reduce((s, l) => s + l.amount, 0),
        discount: [...ids].reduce((s, id) => s + (slipDiscount.get(id) || 0), 0),
      };
    };
    const all = stat(lines);

    if (report.key === 'test-wise' && view === 'details') {
      const rows = lines.map((l) => [
        fmtDay(l.date), l.serialNo, l.mrNo ?? '', l.patientName, l.admitNo, modeLabel(l.mode), companyOf(l), l.test, categoryOf(l), l.qty, l.amount,
      ]);
      return makeTable(
        [['Date', 'text'], ['Slip #', 'text'], ['MR #', 'text'], ['Patient', 'text'], ['Adm #', 'text'], ['Mode', 'text'], ['Panel Company', 'text'], ['Test', 'text'], ['Category', 'text'], ['Qty', 'qty'], ['Amount', 'amt']],
        rows, ['Total', `${all.slips} slips`, '', '', '', '', '', `${rows.length} lines`, '', all.qty, all.amount],
      );
    }
    if (report.key === 'test-wise') {
      const rows = groupBy(lines, (l) => l.subDeptId).map(([, ls]) => { const s = stat(ls); return [ls[0].test, categoryOf(ls[0]), s.slips, s.qty, s.amount]; })
        .sort((a, b) => byText(a[0], b[0]));
      return makeTable([['Test', 'text'], ['Category', 'text'], ['Slips', 'int'], ['Qty', 'qty'], ['Amount', 'amt']],
        rows, [`Total (${rows.length} tests)`, '', all.slips, all.qty, all.amount]);
    }
    if (report.key === 'panel-wise') {
      // Slip discount is the whole slip's — shown beside, not split per test.
      const key = view === 'company' ? companyOf : (l) => l.mode;
      const rows = groupBy(lines, key).map(([k, ls]) => { const s = stat(ls); return [view === 'company' ? k : modeLabel(k), s.slips, s.qty, s.amount, s.discount, s.amount - s.discount, k]; })
        .sort(view === 'company' ? (a, b) => byText(a[0], b[0]) : (a, b) => MODE_ORDER.indexOf(a[6]) - MODE_ORDER.indexOf(b[6]))
        .map((r) => r.slice(0, 6));
      return makeTable([[view === 'company' ? 'Panel Company' : 'Mode of Payment', 'text'], ['Slips', 'int'], ['Tests', 'qty'], ['Amount', 'amt'], ['Slip Discount', 'amt'], ['Net', 'amt']],
        rows, [`Total (${rows.length})`, all.slips, all.qty, all.amount, all.discount, all.amount - all.discount]);
    }
    // Department-wise: the Lab setup's categories.
    if (view === 'tests') {
      const rows = groupBy(lines, (l) => `${categoryOf(l)}|${l.subDeptId}`).map(([, ls]) => { const s = stat(ls); return [categoryOf(ls[0]), ls[0].test, s.slips, s.qty, s.amount]; })
        .sort((a, b) => (a[0] === NO_CATEGORY) - (b[0] === NO_CATEGORY) || byText(a[0], b[0]) || byText(a[1], b[1]));
      return makeTable([['Category', 'text'], ['Test', 'text'], ['Slips', 'int'], ['Qty', 'qty'], ['Amount', 'amt']],
        rows, ['Total', `${rows.length} tests`, all.slips, all.qty, all.amount]);
    }
    const rows = groupBy(lines, categoryOf).map(([k, ls]) => { const s = stat(ls); return [k, s.tests, s.slips, s.qty, s.amount]; })
      .sort((a, b) => (a[0] === NO_CATEGORY) - (b[0] === NO_CATEGORY) || byText(a[0], b[0]));
    return makeTable([['Category', 'text'], ['Tests', 'int'], ['Slips', 'int'], ['Qty', 'qty'], ['Amount', 'amt']],
      rows, [`Total (${rows.length})`, all.tests, all.slips, all.qty, all.amount]);
  }, [data, report, view, f, panelOnly]);

  if (!report) return <div className="lab-page"><p className="lab-empty">You don't have access to lab reports.</p></div>;

  const viewLabel = report.views.find(([k]) => k === view)?.[1];
  const title = `${report.label} — ${viewLabel}`;
  const shown = data ? { from: data.from, to: data.to } : f;
  const criteria = [
    `${fmtDay(shown.from)} to ${fmtDay(shown.to)}`,
    panelOnly ? 'Panel only' : f.mode && `Mode: ${modeLabel(f.mode)}`,
    f.company && `Panel Company: ${f.company}`,
    f.patient && (f.patient === 'opd' ? 'OPD only' : 'Admission only'),
    f.test && `Test: ${f.test}`,
    f.category && `Category: ${f.category}`,
  ].filter(Boolean).join(' · ');

  const print = () => {
    if (!table) return;
    const win = openPrintWindow();
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${esc(title)}</title><style>
      @page { size: A4 ${table.head.length > 7 ? 'landscape' : 'portrait'}; margin: 10mm; }
      * { box-sizing: border-box; margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; }
      body { font-size: 8pt; color: #000; }
      h1 { font-size: 11pt; text-align: center; } h2 { font-size: 10pt; text-align: center; margin: 1mm 0; }
      p { text-align: center; font-size: 8pt; margin-bottom: 3mm; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #777; padding: 1mm 1.5mm; font-size: 8pt; text-align: left; }
      th { background: #eee; } .n { text-align: right; white-space: nowrap; }
      tfoot td { font-weight: 700; } thead { display: table-header-group; } tfoot { display: table-row-group; }
      tr { page-break-inside: avoid; }
    </style></head><body>
      <h1>${HOSPITAL}</h1><h2>${esc(title)}</h2><p>${esc(criteria)} · Printed by ${esc(userName)} on ${esc(new Date().toLocaleString('en-GB'))}</p>
      <table><thead><tr>${table.head.map((h, i) => `<th class="${table.num.includes(i) ? 'n' : ''}">${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${table.rows.map((r) => `<tr>${r.map((v, i) => `<td class="${table.num.includes(i) ? 'n' : ''}">${esc(table.fmt(i, v))}</td>`).join('')}</tr>`).join('')}</tbody>
      <tfoot><tr>${table.foot.map((v, i) => `<td class="${table.num.includes(i) ? 'n' : ''}">${esc(table.num.includes(i) ? table.fmt(i, v) : v)}</td>`).join('')}</tr></tfoot></table>
    </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  const excel = () => {
    if (!table) return;
    const ws = XLSX.utils.aoa_to_sheet([[HOSPITAL], [title], [criteria], [], table.head, ...table.rows, table.foot]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lab Report');
    XLSX.writeFile(wb, `lab_${report.key}_${view}_${shown.from}_${shown.to}.xlsx`);
  };

  return (
    <div className="lab-page">
      <PageHeader breadcrumbs={[{ label: 'Laboratories', link: '/lab-module' }, { label: 'Reports' }]} title="Lab Reports" subtitle="Test-wise, panel / mode of payment and department-wise, from the lab slips" />

      <div className="lab-tabs" role="tablist">
        {allowed.map((r) => (
          <button type="button" role="tab" key={r.key} aria-selected={report.key === r.key} className={report.key === r.key ? 'is-on' : ''} onClick={() => setParams({ report: r.key })}>{r.label}</button>
        ))}
      </div>

      <section className="lab-card">
        <div className="lab-filters">
          <label className="lab-field"><span>Date From</span><input type="date" className="lab-input" value={f.from} max={pktToday()} onChange={(e) => set('from', e.target.value)} /></label>
          <label className="lab-field"><span>To</span><input type="date" className="lab-input" value={f.to} min={f.from} max={pktToday()} onChange={(e) => set('to', e.target.value)} /></label>
          <label className="lab-field"><span>Mode of Payment</span>
            <select className="lab-select" value={panelOnly ? 'panel' : f.mode} disabled={panelOnly} onChange={(e) => set('mode', e.target.value)}>
              <option value="">All</option>
              {(choices.modes.length ? choices.modes : MODE_ORDER).map((m) => <option key={m} value={m}>{modeLabel(m)}</option>)}
            </select>
          </label>
          <label className="lab-field"><span>Panel Company</span>
            <SearchableSelect options={choices.companies} value={f.company} onChange={(v) => set('company', v || '')} getKey={(c) => c} getLabel={(c) => c} placeholder="All companies" size="sm" />
          </label>
          <label className="lab-field"><span>Patient</span>
            <select className="lab-select" value={f.patient} onChange={(e) => set('patient', e.target.value)}>
              <option value="">OPD + Admission</option><option value="opd">OPD only</option><option value="admission">Admission only</option>
            </select>
          </label>
          <label className="lab-field"><span>Test</span>
            <SearchableSelect options={choices.tests} value={f.test} onChange={(v) => set('test', v || '')} getKey={(c) => c} getLabel={(c) => c} placeholder="All tests" size="sm" />
          </label>
          <label className="lab-field"><span>Category (Department)</span>
            <select className="lab-select" value={f.category} onChange={(e) => set('category', e.target.value)}>
              <option value="">All</option>
              {choices.categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </div>
        <div className="lab-report-bar">
          <div className="lab-seg" role="radiogroup" aria-label="View">
            {report.views.map(([k, l]) => (
              <button type="button" key={k} className={view === k ? 'is-on' : ''} aria-pressed={view === k} onClick={() => setViews((v) => ({ ...v, [report.key]: k }))}>{l}</button>
            ))}
          </div>
          <span className="lab-grow" />
          <button type="button" className="lab-btn lab-btn--primary" onClick={run} disabled={loading}><RefreshCw size={14} /> {loading ? 'Loading…' : 'Show'}</button>
          <button type="button" className="lab-btn" onClick={print} disabled={!table?.rows.length}><Printer size={14} /> Print</button>
          <button type="button" className="lab-btn" onClick={excel} disabled={!table?.rows.length}><FileSpreadsheet size={14} /> Excel</button>
        </div>
      </section>

      <section className="lab-card">
        <h2 className="lab-card-title">{title}<span className="lab-count">{criteria}</span></h2>
        <div className="table-wrap">
          {loading && !data ? <p className="lab-empty">Loading…</p> : !table || !table.rows.length ? <p className="lab-empty">No lab slips for these filters.</p> : (
            <table className="lab-table lab-table--report">
              <thead><tr>{table.head.map((h, i) => <th key={h} className={table.num.includes(i) ? 'r' : ''}>{h}</th>)}</tr></thead>
              <tbody>{table.rows.map((r, ri) => <tr key={ri}>{r.map((v, i) => <td key={i} className={table.num.includes(i) ? 'r' : ''}>{table.fmt(i, v)}</td>)}</tr>)}</tbody>
              <tfoot><tr>{table.foot.map((v, i) => <td key={i} className={table.num.includes(i) ? 'r' : ''}>{table.num.includes(i) ? table.fmt(i, v) : v}</td>)}</tr></tfoot>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
