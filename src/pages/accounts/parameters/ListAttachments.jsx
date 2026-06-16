import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus, ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react';
import { useAccountsStore } from '../../../store/useAccountsStore';
import './ListAttachments.scss';

const SYSTEM_HEADS = [
  { key: 'employee', label: 'Employees',          hint: 'Pulled from HR — Employee Database' },
  { key: 'vendor',   label: 'Vendors / Suppliers', hint: 'Pulled from Inventory module' },
  { key: 'doctor',   label: 'Doctors / Consultants', hint: 'Pulled from Clinic module' },
];

export default function ListAttachments() {
  const { entityType } = useParams();
  const navigate = useNavigate();
  const {
    payeeHeads, payeeEntries, linkedEmployees, linkedSuppliers,
    fetchPayeeHeads, fetchPayeeEntries, fetchLinkedEmployees, fetchLinkedSuppliers,
    createPayeeHead, updatePayeeHead, deletePayeeHead,
    createPayeeEntry, deletePayeeEntry,
  } = useAccountsStore();

  const [loading, setLoading] = useState(true);
  const [expandedHead, setExpandedHead] = useState(null);
  const [headModal, setHeadModal] = useState(null);
  const [headName, setHeadName] = useState('');
  const [entryModal, setEntryModal] = useState(null); // { headId }
  const [entryName, setEntryName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([fetchPayeeHeads(entityType), fetchLinkedEmployees(), fetchLinkedSuppliers()]).finally(() => setLoading(false));
  }, [entityType]);

  const toggleHead = async (headId) => {
    if (expandedHead === headId) { setExpandedHead(null); return; }
    setExpandedHead(headId);
    await fetchPayeeEntries(headId);
  };

  // Head modal
  const openAddHead = () => { setHeadName(''); setHeadModal({ mode: 'add' }); };
  const openEditHead = (h) => { setHeadName(h.name); setHeadModal({ mode: 'edit', row: h }); };
  const closeHeadModal = () => setHeadModal(null);

  const saveHead = async () => {
    if (!headName.trim()) return toast.error('Head name is required');
    setSaving(true);
    try {
      if (headModal.mode === 'add') {
        await createPayeeHead({ name: headName, sourceType: 'manual', entity_type: entityType });
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
    try { await deletePayeeHead(id); toast.success('Deleted'); if (expandedHead === id) setExpandedHead(null); }
    catch (err) { toast.error(err.message); }
  };

  // Entry modal
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

  return (
    <div className="list-attach">
      <div className="list-attach__header">
        <div className="list-attach__header-left">
          <button className="acc-param-page__back" onClick={() => navigate(`/accounts/${entityType}/parameters`)}>
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div>
            <h2>List Attachments</h2>
            <p>Payee heads — system-linked &amp; custom lists</p>
          </div>
        </div>
        <button className="acc-param-page__btn-save" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }} onClick={openAddHead}>
          <Plus className="w-4 h-4" /> Add Custom Head
        </button>
      </div>

      {/* System-linked heads */}
      <div className="list-attach__section-label">System-Linked Lists</div>
      <div className="list-attach__list">
        {SYSTEM_HEADS.map((sh) => (
          <div key={sh.key} className="list-attach__head system">
            <div className="list-attach__head-row">
              <div className="list-attach__head-info">
                <span className="list-attach__head-name">{sh.label}</span>
                <span className="list-attach__head-hint">{sh.hint}</span>
              </div>
              <button
                className="list-attach__expand-btn"
                onClick={() => toggleHead(`sys-${sh.key}`)}
              >
                {expandedHead === `sys-${sh.key}` ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {expandedHead === `sys-${sh.key}` && (
              <div className="list-attach__entries">
                {sh.key === 'employee' && (
                  loading ? <p className="list-attach__empty">Loading…</p>
                  : linkedEmployees.length === 0 ? <p className="list-attach__empty">No employees found</p>
                  : linkedEmployees.map((e) => (
                    <div key={e.id} className="list-attach__entry-row">
                      <span>{e.firstName} {e.lastName}</span>
                    </div>
                  ))
                )}
                {sh.key === 'vendor' && (
                  loading ? <p className="list-attach__empty">Loading…</p>
                  : linkedSuppliers.length === 0 ? <p className="list-attach__empty">No suppliers found in Inventory module</p>
                  : linkedSuppliers.map((s) => (
                    <div key={s.id} className="list-attach__entry-row">
                      <span>{s.name}</span>
                    </div>
                  ))
                )}
                {sh.key === 'doctor' && (
                  <p className="list-attach__empty">Connected when Clinic — Doctors module data is available</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Custom heads */}
      <div className="list-attach__section-label" style={{ marginTop: '1.5rem' }}>Custom Lists</div>
      <div className="list-attach__list">
        {loading ? <p className="list-attach__empty">Loading…</p>
        : payeeHeads.filter((h) => h.sourceType === 'manual').length === 0 ? (
          <p className="list-attach__empty">No custom heads yet. Click "Add Custom Head" to create one.</p>
        ) : payeeHeads.filter((h) => h.sourceType === 'manual').map((h) => (
          <div key={h.id} className="list-attach__head custom">
            <div className="list-attach__head-row">
              <div className="list-attach__head-info">
                <span className="list-attach__head-name">{h.name}</span>
              </div>
              <div className="list-attach__head-actions">
                <button className="btn-icon" title="Edit" onClick={() => openEditHead(h)}><Pencil className="w-3.5 h-3.5" /></button>
                <button className="btn-icon danger" title="Delete" onClick={() => removeHead(h.id)}><Trash2 className="w-3.5 h-3.5" /></button>
                <button className="btn-icon" title="Add Entry" onClick={() => openAddEntry(h.id)}><Plus className="w-3.5 h-3.5" /></button>
                <button className="list-attach__expand-btn" onClick={() => toggleHead(h.id)}>
                  {expandedHead === h.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {expandedHead === h.id && (
              <div className="list-attach__entries">
                {payeeEntries.length === 0 ? (
                  <p className="list-attach__empty">No entries yet. Click + to add.</p>
                ) : payeeEntries.map((e) => (
                  <div key={e.id} className="list-attach__entry-row">
                    <span>{e.name}</span>
                    <button className="btn-icon danger" onClick={() => removeEntry(e.id, h.id)}><Trash2 className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

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
