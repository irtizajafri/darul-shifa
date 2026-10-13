import toast from 'react-hot-toast';
import { confirmDialog } from '../../../components/ui/ConfirmDialog';

const API = 'http://localhost:5001/api/accounts';

// Account Allocation rename / delete rules (see getAllocationUsage on the
// server): refused outright when a voucher line or pending draft sits on it
// or anything under it; otherwise the user is told exactly what goes —
// a rename wipes everything under it, a delete removes it and everything
// under it, List Attachments links / names included — and asked once.
// Returns true when the change may go ahead.
const CHILD_LABEL = { 'main-gl': 'Sub GL', 'sub-gl': 'Main Account', 'main-account': 'Sub Account' };

function describe(u, links) {
  const parts = [
    u.under.subGl && `${u.under.subGl} Sub GL`,
    u.under.mainAccount && `${u.under.mainAccount} Main Account`,
    u.under.subAccount && `${u.under.subAccount} Sub Account`,
  ].filter(Boolean);
  const linkParts = [
    links.headLinks && `List Attachments ke ${links.headLinks} head link`,
    links.payeeNames && `${links.payeeNames} payee name`,
  ].filter(Boolean);
  return { parts, linkParts };
}

export async function guardAllocationChange(level, id, action) {
  let u;
  try {
    const res = await fetch(`${API}/allocation-usage?level=${level}&id=${id}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.message);
    u = json.data;
  } catch (err) {
    toast.error(err.message || 'Check nahi ho saka');
    return false;
  }

  const verb = action === 'rename' ? 'edit' : 'delete';
  if (u.locked) {
    const used = [u.voucherLines && `${u.voucherLines} voucher line`, u.pendingDrafts && `${u.pendingDrafts} pending draft`].filter(Boolean).join(' aur ');
    toast.error(`${u.label} "${u.name}" (ya is ke neeche ke accounts) par ${used} bane hue hain — ${verb} nahi ho sakta`, { duration: 6000 });
    return false;
  }

  const { parts, linkParts } = describe(u, action === 'rename' ? u.onRename : u.onDelete);
  const linkNote = linkParts.length ? `\n\nSaath mein ${linkParts.join(' aur ')} bhi hat jayenge.` : '';

  if (action === 'rename') {
    if (!parts.length && !linkParts.length) return true;
    return confirmDialog({
      title: `${u.label} edit karein?`,
      message: `"${u.name}" ka naam badalne se is ke neeche ke ${parts.join(', ')} delete ho jayenge.${linkNote}\n\nNaye naam ke neeche aap ko naye ${CHILD_LABEL[level]} (aur un ke neeche ke accounts) banane honge. Jaari rakhein?`,
      confirmLabel: 'Haan, edit karein',
      danger: true,
    });
  }

  return confirmDialog({
    title: `${u.label} delete karein?`,
    message: `"${u.name}" delete ho jayega${parts.length ? `, saath mein is ke neeche ke ${parts.join(', ')} bhi` : ''}.${linkNote}\n\nJaari rakhein?`,
    confirmLabel: 'Delete',
    danger: true,
  });
}
