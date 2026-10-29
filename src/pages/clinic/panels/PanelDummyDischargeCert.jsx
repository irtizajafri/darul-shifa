import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';
import { openPrintWindow } from '../../../utils/printRelay';
import { printPanelDummyDischargeCert, fetchPanelDummyDischargeCert } from './panelDummyDischargeCertPrint';
import useModalKeys from '../../../hooks/useModalKeys';

const API = 'http://localhost:5001/api/clinic';
const RELATIONS = ['S/o', 'D/o', 'W/o', 'H/o', 'F/o', 'M/o', 'Self'];

// Panels > Billing > Discharge Certificate (owner, 2026-10-29): a dummy,
// print-only certificate in the panel format. Its details are typed here,
// printed, and saved for reprint — the real Discharge Certificate is never
// read or touched.

export default function PanelDummyDischargeCertModal({ admissionNo, printedBy, onClose }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState(null);
  const [savedInfo, setSavedInfo] = useState(null);
  useModalKeys({ active: true, onEsc: onClose });

  useEffect(() => {
    let alive = true;
    fetchPanelDummyDischargeCert(admissionNo)
      .then((d) => {
        if (!alive) return;
        // Reprint: the last printed details; first time: from the file.
        setValues({ ...d.defaults, ...(d.saved || {}) });
        setSavedInfo(d.saved ? { at: d.saved.savedAt, by: d.saved.savedBy } : null);
      })
      .catch((e) => { toast.error(e.message); onClose(); })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [admissionNo, onClose]);

  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));

  async function handleSavePrint() {
    if (!values.patientName?.trim()) { toast.error('Patient Name likhein'); return; }
    // Opened on the click, before the save, so the popup isn't blocked.
    const w = openPrintWindow('width=700,height=900');
    setSaving(true);
    try {
      const res = await fetch(`${API}/admission/panel-dummy-discharge-cert/${encodeURIComponent(admissionNo)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, userName: printedBy }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || 'Save nahi hua');
      printPanelDummyDischargeCert(values, admissionNo, printedBy, w);
      toast.success('Discharge Certificate save ho gaya');
      onClose();
    } catch (e) {
      if (!w.filled) w.close();
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  const field = (label, k, props = {}) => (
    <label className="pdc-field">
      <span>{label}</span>
      <input value={values[k] ?? ''} onChange={set(k)} {...props} />
    </label>
  );

  return (
    <div className="pnb-modal-overlay" onMouseDown={onClose}>
      <div className="pnb-modal pdc-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="pnb-modal-head">
          <span>Discharge Certificate — Admission # {admissionNo}</span>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <div className="pnb-modal-body">
          {loading || !values ? (
            <div className="pdc-loading">Loading…</div>
          ) : (
            <>
              <p className="pdc-note">
                Sirf print ke liye — asal Discharge Certificate se iska koi taluq nahi.
                {savedInfo && <> Pichhli dafa {new Date(savedInfo.at).toLocaleString('en-GB')}{savedInfo.by ? ` (${savedInfo.by})` : ''} save hua tha.</>}
              </p>
              <div className="pdc-grid">
                <label className="pdc-field">
                  <span>Status</span>
                  <select value={values.status || ''} onChange={set('status')}>
                    <option value="active">Admit</option>
                    <option value="discharge">Discharge</option>
                    <option value="closed">Closed</option>
                  </select>
                </label>
                {field('Patient Name', 'patientName')}
                <label className="pdc-field">
                  <span>Relation</span>
                  <div className="pdc-inline">
                    <select value={values.relationType || ''} onChange={set('relationType')}>
                      <option value="">—</option>
                      {RELATIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <input value={values.relationName ?? ''} onChange={set('relationName')} placeholder="Name" />
                  </div>
                </label>
                <label className="pdc-field">
                  <span>Age (Y / M / D)</span>
                  <div className="pdc-inline">
                    <input type="number" min="0" value={values.ageYears ?? ''} onChange={set('ageYears')} />
                    <input type="number" min="0" value={values.ageMonths ?? ''} onChange={set('ageMonths')} />
                    <input type="number" min="0" value={values.ageDays ?? ''} onChange={set('ageDays')} />
                  </div>
                </label>
                <label className="pdc-field">
                  <span>Gender</span>
                  <select value={values.gender || 'male'} onChange={set('gender')}>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </label>
                {field('Room', 'room')}
                {field('Bed', 'bed')}
                {field('Consultant', 'consultant')}
                {field('Admit Date', 'admitDate', { type: 'date' })}
                {field('Discharge Date', 'dischargeDate', { type: 'date' })}
                <label className="pdc-field pdc-field--wide">
                  <span>Diagnosis</span>
                  <textarea rows={2} value={values.diagnosis ?? ''} onChange={set('diagnosis')} />
                </label>
                {field('Follow Up', 'followUp')}
                {field('Medical Officer', 'medicalOfficer')}
              </div>
            </>
          )}
        </div>
        <div className="pnb-pkg-footer">
          <button className="pnb-btn" onClick={onClose}>Close</button>
          <button className="pnb-add-btn" onClick={handleSavePrint} disabled={loading || saving} style={{ marginLeft: 'auto' }}>
            {saving ? 'Saving…' : 'Save & Print'}
          </button>
        </div>
      </div>
    </div>
  );
}
