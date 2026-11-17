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
import {
  PHARMACY_NAME, pharmacyApi, getJson, DEPARTMENTS_API, activeDepartments, EMPLOYEES_API, pktToday, daysBefore, fmtDate, fmtQty, fmtAmt, employeeName, patientRef, STATUS_LABEL,
} from './pharmacyApi';
import './Pharmacy.scss';

// Al Shifa Hospital Pharmacy → Reports: GD Report (every demanded line with
// what's been issued) and GIN Report (Details, Patient-wise, Medicine-wise),
// like Inventory's GD / Issuance reports.

const REPORTS = [
  { key: 'gd-report', label: 'GD Report' },
  { key: 'gin-report', label: 'GIN Report' },
];
const GIN_VIEWS = [['details', 'Details'], ['patient', 'Patient-wise'], ['medicine', 'Medicine-wise']];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export default function PharmacyReports() {
  const { user } = useAuthStore();
  const userName = user?.name || user?.username || user?.email || '';
  const [params, setParams] = useSearchParams();
  const allowed = REPORTS.filter((r) => user?.isSuperAdmin || hasPermission(user, 'pharmacy', 'reports', r.key));
  const report = allowed.some((r) => r.key === params.get('report')) ? params.get('report') : allowed[0]?.key;
  const [f, setF] = useState({ from: daysBefore(pktToday(), 30), to: pktToday(), departmentId: '', patientType: '', admissionNumber: '', opdSlipNo: '', medicine: '', issuedToId: '', status: '' });
  const [view, setView] = useState('details');
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getJson(DEPARTMENTS_API).then((d) => setDepartments(activeDepartments(d))).catch(() => {});
    getJson(EMPLOYEES_API).then((d) => setEmployees(d || [])).catch(() => {});
  }, []);

  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const run = async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      Object.entries(f).forEach(([k, v]) => { if (v) p.set(k, v); });
      const rows = await pharmacyApi(`/${report === 'gd-report' ? 'gd' : 'gin'}?${p}`);
      setData({ report, rows });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setData(null); if (report) run(); }, [report]);

  // Rows as shown, for the screen, print and Excel alike.
  const table = useMemo(() => {
    if (!data) return null;
    const med = f.medicine.trim().toLowerCase();
    const medOk = (name, code) => !med || String(name || '').toLowerCase().includes(med) || String(code || '').toLowerCase().includes(med);
    if (data.report === 'gd-report') {
      const rows = data.rows.flatMap((g) => g.items.filter((it) => medOk(it.medicineName, it.medicineCode)).map((it) => [
        fmtDate(g.requestDate), g.code, g.departmentName, patientRef(g), g.patientName || '', it.medicineName, it.packSize || '',
        it.quantityRequested, it.quantityIssued, Math.max(0, it.quantityRequested - it.quantityIssued), STATUS_LABEL[it.status],
      ]));
      return {
        head: ['Date', 'GD #', 'Department', 'Adm # / Slip #', 'Patient', 'Medicine', 'Pack', 'Requested', 'Issued', 'Pending', 'Status'],
        num: [7, 8, 9], rows,
        foot: ['Total', `${data.rows.length} GD`, '', '', '', `${rows.length} lines`, '', rows.reduce((s, r) => s + r[7], 0), rows.reduce((s, r) => s + r[8], 0), rows.reduce((s, r) => s + r[9], 0), ''],
        fmt: (i, v) => ([7, 8, 9].includes(i) ? fmtQty(v) : v),
      };
    }
    const lines = data.rows.flatMap((g) => g.items.filter((it) => medOk(it.medicineName, it.medicineCode)).map((it) => ({ g, it })));
    const totalAmt = lines.reduce((s, l) => s + Number(l.it.amount), 0);
    if (view === 'patient') {
      const m = new Map();
      for (const { g, it } of lines) {
        const key = patientRef(g) || `No patient · ${g.departmentName}`;
        if (!m.has(key)) m.set(key, { ref: patientRef(g) || '—', name: g.patientName || '', dept: g.departmentName, gins: new Set(), qty: 0, amount: 0 });
        const r = m.get(key);
        r.gins.add(g.code); r.qty += it.quantity; r.amount += Number(it.amount);
      }
      const rows = [...m.values()].map((r) => [r.ref, r.name, r.dept, r.gins.size, r.qty, r.amount]);
      return {
        head: ['Adm # / Slip #', 'Patient', 'Department', 'GINs', 'Qty', 'Amount'], num: [3, 4, 5], rows,
        foot: ['Total', `${rows.length} patients`, '', rows.reduce((s, r) => s + r[3], 0), rows.reduce((s, r) => s + r[4], 0), totalAmt],
        fmt: (i, v) => (i === 5 ? fmtAmt(v) : i === 4 ? fmtQty(v) : v),
      };
    }
    if (view === 'medicine') {
      const m = new Map();
      for (const { it } of lines) {
        const key = it.medicineId || it.medicineName;
        if (!m.has(key)) m.set(key, { code: it.medicineCode || '', name: it.medicineName, pack: it.packSize || '', qty: 0, amount: 0 });
        const r = m.get(key);
        r.qty += it.quantity; r.amount += Number(it.amount);
      }
      const rows = [...m.values()].sort((a, b) => a.name.localeCompare(b.name)).map((r) => [r.code, r.name, r.pack, r.qty, r.amount]);
      return {
        head: ['Code', 'Medicine', 'Pack', 'Qty Issued', 'Amount'], num: [3, 4], rows,
        foot: ['Total', `${rows.length} medicines`, '', rows.reduce((s, r) => s + r[3], 0), totalAmt],
        fmt: (i, v) => (i === 4 ? fmtAmt(v) : i === 3 ? fmtQty(v) : v),
      };
    }
    const rows = lines.map(({ g, it }) => [
      fmtDate(g.issueDate), g.code, g.gd?.code || '', g.departmentName, patientRef(g), g.patientName || '', g.issuedToName || '',
      it.medicineName, it.quantity, Number(it.rate), Number(it.amount),
    ]);
    return {
      head: ['Date', 'GIN #', 'GD #', 'Department', 'Adm # / Slip #', 'Patient', 'Issued To', 'Medicine', 'Qty', 'Rate', 'Amount'],
      num: [8, 9, 10], rows,
      foot: ['Total', `${data.rows.length} GIN`, '', '', '', '', '', `${rows.length} lines`, rows.reduce((s, r) => s + r[8], 0), '', totalAmt],
      fmt: (i, v) => (i === 8 ? fmtQty(v) : [9, 10].includes(i) ? (v === '' ? '' : fmtAmt(v)) : v),
    };
  }, [data, view, f.medicine]);

  const title = report === 'gd-report' ? 'GD Report' : `GIN Report — ${GIN_VIEWS.find(([k]) => k === view)?.[1]}`;
  const criteria = [
    `${fmtDate(`${f.from}T00:00:00Z`)} to ${fmtDate(`${f.to}T00:00:00Z`)}`,
    f.departmentId && `Department: ${departments.find((d) => String(d.id) === String(f.departmentId))?.name || ''}`,
    f.patientType && `Patient: ${{ admission: 'Admission', panel: 'Panel Slip', none: 'No patient' }[f.patientType]}`,
    f.admissionNumber && `Adm # ${f.admissionNumber}`, f.opdSlipNo && `Slip # ${f.opdSlipNo}`,
    f.medicine && `Medicine: ${f.medicine}`,
    report === 'gin-report' && f.issuedToId && `Issued To: ${employeeName(employees.find((e) => String(e.id) === String(f.issuedToId)) || {})}`,
    report === 'gd-report' && f.status && `Status: ${f.status === 'pending' ? 'Not fully issued' : 'Issued'}`,
  ].filter(Boolean).join(' · ');

  const print = () => {
    if (!table) return;
    const win = openPrintWindow();
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${esc(title)}</title><style>
      @page { size: A4 landscape; margin: 10mm; }
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
      <h1>${PHARMACY_NAME}</h1><h2>${esc(title)}</h2><p>${esc(criteria)} · Printed by ${esc(userName)} on ${esc(new Date().toLocaleString('en-GB'))}</p>
      <table><thead><tr>${table.head.map((h, i) => `<th class="${table.num.includes(i) ? 'n' : ''}">${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${table.rows.map((r) => `<tr>${r.map((v, i) => `<td class="${table.num.includes(i) ? 'n' : ''}">${esc(table.fmt(i, v))}</td>`).join('')}</tr>`).join('')}</tbody>
      <tfoot><tr>${table.foot.map((v, i) => `<td class="${table.num.includes(i) ? 'n' : ''}">${esc(table.num.includes(i) && v !== '' ? table.fmt(i, v) : v)}</td>`).join('')}</tr></tfoot></table>
    </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  const excel = () => {
    if (!table) return;
    const ws = XLSX.utils.aoa_to_sheet([[PHARMACY_NAME], [title], [criteria], [], table.head, ...table.rows, table.foot]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, report === 'gd-report' ? 'GD' : 'GIN');
    XLSX.writeFile(wb, `pharmacy_${report}${report === 'gin-report' ? `_${view}` : ''}_${f.from}_${f.to}.xlsx`);
  };

  if (!allowed.length) return <div className="ph-page"><p className="ph-empty">You don't have access to pharmacy reports.</p></div>;

  return (
    <div className="ph-page">
      <PageHeader breadcrumbs={[{ label: 'Al Shifa Hospital Pharmacy', link: '/pharmacy-module' }, { label: 'Reports' }]} title="Reports" subtitle="Goods Demand and Goods Issuance reports" />

      <div className="ph-tabs" role="tablist">
        {allowed.map((r) => (
          <button type="button" role="tab" key={r.key} aria-selected={report === r.key} className={report === r.key ? 'is-on' : ''} onClick={() => setParams({ report: r.key })}>{r.label}</button>
        ))}
      </div>

      <section className="ph-card">
        <div className="ph-grid ph-grid--4">
          <label className="ph-field"><span>{report === 'gd-report' ? 'Request Date From' : 'Issue Date From'}</span><input type="date" className="ph-input" value={f.from} onChange={(e) => set('from', e.target.value)} /></label>
          <label className="ph-field"><span>To</span><input type="date" className="ph-input" value={f.to} min={f.from} onChange={(e) => set('to', e.target.value)} /></label>
          <label className="ph-field"><span>Department</span>
            <SearchableSelect options={departments} value={f.departmentId} onChange={(v) => set('departmentId', v || '')} getKey={(d) => d.id} getLabel={(d) => d.name} placeholder="All departments" size="sm" />
          </label>
          <label className="ph-field"><span>Patient Type</span>
            <select className="ph-input" value={f.patientType} onChange={(e) => set('patientType', e.target.value)}>
              <option value="">All</option><option value="admission">Admission</option><option value="panel">Panel Slip</option><option value="none">No patient (department)</option>
            </select>
          </label>
          <label className="ph-field"><span>Admission #</span><input className="ph-input" value={f.admissionNumber} onChange={(e) => set('admissionNumber', e.target.value)} /></label>
          <label className="ph-field"><span>Panel Slip #</span><input className="ph-input" value={f.opdSlipNo} onChange={(e) => set('opdSlipNo', e.target.value)} /></label>
          <label className="ph-field"><span>Medicine</span><input className="ph-input" value={f.medicine} onChange={(e) => set('medicine', e.target.value)} placeholder="Name or code" /></label>
          {report === 'gin-report' ? (
            <label className="ph-field"><span>Issued To</span>
              <SearchableSelect options={employees} value={f.issuedToId} onChange={(v) => set('issuedToId', v || '')} getKey={(e) => e.id} getLabel={(e) => employeeName(e)} placeholder="All staff" size="sm" />
            </label>
          ) : (
            <label className="ph-field"><span>Status</span>
              <select className="ph-input" value={f.status} onChange={(e) => set('status', e.target.value)}>
                <option value="">All</option><option value="pending">Not fully issued</option><option value="closed">Issued</option>
              </select>
            </label>
          )}
        </div>
        <div className="ph-actions ph-actions--left">
          {report === 'gin-report' && (
            <div className="ph-seg" role="radiogroup" aria-label="View">
              {GIN_VIEWS.map(([k, l]) => <button type="button" key={k} className={view === k ? 'is-on' : ''} aria-pressed={view === k} onClick={() => setView(k)}>{l}</button>)}
            </div>
          )}
          <span className="ph-grow" />
          <button type="button" className="ph-btn ph-btn--primary" onClick={run} disabled={loading}><RefreshCw size={14} /> Show</button>
          <button type="button" className="ph-btn" onClick={print} disabled={!table?.rows.length}><Printer size={14} /> Print</button>
          <button type="button" className="ph-btn" onClick={excel} disabled={!table?.rows.length}><FileSpreadsheet size={14} /> Excel</button>
        </div>
      </section>

      <section className="ph-card">
        <h2 className="ph-card__title">{title}<span className="ph-count">{criteria}</span></h2>
        <div className="table-wrap">
          {loading ? <p className="ph-empty">Loading…</p> : !table || !table.rows.length ? <p className="ph-empty">Nothing for these filters.</p> : (
            <table className="ph-table">
              <thead><tr>{table.head.map((h, i) => <th key={h} className={table.num.includes(i) ? 'r' : ''}>{h}</th>)}</tr></thead>
              <tbody>{table.rows.map((r, ri) => <tr key={ri}>{r.map((v, i) => <td key={i} className={table.num.includes(i) ? 'r' : ''}>{table.fmt(i, v)}</td>)}</tr>)}</tbody>
              <tfoot><tr>{table.foot.map((v, i) => <td key={i} className={table.num.includes(i) ? 'r' : ''}>{table.num.includes(i) && v !== '' ? table.fmt(i, v) : v}</td>)}</tr></tfoot>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
