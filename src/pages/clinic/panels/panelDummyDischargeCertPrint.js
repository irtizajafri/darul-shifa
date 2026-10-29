import { buildDischargeCertificatePrintHtml } from '../dischargeCertificatePrintUtils';
import { openPrintWindow } from '../../../utils/printRelay';

// Panels > Billing > Discharge Certificate (dummy, print-only) — the print
// and the saved details, shared by Billing and Reprint Panel Bill/Form.
const API = 'http://localhost:5001/api/clinic';
const STATUS_LABEL = { active: 'Admit', discharge: 'Discharge', closed: 'Closed' };

// Typed details → the panel Discharge Certificate print.
export function printPanelDummyDischargeCert(values, admissionNo, printedBy, w = openPrintWindow('width=700,height=900')) {
  const html = buildDischargeCertificatePrintHtml({
    admission: {
      admissionNo,
      status: STATUS_LABEL[values.status] || values.status || '',
      patientTitle: '',
      patientName: values.patientName,
      patientCategory: 'panel',
      relationType: values.relationType,
      relationName: values.relationName,
      gender: values.gender,
      ageYears: Number(values.ageYears) || 0,
      ageMonths: Number(values.ageMonths) || 0,
      ageDays: Number(values.ageDays) || 0,
      createdAt: values.admitDate ? `${values.admitDate}T12:00:00` : null,
    },
    roomCategory: { name: values.room || '—' },
    bed: { name: values.bed || '—' },
    consultant: { name: values.consultant || '—' },
    certificate: {
      dischargeDate: values.dischargeDate ? `${values.dischargeDate}T12:00:00` : null,
      diagnosis: values.diagnosis,
      followUp: values.followUp,
      medicalOfficer: values.medicalOfficer,
    },
    printedBy,
  });
  w.document.write(html);
  w.document.close();
}

export async function fetchPanelDummyDischargeCert(admissionNo) {
  const res = await fetch(`${API}/admission/panel-dummy-discharge-cert/${encodeURIComponent(admissionNo)}`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || 'Load nahi hua');
  return json.data;
}

