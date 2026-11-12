import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Printer, RefreshCw, Save, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../../../../components/shared/PageHeader';
import { confirmDialog } from '../../../../components/ui/ConfirmDialog';
import { useAuthStore } from '../../../../store/useAuthStore';
import { openPrintWindow, printHtml } from '../../../../utils/printRelay';
import { panelLabApi, pktToday, fmtDateTime, flagFor, SOURCE_LABEL } from './panelLabApi';
import { buildPanelLabReportHtml } from './panelLabReportPrint';
import '../../../lab/Lab.scss';

// Lab Billing (Panels), owner 2026-11-12: lab reports for panel patients,
// separate from Laboratories → Result Entry. Lists every Laboratory item added
// on a Panels → Billing bill (one report per bill per day) and every panel
// Laboratory slip made in Clinic. Results saved here never show in
// Laboratories, and Laboratories' results never show here.

const PKT = 'Asia/Karachi';
const dayLabel = (iso) => new Date(`${iso}T12:00:00+05:00`).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: PKT });
const fmtTime = (d) => new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: PKT });
const fmtDay = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: PKT });
const ALL_DATES_LIMIT = 500;

const isParam = (p) => (p.kind || 'param') === 'param';

const entriesFrom = (rep) => Object.fromEntries(rep.tests.map((t) => [t.lineKey, {
  values: Object.fromEntries((t.result?.values || []).filter((v) => v.parameterId).map((v) => [v.parameterId, v.value || ''])),
  remarks: t.result?.remarks || '',
}]));

// Only what the backend saves: typed values of current lines + remarks.
const comparable = (rep, entries) => JSON.stringify(rep?.tests.map((t) => {
  const e = entries[t.lineKey] || { values: {}, remarks: '' };
  return [t.lineKey, t.parameters.filter(isParam).map((p) => String(e.values[p.id] ?? '').trim()), String(e.remarks || '').trim()];
}) || []);

export default function PanelLabBilling() {
  const { user } = useAuthStore();
  const userName = user?.name || user?.username || user?.email || '';
  // No dates = every date (newest first), so reports show as soon as the screen opens.
  const [filters, setFilters] = useState({ from: '', to: '', q: '', status: '', source: '' });
  const [list, setList] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [entries, setEntries] = useState({});
  const [saving, setSaving] = useState(false);
  const savedRef = useRef('[]');
  const bodyRef = useRef(null);

  const loadList = useCallback(async (f) => {
    setListLoading(true);
    try {
      const p = new URLSearchParams();
      if (f.q.trim()) p.set('q', f.q.trim());
      else if (f.from || f.to) { p.set('from', f.from || f.to); p.set('to', f.to || f.from); }
      if (f.status) p.set('status', f.status);
      if (f.source) p.set('source', f.source);
      setList(await panelLabApi(`/entries?${p}`));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyReport = (r) => {
    const e = entriesFrom(r);
    setReport(r);
    setEntries(e);
    savedRef.current = comparable(r, e);
  };

  const openReport = async (key) => {
    try {
      applyReport(await panelLabApi(`/entries/${encodeURIComponent(key)}`));
      window.scrollTo?.({ top: 0 });
    } catch (e) {
      toast.error(e.message);
    }
  };

  const dirty = report ? comparable(report, entries) !== savedRef.current : false;

  const backToList = async () => {
    if (dirty && !(await confirmDialog({ title: 'Result not saved', message: 'Discard the changes and go back to the list?', confirmLabel: 'Discard', danger: true }))) return;
    setReport(null);
    loadList(filters);
  };

  const setValue = (lineKey, paramId, value) => setEntries((es) => ({
    ...es, [lineKey]: { ...es[lineKey], values: { ...es[lineKey].values, [paramId]: value } },
  }));
  const setRemarks = (lineKey, value) => setEntries((es) => ({ ...es, [lineKey]: { ...es[lineKey], remarks: value } }));

  // Enter moves to the next result box, for quick entry down the list.
  const onResultKey = (e) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    if (e.target.tagName === 'TEXTAREA') return;
    e.preventDefault();
    const boxes = [...(bodyRef.current?.querySelectorAll('[data-result-box]') || [])];
    const i = boxes.indexOf(e.target);
    boxes[i + 1]?.focus();
  };

  const save = async () => {
    const body = {
      userId: user?.id ? String(user.id) : null,
      userName,
      tests: report.tests.map((t) => ({ lineKey: t.lineKey, values: entries[t.lineKey].values, remarks: entries[t.lineKey].remarks })),
    };
    const saved = await panelLabApi(`/entries/${encodeURIComponent(report.visit.entryKey)}/results`, { method: 'PUT', body });
    applyReport(saved);
    return saved;
  };

  const print = async (data, win) => {
    const ready = data.tests.filter((t) => t.result?.status === 'done');
    if (!ready.length) {
      win?.close();
      toast.error('Save the result of at least one test before printing');
      return;
    }
    printHtml(buildPanelLabReportHtml({ visit: data.visit, tests: data.tests, printedBy: userName }), undefined, win);
    panelLabApi('/results/print', { method: 'POST', body: { resultIds: ready.map((t) => t.result.id) } }).catch(() => {});
  };

  const onSave = async () => {
    setSaving(true);
    try {
      await save();
      toast.success('Result saved');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  // The print window opens on the click itself, before any await, or the
  // browser blocks it as an unrequested popup.
  const onSaveAndPrint = async () => {
    const win = openPrintWindow();
    setSaving(true);
    try {
      const data = dirty ? await save() : report;
      await print(data, win);
    } catch (e) {
      win.close();
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const pendingCount = useMemo(() => list.reduce((s, r) => s + (r.testCount - r.doneCount), 0), [list]);
  const byDay = useMemo(() => {
    const m = new Map();
    for (const r of list) {
      if (!m.has(r.day)) m.set(r.day, []);
      m.get(r.day).push(r);
    }
    return [...m.entries()];
  }, [list]);
  const allDates = !filters.q.trim() && !filters.from && !filters.to;

  const setDates = (from, to) => {
    const next = { ...filters, from, to, q: '' };
    setFilters(next);
    loadList(next);
  };

  const v = report?.visit;
  const group = v?.patientGroup;
  const groupLabel = { male: 'Male', female: 'Female', child: 'Children' }[group] || '';

  return (
    <div className="lab-page">
      <PageHeader
        breadcrumbs={[
          { label: 'Clinic', link: '/clinic-module' },
          { label: 'Panels' },
          { label: 'Transaction' },
          { label: 'Lab Billing' },
        ]}
        title="Lab Billing"
        subtitle="Laboratory items from Panels → Billing and panel lab slips — enter results, then save and print. Separate from Laboratories."
      />

      {!report && (
        <>
          <div className="lab-card">
            <div className="lab-toolbar" style={{ marginBottom: 0 }}>
              <label className="lab-field">
                <span>From</span>
                <input type="date" className="lab-input" value={filters.from} disabled={!!filters.q.trim()}
                  onChange={(e) => { const val = e.target.value; setFilters((f) => ({ ...f, from: val, to: val })); }} />
              </label>
              <label className="lab-field">
                <span>To</span>
                <input type="date" className="lab-input" value={filters.to} min={filters.from} disabled={!!filters.q.trim()}
                  onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} />
              </label>
              <button type="button" className="lab-btn" onClick={() => setDates(pktToday(), pktToday())}>Today</button>
              <button type="button" className="lab-btn" onClick={() => setDates('', '')}>All dates</button>
              <label className="lab-field" style={{ flex: '1 1 240px' }}>
                <span>Search (all dates)</span>
                <div style={{ position: 'relative' }}>
                  <Search style={{ position: 'absolute', left: 9, top: 9, width: 15, height: 15, color: '#94a3b8' }} />
                  <input className="lab-input" style={{ paddingLeft: 30, width: '100%' }} value={filters.q}
                    onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && loadList(filters)}
                    placeholder="Admission #, Slip #, MR # or name" />
                </div>
              </label>
              <label className="lab-field" style={{ width: 170 }}>
                <span>Source</span>
                <select className="lab-select" value={filters.source} onChange={(e) => setFilters((f) => ({ ...f, source: e.target.value }))}>
                  <option value="">All</option>
                  <option value="billing">Billing items</option>
                  <option value="slips">Panel lab slips</option>
                </select>
              </label>
              <label className="lab-field" style={{ width: 130 }}>
                <span>Status</span>
                <select className="lab-select" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
                  <option value="">All</option>
                  <option value="pending">Pending</option>
                  <option value="done">Done</option>
                </select>
              </label>
              <button type="button" className="lab-btn lab-btn--primary" onClick={() => loadList(filters)} disabled={listLoading}>
                <RefreshCw /> Show
              </button>
            </div>
          </div>

          <div className="lab-card">
            <h2 className="lab-card-title">
              Lab reports
              <span className="lab-count">
                {allDates ? 'All dates' : filters.q.trim() ? 'Search' : (filters.from === filters.to ? dayLabel(filters.from) : `${dayLabel(filters.from)} – ${dayLabel(filters.to)}`)}
                {' · '}{list.length} report{list.length === 1 ? '' : 's'} · {pendingCount} test{pendingCount === 1 ? '' : 's'} pending
                {allDates && list.length >= ALL_DATES_LIMIT ? ` · newest ${ALL_DATES_LIMIT} shown, pick dates for older ones` : ''}
              </span>
            </h2>
            <div className="table-wrap">
              {listLoading ? (
                <p className="lab-empty">Loading…</p>
              ) : list.length === 0 ? (
                <p className="lab-empty">{allDates ? 'No Laboratory items on panel bills and no panel lab slips yet.' : 'Nothing on these dates. Press "All dates" or search by number.'}</p>
              ) : (
                <table className="lab-table lab-table--click">
                  <thead>
                    <tr>
                      <th>Admission # / Slip #</th>
                      <th>From</th>
                      <th>Time</th>
                      <th>MR #</th>
                      <th>Patient</th>
                      <th>Panel</th>
                      <th>Tests</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byDay.map(([day, rows]) => [
                      <tr key={`d-${day}`} className="lab-group-row lab-day-row">
                        <td colSpan={8}>
                          {dayLabel(day)}
                          <span className="muted">{(() => {
                            const pending = rows.reduce((n, r) => n + (r.testCount - r.doneCount), 0);
                            return ` · ${rows.length} report${rows.length === 1 ? '' : 's'} · ${pending} test${pending === 1 ? '' : 's'} pending`;
                          })()}</span>
                        </td>
                      </tr>,
                      ...rows.map((r) => (
                        <tr key={r.entryKey} onClick={() => openReport(r.entryKey)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && openReport(r.entryKey)}>
                          <td className="nowrap"><span className="muted">{r.numberLabel} </span><b>{r.number}</b></td>
                          <td className="nowrap muted">{SOURCE_LABEL[r.source]}{r.admitNo ? ` · Adm # ${r.admitNo}` : ''}</td>
                          <td className="nowrap muted">{r.source === 'slip' ? fmtTime(r.sampleDate) : '—'}</td>
                          <td>{r.mrNo ?? '—'}</td>
                          <td>{r.patientName}<span className="muted">{[r.age, r.gender].filter(Boolean).length ? ` · ${[r.age, r.gender].filter(Boolean).join(' / ')}` : ''}</span></td>
                          <td>{r.panelName || '—'}{r.empCode ? <span className="muted"> · {r.empCode}</span> : null}</td>
                          <td>{r.tests.map((t) => t.name).join(', ')}</td>
                          <td className="nowrap">
                            <span className={`lab-badge lab-badge--${r.status}`}>{r.status === 'done' ? 'Done' : `Pending ${r.testCount - r.doneCount}/${r.testCount}`}</span>
                          </td>
                        </tr>
                      )),
                    ])}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {report && (
        <div ref={bodyRef}>
          <div className="lab-card">
            <div className="lab-toolbar" style={{ marginBottom: 10 }}>
              <button type="button" className="lab-btn" onClick={backToList}><ArrowLeft /> List</button>
              <span className="lab-badge lab-badge--info">{SOURCE_LABEL[v.source]}</span>
              <span className="lab-count">Range: {groupLabel || '—'} (used for the H/L flag)</span>
            </div>
            <div className="lab-slip-head">
              <div><span>Patient</span><b>{`${v.patientType || ''} ${v.patientName || ''}`.trim()}</b></div>
              <div><span>Age / Gender</span><b>{[v.age, v.gender].filter(Boolean).join(' / ') || '—'}</b></div>
              <div><span>{v.numberLabel}</span><b>{v.serialNo}</b></div>
              <div><span>MR #</span><b>{v.mrNo ?? '—'}</b></div>
              <div><span>Sample date</span><b>{v.source === 'slip' ? fmtDateTime(v.createdAt) : fmtDay(v.createdAt)}</b></div>
              <div><span>Panel</span><b>{v.panelName || '—'}</b></div>
              <div><span>Emp #</span><b>{[v.empCode, v.employeeName ? `(${v.employeeName})` : ''].filter(Boolean).join(' ') || '—'}</b></div>
              {v.admitNo && <div><span>Admission #</span><b>{v.admitNo}</b></div>}
              <div><span>Referred By</span><b>{v.referredBy || '—'}</b></div>
            </div>
          </div>

          {report.tests.map((t) => {
            const e = entries[t.lineKey] || { values: {}, remarks: '' };
            const done = t.result?.status === 'done';
            const hasLines = t.parameters.some(isParam);
            return (
              <section className="lab-test" key={t.lineKey}>
                <div className="lab-test-head">
                  <h3>{t.name}</h3>
                  <span className="meta">{t.code}</span>
                  {t.sampleType && <span className="lab-badge">{t.sampleType}</span>}
                  <div className="end">
                    {t.result?.enteredByName && (
                      <span className="meta">
                        {t.result.updatedByName && new Date(t.result.updatedAt) - new Date(t.result.enteredAt) > 5000
                          ? `Updated: ${t.result.updatedByName}, ${fmtDateTime(t.result.updatedAt)}`
                          : `Entered: ${t.result.enteredByName}, ${fmtDateTime(t.result.enteredAt)}`}
                      </span>
                    )}
                    <span className={`lab-badge lab-badge--${done ? 'done' : 'pending'}`}>{done ? 'Done' : 'Pending'}</span>
                  </div>
                </div>
                <div className="lab-test-body">
                  {!hasLines ? (
                    <>
                      <p className="lab-hint" style={{ marginBottom: 6 }}>
                        {t.subDeptId
                          ? 'This test has no result lines in Lab Parameters yet — write the result below.'
                          : 'This name is not in the Clinic Laboratory list — write the result below.'}
                      </p>
                      {t.parameters.filter((p) => p.kind === 'note').map((p) => (
                        <p key={p.id} className="lab-note-line">{p.name && <b>{p.name}: </b>}{p.noteText}</p>
                      ))}
                      <textarea className="lab-input" rows={4} style={{ width: '100%' }} value={e.remarks}
                        onChange={(ev) => setRemarks(t.lineKey, ev.target.value)} placeholder="Result / report" aria-label={`${t.name} result`} />
                    </>
                  ) : (
                    <>
                      <div className="table-wrap">
                        <table className="lab-table">
                          <thead>
                            <tr>
                              <th style={{ width: '30%' }}>Test</th>
                              <th style={{ width: 150 }}>Result</th>
                              <th style={{ width: 34 }} />
                              <th style={{ width: 90 }}>Unit</th>
                              <th>Reference range</th>
                            </tr>
                          </thead>
                          <tbody>
                            {t.parameters.map((p) => {
                              if (p.kind === 'heading') {
                                return <tr key={p.id} className="lab-group-row"><td colSpan={5}>{p.name}</td></tr>;
                              }
                              if (p.kind === 'note') {
                                return (
                                  <tr key={p.id}>
                                    <td colSpan={5} className="lab-note-line">{p.name && <b>{p.name}: </b>}{p.noteText}</td>
                                  </tr>
                                );
                              }
                              const value = e.values[p.id] ?? '';
                              const flag = p.resultType === 'number' ? flagFor(value, p.referenceRange, group) : '';
                              return (
                                <Fragment key={p.id}>
                                  <tr>
                                    <td>{p.name}</td>
                                    <td>
                                      {p.resultType === 'select' ? (
                                        <select className="lab-select lab-input--sm lab-result-input" data-result-box value={value}
                                          onChange={(ev) => setValue(t.lineKey, p.id, ev.target.value)} onKeyDown={onResultKey} aria-label={p.name}>
                                          <option value="">—</option>
                                          {p.options.map((o) => <option key={o} value={o}>{o}</option>)}
                                        </select>
                                      ) : (
                                        <input className={`lab-input lab-input--sm lab-result-input ${flag ? `lab-value--${flag}` : ''}`} data-result-box value={value}
                                          inputMode={p.resultType === 'number' ? 'decimal' : undefined}
                                          onChange={(ev) => setValue(t.lineKey, p.id, ev.target.value)} onKeyDown={onResultKey} aria-label={p.name} />
                                      )}
                                    </td>
                                    <td>{flag && <span className={`lab-flag lab-flag--${flag}`}>{flag}</span>}</td>
                                    <td className="muted">{p.unit || ''}</td>
                                    <td className="lab-ranges-text">{p.referenceRange || '—'}</td>
                                  </tr>
                                </Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <label className="lab-field" style={{ marginTop: 10 }}>
                        <span>Remarks</span>
                        <input className="lab-input" value={e.remarks} onChange={(ev) => setRemarks(t.lineKey, ev.target.value)} placeholder="Any note (optional)" />
                      </label>
                    </>
                  )}
                </div>
              </section>
            );
          })}

          <div className="lab-actions">
            <span className="lab-hint">{dirty ? 'Unsaved changes' : 'All changes saved'}</span>
            <button type="button" className="lab-btn" onClick={onSave} disabled={saving || !dirty}><Save /> Save</button>
            <button type="button" className="lab-btn lab-btn--primary" onClick={onSaveAndPrint} disabled={saving}>
              <Printer /> {dirty ? 'Save & Print' : 'Print'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
