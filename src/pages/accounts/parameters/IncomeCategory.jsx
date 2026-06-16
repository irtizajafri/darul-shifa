import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus } from 'lucide-react';
import { useAccountsStore } from '../../../store/useAccountsStore';
import './accParam.scss';

export default function IncomeCategory() {
  const { entityType } = useParams();
  const navigate = useNavigate();
  const { incomeCategories, fetchIncomeCategories, createIncomeCategory, updateIncomeCategory, deleteIncomeCategory } = useAccountsStore();

  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchIncomeCategories(entityType).finally(() => setLoading(false));
  }, [entityType]);

  const openAdd = () => { setName(''); setModal({ mode: 'add' }); };
  const openEdit = (row) => { setName(row.name); setModal({ mode: 'edit', row }); };
  const closeModal = () => setModal(null);

  const handleSave = async () => {
    if (!name.trim()) return toast.error('Category name is required');
    setSaving(true);
    try {
      if (modal.mode === 'add') {
        await createIncomeCategory({ name, entity_type: entityType });
        toast.success('Category created');
      } else {
        await updateIncomeCategory(modal.row.id, { name });
        toast.success('Category updated');
      }
      closeModal();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this income category?')) return;
    try { await deleteIncomeCategory(id); toast.success('Deleted'); }
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
            <h2>Account Category for Income</h2>
            <p>Income category names used in transactions</p>
          </div>
        </div>
        <button className="acc-param-page__btn-save" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }} onClick={openAdd}>
          <Plus className="w-4 h-4" /> Add Category
        </button>
      </div>

      <div className="acc-param-page__table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Category Name</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className="empty-row"><td colSpan={3}>Loading…</td></tr>
            ) : incomeCategories.length === 0 ? (
              <tr className="empty-row"><td colSpan={3}>No income categories yet. Click "Add Category".</td></tr>
            ) : incomeCategories.map((row, i) => (
              <tr key={row.id}>
                <td>{i + 1}</td>
                <td style={{ fontWeight: 500 }}>{row.name}</td>
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
            <h3>{modal.mode === 'add' ? 'Add Income Category' : 'Edit Income Category'}</h3>
            <div className="acc-param-page__field">
              <label>Category Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Donations, Zakat, OPD Income" autoFocus />
            </div>
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
