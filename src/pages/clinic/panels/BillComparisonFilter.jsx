import { useNavigate } from 'react-router-dom';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import '../reports/ConsultantWiseFilter.scss';

// Panels > Reports > Bill Comparison Report — filter step (owner's report
// format: filter screen first, then the preview). This report has no filters
// of its own (it always lists every imported row), so this is only the
// entry point; OK opens BillComparisonReport at /view.
export default function BillComparisonFilter() {
  const navigate = useNavigate();

  return (
    <div className="cwf-page">
      <ClinicMenuBar />

      <div className="cwf-center">
        <div className="cwf-window">
          <div className="cwf-titlebar">
            <span className="cwf-title-left">Reports — Bill Comparison Report</span>
            <span className="cwf-title-right">Bill Comparison Report</span>
          </div>

          <div className="cwf-body">
            <div className="cwf-row" style={{ fontSize: '0.82rem', color: '#333' }}>
              Admission wise panel billing — sab imported rows dikhaye jayenge. Excel import Preview screen se hota hai.
            </div>

            <div className="cwf-actions">
              <button type="button" className="cwf-btn cwf-btn--ok" onClick={() => navigate('/clinic/panels/bill-comparison/view')}>OK</button>
              <button type="button" className="cwf-btn" onClick={() => navigate(-1)}>Close</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
