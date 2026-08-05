import { RECEIPT_LOGO_DATA_URI } from './receiptLogo';
import './ClinicalRecordForm.scss';

// Shared by Consultant OPD, General OPD, Dental OPD and Emergency — each saves
// its own visit, then prints this same A4 Clinical Record Form in-page right
// after the slip. Built once here so none of those pages have to duplicate it.

// The slip prints via its own popup (unchanged, proven reliable). The Clinical
// Record Form prints in-page instead — a second popup from the same click
// gets silently blocked by Chrome, and sequencing two popups off the
// `afterprint` event turned out not to fire reliably either. In-page print
// (same technique as Admission.jsx) has neither problem: no second window,
// so nothing for a popup blocker or event timing to interfere with.
export function printClinicalRecordForm() {
  const styleId = 'copd-crf-page-size-override';
  let style = document.getElementById(styleId);
  if (!style) {
    style = document.createElement('style');
    style.id = styleId;
    document.head.appendChild(style);
  }
  style.textContent = '@page { size: A4 portrait !important; margin: 8mm !important; }';

  const cleanup = () => { style.remove(); window.removeEventListener('afterprint', cleanup); };
  window.addEventListener('afterprint', cleanup);
  setTimeout(cleanup, 5000);

  window.print();
}

function blankLines(n) {
  return Array.from({ length: n }, (_, i) => <div key={i} className="copd-crf-line" />);
}

function Check({ label }) {
  return (
    <label className="copd-crf-check">
      <span className="copd-crf-checkbox" />
      <span>{label}</span>
    </label>
  );
}

function BlankCheckLine() {
  return (
    <label className="copd-crf-check copd-crf-check--blank">
      <span className="copd-crf-checkbox" />
      <span className="copd-crf-blankfill" />
    </label>
  );
}

const LAB_LEFT = ['CBC', 'UCE', 'CRP', 'RBS', 'HbA1C', 'LFT', 'Lipid Profile', 'Vitamin D', 'Malaria Parasite-MP'];
const LAB_RIGHT = ['Urine DR', 'BUN', 'T3 , T4', 'TSH', 'Blood Group', 'HCV', 'HBsAg', 'Rapid Typhoid Test', 'Dengue NS 1 Antigen'];
const XRAY_LEFT = ['Chest X-Ray', 'Feet X-Ray', 'Knee X-Ray', 'Shoulder X-Ray'];
const XRAY_RIGHT = ['Skull X-Ray', 'Wrist / Hand X-Ray'];
const US_LEFT = ['Abdomen', 'Pelvis', 'KUB', 'FWB'];
const US_RIGHT = ['Obstetric', 'TVS'];

// ── Clinical Record Form (print-only, hidden on screen) ──────────────────────
// Exact replica of the hospital's paper "Consultant Form" (patient info,
// vitals, and checkbox-driven investigation lists on the left; symptoms,
// diagnosis and a ruled prescription pad on the right).
export function ClinicalRecordPrintTemplate({ visit, consultantName, barcodeDataUrl, formTitle }) {
  if (!visit) return null;

  const now = visit.createdAt ? new Date(visit.createdAt) : new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const fmt = (v) => Number(v || 0).toFixed(0);

  return (
    <div className="copd-crf">
      {/* Header */}
      <div className="copd-crf-hdr">
        <div className="copd-crf-hdr-brand">
          <img className="copd-crf-hdr-logo" src={RECEIPT_LOGO_DATA_URI} alt="logo" />
        </div>
        <div className="copd-crf-hdr-title">{formTitle}</div>
      </div>

      {/* Slip / consultant info row */}
      <div className="copd-crf-info">
        <div className="copd-crf-info-text">
          <div>
            SLIP NO.: <span className="copd-crf-dln">{visit.serialNo}</span>
            &nbsp;&nbsp; MR. NO.: <span className="copd-crf-dln copd-crf-dln--sm">{visit.mrNo || ''}</span>
            &nbsp;&nbsp; Date: <span className="copd-crf-dln copd-crf-dln--sm">{dateStr}</span>
          </div>
          <div>
            Consultant: <span className="copd-crf-dln">{consultantName}</span>
            &nbsp;&nbsp; Received PKR: <span className="copd-crf-dln copd-crf-dln--sm">{fmt(visit.receive)}</span> with Thanks.
          </div>
        </div>
        <div className="copd-crf-barcode">
          {barcodeDataUrl ? <img src={barcodeDataUrl} alt="barcode" /> : null}
        </div>
      </div>

      {/* Two-column body */}
      <div className="copd-crf-cols">
        {/* ── Left column ── */}
        <div className="copd-crf-col-left">
          <div className="copd-crf-box">
            <div className="copd-crf-box-hdr">PATIENT INFORMATION</div>
            <div className="copd-crf-box-body">
              <div className="copd-crf-inforow">Patient Name: <span className="copd-crf-dln copd-crf-dln--full">{visit.patientName}</span></div>
              <div className="copd-crf-inforow">
                Age: <span className="copd-crf-dln copd-crf-dln--xs">{visit.age ?? ''}</span> years
                <span className="copd-crf-dln copd-crf-dln--xs">{visit.ageMonths ?? ''}</span> months
                <span className="copd-crf-dln copd-crf-dln--xs">{visit.ageDays ?? ''}</span> days
              </div>
              <div className="copd-crf-inforow">Contact No. <span className="copd-crf-dln copd-crf-dln--full">{visit.phoneNo}</span></div>
            </div>
          </div>

          <div className="copd-crf-box">
            <div className="copd-crf-box-hdr">VITAL SIGNS</div>
            <div className="copd-crf-box-body copd-crf-vitals">
              <div>Blood Pressure <span className="copd-crf-dln copd-crf-dln--vit" /> mmHg</div>
              <div>Pulse Rate <span className="copd-crf-dln copd-crf-dln--vit" /> bpm</div>
              <div>Temperature <span className="copd-crf-dln copd-crf-dln--vit" /> °F</div>
              <div>Weight <span className="copd-crf-dln copd-crf-dln--vit" /> kg</div>
              <div>Respiratory Rate <span className="copd-crf-dln copd-crf-dln--vit" /> /min</div>
              <div>SpO<sub>2</sub> <span className="copd-crf-dln copd-crf-dln--vit" /> %</div>
            </div>
          </div>

          <div className="copd-crf-box copd-crf-box--inv">
            <div className="copd-crf-box-hdr">INVESTIGAION</div>
            <div className="copd-crf-box-body">
              <div className="copd-crf-subhdr">Laboratory Test</div>
              <div className="copd-crf-checkgrid">
                <div className="copd-crf-checkcol">{LAB_LEFT.map(l => <Check key={l} label={l} />)}</div>
                <div className="copd-crf-checkcol">{LAB_RIGHT.map(l => <Check key={l} label={l} />)}</div>
              </div>
              {Array.from({ length: 6 }, (_, i) => <BlankCheckLine key={i} />)}

              <div className="copd-crf-subhdr">X-Ray</div>
              <div className="copd-crf-checkgrid">
                <div className="copd-crf-checkcol">{XRAY_LEFT.map(l => <Check key={l} label={l} />)}</div>
                <div className="copd-crf-checkcol">
                  {XRAY_RIGHT.map(l => <Check key={l} label={l} />)}
                  <BlankCheckLine />
                  <BlankCheckLine />
                </div>
              </div>

              <div className="copd-crf-subhdr">Ultrasound</div>
              <div className="copd-crf-checkgrid">
                <div className="copd-crf-checkcol">{US_LEFT.map(l => <Check key={l} label={l} />)}</div>
                <div className="copd-crf-checkcol">
                  {US_RIGHT.map(l => <Check key={l} label={l} />)}
                  <BlankCheckLine />
                  <BlankCheckLine />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right column ── */}
        <div className="copd-crf-col-right">
          <div className="copd-crf-box">
            <div className="copd-crf-box-hdr">SYMPTOMS &amp; DIAGNISIS</div>
            <div className="copd-crf-box-body">
              <div className="copd-crf-fillrow">Symptoms <span className="copd-crf-dashline" /></div>
              <div className="copd-crf-fillrow">Diagnosis <span className="copd-crf-dashline" /></div>
            </div>
          </div>

          <div className="copd-crf-box copd-crf-box--rx">
            <div className="copd-crf-box-hdr">PRESCRIPTION &amp; NOTES</div>
            <div className="copd-crf-box-body copd-crf-rx-body">
              <div className="copd-crf-rx-symbol">℞</div>
              {blankLines(26)}
            </div>
          </div>
        </div>
      </div>

      <div className="copd-crf-footer">
        <span>Flow up Date: <span className="copd-crf-dln copd-crf-dln--md" /></span>
        <span>Consultant Sign: <span className="copd-crf-dln copd-crf-dln--md" /></span>
      </div>
    </div>
  );
}
