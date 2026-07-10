import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import './ConsultantRates.scss';

const API = 'http://localhost:5001/api/clinic';

export default function ConsultantRates() {
  const [consultants, setConsultants] = useState([]);
  const [rates,       setRates]       = useState({});
  const [saving,      setSaving]      = useState({});
  const [loading,     setLoading]     = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cRes, rRes] = await Promise.all([
        fetch(`${API}/patient-visits/consultants`).then(r => r.json()),
        fetch(`${API}/consultant-rates`).then(r => r.json()),
      ]);
      const names     = cRes.data || [];
      const ratesList = rRes.data || [];
      const rateMap   = {};
      ratesList.forEach(r => { rateMap[r.consultantName] = r.rate; });
      setConsultants(names);
      const init = {};
      names.forEach(n => { init[n] = rateMap[n] !== undefined ? String(rateMap[n]) : ''; });
      setRates(init);
    } catch { toast.error('Load failed'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const handleSaveOne = async (name) => {
    const rate = rates[name];
    if (rate === '' || rate === undefined) { toast.error('Rate daalo pehle'); return; }
    setSaving(s => ({ ...s, [name]: true }));
    try {
      const res  = await fetch(`${API}/consultant-rates`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ consultantName: name, rate: Number(rate) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      toast.success(`${name} — Rate saved`);
    } catch (err) { toast.error(err.message || 'Save failed'); }
    finally { setSaving(s => ({ ...s, [name]: false })); }
  };

  const handleSaveAll = async () => {
    const entries = consultants.filter(n => rates[n] !== '' && rates[n] !== undefined);
    if (!entries.length) { toast.error('Koi rate nahi dala'); return; }
    setSaving({ __all: true });
    try {
      await Promise.all(entries.map(name =>
        fetch(`${API}/consultant-rates`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ consultantName: name, rate: Number(rates[name]) }),
        })
      ));
      toast.success(`${entries.length} rates saved`);
    } catch { toast.error('Save failed'); }
    finally { setSaving({}); }
  };

  return (
    <div className="crate-page">
      <ClinicMenuBar />

      <div className="crate-body">
        <div className="crate-header-bar">
          <span className="crate-title">Consultant Rates</span>
          <button className="crate-btn crate-btn--save-all" onClick={handleSaveAll} disabled={!!saving.__all}>
            {saving.__all ? 'Saving...' : 'Save All'}
          </button>
        </div>

        {loading ? (
          <div className="crate-loading">Loading consultants...</div>
        ) : (
          <div className="crate-table-wrap">
            <table className="crate-table">
              <thead>
                <tr>
                  <th className="crate-col-sno">#</th>
                  <th>Consultant Name</th>
                  <th className="crate-col-rate">Rate %</th>
                  <th className="crate-col-action">Action</th>
                </tr>
              </thead>
              <tbody>
                {consultants.map((name, i) => (
                  <tr key={name} className={i % 2 === 1 ? 'crate-row-even' : ''}>
                    <td>{i + 1}</td>
                    <td className="crate-td-name">{name}</td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        className="crate-rate-input"
                        value={rates[name] ?? ''}
                        onChange={e => setRates(r => ({ ...r, [name]: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && handleSaveOne(name)}
                        placeholder="0"
                      />
                      <span className="crate-pct">%</span>
                    </td>
                    <td>
                      <button
                        className="crate-btn crate-btn--save"
                        onClick={() => handleSaveOne(name)}
                        disabled={saving[name] || !!saving.__all}
                      >
                        {saving[name] ? '...' : 'Save'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
