import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, FileDown, RefreshCw } from 'lucide-react';
import ReportWindowControls from './ReportWindowControls';
import './ReportToolbar.scss';

// One action bar for every Clinic / Panels report preview (owner's format,
// 2026-10-21 — same as Patients List): Back · Print / PDF · Export Excel ·
// Refresh, stuck to the top while the report scrolls. `children` adds a
// report's own extra buttons after Refresh; `right` fills the right side
// (e.g. "Refreshed: 10:42"), ending with the Minimize / Close window
// buttons. Leave a handler out to hide that button.
export default function ReportToolbar({ onBack, onPrint, onExport, onRefresh, refreshing = false, children, right, title }) {
  const navigate = useNavigate();
  return (
    <div className="rpt-sticky no-print">
      <div className="rpt-toolbar">
        <div className="rpt-toolbar-left">
          <button type="button" className="rpt-tool-btn rpt-tool-btn--back" onClick={onBack || (() => navigate(-1))} title="Back to Filters">
            <ArrowLeft size={14} /> <span>Back</span>
          </button>
          <div className="rpt-tool-sep" />
          {onPrint && (
            <button type="button" className="rpt-tool-btn" onClick={onPrint} title="Print / PDF">
              <Printer size={14} /> <span>Print / PDF</span>
            </button>
          )}
          {onExport && (
            <button type="button" className="rpt-tool-btn rpt-tool-btn--excel" onClick={onExport} title="Export Excel">
              <FileDown size={14} /> <span>Export Excel</span>
            </button>
          )}
          {onRefresh && (
            <>
              <div className="rpt-tool-sep" />
              <button type="button" className="rpt-tool-btn" onClick={onRefresh} disabled={refreshing} title="Refresh">
                <RefreshCw size={14} className={refreshing ? 'rpt-spin' : ''} /> <span>Refresh</span>
              </button>
            </>
          )}
          {children}
        </div>
        <div className="rpt-toolbar-right">
          {right}
          <ReportWindowControls title={title} />
        </div>
      </div>
    </div>
  );
}
