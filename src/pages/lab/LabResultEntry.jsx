import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Printer, RefreshCw, Save, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../../components/shared/PageHeader';
import { confirmDialog } from '../../components/ui/ConfirmDialog';
import { useAuthStore } from '../../store/useAuthStore';
import { openPrintWindow, printHtml } from '../../utils/printRelay';
import { labApi, pktToday, fmtDateTime, flagFor } from './labApi';
import { buildLabReportHtml } from './labReportPrint';
import './Lab.scss';

// Slips are grouped under their PKT calendar day.
const PKT = 'Asia/Karachi';
const pktDay = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: PKT, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(d));
const dayLabel = (iso) => new Date(`${iso}T12:00:00+05:00`).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: PKT });
const fmtTime = (d) => new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: PKT });
const ALL_DATES_LIMIT = 500;

const isParam = (p) => (p.kind || 'param') === 'param';

const entriesFrom = (slip) => Object.fromEntries(slip.tests.map((t) => [t.visitDoctorId, {
  values: Object.fromEntries((t.result?.values || []).filter((v) => v.parameterId).map((v) => [v.parameterId, v.value || ''])),
  remarks: t.result?.remarks || '',
}]));

// Only what the backend saves: typed values of current parameters + remarks.
const comparable = (slip, entries) => JSON.stringify(slip?.tests.map((t) => {
  const e = entries[t.visitDoctorId] || { values: {}, remarks: '' };
  return [t.visitDoctorId, t.parameters.filter(isParam).map((p) => String(e.values[p.id] ?? '').trim()), String(e.remarks || '').trim()];
}) || []);

export default function LabResultEntry() {
  const { user } = useAuthStore();
  const userName = user?.name || user?.username || user?.email || '';
  // No dates = every date (newest first), so slips show as soon as the screen opens.
  const [filters, setFilters] = useState({ from: '', to: '', q: '', status: '' });
  const [slips, setSlips] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [slip, setSlip] = useState(null);
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
      setSlips(await labApi(`/slips?${p}`));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setListLoading(false);
    }
  }, []);

  // Today's slips on open; after that the Show button reloads.
  useEffect(() => {
    loadList(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applySlip = (s) => {
    const e = entriesFrom(s);
    setSlip(s);
    setEntries(e);
    savedRef.current = comparable(s, e);
  };

  const openSlip = async (id) => {
    try {
      applySlip(await labApi(`/slips/${id}`));
      window.scrollTo?.({ top: 0 });
    } catch (e) {
      toast.error(e.message);
    }
  };

  const dirty = slip ? comparable(slip, entries) !== savedRef.current : false;

  const backToList = async () => {
    if (dirty && !(await confirmDialog({ title: 'Result not saved', message: 'Discard the changes and go back to the list?', confirmLabel: 'Discard', danger: true }))) return;
    setSlip(null);
    loadList(filters);
  };

  const setValue = (lineId, paramId, value) => setEntries((es) => ({
    ...es, [lineId]: { ...es[lineId], values: { ...es[lineId].values, [paramId]: value } },
  }));
  const setRemarks = (lineId, value) => setEntries((es) => ({ ...es, [lineId]: { ...es[lineId], remarks: value } }));

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
      tests: slip.tests.map((t) => ({ visitDoctorId: t.visitDoctorId, values: entries[t.visitDoctorId].values, remarks: entries[t.visitDoctorId].remarks })),
    };
    const saved = await labApi(`/slips/${slip.visit.id}/results`, { method: 'PUT', body });
    applySlip(saved);
    return saved;
  };

  const print = async (data, win) => {
    const ready = data.tests.filter((t) => t.result?.status === 'done');
    if (!ready.length) {
      win?.close();
      toast.error('Save the result of at least one test before printing');
      return;
    }
    printHtml(buildLabReportHtml({ visit: data.visit, tests: data.tests, printedBy: userName }), undefined, win);
    labApi('/results/print', { method: 'POST', body: { resultIds: ready.map((t) => t.result.id) } }).catch(() => {});
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
      const data = dirty ? await save() : slip;
      await print(data, win);
    } catch (e) {
      win.close();
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const pendingCount = useMemo(() => slips.reduce((s, r) => s + (r.testCount - r.doneCount), 0), [slips]);
  const byDay = useMemo(() => {
    const m = new Map();
    for (const s of slips) {
      const d = pktDay(s.createdAt);
      if (!m.has(d)) m.set(d, []);
      m.get(d).push(s);
    }
    return [...m.entries()];
  }, [slips]);
  const allDates = !filters.q.trim() && !filters.from && !filters.to;

  const setDates = (from, to) => {
    const next = { ...filters, from, to, q: '' };
    setFilters(next);
    loadList(next);
  };

  const group = slip?.visit.patientGroup;
  const groupLabel = { male: 'Male', female: 'Female', child: 'Children' }[group] || '';

  return (
    <div className="lab-page">
      <PageHeader
        breadcrumbs={[{ label: 'Laboratories', link: '/lab-module' }, { label: 'Result Entry' }]}
        title="Result Entry"
        subtitle="Lab slips made in Clinic — open a slip, enter each test's result, then save and print"
      />

      {!slip && (
        <>
          <div className="lab-card">
            <div className="lab-toolbar" style={{ marginBottom: 0 }}>
              <label className="lab-field">
                <span>From</span>
                <input type="date" className="lab-input" value={filters.from} disabled={!!filters.q.trim()}
                  onChange={(e) => { const v = e.target.value; setFilters((f) => ({ ...f, from: v, to: v })); }} />
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
                    placeholder="Slip #, MR #, Admission # or name" />
                </div>
              </label>
              <label className="lab-field" style={{ width: 140 }}>
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
              Lab slips
              <span className="lab-count">
                {allDates ? 'All dates' : filters.q.trim() ? 'Search' : (filters.from === filters.to ? dayLabel(filters.from) : `${dayLabel(filters.from)} – ${dayLabel(filters.to)}`)}
                {' · '}{slips.length} slip{slips.length === 1 ? '' : 's'} · {pendingCount} test{pendingCount === 1 ? '' : 's'} pending
                {allDates && slips.length >= ALL_DATES_LIMIT ? ` · newest ${ALL_DATES_LIMIT} shown, pick dates for older slips` : ''}
              </span>
            </h2>
            <div className="table-wrap">
              {listLoading ? (
                <p className="lab-empty">Loading…</p>
              ) : slips.length === 0 ? (
                <p className="lab-empty">{allDates ? 'No lab slips yet.' : 'No lab slips on these dates. Press "All dates" or search by Slip #.'}</p>
              ) : (
                <table className="lab-table lab-table--click">
                  <thead>
                    <tr>
                      <th>Slip #</th>
                      <th>Time</th>
                      <th>MR #</th>
                      <th>Patient</th>
                      <th>Age / Gender</th>
                      <th>Tests</th>
                      <th>OPD / Admission</th>
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
                            return ` · ${rows.length} slip${rows.length === 1 ? '' : 's'} · ${pending} test${pending === 1 ? '' : 's'} pending`;
                          })()}</span>
                        </td>
                      </tr>,
                      ...rows.map((s) => (
                      <tr key={s.id} onClick={() => openSlip(s.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && openSlip(s.id)}>
                        <td><b>{s.serialNo}</b></td>
                        <td className="nowrap muted">{fmtTime(s.createdAt)}</td>
                        <td>{s.mrNo ?? '—'}</td>
                        <td>{s.patientName}</td>
                        <td className="nowrap muted">{[s.age, s.gender].filter(Boolean).join(' / ')}</td>
                        <td>{s.tests.map((t) => t.name).join(', ')}</td>
                        <td className="nowrap">{s.admitNo ? `Adm # ${s.admitNo}` : 'OPD'}</td>
                        <td className="nowrap">
                          <span className={`lab-badge lab-badge--${s.status}`}>{s.status === 'done' ? 'Done' : `Pending ${s.testCount - s.doneCount}/${s.testCount}`}</span>
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

      {slip && (
        <div ref={bodyRef}>
          <div className="lab-card">
            <div className="lab-toolbar" style={{ marginBottom: 10 }}>
              <button type="button" className="lab-btn" onClick={backToList}><ArrowLeft /> List</button>
              <span className="lab-count">Range: {groupLabel || '—'} (used for the H/L flag)</span>
            </div>
            <div className="lab-slip-head">
              <div><span>Patient</span><b>{`${slip.visit.patientType || ''} ${slip.visit.patientName || ''}`.trim()}</b></div>
              <div><span>Age / Gender</span><b>{[slip.visit.age, slip.visit.gender].filter(Boolean).join(' / ') || '—'}</b></div>
              <div><span>Slip #</span><b>{slip.visit.serialNo}</b></div>
              <div><span>MR #</span><b>{slip.visit.mrNo ?? '—'}</b></div>
              <div><span>Date</span><b>{fmtDateTime(slip.visit.createdAt)}</b></div>
              <div><span>{slip.visit.admitNo ? 'Admission #' : 'Type'}</span><b>{slip.visit.admitNo || 'OPD'}</b></div>
              <div><span>Referred By</span><b>{slip.visit.referredBy || '—'}</b></div>
            </div>
          </div>

          {slip.tests.map((t) => {
            const e = entries[t.visitDoctorId] || { values: {}, remarks: '' };
            const done = t.result?.status === 'done';
            const hasLines = t.parameters.some(isParam);
            return (
              <section className="lab-test" key={t.visitDoctorId}>
                <div className="lab-test-head">
                  <h3>{t.name}</h3>
                  <span className="meta">{t.code}</span>
                  {t.categoryName && <span className="lab-badge lab-badge--info">{t.categoryName}</span>}
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
                        This test has no result lines yet{t.labTestId ? '' : ' (it isn\'t in any category either)'} — write the result below.
                      </p>
                      {t.parameters.filter((p) => p.kind === 'note').map((p) => (
                        <p key={p.id} className="lab-note-line">{p.name && <b>{p.name}: </b>}{p.noteText}</p>
                      ))}
                      <textarea className="lab-input" rows={4} style={{ width: '100%' }} value={e.remarks}
                        onChange={(ev) => setRemarks(t.visitDoctorId, ev.target.value)} placeholder="Result / report" aria-label={`${t.name} result`} />
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
                                        <select className={`lab-select lab-input--sm lab-result-input`} data-result-box value={value}
                                          onChange={(ev) => setValue(t.visitDoctorId, p.id, ev.target.value)} onKeyDown={onResultKey} aria-label={p.name}>
                                          <option value="">—</option>
                                          {p.options.map((o) => <option key={o} value={o}>{o}</option>)}
                                        </select>
                                      ) : (
                                        <input className={`lab-input lab-input--sm lab-result-input ${flag ? `lab-value--${flag}` : ''}`} data-result-box value={value}
                                          inputMode={p.resultType === 'number' ? 'decimal' : undefined}
                                          onChange={(ev) => setValue(t.visitDoctorId, p.id, ev.target.value)} onKeyDown={onResultKey} aria-label={p.name} />
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
                        <input className="lab-input" value={e.remarks} onChange={(ev) => setRemarks(t.visitDoctorId, ev.target.value)} placeholder="Any note (optional)" />
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
