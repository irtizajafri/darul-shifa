import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus } from 'lucide-react';
import { useAccountsStore } from '../../../store/useAccountsStore';
import './accParam.scss';

export default function BankAccounts() {
  const { entityType } = useParams();
  const navigate = useNavigate();
  const { bankAccounts, fetchBankAccounts, createBankAccount, updateBankAccount, deleteBankAccount } = useAccountsStore();

  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ bankName: '', accountNumber: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchBankAccounts(entityType).finally(() => setLoading(false));
  }, [entityType]);

  const openAdd = () => { setForm({ bankName: '', accountNumber: '' }); setModal({ mode: 'add' }); };
  const openEdit = (row) => { setForm({ bankName: row.bankName, accountNumber: row.accountNumber }); setModal({ mode: 'edit', row }); };
  const closeModal = () => setModal(null);

  const handleSave = async () => {
    if (!form.bankName.trim()) return toast.error('Bank name is required');
    if (!form.accountNumber.trim()) return toast.error('Account number is required');
    setSaving(true);
    try {
      if (modal.mode === 'add') {
        await createBankAccount({ ...form, entity_type: entityType });
        toast.success('Bank Account created');
      } else {
        await updateBankAccount(modal.row.id, form);
        toast.success('Bank Account updated');
      }
      closeModal();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this Bank Account? Linked cheque serials will also be removed.')) return;
    try { await deleteBankAccount(id); toast.success('Deleted'); }
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
            <h2>Bank Accounts</h2>
            <p>Bank name &amp; account number master</p>
          </div>
        </div>
        <button className="acc-param-page__btn-save" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }} onClick={openAdd}>
          <Plus className="w-4 h-4" /> Add Bank Account
        </button>
      </div>

      <div className="acc-param-page__table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Bank Name</th>
              <th>Account Number</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className="empty-row"><td colSpan={4}>Loading…</td></tr>
            ) : bankAccounts.length === 0 ? (
              <tr className="empty-row"><td colSpan={4}>No Bank Accounts yet. Click "Add Bank Account".</td></tr>
            ) : bankAccounts.map((row, i) => (
              <tr key={row.id}>
                <td>{i + 1}</td>
                <td style={{ fontWeight: 600 }}>{row.bankName}</td>
                <td style={{ fontFamily: 'monospace' }}>{row.accountNumber}</td>
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
            <h3>{modal.mode === 'add' ? 'Add Bank Account' : 'Edit Bank Account'}</h3>
            <div className="acc-param-page__field">
              <label>Bank Name</label>
              <input value={form.bankName} onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))} placeholder="e.g. HBL — Habib Bank Limited" autoFocus />
            </div>
            <div className="acc-param-page__field">
              <label>Account Number</label>
              <input value={form.accountNumber} onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))} placeholder="e.g. 0123-4567890-01" />
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
