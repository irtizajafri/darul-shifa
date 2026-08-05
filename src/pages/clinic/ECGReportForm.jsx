import { RECEIPT_LOGO_DATA_URI } from './receiptLogo';
import { invoiceLabel } from './receiptUtils';
import './ECGReportForm.scss';

// Exact replica of the hospital's paper "E C G Report" (Department of
// Cardiology) — prints in-page after the slip, same technique as
// ClinicalRecordForm (see printClinicalRecordForm), triggered only when the
// Miscellaneous slip includes the "E C G" sub-department item.
function blankLines(n) {
  return Array.from({ length: n }, (_, i) => <div key={i} className="ecg-rpt-line" />);
}

export default function ECGReportForm({ visit, barcodeDataUrl, printedBy }) {
  if (!visit) return null;

  const now = visit.createdAt ? new Date(visit.createdAt) : new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const fmt = (v) => Number(v || 0).toFixed(2);
  const isComplementary = visit.paymentType === 'complementary';
  const total = isComplementary ? 0 : (visit.totalAmount || 0);
  const received = isComplementary ? 0 : (visit.receive || 0);

  return (
    <div className="ecg-rpt">
      <div className="ecg-rpt-hdr">
        <img className="ecg-rpt-hdr-logo" src={RECEIPT_LOGO_DATA_URI} alt="logo" />
      </div>

      <div className="ecg-rpt-info">
        <div className="ecg-rpt-info-cols">
          <div className="ecg-rpt-info-col">
            <div>Serial #: <span className="copd-crf-dln">{visit.serialNo}</span></div>
            <div>Patient: <span className="copd-crf-dln">{visit.patientType} {visit.patientName}</span></div>
            <div>Ref. By: <span className="copd-crf-dln">{visit.referredBy || '—'}</span></div>
            {visit.admitNo ? <div>Admission No: <span className="copd-crf-dln">{visit.admitNo}</span></div> : null}
            <div className="ecg-rpt-rec-code">REC/FM/001-A-02-00</div>
          </div>
          <div className="ecg-rpt-info-col">
            <div>Printed By: <span className="copd-crf-dln copd-crf-dln--sm">{printedBy || ''}</span></div>
            <div>Date: <span className="copd-crf-dln copd-crf-dln--sm">{dateStr} {timeStr}</span></div>
            <div>Age: <span className="copd-crf-dln copd-crf-dln--sm">{visit.age ?? ''} Year(s) {visit.ageMonths ?? 0} Month(s) {visit.ageDays ?? 0} Day(s)</span></div>
            <div>Total: <span className="copd-crf-dln copd-crf-dln--sm">{fmt(total)}</span></div>
            <div>Received: <span className="copd-crf-dln copd-crf-dln--sm">{fmt(received)}</span></div>
          </div>
        </div>
        <div className="ecg-rpt-barcode">
          {barcodeDataUrl ? <img src={barcodeDataUrl} alt="barcode" /> : null}
        </div>
      </div>

      <div className="ecg-rpt-svc">
        <span>E C G</span>
        <span>{isComplementary ? 'COMPLEMENTARY' : invoiceLabel(visit.paymentType)}</span>
      </div>

      <div className="ecg-rpt-title">DEPARTMENT OF CARDIOLOGY</div>
      <div className="ecg-rpt-subtitle">E C G REPORT</div>

      <div className="ecg-rpt-history">
        <div className="ecg-rpt-history-lbl">HISTORY</div>
        <div className="ecg-rpt-history-box" />
      </div>

      <div className="ecg-rpt-cols">
        <div className="ecg-rpt-col">
          <div className="ecg-rpt-fillrow">RATE <span className="copd-crf-dashline" /></div>
          <div className="ecg-rpt-fillrow">P WAVE <span className="copd-crf-dashline" /></div>
          <div className="ecg-rpt-fillrow">QRS COMPLEX <span className="copd-crf-dashline" /></div>
          <div className="ecg-rpt-fillrow">T WAVE <span className="copd-crf-dashline" /></div>
          <div className="ecg-rpt-fillrow">U WAVE <span className="copd-crf-dashline" /></div>
        </div>
        <div className="ecg-rpt-col">
          <div className="ecg-rpt-fillrow">RHYTHM <span className="copd-crf-dashline" /></div>
          <div className="ecg-rpt-fillrow">AXIS <span className="copd-crf-dashline" /></div>
          <div className="ecg-rpt-fillrow">PR INTERVAL <span className="copd-crf-dashline" /></div>
          <div className="ecg-rpt-fillrow">Q WAVE <span className="copd-crf-dashline" /></div>
          <div className="ecg-rpt-fillrow">ST SEGMENT <span className="copd-crf-dashline" /></div>
          <div className="ecg-rpt-fillrow">QTc <span className="copd-crf-dashline" /></div>
          <div className="ecg-rpt-fillrow">QT INTERVAL <span className="copd-crf-dashline" /></div>
        </div>
      </div>

      <div className="ecg-rpt-diagnosis-lbl">DIAGNOSIS:</div>
      <div className="ecg-rpt-lines">{blankLines(9)}</div>

      <div className="ecg-rpt-diagnosis-lbl">TREATMENT:</div>
      <div className="ecg-rpt-lines">{blankLines(5)}</div>

      <div className="ecg-rpt-footer">
        <span>REPORTING PHYSICIAN <span className="copd-crf-dln copd-crf-dln--md" /></span>
        <span>REPORTING RESIDANCE <span className="copd-crf-dln copd-crf-dln--md" /></span>
      </div>
    </div>
  );
}
