import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { Search } from 'lucide-react';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import './DeathCertificatePage.scss';

const API = 'http://localhost:5001/api/clinic';

const RELATION_TYPES = ['S/o', 'D/o', 'W/o'];

const EMPTY_MANUAL = {
  deathTime: '', deathPlace: 'Darul Shifa Imam Khomeini (q.s.)',
  relationType: 'S/o', relationName: '',
  religion: '', occupation: '', causeOfDeath: '',
  medicalOfficerId: '', drAddress: 'Darul Shifa Imam Khomeini (q.s.)',
};

// ISO datetime (server) -> "YYYY-MM-DDTHH:mm" for <input type="datetime-local">
function toLocalDatetimeInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function DeathCertificatePage() {
  const [admissionNo, setAdmissionNo] = useState('');
  const [looking, setLooking] = useState(false);
  const [admission, setAdmission] = useState(null); // snapshot from ClinicAdmission
  const [gender, setGender] = useState('male');
  const [ageYears, setAgeYears] = useState('');
  const [ageMonths, setAgeMonths] = useState('0');
  const [ageDays, setAgeDays] = useState('0');
  const [manual, setManual] = useState(EMPTY_MANUAL);
  const [existingCertificateId, setExistingCertificateId] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [saving, setSaving] = useState(false);

  // Searchable Admission # combobox
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchingList, setSearchingList] = useState(false);
  const debounceRef = useRef(null);
  const boxRef = useRef(null);

  useEffect(() => {
    fetch(`${API}/doctors`).then((r) => r.json()).then((j) => setDoctors(j.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    function onClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setShowSuggestions(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function onAdmissionNoChange(v) {
    setAdmissionNo(v);
    setShowSuggestions(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearchingList(true);
      try {
        const res = await fetch(`${API}/admission/search?q=${encodeURIComponent(v.trim())}`);
        const json = await res.json();
        setSuggestions(json.data || []);
      } catch {
        setSuggestions([]);
      } finally {
        setSearchingList(false);
      }
    }, 250);
  }

  async function lookup(overrideNo) {
    const no = (overrideNo ?? admissionNo).trim();
    if (!no) return toast.error('Admission # daalo');
    setLooking(true);
    setShowSuggestions(false);
    try {
      const res = await fetch(`${API}/admission/lookup/${encodeURIComponent(no)}`);
      const json = await res.json();
      if (!res.ok) { toast.error(json.message || 'Admission nahi mili'); setAdmission(null); return; }
      const d = json.data;
      setAdmissionNo(no);
      setAdmission(d);
      setGender(d.gender || 'male');
      setAgeYears(String(d.ageYears ?? ''));
      setAgeMonths(String(d.ageMonths ?? '0'));
      setAgeDays(String(d.ageDays ?? '0'));

      if (d.source === 'certificate' && d.existingCertificateId) {
        // A certificate already exists for this admission (manual entry earlier, or
        // bulk-imported from the report's Excel) — auto-fill EVERYTHING, and Save
        // will UPDATE this record instead of creating a duplicate.
        setExistingCertificateId(d.existingCertificateId);
        setManual({
          deathTime: toLocalDatetimeInput(d.deathTime),
          deathPlace: d.deathPlace || '',
          relationType: d.relationType || 'S/o',
          relationName: d.relationName || '',
          religion: d.religion || '',
          occupation: d.occupation || '',
          causeOfDeath: d.causeOfDeath || '',
          medicalOfficerId: d.medicalOfficerId ? String(d.medicalOfficerId) : '',
          drAddress: d.drAddress || '',
        });
        toast('Is admission ka certificate pehle se mojood hai — edit karke Update karo', { icon: 'ℹ️' });
      } else {
        setExistingCertificateId(null);
        setManual(EMPTY_MANUAL);
      }
    } catch {
      toast.error('Lookup failed');
    } finally {
      setLooking(false);
    }
  }

  function resetToSearch() {
    setAdmissionNo('');
    setAdmission(null);
    setManual(EMPTY_MANUAL);
    setExistingCertificateId(null);
    setSuggestions([]);
    setShowSuggestions(false);
  }

  async function handleAdd() {
    if (!admission) return;
    if (!manual.causeOfDeath.trim()) return toast.error('Cause of Death daalo');
    setSaving(true);
    try {
      const payload = {
        admissionId: admission.admissionId,
        admissionNo: admission.admissionNo,
        arrivedSlipNo: admission.arrivedSlipNo,
        patientName: admission.patientName,
        ageYears: Number(ageYears) || 0,
        ageMonths: Number(ageMonths) || 0,
        ageDays: Number(ageDays) || 0,
        gender,
        deathTime: manual.deathTime || null,
        deathPlace: manual.deathPlace,
        relationType: manual.relationType,
        relationName: manual.relationName,
        religion: manual.religion,
        occupation: manual.occupation,
        causeOfDeath: manual.causeOfDeath,
        medicalOfficerId: manual.medicalOfficerId || null,
        drAddress: manual.drAddress,
      };
      const url = existingCertificateId ? `${API}/death-certificates/${existingCertificateId}` : `${API}/death-certificates`;
      const res = await fetch(url, {
        method: existingCertificateId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      toast.success(existingCertificateId ? 'Death Certificate updated' : 'Death Certificate saved');
      resetToSearch();
    } catch (err) {
      toast.error(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const set = (k, v) => setManual((m) => ({ ...m, [k]: v }));

  return (
    <div className="dc-page">
      <ClinicMenuBar />

      <div className="dc-body">
        <div className="dc-window">
          <div className="dc-titlebar">
            <span>Parameter — Death Certificate</span>
            <span className="dc-title-right">Death Certificate</span>
          </div>

          {/* ── Admission # search row (always visible, searchable dropdown) ── */}
          <div className="dc-search-row">
            <label>Admission #</label>
            <div className="dc-lookup" ref={boxRef}>
              <input
                value={admissionNo}
                onChange={(e) => onAdmissionNoChange(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={(e) => e.key === 'Enter' && lookup()}
                placeholder="Admit # ya patient naam type karo…"
                autoComplete="off"
              />
              <button onClick={() => lookup()} disabled={looking}><Search size={14} /></button>

              {showSuggestions && admissionNo.trim() && (
                <div className="dc-suggest">
                  {searchingList ? (
                    <div className="dc-suggest-empty">Search ho raha hai…</div>
                  ) : suggestions.length === 0 ? (
                    <div className="dc-suggest-empty">Koi match nahi mila</div>
                  ) : (
                    suggestions.map((s) => (
                      <div key={`${s.source}-${s.admissionNo}`} className="dc-suggest-item" onClick={() => lookup(s.admissionNo)}>
                        <span className="dc-suggest-no">{s.admissionNo}</span>
                        <span className="dc-suggest-name">{s.patientName}</span>
                        <span className={`dc-suggest-badge dc-suggest-badge--${s.source}`}>
                          {s.source === 'certificate' ? 'Certificate on file' : s.source === 'admission' ? 'Admission' : 'Patient List'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            {admission && (
              <span className="dc-slip">{admission.arrivedSlipNo ? `${admission.arrivedSlipNo}/` : ''}{admission.admissionNo}</span>
            )}
            <label className="dc-admission-chk">
              <input type="checkbox" checked readOnly /> Admission
            </label>
          </div>

          {/* ── Full form (only after a successful lookup) ── */}
          {admission && (
            <div className="dc-form">
              <div className="dc-row">
                <div className="dc-fg">
                  <label>Death Time</label>
                  <input type="datetime-local" value={manual.deathTime} onChange={(e) => set('deathTime', e.target.value)} />
                </div>
                <div className="dc-fg">
                  <label>Gender</label>
                  <div className="dc-radio-group">
                    <label><input type="radio" checked={gender === 'male'} onChange={() => setGender('male')} /> Male</label>
                    <label><input type="radio" checked={gender === 'female'} onChange={() => setGender('female')} /> Female</label>
                  </div>
                </div>
              </div>

              <div className="dc-row">
                <div className="dc-fg dc-fg--wide">
                  <label>Death Place</label>
                  <input value={manual.deathPlace} onChange={(e) => set('deathPlace', e.target.value)} />
                </div>
              </div>

              <div className="dc-row">
                <div className="dc-fg dc-fg--wide">
                  <label>Patient Name</label>
                  <input value={admission.patientName} readOnly className="dc-readonly" />
                </div>
              </div>

              <div className="dc-row">
                <div className="dc-fg">
                  <label>Relation</label>
                  <div className="dc-relation">
                    <select value={manual.relationType} onChange={(e) => set('relationType', e.target.value)}>
                      {RELATION_TYPES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <input value={manual.relationName} onChange={(e) => set('relationName', e.target.value)} placeholder="Father / Husband naam" />
                  </div>
                </div>
              </div>

              <div className="dc-row">
                <div className="dc-fg">
                  <label>Age</label>
                  <div className="dc-age-row">
                    <input value={ageYears} onChange={(e) => setAgeYears(e.target.value)} placeholder="Yrs" />
                    <span>Y</span>
                    <select value={ageMonths} onChange={(e) => setAgeMonths(e.target.value)}>
                      {Array.from({ length: 12 }, (_, i) => <option key={i} value={i}>{i}</option>)}
                    </select>
                    <span>M</span>
                    <select value={ageDays} onChange={(e) => setAgeDays(e.target.value)}>
                      {Array.from({ length: 31 }, (_, i) => <option key={i} value={i}>{i}</option>)}
                    </select>
                    <span>D</span>
                  </div>
                </div>
              </div>

              <div className="dc-row">
                <div className="dc-fg">
                  <label>Religion</label>
                  <input value={manual.religion} onChange={(e) => set('religion', e.target.value)} placeholder="e.g. MUSLIM" />
                </div>
              </div>

              <div className="dc-row">
                <div className="dc-fg dc-fg--wide">
                  <label>Occupation</label>
                  <input value={manual.occupation} onChange={(e) => set('occupation', e.target.value)} />
                </div>
              </div>

              <div className="dc-row">
                <div className="dc-fg dc-fg--wide">
                  <label>Cause of Death</label>
                  <textarea value={manual.causeOfDeath} onChange={(e) => set('causeOfDeath', e.target.value)} rows={2} />
                </div>
              </div>

              <div className="dc-row">
                <div className="dc-fg dc-fg--wide">
                  <label>Medical Officer</label>
                  <select value={manual.medicalOfficerId} onChange={(e) => set('medicalOfficerId', e.target.value)}>
                    <option value="">— Select —</option>
                    {doctors.map((d) => <option key={d.id} value={d.id}>{d.code} - {d.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="dc-row">
                <div className="dc-fg dc-fg--wide">
                  <label>Dr.'s Address</label>
                  <input value={manual.drAddress} onChange={(e) => set('drAddress', e.target.value)} />
                </div>
              </div>

              <div className="dc-actions">
                <button className="dc-btn dc-btn--cancel" onClick={resetToSearch}>Cancel</button>
                <button className="dc-btn dc-btn--add" onClick={handleAdd} disabled={saving}>
                  {saving ? 'Saving…' : existingCertificateId ? 'Update' : 'Add'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
