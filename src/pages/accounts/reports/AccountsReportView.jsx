import { useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import ReportToolbar from '../../../components/reports/ReportToolbar';
import { openPrintWindow } from '../../../utils/printRelay';
import { useReportPreviewStore, refreshReportPreview } from './reportPreview';
import './AccountsReportView.scss';

// Preview of an Accounts report (see reportPreview.js): the report's own
// print page shown on screen, under the Clinic reports' toolbar. Scripts in
// it (auto-print on load) don't run here — sandboxed — only on Print.
export default function AccountsReportView() {
  const { entityType } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const pid = params.get('pid');
  const preview = useReportPreviewStore((s) => s.previews[pid]);
  const frameRef = useRef(null);
  const [refreshing, setRefreshing] = useState(false);

  // The preview lives in memory — after a page reload it's gone and the
  // report has to be run again from its filter screen.
  if (!preview?.html) {
    return (
      <div className="arv-page">
        <ReportToolbar menuBar={null} onBack={() => navigate(`/accounts/${entityType}/reports`)} />
        <div className="arv-empty">Yeh report ab available nahi — filter screen se dobara chalayein.</div>
      </div>
    );
  }

  const fitFrame = () => {
    const doc = frameRef.current?.contentDocument;
    if (doc?.documentElement) frameRef.current.style.height = `${doc.documentElement.scrollHeight + 20}px`;
  };

  const handlePrint = () => {
    const w = openPrintWindow('width=1000,height=800');
    w.document.write(preview.html);
    w.document.close();
    if (preview.autoPrint) w.print();
  };

  const handleExport = () => {
    const doc = frameRef.current?.contentDocument;
    const tables = doc ? [...doc.querySelectorAll('table')] : [];
    if (!tables.length) { toast.error('Is report mein export ke liye koi table nahi'); return; }
    // Every table of the report on one sheet, one after another.
    let ws = null;
    tables.forEach((t) => {
      if (!ws) ws = XLSX.utils.table_to_sheet(t, { raw: true });
      else {
        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
        XLSX.utils.sheet_add_dom(ws, t, { origin: range.e.r + 2, raw: true });
      }
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, `${(preview.title || 'Report').replace(/[^\w -]+/g, '')}.xlsx`);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try { await refreshReportPreview(pid); } finally { setRefreshing(false); }
  };

  const at = preview.at ? new Date(preview.at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div className="arv-page">
      <ReportToolbar
        menuBar={null}
        title={preview.title}
        onPrint={handlePrint}
        onExport={handleExport}
        onRefresh={preview.regenerate ? handleRefresh : undefined}
        refreshing={refreshing}
        right={at ? <span>Refreshed: {at}</span> : null}
      />
      <div className="arv-paper">
        <iframe
          ref={frameRef}
          title={preview.title || 'Report'}
          className="arv-frame"
          sandbox="allow-same-origin"
          srcDoc={preview.html}
          onLoad={fitFrame}
        />
      </div>
    </div>
  );
}
