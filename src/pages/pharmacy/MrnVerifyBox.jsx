import { useState } from 'react';
import { Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { pharmacyApi, mrnChanged, fmtDate, fmtQty, fmtAmt } from './pharmacyApi';

// One MRN's medicines — on the MRN page and in the pharmacy's pop-up.
export function MrnItems({ mrn }) {
  return (
    <table className="ph-table ph-table--inner">
      <thead><tr><th>Medicine</th><th>Pack</th><th>GIN #</th><th>GIN Date</th><th className="r">Qty</th><th className="r">Rate</th><th className="r">Amount</th></tr></thead>
      <tbody>
        {mrn.items.map((it) => (
          <tr key={it.id}>
            <td>{it.medicineName}</td><td>{it.packSize || ''}</td><td className="nowrap">{it.gin?.code || ''}</td><td className="nowrap">{fmtDate(it.gin?.issueDate)}</td>
            <td className="r">{fmtQty(it.quantity)}</td><td className="r">{fmtAmt(it.rate)}</td><td className="r">{fmtAmt(it.amount)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot><tr><td colSpan={6}>Total</td><td className="r">{fmtAmt(mrn.totalAmount)}</td></tr></tfoot>
    </table>
  );
}

// Accept (the medicine is back at the pharmacy) or Reject (with the reason).
export default function MrnVerifyBox({ mrn, onDone }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const act = async (action) => {
    if (action === 'reject' && !note.trim()) { toast.error('Enter the reason for rejecting'); return; }
    setBusy(action);
    try {
      const r = await pharmacyApi(`/mrn/${mrn.id}/verify`, { method: 'POST', body: { action, note: note.trim() } });
      toast.success(`MRN ${r.code} ${action === 'accept' ? 'accepted' : 'rejected'}`);
      mrnChanged();
      onDone?.(r);
    } catch (e) {
      toast.error(e.message);
      mrnChanged(); // someone else may have verified it — load again
    } finally {
      setBusy('');
    }
  };
  return (
    <div className="ph-verify">
      <input className="ph-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (needed to reject)" aria-label={`Note for MRN ${mrn.code}`} maxLength={300} />
      <button type="button" className="ph-btn ph-btn--danger" onClick={() => act('reject')} disabled={!!busy}><X size={14} /> {busy === 'reject' ? 'Rejecting…' : 'Reject'}</button>
      <button type="button" className="ph-btn ph-btn--primary" onClick={() => act('accept')} disabled={!!busy}><Check size={14} /> {busy === 'accept' ? 'Accepting…' : 'Accept — medicine received'}</button>
    </div>
  );
}
