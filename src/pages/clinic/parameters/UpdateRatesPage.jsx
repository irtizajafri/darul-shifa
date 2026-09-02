import { useEffect, useMemo, useState } from 'react';
import { Search, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import PageHeader from '../../../components/shared/PageHeader';
import { useClinicStore } from '../../../store/useClinicStore';
import './UpdateRatesPage.scss';

const TABS = [
  { key: 'subdept',    label: 'Sub Department Rates' },
  { key: 'ward',       label: 'Ward Rates' },
  { key: 'consultant', label: 'Consultant Rates' },
  { key: 'rmo',        label: 'RMO Rates' },
];

// Clinic > Panels > Parameter > Update Rates — a dedicated quick-access rate card for
// one Panel Company: Sub Department rates (Panel → Department → Sub
// Department → Rate, already existed inside the Panel Company edit screen),
// Ward rates (Panel → Room Category → Rate — that screen only ever had an
// enabled checkbox, never a rate), and per-Doctor Consultant/RMO rates
// (brand new — which tab a doctor shows up under is driven purely by that
// doctor's own Staff Category, set in Clinic > Parameters > Doctor).
export default function UpdateRatesPage() {
  const { panelCompanies, fetchPanelCompanies, fetchPanelRateCard, savePanelRateCard } = useClinicStore();

  const [panelCompanyId, setPanelCompanyId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('subdept');
  const [subDeptRows, setSubDeptRows] = useState([]);
  const [wardRows, setWardRows] = useState([]);
  const [consultantRows, setConsultantRows] = useState([]);
  const [rmoRows, setRmoRows] = useState([]);
  const [query, setQuery] = useState('');

  useEffect(() => { fetchPanelCompanies(); }, [fetchPanelCompanies]);

  useEffect(() => {
    setQuery('');
    if (!panelCompanyId) {
      setSubDeptRows([]); setWardRows([]); setConsultantRows([]); setRmoRows([]);
      return;
    }
    setLoading(true);
    fetchPanelRateCard(panelCompanyId)
      .then((data) => {
        setSubDeptRows(data.subDeptRows);
        setWardRows(data.wardRows);
        setConsultantRows(data.consultantRows);
        setRmoRows(data.rmoRows);
      })
      .catch((e) => toast.error(e.message || 'Rate card load nahi hui'))
      .finally(() => setLoading(false));
  }, [panelCompanyId, fetchPanelRateCard]);

  function updateRow(setRows, keyField, keyValue, patch) {
    setRows((rows) => rows.map((r) => (r[keyField] === keyValue ? { ...r, ...patch } : r)));
  }

  const q = query.trim().toLowerCase();
  const filteredSubDept = useMemo(
    () => subDeptRows.filter((r) => !q || r.deptName.toLowerCase().includes(q) || r.subDeptName.toLowerCase().includes(q)),
    [subDeptRows, q]
  );
  const filteredWard = useMemo(
    () => wardRows.filter((r) => !q || r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q)),
    [wardRows, q]
  );
  const filteredConsultant = useMemo(
    () => consultantRows.filter((r) => !q || r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q)),
    [consultantRows, q]
  );
  const filteredRmo = useMemo(
    () => rmoRows.filter((r) => !q || r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q)),
    [rmoRows, q]
  );

  async function handleSave() {
    if (!panelCompanyId) return toast.error('Pehle Panel select karo');
    setSaving(true);
    try {
      await savePanelRateCard(panelCompanyId, {
        subDeptRates: subDeptRows.map((r) => ({ subDeptId: r.subDeptId, enabled: r.enabled, rate: Number(r.rate) || 0, status: r.status })),
        wardRates: wardRows.map((r) => ({ roomCategoryId: r.roomCategoryId, enabled: r.enabled, rate: Number(r.rate) || 0 })),
        doctorRates: [...consultantRows, ...rmoRows].map((r) => ({ doctorId: r.doctorId, enabled: r.enabled, rate: Number(r.rate) || 0, status: r.status })),
      });
      toast.success('Rates update ho gayin');
    } catch (e) {
      toast.error(e.message || 'Save nahi hua');
    } finally {
      setSaving(false);
    }
  }

  const selectedCompany = panelCompanies.find((c) => String(c.id) === String(panelCompanyId));

  return (
    <div className="upr-page">
      <ClinicMenuBar />

      <div className="upr-body">
        <PageHeader
          breadcrumbs={[
            { label: 'Clinic', link: '/clinic-module' },
            { label: 'Panels' },
            { label: 'Update Rates' },
          ]}
          title="Update Rates"
        />

        <div className="upr-picker">
          <label className="upr-picker-label">Panel</label>
          <select className="upr-picker-select" value={panelCompanyId} onChange={(e) => { setActiveTab('subdept'); setPanelCompanyId(e.target.value); }}>
            <option value="">— Select Panel Company —</option>
            {panelCompanies.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
          </select>
        </div>

        {!panelCompanyId && (
          <div className="upr-empty">Rates update karne ke liye pehle upar se ek Panel select karo.</div>
        )}

        {panelCompanyId && (
          <div className="upr-card">
            <div className="upr-tab-strip">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  className={`upr-tab-btn ${activeTab === t.key ? 'upr-tab-btn--active' : ''}`}
                  onClick={() => setActiveTab(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="upr-search">
              <Search size={13} className="upr-search-icon" />
              <input
                placeholder={activeTab === 'subdept' ? 'Department ya Sub Department search karo…' : activeTab === 'ward' ? 'Ward search karo…' : 'Doctor search karo…'}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            {loading ? (
              <p className="upr-loading">Loading…</p>
            ) : (
              <div className="upr-tab-content">
                {activeTab === 'subdept' && (
                  <div className="upr-table-wrap">
                    <table className="upr-table">
                      <thead>
                        <tr><th className="upr-th-check"></th><th>Department</th><th>Sub Department</th><th>Rate</th><th>Status</th></tr>
                      </thead>
                      <tbody>
                        {filteredSubDept.length === 0 ? (
                          <tr><td colSpan={5} className="upr-td-empty">Koi record nahi mila</td></tr>
                        ) : filteredSubDept.map((row) => (
                          <tr key={row.subDeptId}>
                            <td className="upr-td-check">
                              <input type="checkbox" checked={row.enabled} onChange={() => updateRow(setSubDeptRows, 'subDeptId', row.subDeptId, { enabled: !row.enabled })} />
                            </td>
                            <td className="upr-td-dept">{row.deptName}</td>
                            <td>{row.subDeptName}</td>
                            <td>
                              <input className="upr-rate-input" type="number" min="0" step="0.01" value={row.rate}
                                onChange={(e) => updateRow(setSubDeptRows, 'subDeptId', row.subDeptId, { rate: e.target.value })} />
                            </td>
                            <td>
                              <select className="upr-status-select" value={row.status} onChange={(e) => updateRow(setSubDeptRows, 'subDeptId', row.subDeptId, { status: e.target.value })}>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeTab === 'ward' && (
                  <div className="upr-table-wrap">
                    <table className="upr-table">
                      <thead>
                        <tr><th className="upr-th-check"></th><th>Code</th><th>Ward (Room Category)</th><th>Rate</th></tr>
                      </thead>
                      <tbody>
                        {filteredWard.length === 0 ? (
                          <tr><td colSpan={4} className="upr-td-empty">Koi record nahi mila</td></tr>
                        ) : filteredWard.map((row) => (
                          <tr key={row.roomCategoryId}>
                            <td className="upr-td-check">
                              <input type="checkbox" checked={row.enabled} onChange={() => updateRow(setWardRows, 'roomCategoryId', row.roomCategoryId, { enabled: !row.enabled })} />
                            </td>
                            <td className="upr-td-code">{row.code}</td>
                            <td>{row.name}</td>
                            <td>
                              <input className="upr-rate-input" type="number" min="0" step="0.01" value={row.rate}
                                onChange={(e) => updateRow(setWardRows, 'roomCategoryId', row.roomCategoryId, { rate: e.target.value })} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeTab === 'consultant' && (
                  <div className="upr-table-wrap">
                    <table className="upr-table">
                      <thead>
                        <tr><th className="upr-th-check"></th><th>Code</th><th>Consultant</th><th>Rate</th><th>Status</th></tr>
                      </thead>
                      <tbody>
                        {filteredConsultant.length === 0 ? (
                          <tr><td colSpan={5} className="upr-td-empty">Koi Consultant category ka doctor nahi mila</td></tr>
                        ) : filteredConsultant.map((row) => (
                          <tr key={row.doctorId}>
                            <td className="upr-td-check">
                              <input type="checkbox" checked={row.enabled} onChange={() => updateRow(setConsultantRows, 'doctorId', row.doctorId, { enabled: !row.enabled })} />
                            </td>
                            <td className="upr-td-code">{row.code}</td>
                            <td>{row.name}</td>
                            <td>
                              <input className="upr-rate-input" type="number" min="0" step="0.01" value={row.rate}
                                onChange={(e) => updateRow(setConsultantRows, 'doctorId', row.doctorId, { rate: e.target.value })} />
                            </td>
                            <td>
                              <select className="upr-status-select" value={row.status} onChange={(e) => updateRow(setConsultantRows, 'doctorId', row.doctorId, { status: e.target.value })}>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeTab === 'rmo' && (
                  <div className="upr-table-wrap">
                    <table className="upr-table">
                      <thead>
                        <tr><th className="upr-th-check"></th><th>Code</th><th>RMO</th><th>Rate</th><th>Status</th></tr>
                      </thead>
                      <tbody>
                        {filteredRmo.length === 0 ? (
                          <tr><td colSpan={5} className="upr-td-empty">Koi RMO category ka doctor nahi mila</td></tr>
                        ) : filteredRmo.map((row) => (
                          <tr key={row.doctorId}>
                            <td className="upr-td-check">
                              <input type="checkbox" checked={row.enabled} onChange={() => updateRow(setRmoRows, 'doctorId', row.doctorId, { enabled: !row.enabled })} />
                            </td>
                            <td className="upr-td-code">{row.code}</td>
                            <td>{row.name}</td>
                            <td>
                              <input className="upr-rate-input" type="number" min="0" step="0.01" value={row.rate}
                                onChange={(e) => updateRow(setRmoRows, 'doctorId', row.doctorId, { rate: e.target.value })} />
                            </td>
                            <td>
                              <select className="upr-status-select" value={row.status} onChange={(e) => updateRow(setRmoRows, 'doctorId', row.doctorId, { status: e.target.value })}>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            <div className="upr-footer">
              <span className="upr-footer-info">{selectedCompany ? `${selectedCompany.code} — ${selectedCompany.name}` : ''}</span>
              <button className="upr-save-btn" onClick={handleSave} disabled={saving || loading}>
                <Save size={15} />
                {saving ? 'Saving…' : 'Save Rates'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
