import * as XLSX from 'xlsx';

const API = 'http://localhost:5001/api/clinic';

// Billing Detail Report's "Upload Excel" — moved out of
// PanelBillingDetailReport.jsx so both the filter screen and the preview can
// offer it (unchanged parse logic).
const norm = (s) => String(s).toLowerCase().replace(/\s+/g, ' ').trim();

// Header-name → field mapping (robust: matches by header text, not fixed column index)
const HEAD_MATCH = [
  ['const fee', 'constFee'], ['follow-up', 'followUp'], ['followup', 'followUp'],
  ['anesthesia', 'anesthesia'], ['medicine', 'medicine'], ['laboratory', 'laboratory'],
  ['cost of blood', 'costOfBlood'], ['echocardiograph', 'echocardiograph'], ['ultrasound', 'ultrasound'],
  ['x-ray', 'xRay'], ['xray', 'xRay'], ['physiotherapy', 'physiotherapy'],
  ['c.t. scan', 'ctScan'], ['ct scan', 'ctScan'], ['surgon fee', 'surgeonFee'],
  ['surgeon fee', 'surgeonFee'], ['total amount', 'totalAmount'],
];

function parseBillingExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb  = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });

        // period from "From : dd-mm-yyyy   To : dd-mm-yyyy"
        let periodFrom = null, periodTo = null;
        for (let i = 0; i < 8; i++) {
          const line = (raw[i] || []).map((c) => String(c)).join(' ');
          const m = line.match(/From\s*:\s*(\d{2}-\d{2}-\d{4})\s*To\s*:\s*(\d{2}-\d{2}-\d{4})/i);
          if (m) {
            const iso = (s) => { const [d, mo, y] = s.split('-'); return `${y}-${mo}-${d}`; };
            periodFrom = iso(m[1]); periodTo = iso(m[2]); break;
          }
        }

        // header row = the row whose first cell contains "admit"
        let hIdx = -1;
        for (let i = 0; i < 15; i++) { if (norm((raw[i] || [])[0]).includes('admit')) { hIdx = i; break; } }
        if (hIdx === -1) { reject(new Error('Header row (Admit #) nahi mila')); return; }

        const col = {};
        (raw[hIdx] || []).forEach((c, idx) => {
          const n = norm(c);
          if (!n) return;
          if (n.includes('admit')) col.admitNo = idx;
          else if (n.includes('pataint') || n.includes('patient')) col.patientName = idx;
          else if (n.includes('conscode') || n === 'cons code') col.consCode = idx;
          else if (n.includes('compname') || n === 'company') col.companyName = idx;
          else { const hit = HEAD_MATCH.find(([k]) => n === k); if (hit && col[hit[1]] == null) col[hit[1]] = idx; }
        });

        const rows = [];
        for (let i = hIdx + 1; i < raw.length; i++) {
          const r = raw[i];
          const a = r[col.admitNo];
          if (typeof a !== 'number' || a <= 0) continue;
          const g = (k) => (col[k] != null ? Number(r[col[k]]) || 0 : 0);
          rows.push({
            admitNo: String(a),
            patientName: String(r[col.patientName] || '').trim(),
            consCode:    String(r[col.consCode] || '').trim(),
            companyName: String(r[col.companyName] || '').trim(),
            constFee: g('constFee'), followUp: g('followUp'), anesthesia: g('anesthesia'),
            medicine: g('medicine'), laboratory: g('laboratory'), costOfBlood: g('costOfBlood'),
            echocardiograph: g('echocardiograph'), ultrasound: g('ultrasound'), xRay: g('xRay'),
            physiotherapy: g('physiotherapy'), ctScan: g('ctScan'), surgeonFee: g('surgeonFee'),
            totalAmount: g('totalAmount'),
          });
        }
        resolve({ rows, periodFrom, periodTo });
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// Parse + POST one legacy export. Throws on a bad file / server error;
// returns null when the sheet had no usable rows, else the server's message.
export async function importBillingExcel(file) {
  const { rows, periodFrom, periodTo } = await parseBillingExcel(file);
  if (!rows.length) return null;
  const res = await fetch(`${API}/panel-billing/import`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows, periodFrom, periodTo }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message);
  return json.message || `${rows.length} bills imported`;
}

export const isExcelFile = (file) => ['xlsx', 'xls'].includes(file.name.split('.').pop().toLowerCase());
