import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus } from 'lucide-react';
import { useAccountsStore } from '../../../store/useAccountsStore';
import './accParam.scss';

export default function MainGL() {
  const { entityType } = useParams();
  const navigate = useNavigate();
  const { mainGLs, fetchMainGLs, createMainGL, updateMainGL, deleteMainGL } = useAccountsStore();

  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchMainGLs(entityType).finally(() => setLoading(false));
  }, [entityType]);

  const openAdd = () => { setForm({ name: '' }); setModal({ mode: 'add' }); };
  const openEdit = (row) => { setForm({ name: row.name }); setModal({ mode: 'edit', row }); };
  const closeModal = () => setModal(null);

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Name is required');
    setSaving(true);
    try {
      if (modal.mode === 'add') {
        await createMainGL({ name: form.name, entity_type: entityType });
        toast.success('Main GL created');
      } else {
        await updateMainGL(modal.row.id, { name: form.name });
        toast.success('Main GL updated');
      }
      closeModal();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this Main GL? All child Sub GLs and accounts will also be removed.')) return;
    try {
      await deleteMainGL(id);
      toast.success('Deleted');
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="acc-param-page">
      <div className="acc-param-page__header">
        <div className="acc-param-page__header-left">
          <button className="acc-param-page__back" onClick={() => navigate(`/accounts/${entityType}/parameters`)}>
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div>
            <h2>Main GL</h2>
            <p>Level 1 — auto code: E-1, E-2 …</p>
          </div>
        </div>
        <button className="acc-param-page__btn-save" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }} onClick={openAdd}>
          <Plus className="w-4 h-4" /> Add Main GL
        </button>
      </div>

      <div className="acc-param-page__table-wrap">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className="empty-row"><td colSpan={3}>Loading…</td></tr>
            ) : mainGLs.length === 0 ? (
              <tr className="empty-row"><td colSpan={3}>No Main GLs yet. Click "Add Main GL" to create one.</td></tr>
            ) : mainGLs.map((row) => (
              <tr key={row.id}>
                <td><span className="code-badge">{row.code}</span></td>
                <td>{row.name}</td>
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
            <h3>{modal.mode === 'add' ? 'Add Main GL' : 'Edit Main GL'}</h3>

            <div className="acc-param-page__field">
              <label>Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Assets"
                autoFocus
              />
            </div>

            <div className="acc-param-page__modal-actions">
              <button className="acc-param-page__btn-cancel" onClick={closeModal}>Cancel</button>
              <button className="acc-param-page__btn-save" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
