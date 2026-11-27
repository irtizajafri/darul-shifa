import { useCallback, useEffect, useState } from 'react';
import { Undo2, X } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useTabStore } from '../../store/useTabStore';
import { hasPermission } from '../../utils/permissions';
import MrnVerifyBox, { MrnItems } from '../../pages/pharmacy/MrnVerifyBox';
import { pharmacyApi, fmtDateTime, patientRef, MRN_CHANGED } from '../../pages/pharmacy/pharmacyApi';
import '../../pages/pharmacy/Pharmacy.scss';

// Al Shifa Hospital Pharmacy — Medicine Return pop-up (owner, 2026-11-27).
// Goes to the users given "Medicine Return (MRN) — verify (pop-up)" in User
// Management (not the Super Admin, who verifies on the MRN page): each
// return the ward sent, to Accept or Reject. "Later" hides it for 10 minutes
// — a new return brings it back at once. Checks every 30 seconds.
const POLL_MS = 30000;
const LATER_MS = 10 * 60 * 1000;

export default function PharmacyMrnPopup() {
  const { user } = useAuthStore();
  const canVerify = !!user && !user.isSuperAdmin && hasPermission(user, 'pharmacy', 'mrn-verify');
  const navigateActiveTab = useTabStore((s) => s.navigateActiveTab);
  const [list, setList] = useState([]);
  const [later, setLater] = useState(null); // MRN ids put off with "Later"

  const poll = useCallback(async () => {
    try { setList(await pharmacyApi('/mrn/pending')); } catch { /* try again on the next round */ }
  }, []);

  useEffect(() => {
    if (!canVerify) return undefined;
    const first = setTimeout(poll, 0);
    const t = setInterval(poll, POLL_MS);
    window.addEventListener(MRN_CHANGED, poll);
    return () => { clearTimeout(first); clearInterval(t); window.removeEventListener(MRN_CHANGED, poll); };
  }, [canVerify, poll]);
  useEffect(() => {
    if (!later) return undefined;
    const t = setTimeout(() => setLater(null), LATER_MS);
    return () => clearTimeout(t);
  }, [later]);

  const hidden = later && list.every((m) => later.includes(m.id));
  if (!canVerify || !list.length || hidden) return null;

  const close = () => setLater(list.map((m) => m.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="ph-mrn-pop-title">
      <div className="bg-white w-full max-w-3xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[88dvh]">
        <div className="bg-teal-50 border-b border-teal-100 px-5 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-teal-100 flex items-center justify-center"><Undo2 className="w-5 h-5 text-teal-700" /></div>
            <div>
              <h2 id="ph-mrn-pop-title" className="text-base font-bold text-teal-900">Medicine Return — verify</h2>
              <p className="text-xs text-teal-700 mt-0.5">{list.length} return{list.length > 1 ? 's' : ''} waiting · Accept once the medicine reaches the pharmacy</p>
            </div>
          </div>
          <button type="button" onClick={close} className="p-1.5 rounded-lg text-teal-500 hover:text-teal-800 hover:bg-teal-100" aria-label="Later"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto p-4 bg-slate-50">
          {list.map((m) => (
            <div key={m.id} className="ph-mrn-pop">
              <div className="ph-mrn-pop__head">
                <b>{m.code}</b>
                <span>{patientRef(m)} · {m.patientName || '—'}</span>
                <span>{m.departmentName || ''}</span>
                <span>Sent by {m.requestedByName || '—'} · {fmtDateTime(m.createdAt)}</span>
              </div>
              <p className="ph-mrn-pop__reason"><b>Reason:</b> {m.reason || '—'}</p>
              <div className="table-wrap"><MrnItems mrn={m} /></div>
              <MrnVerifyBox mrn={m} />
            </div>
          ))}
        </div>
        <div className="px-5 py-3 bg-white border-t border-slate-100 flex justify-end gap-2 shrink-0">
          <button type="button" className="ph-btn" onClick={() => { close(); navigateActiveTab('/pharmacy/mrn'); }}>Open MRN page</button>
          <button type="button" className="ph-btn" onClick={close}>Later (10 min)</button>
        </div>
      </div>
    </div>
  );
}
