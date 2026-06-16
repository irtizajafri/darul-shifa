import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus } from 'lucide-react';
import { useAccountsStore } from '../../../store/useAccountsStore';
import './accParam.scss';

export default function ChequeSerial() {
  const { entityType } = useParams();
  const navigate = useNavigate();
  const { bankAccounts, chequeSerials, fetchBankAccounts, fetchChequeSerials, createChequeSerial, deleteChequeSerial } = useAccountsStore();

  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ bankAccountId: '', fromSerial: '', toSerial: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchBankAccounts(entityType),
      fetchChequeSerials(entityType),
    ]).finally(() => setLoading(false));
  }, [entityType]);

  const openAdd = () => {
    setForm({ bankAccountId: bankAccounts[0]?.id || '', fromSerial: '', toSerial: '' });
    setModal(true);
  };
  const closeModal = () => setModal(false);

  const handleSave = async () => {
    if (!form.bankAccountId) return toast.error('Select a Bank Account');
    if (!form.fromSerial.trim()) return toast.error('From serial is required');
    if (!form.toSerial.trim()) return toast.error('To serial is required');
    setSaving(true);
    try {
      await createChequeSerial(form);
      toast.success('Cheque Serial range added');
      closeModal();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this cheque serial range?')) return;
    try { await deleteChequeSerial(id); toast.success('Deleted'); }
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
            <h2>Cheque Serial</h2>
            <p>Serial ranges linked to bank accounts (bank name auto-filled)</p>
          </div>
        </div>
        <button className="acc-param-page__btn-save" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }} onClick={openAdd}>
          <Plus className="w-4 h-4" /> Add Range
        </button>
      </div>

      <div className="acc-param-page__table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Bank Name</th>
              <th>Account Number</th>
              <th>From Serial</th>
              <th>To Serial</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className="empty-row"><td colSpan={6}>Loading…</td></tr>
            ) : chequeSerials.length === 0 ? (
              <tr className="empty-row"><td colSpan={6}>No cheque serial ranges yet. Add Bank Accounts first.</td></tr>
            ) : chequeSerials.map((row, i) => (
              <tr key={row.id}>
                <td>{i + 1}</td>
                <td style={{ fontWeight: 600 }}>{row.bankAccount?.bankName}</td>
                <td style={{ fontFamily: 'monospace' }}>{row.bankAccount?.accountNumber}</td>
                <td><span className="code-badge">{row.fromSerial}</span></td>
                <td><span className="code-badge">{row.toSerial}</span></td>
                <td>
                  <div className="actions">
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
            <h3>Add Cheque Serial Range</h3>

            <div className="acc-param-page__field">
              <label>Bank Account</label>
              <select value={form.bankAccountId} onChange={(e) => setForm((f) => ({ ...f, bankAccountId: e.target.value }))}>
                <option value="">— Select Bank Account —</option>
                {bankAccounts.map((b) => <option key={b.id} value={b.id}>{b.bankName} — {b.accountNumber}</option>)}
              </select>
            </div>

            <div className="acc-param-page__field">
              <label>From Serial</label>
              <input value={form.fromSerial} onChange={(e) => setForm((f) => ({ ...f, fromSerial: e.target.value }))} placeholder="e.g. 100001" autoFocus />
            </div>

            <div className="acc-param-page__field">
              <label>To Serial</label>
              <input value={form.toSerial} onChange={(e) => setForm((f) => ({ ...f, toSerial: e.target.value }))} placeholder="e.g. 100200" />
            </div>

            <div className="acc-param-page__modal-actions">
              <button className="acc-param-page__btn-cancel" onClick={closeModal}>Cancel</button>
              <button className="acc-param-page__btn-save" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Add'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
