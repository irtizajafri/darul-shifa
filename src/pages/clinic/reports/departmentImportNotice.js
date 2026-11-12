import { confirmDialog } from '../../../components/ui/ConfirmDialog';

// After a Patients List upload — what the file's department column turned into.
// The Excel carries that column as free text, so the same department arrives
// spelled many ways; the import now matches through the department aliases and
// reuses the existing one instead of adding a near-duplicate. Anything it could
// not recognise is added as a new department, and that is the list worth a
// look: the old system sometimes puts a sub-department or a test name
// ("Peads OPD", "CHEST  X RAY") in the department column, and those do not
// belong in Parameters > Departments.
export function showImportedDepartments(info) {
  const created = info?.created || [];
  const reused = info?.reused || [];
  if (!created.length && !reused.length) return;

  const MAX = 12;
  const block = (rows, head) => {
    if (!rows.length) return '';
    const lines = rows.slice(0, MAX);
    if (rows.length > MAX) lines.push(`… aur ${rows.length - MAX}`);
    return `${head}\n${lines.join('\n')}`;
  };

  const message = [
    block(created.map((n) => `• ${n}`),
      `${created.length} naya department bana (Parameters > Departments mein dekh lein — agar yeh asal mein sub-department ya test ka naam hai to wahan se theek karwayein):`),
    block(reused.map((r) => `• "${r.fileName}" → ${r.department}`),
      `${reused.length} spelling pehle se mojood department se mila di gayi:`),
  ].filter(Boolean).join('\n\n');

  confirmDialog({
    title: 'Upload ke departments',
    message,
    confirmLabel: 'Theek hai',
    cancelLabel: 'Band karein',
    danger: created.length > 0,
  });
}
