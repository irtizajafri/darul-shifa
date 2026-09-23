import { useEffect, useRef } from 'react';
import Spreadsheet from 'x-data-spreadsheet';
import 'x-data-spreadsheet/dist/xspreadsheet.css';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { Upload, Download, FilePlus2 } from 'lucide-react';
import './ExcelWorkspace.scss';

// ── SheetJS (.xlsx) <-> x-data-spreadsheet ke darmiyan conversion ──────────
// Yeh feature bilkul client-side hai — koi file/data server pe nahi jaata,
// import/export dono seedha browser mein hote hain (jaisa asal Excel: file
// kholo, edit karo, save/export karke apne computer pe rakho).

function xlsxWorkbookToSheets(workbook) {
  return workbook.SheetNames.map((name) => {
    const ws = workbook.Sheets[name];
    const ref = ws['!ref'];
    const range = ref ? XLSX.utils.decode_range(ref) : { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } };
    const rows = {};
    for (let r = range.s.r; r <= range.e.r; r += 1) {
      const cells = {};
      let hasCell = false;
      for (let c = range.s.c; c <= range.e.c; c += 1) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        if (cell) {
          hasCell = true;
          const text = cell.f ? `=${cell.f}` : (cell.v !== undefined ? String(cell.v) : '');
          cells[c] = { text };
        }
      }
      if (hasCell) rows[r] = { cells };
    }
    rows.len = Math.max(range.e.r + 1, 100);
    return {
      name,
      freeze: 'A1',
      styles: [],
      merges: [],
      rows,
      cols: { len: Math.max(range.e.c + 1, 26) },
    };
  });
}

function sheetsToXlsxWorkbook(sheets) {
  const wb = XLSX.utils.book_new();
  sheets.forEach((sheet) => {
    const ws = {};
    let maxR = 0;
    let maxC = 0;
    const rows = sheet.rows || {};
    Object.keys(rows).forEach((rk) => {
      if (rk === 'len') return;
      const r = Number(rk);
      const cells = rows[rk].cells || {};
      Object.keys(cells).forEach((ck) => {
        const c = Number(ck);
        const raw = cells[ck].text;
        if (raw === undefined || raw === '') return;
        const addr = XLSX.utils.encode_cell({ r, c });
        if (typeof raw === 'string' && raw.startsWith('=')) {
          ws[addr] = { t: 'n', f: raw.slice(1) };
        } else {
          const num = Number(raw);
          ws[addr] = (raw.trim?.() === '' || Number.isNaN(num)) ? { t: 's', v: raw } : { t: 'n', v: num };
        }
        maxR = Math.max(maxR, r);
        maxC = Math.max(maxC, c);
      });
    });
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } });
    XLSX.utils.book_append_sheet(wb, ws, sheet.name || 'Sheet1');
  });
  return wb;
}

const blankSheet = () => [{ name: 'Sheet1', freeze: 'A1', styles: [], merges: [], rows: { len: 100 }, cols: { len: 26 } }];

export default function ExcelWorkspace() {
  const containerRef = useRef(null);
  const instanceRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || instanceRef.current) return;
    instanceRef.current = new Spreadsheet(containerRef.current, {
      showToolbar: true,
      showGrid: true,
      showContextmenu: true,
      view: {
        height: () => containerRef.current.clientHeight,
        width: () => containerRef.current.clientWidth,
      },
    }).loadData(blankSheet());

    // Excel window canvas ke resize-handle se bari/chhoti hoti hai — library
    // khud sirf browser-window resize pe re-measure karti hai, apne parent
    // container ke resize pe nahi. Isliye khud observe karke "reload()" call
    // karte hain taky grid hamesha window ke naye size ke sath fit rahe.
    const ro = new ResizeObserver(() => {
      instanceRef.current?.sheet?.reload();
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // taky wahi file dobara select karne pe bhi change event fire ho
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array' });
        const sheets = xlsxWorkbookToSheets(wb);
        instanceRef.current?.loadData(sheets);
        toast.success(`"${file.name}" import ho gayi`);
      } catch {
        toast.error('File import nahi ho saki — format check karo (.xlsx/.xls/.csv)');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleExport = () => {
    if (!instanceRef.current) return;
    const sheets = instanceRef.current.getData();
    const wb = sheetsToXlsxWorkbook(sheets);
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `workbook-${stamp}.xlsx`);
  };

  const handleNew = () => {
    if (!confirm('Naya blank workbook shuru karein? Abhi ka data (agar save/export nahi kiya) chala jayega.')) return;
    instanceRef.current?.loadData(blankSheet());
  };

  return (
    <div className="excel-workspace">
      <div className="excel-workspace__toolbar">
        <button onClick={handleImportClick} title="Excel/CSV file import karo">
          <Upload className="w-3.5 h-3.5" /> Import
        </button>
        <button onClick={handleExport} title="Abhi ki sheet .xlsx ke tor par download karo">
          <Download className="w-3.5 h-3.5" /> Export
        </button>
        <button onClick={handleNew} title="Naya blank workbook">
          <FilePlus2 className="w-3.5 h-3.5" /> New
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>
      <div className="excel-workspace__grid" ref={containerRef} />
    </div>
  );
}
