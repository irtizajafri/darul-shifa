// Report > Reprint — print-only builders for every document type.
//
// Each builder fetches the saved record itself and returns the print HTML,
// reproducing exactly what the document's own working screen used to print
// on its `?autoprint=1` / `?reprintNo=` path (same API calls, same builder,
// same arguments, same DUPLICATE marking) — so Reprint never has to open an
// editable screen just to print. The screens' own autoprint support is left
// in place for anything else that still links to it.
//
// Builders throw an Error with a user-facing message when there's nothing
// to print; the caller closes its already-opened popup and toasts it.
import JsBarcode from 'jsbarcode';
import { useClinicStore } from '../../../store/useClinicStore';
import { buildAdmissionFormPrintHtml } from '../admissionFormPrintUtils';
import { buildProvisionalBillPrintHtml } from '../provisionalBillPrintUtils';
import { buildDischargeCertificatePrintHtml } from '../dischargeCertificatePrintUtils';
import { buildBirthCertificatePrintHtml } from '../birthCertificatePrintUtils';
import { buildDeathCertificatePrintHtml } from '../deathCertificatePrintUtils';
import { buildDischargeBillPrintHtml } from '../dischargeBillPrintUtils';
import { buildAntenatalReceiptHtml, buildAntenatalCardHtml } from '../antenatalReceiptUtils';

const API = 'http://localhost:5001/api/clinic';

// Popup size each screen used for its own print window.
export const REPRINT_POPUP_FEATURES = {
  admission:   'width=900,height=1000',
  provisional: 'width=700,height=900',
  discharge:   'width=700,height=900',
  birth:       'width=700,height=900',
  death:       'width=700,height=900',
  final:       'width=900,height=1000',
  antenatal:   'width=420,height=680,left=60,top=60',
};

// GET → json.data, throwing the backend's message (or `fallbackMsg`) on failure.
async function getData(path, fallbackMsg) {
  const res = await fetch(`${API}${path}`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || fallbackMsg);
  return json.data;
}

const store = () => useClinicStore.getState();

// Same admission-picking rule as ProvisionalBill/DischargeRefund's reprint:
// exact Admission # match, else the first search hit (status-agnostic search,
// so a closed file still resolves).
async function findAdmissionId(no) {
  const rows = await store().searchAdmissionsForProvisionalBill(no);
  const match = (rows || []).find(r => r.admissionNo === no) || (rows || [])[0];
  if (!match) throw new Error('Is Admission # ka koi record nahi mila');
  return match.id;
}

// ── Admission Form (Admission.jsx `reprintNo` effect) ──────────────────────
async function admission(no) {
  const rec = await getData(`/admission/by-number/${encodeURIComponent(no)}`, 'Admission nahi mili');
  // Exactly the fields Admission.jsx loads into its form for a reprint.
  const form = {
    serialNo:          rec.serialNo || '',
    admissionNo:       rec.admissionNo || '',
    mrNo:              rec.mrNo != null ? String(rec.mrNo) : '',
    arrivedSlipNo:     rec.arrivedSlipNo || '',
    patientTitle:      rec.patientTitle || 'Mr',
    patientCategory:   rec.patientCategory || 'private',
    patientName:       rec.patientName || '',
    relationType:      rec.relationType || 'W/o',
    relationName:      rec.relationName || '',
    ageYears:          rec.ageYears != null ? String(rec.ageYears) : '',
    ageMonths:         rec.ageMonths != null ? String(rec.ageMonths) : '',
    ageDays:           rec.ageDays != null ? String(rec.ageDays) : '',
    gender:            rec.gender || 'male',
    address:           rec.address || '',
    phoneNo:           rec.phoneNo || '',
    arrivedUnderRmo:   rec.arrivedUnderRmo || '',
    consultantId:      rec.consultantId != null ? String(rec.consultantId) : '',
    referredBy:        rec.referredBy || '',
    authorityLetter:   !!rec.authorityLetter,
    responsibleParty:  rec.responsibleParty || '',
    previousAdmission: rec.previousAdmission || '',
    advancePayment:    rec.advancePayment != null ? String(rec.advancePayment) : '',
    roomCategoryId:    rec.roomCategoryId != null ? String(rec.roomCategoryId) : '',
    bedId:             rec.bedId != null ? String(rec.bedId) : '',
    surgery:           !!rec.surgery,
    surgeryTypeId:     rec.surgeryTypeId != null ? String(rec.surgeryTypeId) : '',
    referralPatient:   rec.referralPatient ? 'yes' : 'no',
    referralNote:      rec.referralNote || '',
    antenatal:         !!rec.antenatal,
    antenatalNo:       rec.antenatalNo || '',
  };

  const [doctors, roomCategories, availableBeds, record] = await Promise.all([
    getData('/doctors', 'Failed to load doctors').catch(() => []),
    getData('/room-categories', 'Failed to load room categories').catch(() => []),
    rec.roomCategoryId ? store().fetchAvailableBeds(rec.roomCategoryId).catch(() => []) : [],
    getData(`/admission/form-print/by-number/${encodeURIComponent(no)}`, '').catch(() => null),
  ]);

  // Admission # zero-padded to 8 digits, Code 39 — same as Admission.jsx.
  let barcodeDataUrl = '';
  if (form.admissionNo.trim()) {
    try {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, form.admissionNo.trim().padStart(8, '0'), { format: 'CODE39', width: 1.5, height: 32, displayValue: true, fontSize: 10, margin: 2 });
      barcodeDataUrl = canvas.toDataURL('image/png');
    } catch { barcodeDataUrl = ''; }
  }

  return {
    html: buildAdmissionFormPrintHtml({
      form, doctors: doctors || [], roomCategories: roomCategories || [], availableBeds: availableBeds || [],
      isDuplicate: true, barcodeDataUrl, record: record || {},
    }),
  };
}

// ── Provisional Bill (ProvisionalBill.jsx autoprint) ───────────────────────
// category 'cash' (Clinic → Reprint) / 'panel' (Panels → Reprint Panel
// Bill/Form) — a file of the other kind is refused, same as the screens.
async function provisional(no, printedBy, { category } = {}) {
  const id = await findAdmissionId(no);
  const detail = await store().fetchProvisionalBillDetail(id);
  if (category) {
    const isPanelFile = detail.admission.patientCategory === 'panel';
    if (isPanelFile && category === 'cash') throw new Error('Yeh panel file hai — Panels → Reports → Reprint Panel Bill/Form se nikalein');
    if (!isPanelFile && category === 'panel') throw new Error('Yeh panel file nahi');
  }
  return { html: buildProvisionalBillPrintHtml({ detail, isDuplicate: true, printedBy }) };
}

// ── Discharge Certificate (DiscountRefundAdmission.jsx autoprint) ──────────
async function discharge(no, printedBy) {
  const data = await getData(`/admission/discount-refund/by-number/${encodeURIComponent(no)}`, 'Load failed');
  const certData = await getData(`/admission/discharge-certificate/${data.admission.id}`, 'Load failed');
  const { certificate, ...header } = certData;
  if (!certificate) throw new Error('Is admission ka Discharge Certificate abhi tak nahi bana — pehle bana lein');
  return { html: buildDischargeCertificatePrintHtml({ ...header, certificate, printedBy }) };
}

// ── Birth Certificate (BirthCertificate.jsx autoprint) ─────────────────────
async function birth(no) {
  const data = await getData(`/admission/birth-certificate/by-number/${encodeURIComponent(no)}?sequenceNo=1`, 'Load failed');
  const bc = data.birthCertificate;
  if (!bc) throw new Error('Is admission ke liye Birth Certificate abhi tak save nahi hui — pehle save karein');
  return { html: buildBirthCertificatePrintHtml({ certificate: bc }) };
}

// ── Death Certificate (DeathCertificatePage.jsx autoprint) ─────────────────
async function death(no) {
  const [doctorList, res] = await Promise.all([
    getData('/doctors?minimal=true', '').catch(() => []),
    fetch(`${API}/admission/lookup/${encodeURIComponent(no)}?allSlips=1`),
  ]);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.data?.source !== 'certificate') {
    throw new Error('Is admission/slip ke liye Death Certificate abhi tak save nahi hui');
  }
  const d = json.data;
  const doctorName = d.medicalOfficerId
    ? ((doctorList || []).find((x) => String(x.id) === String(d.medicalOfficerId)) || {}).name
    : '';
  return { html: buildDeathCertificatePrintHtml({ certificate: d, doctorName }) };
}

// ── Final Bill (DischargeRefund.jsx autoprint) ─────────────────────────────
// NOTE: the discharge-bill detail GET imports the Provisional Bill data into
// the Final Bill the first time it's opened for an admission (backend
// getDischargeBillDetail) — same as opening it on the Final Bill screen.
async function final(no, printedBy) {
  const id = await findAdmissionId(no);
  const detail = await store().fetchDischargeBillDetail(id);
  // DischargeRefund prints the "live" figures, which on a fresh reprint load
  // are just the saved discount / other-income state of the file.
  const discount = Number(detail.discountAmount || 0) || 0;
  const otherIncome = (detail.otherIncomeAmount || 0) > 0;
  const isPanel = detail.admission.patientCategory === 'panel';
  const netAmount = Math.max(0, detail.billAmount - discount);
  const outstanding = Math.max(0, netAmount - detail.amountReceived);
  const liveOtherIncome = isPanel && otherIncome ? outstanding : 0;
  const liveBalance = outstanding - liveOtherIncome;
  const liveRefund = Math.max(0, detail.amountReceived - netAmount);
  const liveDetail = { ...detail, discountAmount: discount, otherIncomeAmount: liveOtherIncome, balance: liveBalance, refund: liveRefund };
  return { html: buildDischargeBillPrintHtml({ detail: liveDetail, isDuplicate: true, printedBy }) };
}

// ── Antenatal (Antenatal.jsx autoprint) — receipt + Antenatal Card ─────────
async function antenatal(no, printedBy) {
  const record = await store().fetchAntenatalByNo(no);
  if (!record) throw new Error('Is Antenatal # ka koi record nahi mila');
  const doctors = await getData('/doctors', 'Failed to load doctors').catch(() => []);
  const doctor = (doctors || []).find(d => String(d.id) === String(record.underTreatmentId));
  const canvas = document.createElement('canvas');
  JsBarcode(canvas, record.serialNo || '', { format: 'CODE128', width: 2, height: 48, displayValue: true, fontSize: 11, margin: 4 });
  const barcodeDataUrl = canvas.toDataURL('image/png');
  return {
    html: buildAntenatalReceiptHtml({ antenatal: record, doctor, isDuplicate: true, barcodeDataUrl, printedBy }),
    // Slip 2 — printed in the same window after the receipt
    // (ReprintFilter → buildSequentialPrintHtml), same as Antenatal's Save flow.
    extraHtml: buildAntenatalCardHtml({ antenatal: record, doctor, barcodeDataUrl }),
  };
}

const BUILDERS = { admission, provisional, discharge, birth, death, final, antenatal };

// → { html, extraHtml? }
export function buildReprint(docType, no, printedBy, opts) {
  const fn = BUILDERS[docType];
  if (!fn) return Promise.reject(new Error('Unknown document type'));
  return fn(no, printedBy, opts);
}
