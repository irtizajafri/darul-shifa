import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus } from 'lucide-react';
import { useAccountsStore } from '../../../store/useAccountsStore';
import { confirmDialog } from '../../../components/ui/ConfirmDialog';
import useModalKeys from '../../../hooks/useModalKeys';
import './accParam.scss';

export default function BankAccounts() {
  const { entityType } = useParams();
  const navigate = useNavigate();
  const { bankAccounts, fetchBankAccounts, createBankAccount, updateBankAccount, deleteBankAccount } = useAccountsStore();

  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const EMPTY = { bankName: '', accountNumber: '', openingBalance: '', openingDate: '', isActive: true };
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchBankAccounts(entityType).finally(() => setLoading(false));
  }, [entityType]);

  const openAdd = () => { setForm(EMPTY); setModal({ mode: 'add' }); };
  const openEdit = (row) => {
    setForm({
      bankName: row.bankName, accountNumber: row.accountNumber,
      openingBalance: Number(row.openingBalance) ? String(Number(row.openingBalance)) : '',
      openingDate: row.openingDate ? String(row.openingDate).slice(0, 10) : '',
      isActive: row.isActive !== false,
    });
    setModal({ mode: 'edit', row });
  };
  const closeModal = () => setModal(null);

  useModalKeys({ active: !!modal, onEsc: closeModal });

  const handleSave = async () => {
    if (!form.bankName.trim()) return toast.error('Bank name is required');
    if (!form.accountNumber.trim()) return toast.error('Account number is required');
    if (form.openingBalance !== '' && !Number.isFinite(Number(String(form.openingBalance).replace(/,/g, '')))) return toast.error('Opening balance must be a number');
    if (form.openingBalance !== '' && Number(String(form.openingBalance).replace(/,/g, '')) !== 0 && !form.openingDate) return toast.error('Select the date of the opening balance');
    setSaving(true);
    try {
      if (modal.mode === 'add') {
        await createBankAccount({ ...form, entityType });
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
    if (!(await confirmDialog({ title: 'Delete Bank Account', message: 'Delete this Bank Account? Linked cheque serials will also be removed.', confirmLabel: 'Delete', danger: true }))) return;
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
            <p>Bank name, account number and the Bank Book opening balance</p>
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
              <th style={{ textAlign: 'right' }}>Opening Balance</th>
              <th>Opening Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className="empty-row"><td colSpan={7}>Loading…</td></tr>
            ) : bankAccounts.length === 0 ? (
              <tr className="empty-row"><td colSpan={7}>No Bank Accounts yet. Click "Add Bank Account".</td></tr>
            ) : bankAccounts.map((row, i) => (
              <tr key={row.id}>
                <td>{i + 1}</td>
                <td style={{ fontWeight: 600 }}>{row.bankName}</td>
                <td style={{ fontFamily: 'monospace' }}>{row.accountNumber}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{Number(row.openingBalance) ? Number(row.openingBalance).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</td>
                <td>{row.openingDate ? new Date(`${String(row.openingDate).slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                <td>{row.isActive === false ? <span style={{ color: '#94a3b8', fontWeight: 600 }}>Inactive</span> : <span style={{ color: '#15803d', fontWeight: 600 }}>Active</span>}</td>
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
            <h3>{modal.mode === 'add' ? 'Add Bank Account' : 'Edit Bank Account'}</h3>
            <div className="acc-param-page__field">
              <label>Bank Name</label>
              <input value={form.bankName} onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))} placeholder="e.g. HBL — Habib Bank Limited" autoFocus />
            </div>
            <div className="acc-param-page__field">
              <label>Account Number</label>
              <input value={form.accountNumber} onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))} placeholder="e.g. 0123-4567890-01" />
            </div>
            <div className="acc-param-page__field">
              <label>Opening Balance (as per books)</label>
              <input inputMode="decimal" value={form.openingBalance} onChange={(e) => setForm((f) => ({ ...f, openingBalance: e.target.value }))} placeholder="0.00" />
            </div>
            <div className="acc-param-page__field">
              <label>Opening Date (Bank Book starts this day)</label>
              <input type="date" value={form.openingDate} onChange={(e) => setForm((f) => ({ ...f, openingDate: e.target.value }))} />
            </div>
            {modal.mode === 'edit' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', margin: '0.25rem 0 0.75rem' }}>
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
                Active (inactive banks stay in old reports)
              </label>
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
