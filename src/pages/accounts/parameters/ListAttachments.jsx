import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus, ChevronDown, ChevronUp, Pencil, Trash2, Link2, CheckCircle2, X } from 'lucide-react';
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
    addHeadAccount, removeHeadAccount,
  } = useAccountsStore();

  const [loading, setLoading] = useState(true);
  const [expandedHead, setExpandedHead] = useState(null);
  const [expandedLink, setExpandedLink] = useState(null);
  const [linkState, setLinkState] = useState({});

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

  const [supplierModal, setSupplierModal] = useState(null);
  const [savingSuppliers, setSavingSuppliers] = useState(false);

  // ── Entries expand ────────────────────────────────────────────────────────
  const toggleHead = async (head) => {
    if (expandedHead === head.id) { setExpandedHead(null); return; }
    setExpandedHead(head.id);
    if (head.sourceType === 'manual') {
      await fetchPayeeEntries(head.id);
    }
    if (head.sourceType === 'vendor') {
      const r = await fetch(`${API}/payee-entries?headId=${head.id}`);
      const j = await r.json();
      const checkedNames = new Set((Array.isArray(j?.data) ? j.data : []).map((e) => e.name));
      setSupplierModal({
        headId: head.id,
        headName: head.name,
        allSuppliers: linkedSuppliers,
        checked: checkedNames,
      });
    }
  };

  const saveSupplierSelection = async () => {
    if (!supplierModal) return;
    setSavingSuppliers(true);
    try {
      const r = await fetch(`${API}/payee-entries/bulk-save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payeeHeadId: supplierModal.headId, subAccountId: supplierModal.subAccountId, names: [...supplierModal.checked] }),
      });
      const j = await r.json();
      if (!r.ok || j?.ok === false) throw new Error(j?.message || 'Failed');
      setSupplierModal(null);
      toast.success('Suppliers saved');
    } catch (err) { toast.error(err.message); }
    finally { setSavingSuppliers(false); }
  };

  // ── Link account cascade ──────────────────────────────────────────────────
  const openLink = (head) => {
    setLinkState((prev) => ({ ...prev, [head.id]: emptyLink() }));
    setExpandedLink(head.id);
  };

  const closeLink = (headId) => {
    setExpandedLink(null);
    setLinkState((prev) => { const n = { ...prev }; delete n[headId]; return n; });
  };

  const updLink = (headId, patch) =>
    setLinkState((prev) => ({ ...prev, [headId]: { ...prev[headId], ...patch } }));

  const loadSubGLs = async (headId, mainGlId) => {
    updLink(headId, { mainGlId, subGlId: '', mainAccountId: '', subAccountId: '', subGLs: [], mainAccs: [], subAccs: [] });
    if (!mainGlId) return;
    const r = await fetch(`${API}/sub-gl?entityType=${entityType}&mainGlId=${mainGlId}`);
    const j = await r.json();
    updLink(headId, { subGLs: Array.isArray(j?.data) ? j.data : [] });
  };

  const loadMainAccs = async (headId, subGlId) => {
    updLink(headId, { subGlId, mainAccountId: '', subAccountId: '', mainAccs: [], subAccs: [] });
    if (!subGlId) return;
    const r = await fetch(`${API}/main-account?entityType=${entityType}&subGlId=${subGlId}`);
    const j = await r.json();
    updLink(headId, { mainAccs: Array.isArray(j?.data) ? j.data : [] });
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

    // Check if already linked
    const head = payeeHeads.find((h) => h.id === headId);
    const alreadyLinked = (head?.linkedAccounts || []).some(
      (la) => String(la.subAccountId) === String(ls.subAccountId)
    );
    if (alreadyLinked) { toast.error('This account is already linked'); return; }

    updLink(headId, { saving: true });
    try {
      await addHeadAccount(headId, Number(ls.subAccountId));
      await fetchPayeeHeads(entityType);
      toast.success('Account linked');
      // Reset form but keep open for adding more
      setLinkState((prev) => ({ ...prev, [headId]: emptyLink() }));
    } catch (err) { toast.error(err.message); }
    finally { updLink(headId, { saving: false }); }
  };

  const handleRemoveLink = async (headId, subAccountId) => {
    try {
      await removeHeadAccount(headId, subAccountId);
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
      return null;
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

  const renderLinkedAccounts = (head) => {
    const links = head.linkedAccounts || [];
    if (links.length === 0) return <span className="list-attach__no-link">No account linked</span>;
    return (
      <div className="list-attach__linked-list">
        {links.map((la) => (
          <div key={la.id} className="list-attach__linked-tag">
            <CheckCircle2 size={11} style={{ color: '#22c55e', flexShrink: 0 }} />
            <span>{la.subAccount.code} — {la.subAccount.name}</span>
            <button
              className="list-attach__tag-remove"
              title="Remove link"
              onClick={() => handleRemoveLink(head.id, la.subAccountId)}
            >
              <X size={10} />
            </button>
          </div>
        ))}
      </div>
    );
  };

  const renderLinkSection = (head) => {
    const ls = linkState[head.id] || emptyLink();
    return (
      <div className="list-attach__link-form">
        <div className="list-attach__link-title">Add Account Link</div>
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
            <select
              value={ls.subAccountId}
              disabled={!ls.mainAccountId || ls.subAccs.length === 0}
              onChange={async (e) => {
                updLink(head.id, { subAccountId: e.target.value });
                if (head.sourceType === 'vendor' && e.target.value) {
                  const r = await fetch(`${API}/payee-entries?headId=${head.id}&subAccountId=${e.target.value}`);
                  const j = await r.json();
                  const checkedNames = new Set((Array.isArray(j?.data) ? j.data : []).map((en) => en.name));
                  setSupplierModal({ headId: head.id, subAccountId: e.target.value, headName: head.name, allSuppliers: linkedSuppliers, checked: checkedNames });
                }
              }}
            >
              <option value="">Select Sub Account</option>
              {ls.subAccs.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
            </select>
          </div>
        </div>
        <div className="list-attach__link-actions">
          <button className="list-attach__link-cancel" onClick={() => closeLink(head.id)}>Close</button>
          <button className="list-attach__link-save" onClick={() => saveLink(head.id)} disabled={ls.saving || !ls.subAccountId}>
            {ls.saving ? 'Saving…' : '+ Add Link'}
          </button>
        </div>
      </div>
    );
  };

  const renderHead = (head) => {
    const badge = SOURCE_BADGE[head.sourceType] || SOURCE_BADGE.manual;
    const isManual = head.sourceType === 'manual';
    const isLinkOpen = expandedLink === head.id;
    const isExpanded = expandedHead === head.id;

    return (
      <div key={head.id} className={`list-attach__head ${isManual ? 'custom' : 'system'}`}>
        <div className="list-attach__head-row">
          <div className="list-attach__head-info">
            <div className="list-attach__head-top">
              <span className="list-attach__head-name">{head.name}</span>
              <span className="list-attach__badge" style={{ background: badge.color }}>{badge.label}</span>
            </div>
            {renderLinkedAccounts(head)}
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
              onClick={() => toggleHead(head)}
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
            <p>Payee heads — link each head to one or more Sub Accounts in your GL hierarchy</p>
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

      {/* Supplier Modal */}
      {supplierModal && (
        <div className="acc-param-page__overlay" onClick={() => setSupplierModal(null)}>
          <div className="list-attach__supplier-modal" onClick={(e) => e.stopPropagation()}>
            <div className="list-attach__supplier-modal__header">
              <div>
                <div className="list-attach__supplier-modal__title">Select Suppliers</div>
                <div className="list-attach__supplier-modal__sub">{supplierModal.headName}</div>
              </div>
              <button className="list-attach__supplier-modal__close" onClick={() => setSupplierModal(null)}>✕</button>
            </div>

            <div className="list-attach__supplier-modal__select-all">
              <label className="list-attach__check-label">
                <input
                  type="checkbox"
                  checked={supplierModal.allSuppliers.length > 0 && supplierModal.checked.size === supplierModal.allSuppliers.length}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? new Set(supplierModal.allSuppliers.map((s) => s.name))
                      : new Set();
                    setSupplierModal((m) => ({ ...m, checked: next }));
                  }}
                />
                <span>Select All</span>
              </label>
              <span className="list-attach__supplier-modal__count">
                {supplierModal.checked.size} / {supplierModal.allSuppliers.length} selected
              </span>
            </div>

            <div className="list-attach__supplier-modal__list">
              {supplierModal.allSuppliers.map((s) => (
                <label
                  key={s.id}
                  className={`list-attach__supplier-modal__item ${supplierModal.checked.has(s.name) ? 'checked' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={supplierModal.checked.has(s.name)}
                    onChange={() => {
                      const next = new Set(supplierModal.checked);
                      next.has(s.name) ? next.delete(s.name) : next.add(s.name);
                      setSupplierModal((m) => ({ ...m, checked: next }));
                    }}
                  />
                  <span className="list-attach__supplier-modal__name">{s.name}</span>
                </label>
              ))}
            </div>

            <div className="list-attach__supplier-modal__footer">
              <button className="list-attach__link-cancel" onClick={() => setSupplierModal(null)}>Cancel</button>
              <button className="list-attach__link-save" onClick={saveSupplierSelection} disabled={savingSuppliers}>
                {savingSuppliers ? 'Saving…' : 'Save & Apply'}
              </button>
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
