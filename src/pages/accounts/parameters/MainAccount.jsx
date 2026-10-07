import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus } from 'lucide-react';
import { useAccountsStore } from '../../../store/useAccountsStore';
import SearchableSelect from '../../../components/ui/SearchableSelect';
import { confirmDialog } from '../../../components/ui/ConfirmDialog';
import useModalKeys from '../../../hooks/useModalKeys';
import './accParam.scss';

const API = 'http://localhost:5001/api/accounts';
const glLabel = (g) => `${g.code} — ${g.name}`;

export default function MainAccount() {
  const { entityType } = useParams();
  const navigate = useNavigate();
  const { mainGLs, mainAccounts, fetchMainGLs, fetchMainAccounts, createMainAccount, updateMainAccount, deleteMainAccount } = useAccountsStore();

  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: '', mainGlId: '', subGlId: '' });
  const [modalSubGLs, setModalSubGLs] = useState([]);
  const [loadingSubGLs, setLoadingSubGLs] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([fetchMainGLs(entityType), fetchMainAccounts(entityType)]).finally(() => setLoading(false));
  }, [entityType]);

  const openAdd = () => {
    setForm({ name: '', mainGlId: '', subGlId: '' });
    setModalSubGLs([]);
    setModal({ mode: 'add' });
  };
  const openEdit = (row) => {
    setForm({ name: row.name, mainGlId: '', subGlId: row.subGlId });
    setModalSubGLs([]);
    setModal({ mode: 'edit', row });
  };
  const closeModal = () => { setModal(null); setModalSubGLs([]); };

  useModalKeys({ active: !!modal, onEsc: closeModal });

  const handleMainGlChange = async (mainGlId) => {
    setForm((f) => ({ ...f, mainGlId, subGlId: '' }));
    if (!mainGlId) { setModalSubGLs([]); return; }
    setLoadingSubGLs(true);
    try {
      const res = await fetch(`${API}/sub-gl?entityType=${entityType}&mainGlId=${mainGlId}`);
      const json = await res.json();
      setModalSubGLs(Array.isArray(json?.data) ? json.data : []);
    } catch { setModalSubGLs([]); }
    finally { setLoadingSubGLs(false); }
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Name is required');
    if (modal.mode === 'add') {
      if (!form.mainGlId) return toast.error('Select a Main GL');
      if (!form.subGlId) return toast.error('Select a Sub GL');
    }
    setSaving(true);
    try {
      if (modal.mode === 'add') {
        await createMainAccount({ name: form.name, subGlId: form.subGlId, entityType });
        toast.success('Main Account created');
      } else {
        await updateMainAccount(modal.row.id, { name: form.name });
        toast.success('Main Account updated');
      }
      await fetchMainAccounts(entityType);
      closeModal();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!(await confirmDialog({ title: 'Delete Main Account', message: 'Delete this Main Account? All child Sub Accounts will also be removed.', confirmLabel: 'Delete', danger: true }))) return;
    try { await deleteMainAccount(id); toast.success('Deleted'); }
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
            <h2>Main Account</h2>
            <p>Level 3 — auto code: E-1.1.1 …</p>
          </div>
        </div>
        <button className="acc-param-page__btn-save" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }} onClick={openAdd}>
          <Plus className="w-4 h-4" /> Add Main Account
        </button>
      </div>

      <div className="acc-param-page__table-wrap">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Parent (Sub GL)</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className="empty-row"><td colSpan={4}>Loading…</td></tr>
            ) : mainAccounts.length === 0 ? (
              <tr className="empty-row"><td colSpan={4}>No Main Accounts yet. Add Sub GLs first.</td></tr>
            ) : mainAccounts.map((row) => (
              <tr key={row.id}>
                <td><span className="code-badge">{row.code}</span></td>
                <td>{row.name}</td>
                <td><span className="code-badge">{row.subGL?.code}</span> {row.subGL?.name}</td>
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
          <div className="acc-param-page__modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>{modal.mode === 'add' ? 'Add Main Account' : 'Edit Main Account'}</h3>

            <div className="acc-param-page__field">
              <label>Name</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Cash & Bank" autoFocus />
            </div>

            {modal.mode === 'add' && (
              <>
                <div className="acc-param-page__field">
                  <label>Main GL</label>
                  <SearchableSelect
                    options={mainGLs}
                    value={form.mainGlId}
                    onChange={(v) => handleMainGlChange(v)}
                    getLabel={glLabel}
                    placeholder="— Select Main GL —"
                  />
                </div>

                <div className="acc-param-page__field">
                  <label>Sub GL</label>
                  <SearchableSelect
                    options={modalSubGLs}
                    value={form.subGlId}
                    onChange={(v) => setForm((f) => ({ ...f, subGlId: v }))}
                    disabled={!form.mainGlId || loadingSubGLs}
                    getLabel={glLabel}
                    placeholder={!form.mainGlId ? '— Select Main GL first —' : loadingSubGLs ? 'Loading…' : '— Select Sub GL —'}
                  />
                </div>
              </>
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
