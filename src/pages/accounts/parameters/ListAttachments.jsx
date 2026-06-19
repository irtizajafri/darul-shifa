import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus, ChevronDown, ChevronUp, Pencil, Trash2, Link2, CheckCircle2 } from 'lucide-react';
import { useAccountsStore } from '../../../store/useAccountsStore';
import './ListAttachments.scss';

const API = 'http://localhost:5001/api/accounts';

const SOURCE_BADGE = {
  employee: { label: 'HR Module',        color: '#3b82f6' },
  vendor:   { label: 'Inventory Module', color: '#f59e0b' },
  doctor:   { label: 'Clinic Module',    color: '#10b981' },
  manual:   { label: 'Custom',           color: '#8b5cf6' },
};

const emptyLink = () => ({ mainGlId: '', subGlId: '', mainAccountId: '', subAccountId: '', subGLs: [], mainAccs: [], subAccs: [], saving: false });

export default function ListAttachments() {
  const { entityType } = useParams();
  const navigate = useNavigate();
  const {
    payeeHeads, payeeEntries, linkedEmployees, linkedSuppliers, mainGLs,
    fetchPayeeHeads, fetchPayeeEntries, fetchLinkedEmployees, fetchLinkedSuppliers, fetchMainGLs,
    createPayeeHead, updatePayeeHead, deletePayeeHead,
    createPayeeEntry, deletePayeeEntry,
  } = useAccountsStore();

  const [loading, setLoading] = useState(true);
  const [expandedHead, setExpandedHead] = useState(null);
  const [expandedLink, setExpandedLink] = useState(null); // headId whose link section is open
  const [linkState, setLinkState] = useState({}); // { [headId]: { mainGlId, subGlId, mainAccountId, subAccountId, subGLs, mainAccs, subAccs, saving } }

  const [headModal, setHeadModal] = useState(null);
  const [headName, setHeadName] = useState('');
  const [entryModal, setEntryModal] = useState(null);
  const [entryName, setEntryName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchPayeeHeads(entityType),
      fetchMainGLs(entityType),
      fetchLinkedEmployees(),
      fetchLinkedSuppliers(),
    ]).finally(() => setLoading(false));
  }, [entityType]);

  // ── Entries expand ────────────────────────────────────────────────────────
  const toggleHead = async (headId) => {
    if (expandedHead === headId) { setExpandedHead(null); return; }
    setExpandedHead(headId);
    if (typeof headId === 'number') await fetchPayeeEntries(headId);
  };

  // ── Link account cascade ──────────────────────────────────────────────────
  const openLink = (head) => {
    const s = head.subAccount;
    const initial = {
      mainGlId:      s?.mainAccount?.subGL?.mainGL?.id  ? String(s.mainAccount.subGL.mainGL.id)  : '',
      subGlId:       s?.mainAccount?.subGL?.id           ? String(s.mainAccount.subGL.id)          : '',
      mainAccountId: s?.mainAccount?.id                  ? String(s.mainAccount.id)                : '',
      subAccountId:  s?.id                               ? String(s.id)                            : '',
      subGLs: [], mainAccs: [], subAccs: [], saving: false,
    };
    setLinkState((prev) => ({ ...prev, [head.id]: initial }));
    setExpandedLink(head.id);

    // Pre-load cascades if already linked
    if (initial.mainGlId) loadSubGLs(head.id, initial.mainGlId, initial.subGlId, initial.mainAccountId);
  };

  const closeLink = (headId) => {
    setExpandedLink(null);
    setLinkState((prev) => { const n = { ...prev }; delete n[headId]; return n; });
  };

  const updLink = (headId, patch) =>
    setLinkState((prev) => ({ ...prev, [headId]: { ...prev[headId], ...patch } }));

  const loadSubGLs = async (headId, mainGlId, preSubGlId = '', preMainAccId = '') => {
    updLink(headId, { mainGlId, subGlId: '', mainAccountId: '', subAccountId: '', subGLs: [], mainAccs: [], subAccs: [] });
    if (!mainGlId) return;
    const r = await fetch(`${API}/sub-gl?entityType=${entityType}&mainGlId=${mainGlId}`);
    const j = await r.json();
    const subGLs = Array.isArray(j?.data) ? j.data : [];
    updLink(headId, { subGLs });
    if (preSubGlId) loadMainAccs(headId, preSubGlId, preMainAccId);
    else updLink(headId, { subGlId: '' });
  };

  const loadMainAccs = async (headId, subGlId, preMainAccId = '') => {
    updLink(headId, { subGlId, mainAccountId: '', subAccountId: '', mainAccs: [], subAccs: [] });
    if (!subGlId) return;
    const r = await fetch(`${API}/main-account?entityType=${entityType}&subGlId=${subGlId}`);
    const j = await r.json();
    const mainAccs = Array.isArray(j?.data) ? j.data : [];
    updLink(headId, { mainAccs });
    if (preMainAccId) loadSubAccs(headId, preMainAccId);
    else updLink(headId, { mainAccountId: '' });
  };

  const loadSubAccs = async (headId, mainAccountId) => {
    updLink(headId, { mainAccountId, subAccountId: '', subAccs: [] });
    if (!mainAccountId) return;
    const r = await fetch(`${API}/sub-account?entityType=${entityType}&mainAccountId=${mainAccountId}`);
    const j = await r.json();
    updLink(headId, { subAccs: Array.isArray(j?.data) ? j.data : [] });
  };

  const saveLink = async (headId) => {
    const ls = linkState[headId];
    if (!ls?.subAccountId) { toast.error('Select a Sub Account to link'); return; }
    updLink(headId, { saving: true });
    try {
      await updatePayeeHead(headId, { subAccountId: Number(ls.subAccountId) });
      await fetchPayeeHeads(entityType);
      toast.success('Account linked');
      closeLink(headId);
    } catch (err) { toast.error(err.message); }
    finally { updLink(headId, { saving: false }); }
  };

  const removeLink = async (headId) => {
    try {
      await updatePayeeHead(headId, { subAccountId: null });
      await fetchPayeeHeads(entityType);
      toast.success('Link removed');
    } catch (err) { toast.error(err.message); }
  };

  // ── Head modal ────────────────────────────────────────────────────────────
  const openAddHead = () => { setHeadName(''); setHeadModal({ mode: 'add' }); };
  const openEditHead = (h) => { setHeadName(h.name); setHeadModal({ mode: 'edit', row: h }); };
  const closeHeadModal = () => setHeadModal(null);

  const saveHead = async () => {
    if (!headName.trim()) return toast.error('Head name is required');
    setSaving(true);
    try {
      if (headModal.mode === 'add') {
        await createPayeeHead({ name: headName, sourceType: 'manual', entityType });
        toast.success('Head created');
      } else {
        await updatePayeeHead(headModal.row.id, { name: headName });
        toast.success('Head updated');
      }
      closeHeadModal();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const removeHead = async (id) => {
    if (!confirm('Delete this head and all its entries?')) return;
    try {
      await deletePayeeHead(id);
      toast.success('Deleted');
      if (expandedHead === id) setExpandedHead(null);
    } catch (err) { toast.error(err.message); }
  };

  // ── Entry modal ───────────────────────────────────────────────────────────
  const openAddEntry = (headId) => { setEntryName(''); setEntryModal({ headId }); };
  const closeEntryModal = () => setEntryModal(null);

  const saveEntry = async () => {
    if (!entryName.trim()) return toast.error('Entry name is required');
    setSaving(true);
    try {
      await createPayeeEntry({ payeeHeadId: entryModal.headId, name: entryName });
      await fetchPayeeEntries(entryModal.headId);
      toast.success('Entry added');
      closeEntryModal();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const removeEntry = async (id, headId) => {
    if (!confirm('Remove this entry?')) return;
    try { await deletePayeeEntry(id); await fetchPayeeEntries(headId); toast.success('Removed'); }
    catch (err) { toast.error(err.message); }
  };

  const systemHeads = payeeHeads.filter((h) => h.sourceType !== 'manual');
  const customHeads = payeeHeads.filter((h) => h.sourceType === 'manual');

  const renderEntries = (head) => {
    if (head.sourceType === 'employee') {
      if (linkedEmployees.length === 0) return <p className="list-attach__empty">No employees found in HR module</p>;
      return linkedEmployees.map((e) => (
        <div key={e.id} className="list-attach__entry-row"><span>{e.firstName} {e.lastName}</span></div>
      ));
    }
    if (head.sourceType === 'vendor') {
      if (linkedSuppliers.length === 0) return <p className="list-attach__empty">No suppliers found in Inventory module</p>;
      return linkedSuppliers.map((s) => (
        <div key={s.id} className="list-attach__entry-row"><span>{s.name}</span></div>
      ));
    }
    if (head.sourceType === 'doctor') {
      return <p className="list-attach__empty">Connected when Clinic — Doctors data is available</p>;
    }
    // manual
    if (expandedHead !== head.id) return null;
    if (payeeEntries.length === 0) return <p className="list-attach__empty">No entries yet. Click + to add.</p>;
    return payeeEntries.map((e) => (
      <div key={e.id} className="list-attach__entry-row">
        <span>{e.name}</span>
        <button className="btn-icon danger" onClick={() => removeEntry(e.id, head.id)}><Trash2 className="w-3 h-3" /></button>
      </div>
    ));
  };

  const renderLinkSection = (head) => {
    const ls = linkState[head.id] || emptyLink();
    return (
      <div className="list-attach__link-form">
        <div className="list-attach__link-grid">
          <div className="list-attach__link-field">
            <label>Main GL</label>
            <select value={ls.mainGlId} onChange={(e) => loadSubGLs(head.id, e.target.value)}>
              <option value="">Select Main GL</option>
              {mainGLs.map((g) => <option key={g.id} value={g.id}>{g.code} — {g.name}</option>)}
            </select>
          </div>
          <div className="list-attach__link-field">
            <label>Sub GL</label>
            <select value={ls.subGlId} onChange={(e) => loadMainAccs(head.id, e.target.value)} disabled={!ls.mainGlId}>
              <option value="">Select Sub GL</option>
              {ls.subGLs.map((g) => <option key={g.id} value={g.id}>{g.code} — {g.name}</option>)}
            </select>
          </div>
          <div className="list-attach__link-field">
            <label>Main Account</label>
            <select value={ls.mainAccountId} onChange={(e) => loadSubAccs(head.id, e.target.value)} disabled={!ls.subGlId}>
              <option value="">Select Main Account</option>
              {ls.mainAccs.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
            </select>
          </div>
          <div className="list-attach__link-field">
            <label>Sub Account</label>
            <select value={ls.subAccountId} onChange={(e) => updLink(head.id, { subAccountId: e.target.value })} disabled={!ls.mainAccountId || ls.subAccs.length === 0}>
              <option value="">Select Sub Account</option>
              {ls.subAccs.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
            </select>
          </div>
        </div>
        <div className="list-attach__link-actions">
          <button className="list-attach__link-cancel" onClick={() => closeLink(head.id)}>Cancel</button>
          <button className="list-attach__link-save" onClick={() => saveLink(head.id)} disabled={ls.saving || !ls.subAccountId}>
            {ls.saving ? 'Saving…' : 'Save Link'}
          </button>
        </div>
      </div>
    );
  };

  const renderHead = (head) => {
    const badge = SOURCE_BADGE[head.sourceType] || SOURCE_BADGE.manual;
    const isManual = head.sourceType === 'manual';
    const linked = head.subAccount;
    const isLinkOpen = expandedLink === head.id;
    const isExpanded = expandedHead === head.id || (head.sourceType !== 'manual' && expandedHead === `sys-${head.sourceType}`);

    return (
      <div key={head.id} className={`list-attach__head ${isManual ? 'custom' : 'system'}`}>
        <div className="list-attach__head-row">
          <div className="list-attach__head-info">
            <div className="list-attach__head-top">
              <span className="list-attach__head-name">{head.name}</span>
              <span className="list-attach__badge" style={{ background: badge.color }}>{badge.label}</span>
            </div>
            {linked ? (
              <div className="list-attach__linked-acc">
                <CheckCircle2 className="w-3.5 h-3.5" style={{ color: '#22c55e' }} />
                <span>{linked.code} — {linked.name}</span>
                <button className="list-attach__unlink-btn" onClick={() => removeLink(head.id)}>✕ Unlink</button>
              </div>
            ) : (
              <span className="list-attach__no-link">No account linked</span>
            )}
          </div>
          <div className="list-attach__head-actions">
            <button
              className={`btn-icon ${isLinkOpen ? 'active' : ''}`}
              title="Link to Account"
              onClick={() => isLinkOpen ? closeLink(head.id) : openLink(head)}
            >
              <Link2 className="w-3.5 h-3.5" />
            </button>
            {isManual && (
              <>
                <button className="btn-icon" title="Edit" onClick={() => openEditHead(head)}><Pencil className="w-3.5 h-3.5" /></button>
                <button className="btn-icon danger" title="Delete" onClick={() => removeHead(head.id)}><Trash2 className="w-3.5 h-3.5" /></button>
                <button className="btn-icon" title="Add Entry" onClick={() => openAddEntry(head.id)}><Plus className="w-3.5 h-3.5" /></button>
              </>
            )}
            <button
              className="list-attach__expand-btn"
              onClick={() => isManual ? toggleHead(head.id) : toggleHead(`sys-${head.sourceType}`)}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {isLinkOpen && renderLinkSection(head)}

        {isExpanded && (
          <div className="list-attach__entries">
            {renderEntries(head)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="list-attach">
      <div className="list-attach__header">
        <div className="list-attach__header-left">
          <button className="acc-param-page__back" onClick={() => navigate(`/accounts/${entityType}/parameters`)}>
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div>
            <h2>List Attachments</h2>
            <p>Payee heads — link each head to a Sub Account in your GL hierarchy</p>
          </div>
        </div>
        <button className="acc-param-page__btn-save" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }} onClick={openAddHead}>
          <Plus className="w-4 h-4" /> Add Custom Head
        </button>
      </div>

      {loading ? (
        <p className="list-attach__empty">Loading…</p>
      ) : (
        <>
          <div className="list-attach__section-label">System-Linked Lists</div>
          <div className="list-attach__list">
            {systemHeads.map(renderHead)}
          </div>

          <div className="list-attach__section-label" style={{ marginTop: '1.5rem' }}>Custom Lists</div>
          <div className="list-attach__list">
            {customHeads.length === 0 ? (
              <p className="list-attach__empty">No custom heads yet. Click "Add Custom Head" to create one.</p>
            ) : customHeads.map(renderHead)}
          </div>
        </>
      )}

      {/* Head Modal */}
      {headModal && (
        <div className="acc-param-page__overlay" onClick={closeHeadModal}>
          <div className="acc-param-page__modal" onClick={(e) => e.stopPropagation()}>
            <h3>{headModal.mode === 'add' ? 'Add Custom Head' : 'Edit Head Name'}</h3>
            <div className="acc-param-page__field">
              <label>Head Name</label>
              <input value={headName} onChange={(e) => setHeadName(e.target.value)} placeholder="e.g. NGO Partners" autoFocus />
            </div>
            <div className="acc-param-page__modal-actions">
              <button className="acc-param-page__btn-cancel" onClick={closeHeadModal}>Cancel</button>
              <button className="acc-param-page__btn-save" onClick={saveHead} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Entry Modal */}
      {entryModal && (
        <div className="acc-param-page__overlay" onClick={closeEntryModal}>
          <div className="acc-param-page__modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add Entry</h3>
            <div className="acc-param-page__field">
              <label>Name</label>
              <input value={entryName} onChange={(e) => setEntryName(e.target.value)} placeholder="Entry name" autoFocus />
            </div>
            <div className="acc-param-page__modal-actions">
              <button className="acc-param-page__btn-cancel" onClick={closeEntryModal}>Cancel</button>
              <button className="acc-param-page__btn-save" onClick={saveEntry} disabled={saving}>{saving ? 'Saving…' : 'Add'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
