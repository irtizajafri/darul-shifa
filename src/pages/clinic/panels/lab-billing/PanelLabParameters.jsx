import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, Save, Heading, StickyNote } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../../../../components/shared/PageHeader';
import SearchableSelect from '../../../../components/ui/SearchableSelect';
import { confirmDialog } from '../../../../components/ui/ConfirmDialog';
import { panelLabApi, RESULT_TYPES, ROW_KINDS } from './panelLabApi';
import '../../../lab/Lab.scss';

// Lab Billing's own test setup (owner, 2026-11-12) — separate from
// Laboratories → Parameters: an edit here never changes Laboratories, and an
// edit there never changes this. Tests are Clinic's LABORATORY list. A test's
// report rows, in the order they print: a test line (its result is typed in
// Lab Billing; unit and reference range print as written here), a heading, or
// a note that prints as it is.
const SAMPLE_TYPES = ['Blood', 'Serum', 'Plasma', 'Urine', 'Stool', 'Sputum', 'Swab', 'Fluid', 'Semen', 'Tissue'];
let seq = 0;
const blankRow = (kind) => ({ key: `n${++seq}`, id: null, kind, name: '', unit: '', referenceRange: '', noteText: '', resultType: 'number', options: '' });

const fromApi = (p) => ({
  key: `p${p.id}`, id: p.id, kind: p.kind, name: p.name || '', unit: p.unit || '', referenceRange: p.referenceRange || '',
  noteText: p.noteText || '', resultType: p.resultType, options: (p.options || []).join(', '),
});

const toApi = (r) => ({
  id: r.id, kind: r.kind, name: r.name, unit: r.unit, referenceRange: r.referenceRange, noteText: r.noteText,
  resultType: r.resultType, options: r.options,
});

const KIND_LABEL = Object.fromEntries(ROW_KINDS.map((k) => [k.key, k.label]));

const formJson = (rows, sampleType) => JSON.stringify({ s: String(sampleType || '').trim(), r: rows.map(toApi) });

export default function PanelLabParameters() {
  const [tests, setTests] = useState([]);
  const [testId, setTestId] = useState('');
  const [test, setTest] = useState(null);
  const [rows, setRows] = useState([]);
  const [sampleType, setSampleType] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingTest, setLoadingTest] = useState(false);
  const savedJson = useRef(formJson([], ''));

  useEffect(() => {
    panelLabApi('/tests').then(setTests).catch((e) => toast.error(e.message));
  }, []);

  const loadTest = useCallback(async (id) => {
    if (!id) { setTest(null); setRows([]); setSampleType(''); savedJson.current = formJson([], ''); return; }
    setLoadingTest(true);
    try {
      const t = await panelLabApi(`/tests/${id}/parameters`);
      const r = t.parameters.map(fromApi);
      setTest(t);
      setRows(r);
      setSampleType(t.sampleType || '');
      savedJson.current = formJson(r, t.sampleType);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoadingTest(false);
    }
  }, []);

  useEffect(() => { loadTest(testId); }, [testId, loadTest]);

  const dirty = formJson(rows, sampleType) !== savedJson.current;

  const confirmLeave = async () => !dirty || confirmDialog({
    title: 'Unsaved changes', message: 'Discard the changes to this test?', confirmLabel: 'Discard', danger: true,
  });

  const pickTest = async (v) => {
    if (!(await confirmLeave())) return;
    setTestId(v || '');
  };

  const update = (key, patch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const move = (i, d) => setRows((rs) => {
    const j = i + d;
    if (j < 0 || j >= rs.length) return rs;
    const next = [...rs];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  const removeRow = (key) => setRows((rs) => rs.filter((r) => r.key !== key));
  const addRow = (kind) => setRows((rs) => [...rs, blankRow(kind)]);

  const save = async () => {
    if (!test) return;
    setSaving(true);
    try {
      const t = await panelLabApi(`/tests/${test.subDept.id}/parameters`, { method: 'PUT', body: { sampleType, parameters: rows.map(toApi) } });
      const r = t.parameters.map(fromApi);
      setTest(t);
      setRows(r);
      setSampleType(t.sampleType || '');
      savedJson.current = formJson(r, t.sampleType);
      setTests((ts) => ts.map((x) => (x.subDeptId === t.subDept.id ? { ...x, sampleType: t.sampleType, lineCount: t.parameters.filter((p) => p.isActive !== false).length } : x)));
      toast.success(`${t.subDept.name}: saved`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="lab-page">
      <PageHeader
        breadcrumbs={[
          { label: 'Clinic', link: '/clinic-module' },
          { label: 'Panels' },
          { label: 'Parameter' },
          { label: 'Lab Parameters' },
        ]}
        title="Lab Parameters"
        subtitle="Lab Billing's own report lines for each test — separate from Laboratories → Parameters"
      />

      <div className="lab-card">
        <div className="lab-toolbar" style={{ marginBottom: 0 }}>
          <label className="lab-field" style={{ flex: '2 1 360px' }}>
            <span>Test (Clinic Laboratory list)</span>
            <SearchableSelect
              options={tests}
              value={testId}
              onChange={pickTest}
              getKey={(t) => t.subDeptId}
              getLabel={(t) => `${t.name}${t.code ? ` (${t.code})` : ''}${t.lineCount ? ` — ${t.lineCount}` : ''}`}
              placeholder={tests.length ? `Select a test — ${tests.filter((t) => t.lineCount).length} of ${tests.length} have lines` : 'Loading tests…'}
              size="sm"
              maxUnfiltered={400}
            />
          </label>
        </div>
      </div>

      {loadingTest && <p className="lab-empty">Loading…</p>}

      {test && !loadingTest && (
        <>
          <div className="lab-card">
            <h2 className="lab-card-title">
              {test.subDept.name}
              {test.subDept.code && <span className="lab-badge lab-badge--info">{test.subDept.code}</span>}
              <span className="lab-count">{rows.length} lines</span>
            </h2>
            <label className="lab-field" style={{ width: 180, marginBottom: 10 }}>
              <span>Sample</span>
              <input className="lab-input" list="panel-lab-sample-types" value={sampleType} onChange={(e) => setSampleType(e.target.value)} placeholder="e.g. Blood" />
              <datalist id="panel-lab-sample-types">
                {SAMPLE_TYPES.map((s) => <option key={s} value={s} />)}
              </datalist>
            </label>
            <p className="lab-hint" style={{ marginBottom: 10 }}>
              Everything here prints on the Lab Billing report as written. Results are entered in Panels → Lab Billing.
              Write the reference range any way you like, on several lines if needed; a plain range (e.g. 13.0-17.0, &lt; 200, or &quot;Male: 13-17&quot; on its own line) sets the H/L flag automatically.
            </p>
            <div className="table-wrap">
              <table className="lab-table lab-param-table">
                <thead>
                  <tr>
                    <th style={{ width: 34 }}>#</th>
                    <th style={{ width: 96 }}>Line</th>
                    <th style={{ minWidth: 210 }}>Name</th>
                    <th style={{ width: 110 }}>Unit</th>
                    <th style={{ minWidth: 260 }}>Reference range / Note</th>
                    <th style={{ width: 170 }}>Result type</th>
                    <th style={{ width: 96 }} />
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr><td colSpan={7} className="lab-empty">This test has no lines yet. Add a Test line, Heading or Note below.</td></tr>
                  )}
                  {rows.map((r, i) => (
                    <tr key={r.key} className={`lab-row--${r.kind}`}>
                      <td className="muted">{i + 1}</td>
                      <td><span className={`lab-badge ${r.kind === 'param' ? 'lab-badge--info' : ''}`}>{KIND_LABEL[r.kind]}</span></td>
                      <td>
                        <input className="lab-input lab-input--sm" value={r.name} onChange={(e) => update(r.key, { name: e.target.value })}
                          placeholder={r.kind === 'heading' ? 'e.g. Differential Count' : r.kind === 'note' ? 'e.g. Remarks / Note (optional)' : 'e.g. HB'}
                          aria-label="Name" />
                      </td>
                      <td>
                        {r.kind === 'param' && (
                          <input className="lab-input lab-input--sm" value={r.unit} onChange={(e) => update(r.key, { unit: e.target.value })} placeholder="gm/dL" aria-label="Unit" />
                        )}
                      </td>
                      <td>
                        {r.kind === 'param' && (
                          <textarea className="lab-input lab-input--sm lab-ref-input" rows={Math.min(5, Math.max(1, r.referenceRange.split('\n').length))}
                            value={r.referenceRange} onChange={(e) => update(r.key, { referenceRange: e.target.value })}
                            placeholder={'13.0-17.0\n(or Male: 13-17, Enter, Female: 12-15)'} aria-label="Reference range" />
                        )}
                        {r.kind === 'note' && (
                          <textarea className="lab-input lab-input--sm lab-ref-input" rows={Math.min(5, Math.max(2, r.noteText.split('\n').length))}
                            value={r.noteText} onChange={(e) => update(r.key, { noteText: e.target.value })}
                            placeholder="Text to print on the report" aria-label="Note text" />
                        )}
                      </td>
                      <td>
                        {r.kind === 'param' && (
                          <>
                            <select className="lab-select lab-input--sm" style={{ width: '100%' }} value={r.resultType} onChange={(e) => update(r.key, { resultType: e.target.value })} aria-label="Result type">
                              {RESULT_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                            </select>
                            {r.resultType === 'select' && (
                              <input className="lab-input lab-input--sm" style={{ marginTop: 4 }} value={r.options} onChange={(e) => update(r.key, { options: e.target.value })} placeholder="Nil, +, ++" aria-label="Dropdown options" />
                            )}
                          </>
                        )}
                      </td>
                      <td className="nowrap">
                        <button type="button" className="lab-icon-btn" title="Move up" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp /></button>
                        <button type="button" className="lab-icon-btn" title="Move down" aria-label="Move down" disabled={i === rows.length - 1} onClick={() => move(i, 1)}><ArrowDown /></button>
                        <button type="button" className="lab-icon-btn is-danger" title="Remove" aria-label="Remove" onClick={() => removeRow(r.key)}><Trash2 /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="lab-actions">
            <span className="lab-hint">{dirty ? 'Unsaved changes' : 'All changes saved'}</span>
            <button type="button" className="lab-btn" onClick={() => addRow('param')}><Plus /> Test line</button>
            <button type="button" className="lab-btn" onClick={() => addRow('heading')}><Heading /> Heading</button>
            <button type="button" className="lab-btn" onClick={() => addRow('note')}><StickyNote /> Note</button>
            <button type="button" className="lab-btn lab-btn--primary" onClick={save} disabled={saving || !dirty}><Save /> Save</button>
          </div>
        </>
      )}
    </div>
  );
}
