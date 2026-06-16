import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus } from 'lucide-react';
import { useAccountsStore } from '../../../store/useAccountsStore';
import './accParam.scss';

export default function SubGL() {
  const { entityType } = useParams();
  const navigate = useNavigate();
  const { mainGLs, subGLs, fetchMainGLs, fetchSubGLs, createSubGL, updateSubGL, deleteSubGL } = useAccountsStore();

  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: '', mainGlId: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([fetchMainGLs(entityType), fetchSubGLs(entityType)]).finally(() => setLoading(false));
  }, [entityType]);

  const openAdd = () => {
    setForm({ name: '', mainGlId: mainGLs[0]?.id || '' });
    setModal({ mode: 'add' });
  };
  const openEdit = (row) => { setForm({ name: row.name, mainGlId: row.mainGlId }); setModal({ mode: 'edit', row }); };
  const closeModal = () => setModal(null);

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Name is required');
    if (!form.mainGlId) return toast.error('Select a Main GL');
    setSaving(true);
    try {
      if (modal.mode === 'add') {
        await createSubGL({ ...form, entity_type: entityType });
        toast.success('Sub GL created');
      } else {
        await updateSubGL(modal.row.id, { name: form.name });
        toast.success('Sub GL updated');
      }
      closeModal();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this Sub GL? All child Main Accounts will also be removed.')) return;
    try { await deleteSubGL(id); toast.success('Deleted'); }
    catch (err) { toast.error(err.message); }
  };

  return (
    <div className="acc-param-page">
      <div className="acc-param-page__header">
        <div className="acc-param-page__header-left">
          <button className="acc-param-page__back" onClick={() => navigate(`/accounts/${entityType}/parameters`)}>
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div>
            <h2>Sub GL</h2>
            <p>Level 2 — auto code: E-1.1, E-1.2 …</p>
          </div>
        </div>
        <button className="acc-param-page__btn-save" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }} onClick={openAdd}>
          <Plus className="w-4 h-4" /> Add Sub GL
        </button>
      </div>

      <div className="acc-param-page__table-wrap">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Parent (Main GL)</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className="empty-row"><td colSpan={4}>Loading…</td></tr>
            ) : subGLs.length === 0 ? (
              <tr className="empty-row"><td colSpan={4}>No Sub GLs yet. Add a Main GL first, then create Sub GLs.</td></tr>
            ) : subGLs.map((row) => (
              <tr key={row.id}>
                <td><span className="code-badge">{row.code}</span></td>
                <td>{row.name}</td>
                <td><span className="code-badge">{row.mainGL?.code}</span> {row.mainGL?.name}</td>
                <td>
                  <div className="actions">
                    <button className="btn-edit" onClick={() => openEdit(row)}>Edit</button>
                    <button className="btn-del" onClick={() => handleDelete(row.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="acc-param-page__overlay" onClick={closeModal}>
          <div className="acc-param-page__modal" onClick={(e) => e.stopPropagation()}>
            <h3>{modal.mode === 'add' ? 'Add Sub GL' : 'Edit Sub GL'}</h3>

            <div className="acc-param-page__field">
              <label>Name</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Current Assets" autoFocus />
            </div>

            {modal.mode === 'add' && (
              <div className="acc-param-page__field">
                <label>Parent — Main GL</label>
                <select value={form.mainGlId} onChange={(e) => setForm((f) => ({ ...f, mainGlId: e.target.value }))}>
                  <option value="">— Select Main GL —</option>
                  {mainGLs.map((g) => <option key={g.id} value={g.id}>{g.code} — {g.name}</option>)}
                </select>
              </div>
            )}

            <div className="acc-param-page__modal-actions">
              <button className="acc-param-page__btn-cancel" onClick={closeModal}>Cancel</button>
              <button className="acc-param-page__btn-save" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
