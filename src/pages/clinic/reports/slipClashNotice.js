import { confirmDialog } from '../../../components/ui/ConfirmDialog';

// After a Patients List upload — Excel lines whose Slip # the new system
// already uses for a different receipt (see findUploadSerialClashes). The
// upload itself is done; this only tells staff which numbers to fix.
export function showSlipClashes(clashes) {
  if (!Array.isArray(clashes) || !clashes.length) return;
  const MAX = 15;
  const lines = clashes.slice(0, MAX).map((c) => `• Slip ${c.serialNo}: Excel — ${c.excelPatient}${c.excelDepartment ? ` (${c.excelDepartment})` : ''} | System — ${c.existing}`);
  if (clashes.length > MAX) lines.push(`… aur ${clashes.length - MAX}`);
  confirmDialog({
    title: `${clashes.length} slip number(s) do jagah istemal hue`,
    message: `Upload ho gaya, lekin yeh Slip # naye system mein kisi aur receipt ke paas bhi hain — ek taraf ka number ghalat hai, theek kar lein:\n\n${lines.join('\n')}`,
    confirmLabel: 'Theek hai',
    cancelLabel: 'Band karein',
    danger: true,
  });
}
