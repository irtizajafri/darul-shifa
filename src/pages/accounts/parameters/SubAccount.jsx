import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus } from 'lucide-react';
import { useAccountsStore } from '../../../store/useAccountsStore';
import './accParam.scss';

const API = 'http://localhost:5001/api/accounts';

export default function SubAccount() {
  const { entityType } = useParams();
  const navigate = useNavigate();
  const { mainGLs, subAccounts, fetchMainGLs, fetchSubAccounts, createSubAccount, updateSubAccount, deleteSubAccount } = useAccountsStore();

  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: '', mainGlId: '', subGlId: '', mainAccountId: '' });
  const [modalSubGLs, setModalSubGLs] = useState([]);
  const [modalMainAccounts, setModalMainAccounts] = useState([]);
  const [loadingSubGLs, setLoadingSubGLs] = useState(false);
  const [loadingMainAccounts, setLoadingMainAccounts] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([fetchMainGLs(entityType), fetchSubAccounts(entityType)]).finally(() => setLoading(false));
  }, [entityType]);

  const openAdd = () => {
    setForm({ name: '', mainGlId: '', subGlId: '', mainAccountId: '' });
    setModalSubGLs([]);
    setModalMainAccounts([]);
    setModal({ mode: 'add' });
  };
  const openEdit = (row) => {
    setForm({ name: row.name, mainGlId: '', subGlId: '', mainAccountId: row.mainAccountId });
    setModalSubGLs([]);
    setModalMainAccounts([]);
    setModal({ mode: 'edit', row });
  };
  const closeModal = () => { setModal(null); setModalSubGLs([]); setModalMainAccounts([]); };

  const handleMainGlChange = async (mainGlId) => {
    setForm((f) => ({ ...f, mainGlId, subGlId: '', mainAccountId: '' }));
    setModalMainAccounts([]);
    if (!mainGlId) { setModalSubGLs([]); return; }
    setLoadingSubGLs(true);
    try {
      const res = await fetch(`${API}/sub-gl?entityType=${entityType}&mainGlId=${mainGlId}`);
      const json = await res.json();
      setModalSubGLs(Array.isArray(json?.data) ? json.data : []);
    } catch { setModalSubGLs([]); }
    finally { setLoadingSubGLs(false); }
  };

  const handleSubGlChange = async (subGlId) => {
    setForm((f) => ({ ...f, subGlId, mainAccountId: '' }));
    if (!subGlId) { setModalMainAccounts([]); return; }
    setLoadingMainAccounts(true);
    try {
      const res = await fetch(`${API}/main-account?entityType=${entityType}&subGlId=${subGlId}`);
      const json = await res.json();
      setModalMainAccounts(Array.isArray(json?.data) ? json.data : []);
    } catch { setModalMainAccounts([]); }
    finally { setLoadingMainAccounts(false); }
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Name is required');
    if (modal.mode === 'add') {
      if (!form.mainGlId) return toast.error('Select a Main GL');
      if (!form.subGlId) return toast.error('Select a Sub GL');
      if (!form.mainAccountId) return toast.error('Select a Main Account');
    }
    setSaving(true);
    try {
      if (modal.mode === 'add') {
        await createSubAccount({ name: form.name, mainAccountId: form.mainAccountId, entity_type: entityType });
        toast.success('Sub Account created');
      } else {
        await updateSubAccount(modal.row.id, { name: form.name });
        toast.success('Sub Account updated');
      }
      await fetchSubAccounts(entityType);
      closeModal();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this Sub Account?')) return;
    try { await deleteSubAccount(id); toast.success('Deleted'); }
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
            <h2>Sub Account</h2>
            <p>Level 4 — balance rolls up to all parent levels</p>
          </div>
        </div>
        <button className="acc-param-page__btn-save" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }} onClick={openAdd}>
          <Plus className="w-4 h-4" /> Add Sub Account
        </button>
      </div>

      <div className="acc-param-page__table-wrap">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Parent (Main Account)</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className="empty-row"><td colSpan={4}>Loading…</td></tr>
            ) : subAccounts.length === 0 ? (
              <tr className="empty-row"><td colSpan={4}>No Sub Accounts yet. Add Main Accounts first.</td></tr>
            ) : subAccounts.map((row) => (
              <tr key={row.id}>
                <td><span className="code-badge">{row.code}</span></td>
                <td>{row.name}</td>
                <td><span className="code-badge">{row.mainAccount?.code}</span> {row.mainAccount?.name}</td>
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
            <h3>{modal.mode === 'add' ? 'Add Sub Account' : 'Edit Sub Account'}</h3>

            <div className="acc-param-page__field">
              <label>Name</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Petty Cash" autoFocus />
            </div>

            {modal.mode === 'add' && (
              <>
                <div className="acc-param-page__field">
                  <label>Main GL</label>
                  <select value={form.mainGlId} onChange={(e) => handleMainGlChange(e.target.value)}>
                    <option value="">— Select Main GL —</option>
                    {mainGLs.map((g) => <option key={g.id} value={g.id}>{g.code} — {g.name}</option>)}
                  </select>
                </div>

                <div className="acc-param-page__field">
                  <label>Sub GL</label>
                  <select
                    value={form.subGlId}
                    onChange={(e) => handleSubGlChange(e.target.value)}
                    disabled={!form.mainGlId || loadingSubGLs}
                  >
                    <option value="">
                      {!form.mainGlId ? '— Select Main GL first —' : loadingSubGLs ? 'Loading…' : '— Select Sub GL —'}
                    </option>
                    {modalSubGLs.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
                  </select>
                </div>

                <div className="acc-param-page__field">
                  <label>Main Account</label>
                  <select
                    value={form.mainAccountId}
                    onChange={(e) => setForm((f) => ({ ...f, mainAccountId: e.target.value }))}
                    disabled={!form.subGlId || loadingMainAccounts}
                  >
                    <option value="">
                      {!form.subGlId ? '— Select Sub GL first —' : loadingMainAccounts ? 'Loading…' : '— Select Main Account —'}
                    </option>
                    {modalMainAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                  </select>
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
