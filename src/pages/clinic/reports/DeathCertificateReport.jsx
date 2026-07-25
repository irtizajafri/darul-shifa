import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { Upload } from 'lucide-react';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import './DeathCertificateReport.scss';

const API = 'http://localhost:5001/api/clinic';

const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MN_IDX = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };

function excelSerialToDate(serial) {
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  return new Date(ms);
}

// "28-Jun-2026 03:00" -> Date. Also accepts a raw Excel date serial number,
// or falls back to native Date parsing for any other reasonable format.
function parseDateTimeCell(val) {
  if (val == null || val === '') return null;
  if (typeof val === 'number') return excelSerialToDate(val);
  const s = String(val).trim();
  const m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (m) {
    const [, d, mon, y, hh, mm] = m;
    const mi = MN_IDX[mon.toLowerCase()];
    if (mi != null) return new Date(Number(y), mi, Number(d), Number(hh), Number(mm));
  }
  const d2 = new Date(s);
  return isNaN(d2.getTime()) ? null : d2;
}

// "72 Year(s) 0 Month(s) 0 Day(s)" -> { years, months, days }
function parseAgeCell(val) {
  const s = String(val || '');
  const y = s.match(/(\d+)\s*Year/i);
  const mo = s.match(/(\d+)\s*Month/i);
  const d = s.match(/(\d+)\s*Day/i);
  return { years: y ? Number(y[1]) : 0, months: mo ? Number(mo[1]) : 0, days: d ? Number(d[1]) : 0 };
}

function norm(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }

// The hospital's real historical export (and our own, matching layout) spans TWO
// physical Excel rows per certificate — not two lines in one cell:
//   Row A: Certificate#, Date/Time, Place of death, (spacer), Patient name, S/o./W/o./D/o., (spacer), Gender, Age, (spacer), Religion, Occupation
//   Row B: Reason (cause of death), (blank), Address of doctor, (spacer), Doctor name, ...(rest blank)
// Header itself is also 2 rows ("Certificate /" + "Reason" etc). Column positions
// are read from the FIRST header row; the second header row is skipped (its labels
// are implied — "Reason", "Address of doctor", "Doctor" reuse the same columns).
function parseDeathCertExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });

        // Match column 0 specifically (and startsWith, not includes) — the title
        // row "Death Certificate Report" also contains the word "certificate" and
        // would otherwise be picked up by mistake.
        let hIdx = -1;
        for (let i = 0; i < Math.min(raw.length, 15); i++) {
          if (norm((raw[i] || [])[0]).startsWith('certificate')) { hIdx = i; break; }
        }
        if (hIdx === -1) { reject(new Error('Header row (Certificate) nahi mila')); return; }

        const col = {};
        let relationLabel = 'S/o';
        (raw[hIdx] || []).forEach((c, idx) => {
          const n = norm(c);
          if (!n) return;
          if (n.includes('certificate')) col.certificate = idx;
          else if (n.includes('date') && n.includes('time')) col.dateTime = idx;
          else if (n.includes('place of death')) col.deathPlace = idx;
          else if (n.includes('patient name')) col.patientName = idx;
          else if (n === 's/o.' || n === 'd/o.' || n === 'w/o.' || n.includes('s/o') || n.includes('d/o') || n.includes('w/o')) {
            col.relationName = idx;
            if (n.includes('w/o')) relationLabel = 'W/o';
            else if (n.includes('d/o')) relationLabel = 'D/o';
            else relationLabel = 'S/o';
          }
          else if (n === 'gender') col.gender = idx;
          else if (n === 'age') col.age = idx;
          else if (n === 'religion') col.religion = idx;
          else if (n === 'occupation') col.occupation = idx;
        });
        if (col.certificate == null) { reject(new Error('Certificate column nahi mila')); return; }

        // Data starts after BOTH header rows (hIdx and hIdx+1), in pairs of physical rows.
        const rows = [];
        for (let i = hIdx + 2; i < raw.length; i += 2) {
          const rA = raw[i] || [];
          const rB = raw[i + 1] || [];
          const certRaw = String(rA[col.certificate] || '').trim();
          if (!certRaw) continue;

          const parts = certRaw.split('/').map((p) => p.trim()).filter(Boolean);
          const admissionNo = parts.length > 1 ? parts[parts.length - 1] : parts[0];
          const arrivedSlipNo = parts.length > 1 ? parts.slice(0, -1).join('/') : null;
          const age = parseAgeCell(col.age != null ? rA[col.age] : '');
          const genderRaw = norm(col.gender != null ? rA[col.gender] : '');

          rows.push({
            admissionNo,
            arrivedSlipNo,
            causeOfDeath: String(rB[col.certificate] || '').trim(),
            deathTime: parseDateTimeCell(col.dateTime != null ? rA[col.dateTime] : null),
            deathPlace: col.deathPlace != null ? String(rA[col.deathPlace] || '').trim() : '',
            drAddress: col.deathPlace != null ? String(rB[col.deathPlace] || '').trim() : '',
            patientName: col.patientName != null ? String(rA[col.patientName] || '').trim() : '',
            doctorName: col.patientName != null ? String(rB[col.patientName] || '').trim() : '',
            relationType: relationLabel,
            relationName: col.relationName != null ? String(rA[col.relationName] || '').trim() : '',
            gender: genderRaw === 'female' ? 'female' : 'male',
            ageYears: age.years, ageMonths: age.months, ageDays: age.days,
            religion: col.religion != null ? String(rA[col.religion] || '').trim() : '',
            occupation: col.occupation != null ? String(rA[col.occupation] || '').trim() : '',
          });
        }
        resolve(rows);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// "23-06-2026" (filter query param, yyyy-mm-dd) -> "23-06-2026" (dd-mm-yyyy display)
function fmtDMY(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
}

// Death Time -> "28-Jun-2026 03:00"
function fmtDateTime(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${String(d.getDate()).padStart(2, '0')}-${MN[d.getMonth()]}-${d.getFullYear()} ${hh}:${mm}`;
}

const ageStr = (r) => `${r.ageYears} Year(s) ${r.ageMonths} Month(s) ${r.ageDays} Day(s)`;
const certNo = (r) => (r.arrivedSlipNo ? `${r.arrivedSlipNo}/${r.admissionNo}` : r.admissionNo);

export default function DeathCertificateReport() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const fromDate = searchParams.get('fromDate');
  const toDate = searchParams.get('toDate');

  const [rows, setRows] = useState([]);
  const [doctors, setDoctors] = useState({}); // id -> name, for the Doctor line
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    fetch(`${API}/doctors`).then((r) => r.json()).then((j) => {
      const map = {};
      (j.data || []).forEach((d) => { map[d.id] = d.name; });
      setDoctors(map);
    }).catch(() => {});
  }, []);

  const fetchRows = () => {
    setLoading(true);
    const q = new URLSearchParams();
    if (fromDate) q.set('fromDate', fromDate);
    if (toDate) q.set('toDate', toDate);
    fetch(`${API}/death-certificates?${q}`)
      .then((r) => r.json())
      .then((j) => setRows(j.data || []))
      .finally(() => setLoading(false));
  };

  useEffect(fetchRows, [fromDate, toDate]);

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!['xlsx', 'xls'].includes(file.name.split('.').pop().toLowerCase())) {
      toast.error('Sirf Excel file (.xlsx / .xls)'); e.target.value = ''; return;
    }
    setUploading(true);
    try {
      const parsed = await parseDeathCertExcel(file);
      if (!parsed.length) { toast.error('Excel mein valid rows nahi mili'); return; }
      const res = await fetch(`${API}/death-certificates/import`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: parsed }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      toast.success(json.message || `${parsed.length} rows imported`);
      fetchRows();
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  // Exports in the SAME layout as the hospital's real historical report (2-row
  // header, 2 physical rows per record) so this file can be re-uploaded via
  // "Upload Excel" without any conversion.
  function handleExportExcel() {
    const header = [
      ['', '', '', '', '', '', '', 'Death Certificate Report', '', '', '', '', '', ''],
      [],
      ['', '', '', '', '', '', '', `From : ${fmtDMY(fromDate)}  To : ${fmtDMY(toDate)}`, '', '', '', '', '', ''],
      [],
      ['Certificate / ', 'Date/Time', 'Place of death / ', '', '', 'Patient name / ', 'S/o.', '', 'Gender', 'Age', '', 'Religion', 'Occupation', ''],
      ['Reason ', '', 'Address of doctor ', '', '', 'Doctor ', '', '', '', '', '', '', '', ''],
    ];
    const dataRows = [];
    rows.forEach((r) => {
      dataRows.push([
        certNo(r), fmtDateTime(r.deathTime), r.deathPlace || '', '', '',
        r.patientName || '', r.relationName || '', '',
        r.gender === 'male' ? 'Male' : 'Female', ageStr(r), '', r.religion || '', r.occupation || '', '',
      ]);
      dataRows.push([
        r.causeOfDeath || '', '', r.drAddress || '', '', '',
        doctors[r.medicalOfficerId] || '', '', '', '', '', '', '', '', '',
      ]);
    });
    const ws = XLSX.utils.aoa_to_sheet([...header, ...dataRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Death Certificates');
    XLSX.writeFile(wb, `Death_Certificate_Report_${fromDate}_to_${toDate}.xlsx`);
  }

  return (
    <div className="dcr-page">
      <ClinicMenuBar />

      <div className="dcr-body">
        <div className="dcr-toolbar no-print">
          <button className="dcr-tool-btn" onClick={() => navigate(-1)}>Back to Filter</button>
          <div className="dcr-tool-spacer" />
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleUpload} />
          <button className="dcr-tool-btn dcr-tool-btn--upload" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Upload size={14} /> {uploading ? 'Uploading…' : 'Upload Excel'}
          </button>
          <button className="dcr-tool-btn dcr-tool-btn--excel" onClick={handleExportExcel} disabled={!rows.length}>Export Excel</button>
          <button className="dcr-tool-btn dcr-tool-btn--pdf" onClick={() => window.print()} disabled={!rows.length}>Print / PDF</button>
        </div>

        <div className="dcr-sheet">
          <div className="dcr-hdr">
            <div className="dcr-title">Death Certificate Report</div>
            <div className="dcr-sub">From : {fmtDMY(fromDate)}&nbsp;&nbsp;To&nbsp;&nbsp;: {fmtDMY(toDate)}</div>
          </div>

          {loading ? (
            <div className="dcr-empty">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="dcr-empty">Is date range mein koi Death Certificate nahi mila.</div>
          ) : (
            <table className="dcr-table">
              <thead>
                <tr>
                  <th className="dcr-l">Certificate /<br />Reason</th>
                  <th className="dcr-l">Date/Time</th>
                  <th className="dcr-l">Place of death /<br />Address of doctor</th>
                  <th className="dcr-l">Patient name /<br />Doctor</th>
                  <th className="dcr-l">S/o. / W/o. / D/o.</th>
                  <th className="dcr-c" colSpan={2}>Gender Age</th>
                  <th className="dcr-l">Religion</th>
                  <th className="dcr-l">Occupation</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="dcr-l">
                      <div>{certNo(r)}</div>
                      <div className="dcr-sub-line">{r.causeOfDeath}</div>
                    </td>
                    <td className="dcr-l dcr-nowrap">{fmtDateTime(r.deathTime)}</td>
                    <td className="dcr-l">
                      <div>{r.deathPlace || 'UNKNOWN'}</div>
                      <div className="dcr-sub-line">{r.drAddress}</div>
                    </td>
                    <td className="dcr-l">
                      <div>{r.patientName}</div>
                      <div className="dcr-sub-line">{doctors[r.medicalOfficerId] || ''}</div>
                    </td>
                    <td className="dcr-l">{r.relationType ? `${r.relationType}. ${r.relationName || ''}` : r.relationName}</td>
                    <td className="dcr-c">{r.gender === 'male' ? 'Male' : 'Female'}</td>
                    <td className="dcr-l dcr-nowrap">{ageStr(r)}</td>
                    <td className="dcr-l">{r.religion}</td>
                    <td className="dcr-l">{r.occupation || 'NIL'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
