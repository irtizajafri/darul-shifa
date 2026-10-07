import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus, ChevronDown, ChevronUp, Pencil, Trash2, Link2, CheckCircle2, X } from 'lucide-react';
import { useAccountsStore } from '../../../store/useAccountsStore';
import { useClinicStore } from '../../../store/useClinicStore';
import { useAuthStore, SUPER_ADMIN_EMAIL } from '../../../store/useAuthStore';
import SearchableSelect from '../../../components/ui/SearchableSelect';
import { confirmDialog } from '../../../components/ui/ConfirmDialog';
import useModalKeys from '../../../hooks/useModalKeys';
import './ListAttachments.scss';

const API = 'http://localhost:5001/api/accounts';
const UTIL_API = 'http://localhost:5001/api/utilities';
const codeNameLabel = (x) => `${x.code} — ${x.name}`;

// HR employee names can carry stray spaces / an empty last name. Ticks are
// stored as name strings, so compare on a normalized key (same rule as the
// backend's payeeNameKey) — otherwise such employees can never be ticked.
const cleanName = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const nameKey = (s) => cleanName(s).replace(/\s+(null|undefined)$/i, '').toLowerCase();
const empName = (emp) => emp.fullName || cleanName(`${emp.firstName ?? ''} ${emp.lastName ?? ''}`);

// Matches a "Utility provider" payee entry's free-text name to the Utilities
// Bill module's utility bucket, so we know which actual-bill date to show.
function matchUtility(entryName) {
  const n = entryName.toLowerCase();
  if (n.includes('electric') || n.includes('wapda') || n.includes('kesc') || n.includes('lesco')) return 'electricity';
  if (n.includes('gas') || n.includes('ssgc') || n.includes('sngpl') || n.includes('sui')) return 'gas';
  if (n.includes('ptcl')) return 'ptcl';
  return null;
}

const SOURCE_BADGE = {
  employee:  { label: 'HR Module',        color: '#3b82f6' },
  'employee-manual': { label: 'HR Module (Manual)', color: '#6366f1' },
  vendor:    { label: 'Inventory Module', color: '#f59e0b' },
  doctor:    { label: 'Clinic Module',    color: '#10b981' },
  inventory: { label: 'Inventory Items',  color: '#0ea5e9' },
  surgery:   { label: 'Surgery/Anesthesia', color: '#ec4899' },
  'ipd-consultant': { label: 'IPD Consultant', color: '#d946ef' },
  'advance-loan': { label: 'Employee Management', color: '#14b8a6' },
  'slip-admission-refund': { label: 'Clinic (Refunds)', color: '#f97316' },
  manual:    { label: 'Custom',           color: '#8b5cf6' },
};

// Both link at Main Account level (not Sub Account) via the same generic
// AccPayeeHeadMainAccount join, and both filter their payee list by linked
// Clinic staff categories via the same AccPayeeHeadStaffCategory join —
// Surgery/Anesthesia picks an admission for its Sub Account and a manual
// Amount; IPD Consultant instead picks from that doctor's own pending Const
// Fee rows (see Voucher Expense).
const STAFF_CATEGORY_SOURCE_TYPES = ['surgery', 'ipd-consultant'];

const emptyLink = () => ({ mainGlId: '', subGlId: '', mainAccountId: '', subAccountId: '', subGLs: [], mainAccs: [], subAccs: [], saving: false });

export default function ListAttachments() {
  const { entityType } = useParams();
  const navigate = useNavigate();
  const {
    payeeHeads, payeeEntries, linkedEmployees, linkedSuppliers, linkedDoctors, inventorySubcategories, mainGLs,
    fetchPayeeHeads, fetchPayeeEntries, fetchLinkedEmployees, fetchLinkedSuppliers, fetchLinkedDoctors, fetchInventorySubcategories, fetchMainGLs,
    createPayeeHead, updatePayeeHead, deletePayeeHead,
    createPayeeEntry, deletePayeeEntry,
    addHeadAccount, removeHeadAccount,
  } = useAccountsStore();
  const { staffCategories, fetchStaffCategories } = useClinicStore();
  const { user } = useAuthStore();
  const isMaster = Boolean(user?.isSuperAdmin) || user?.email === SUPER_ADMIN_EMAIL;

  const [loading, setLoading] = useState(true);
  // Global salary-month lock status/toggle — superadmin only (see
  // getSalaryCeilingMonth in accounts.service.js).
  const [salaryLock, setSalaryLock] = useState(null);
  const [savingLock, setSavingLock] = useState(false);

  const fetchSalaryLock = () => {
    fetch(`${API}/salary-lock-status`).then((r) => r.json()).then((j) => setSalaryLock(j?.data || null)).catch(() => {});
  };

  useEffect(() => {
    if (isMaster) fetchSalaryLock();
  }, [isMaster]);

  const toggleSalaryLock = async (active) => {
    setSavingLock(true);
    try {
      const res = await fetch(`${API}/salary-lock-override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active, userId: user?.id != null ? String(user.id) : null, userName: user?.name || user?.username || user?.email || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Failed');
      setSalaryLock(json.data);
      toast.success(active
        ? `Salary lock override ON — ${json.data.monthName} ${json.data.year} ab turant available hai`
        : 'Salary lock override OFF — backlog wapas check hoga');
    } catch (e) {
      toast.error(e.message || 'Failed to update salary lock');
    } finally {
      setSavingLock(false);
    }
  };
  const [expandedHead, setExpandedHead] = useState(null);
  const [expandedLink, setExpandedLink] = useState(null);
  const [linkState, setLinkState] = useState({});
  const [inventoryItems, setInventoryItems] = useState({});
  const [surgeryPayees, setSurgeryPayees] = useState({});

  const [headModal, setHeadModal] = useState(null);
  const [headName, setHeadName] = useState('');
  const [headSubcatId, setHeadSubcatId] = useState('');
  const [entryModal, setEntryModal] = useState(null);
  const [entryName, setEntryName] = useState('');
  const [saving, setSaving] = useState(false);
  const [utilMeterBills, setUtilMeterBills] = useState([]); // [{ meterId, meterNo, utility, lastBill }]
  const [expandedEntry, setExpandedEntry] = useState(null);

  useEffect(() => {
    fetch(`${UTIL_API}/last-bill-summary`)
      .then((r) => r.json())
      .then((j) => setUtilMeterBills(Array.isArray(j?.data) ? j.data : []))
      .catch((err) => toast.error(err?.message || 'Failed to load utility bill summary'));
  }, []);

  useEffect(() => {
    Promise.all([
      fetchPayeeHeads(entityType),
      fetchMainGLs(entityType),
      fetchLinkedEmployees(),
      fetchLinkedSuppliers(),
      fetchLinkedDoctors(),
      fetchInventorySubcategories(),
      fetchStaffCategories(),
    ]).finally(() => setLoading(false));
  }, [entityType]);

  const [supplierModal, setSupplierModal] = useState(null);
  const [savingSuppliers, setSavingSuppliers] = useState(false);
  const [employeeModal, setEmployeeModal] = useState(null);
  const [savingEmployees, setSavingEmployees] = useState(false);
  const [doctorModal, setDoctorModal] = useState(null);
  const [savingDoctors, setSavingDoctors] = useState(false);
  const [customHeadLinkModal, setCustomHeadLinkModal] = useState(null); // { headId, headName, checked: Set<customHeadId> }
  const [savingCustomHeadLinks, setSavingCustomHeadLinks] = useState(false);

  // ── Entries expand ────────────────────────────────────────────────────────
  const toggleHead = async (head) => {
    if (expandedHead === head.id) { setExpandedHead(null); return; }
    setExpandedHead(head.id);
    if (head.sourceType === 'manual') {
      await fetchPayeeEntries(head.id);
    }
    if (head.sourceType === 'vendor') {
      const r = await fetch(`${API}/payee-entries?headId=${head.id}`);
      const j = await r.json();
      const checkedNames = new Set((Array.isArray(j?.data) ? j.data : []).map((e) => nameKey(e.name)));
      setSupplierModal({
        headId: head.id,
        headName: head.name,
        allSuppliers: linkedSuppliers,
        checked: checkedNames,
      });
    }
    if (head.sourceType === 'inventory') {
      // Always fetch fresh on expand — merged inventory items + any linked
      // Custom Heads' own entries (see getInventoryItemsForHead).
      const r = await fetch(`${API}/linked/inventory-items-for-head?headId=${head.id}`);
      const j = await r.json();
      setInventoryItems((prev) => ({ ...prev, [head.id]: Array.isArray(j?.data) ? j.data : [] }));
    }
    if (STAFF_CATEGORY_SOURCE_TYPES.includes(head.sourceType)) {
      const r = await fetch(`${API}/linked/surgery-payees?headId=${head.id}`);
      const j = await r.json();
      setSurgeryPayees((prev) => ({ ...prev, [head.id]: Array.isArray(j?.data) ? j.data : [] }));
    }
  };

  const saveSupplierSelection = async () => {
    if (!supplierModal) return;
    setSavingSuppliers(true);
    try {
      const r = await fetch(`${API}/payee-entries/bulk-save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payeeHeadId: supplierModal.headId, subAccountId: supplierModal.subAccountId, names: supplierModal.allSuppliers.filter((x) => supplierModal.checked.has(nameKey(x.name))).map((x) => cleanName(x.name)) }),
      });
      const j = await r.json();
      if (!r.ok || j?.ok === false) throw new Error(j?.message || 'Failed');
      setSupplierModal(null);
      toast.success('Suppliers saved');
    } catch (err) { toast.error(err.message); }
    finally { setSavingSuppliers(false); }
  };

  const saveEmployeeSelection = async () => {
    if (!employeeModal) return;
    setSavingEmployees(true);
    try {
      const r = await fetch(`${API}/payee-entries/bulk-save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payeeHeadId: employeeModal.headId,
          subAccountId: employeeModal.subAccountId,
          // checked holds normalized keys — send the clean display names.
          names: employeeModal.allEmployees.filter((emp) => employeeModal.checked.has(nameKey(empName(emp)))).map(empName),
        }),
      });
      const j = await r.json();
      if (!r.ok || j?.ok === false) throw new Error(j?.message || 'Failed');
      setEmployeeModal(null);
      toast.success('Employees saved');
      await fetchPayeeHeads(entityType);
    } catch (err) { toast.error(err.message); }
    finally { setSavingEmployees(false); }
  };

  const saveDoctorSelection = async () => {
    if (!doctorModal) return;
    setSavingDoctors(true);
    try {
      const r = await fetch(`${API}/payee-entries/bulk-save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payeeHeadId: doctorModal.headId, subAccountId: doctorModal.subAccountId, names: doctorModal.allDoctors.filter((x) => doctorModal.checked.has(nameKey(x.name))).map((x) => cleanName(x.name)) }),
      });
      const j = await r.json();
      if (!r.ok || j?.ok === false) throw new Error(j?.message || 'Failed');
      setDoctorModal(null);
      toast.success('Doctors saved');
      await fetchPayeeHeads(entityType);
    } catch (err) { toast.error(err.message); }
    finally { setSavingDoctors(false); }
  };

  // ── Link account cascade ──────────────────────────────────────────────────
  const openLink = (head) => {
    setLinkState((prev) => ({ ...prev, [head.id]: emptyLink() }));
    setExpandedLink(head.id);
  };

  const closeLink = (headId) => {
    setExpandedLink(null);
    setLinkState((prev) => { const n = { ...prev }; delete n[headId]; return n; });
  };

  const updLink = (headId, patch) =>
    setLinkState((prev) => ({ ...prev, [headId]: { ...prev[headId], ...patch } }));

  const loadSubGLs = async (headId, mainGlId) => {
    updLink(headId, { mainGlId, subGlId: '', mainAccountId: '', subAccountId: '', subGLs: [], mainAccs: [], subAccs: [] });
    if (!mainGlId) return;
    const r = await fetch(`${API}/sub-gl?entityType=${entityType}&mainGlId=${mainGlId}`);
    const j = await r.json();
    updLink(headId, { subGLs: Array.isArray(j?.data) ? j.data : [] });
  };

  const loadMainAccs = async (headId, subGlId) => {
    updLink(headId, { subGlId, mainAccountId: '', subAccountId: '', mainAccs: [], subAccs: [] });
    if (!subGlId) return;
    const r = await fetch(`${API}/main-account?entityType=${entityType}&subGlId=${subGlId}`);
    const j = await r.json();
    updLink(headId, { mainAccs: Array.isArray(j?.data) ? j.data : [] });
  };

  const loadSubAccs = async (headId, mainAccountId) => {
    updLink(headId, { mainAccountId, subAccountId: '', subAccs: [] });
    if (!mainAccountId) return;
    const r = await fetch(`${API}/sub-account?entityType=${entityType}&mainAccountId=${mainAccountId}`);
    const j = await r.json();
    updLink(headId, { subAccs: Array.isArray(j?.data) ? j.data : [] });
  };

  const saveLink = async (headId) => {
    const ls = linkState[headId];
    if (!ls?.subAccountId) { toast.error('Select a Sub Account to link'); return; }

    // Check if already linked
    const head = payeeHeads.find((h) => h.id === headId);
    const alreadyLinked = (head?.linkedAccounts || []).some(
      (la) => String(la.subAccountId) === String(ls.subAccountId)
    );
    if (alreadyLinked) { toast.error('This account is already linked'); return; }

    updLink(headId, { saving: true });
    try {
      await addHeadAccount(headId, Number(ls.subAccountId));
      await fetchPayeeHeads(entityType);
      toast.success('Account linked');
      // Reset form but keep open for adding more
      setLinkState((prev) => ({ ...prev, [headId]: emptyLink() }));
    } catch (err) { toast.error(err.message); }
    finally { updLink(headId, { saving: false }); }
  };

  const handleRemoveLink = async (headId, subAccountId) => {
    try {
      await removeHeadAccount(headId, subAccountId);
      await fetchPayeeHeads(entityType);
      toast.success('Link removed');
    } catch (err) { toast.error(err.message); }
  };

  // ── Head modal ────────────────────────────────────────────────────────────
  // ── Custom (manual) head modal ───────────────────────────────────────────
  const openAddHead = () => { setHeadName(''); setHeadSubcatId(''); setHeadModal({ mode: 'add' }); };
  const openEditHead = (h) => { setHeadName(h.name); setHeadModal({ mode: 'edit', row: h }); };
  const closeHeadModal = () => setHeadModal(null);

  const saveHead = async () => {
    if (!headName.trim()) return toast.error('Head name is required');
    setSaving(true);
    try {
      if (headModal.mode === 'add') {
        await createPayeeHead({ name: headName, sourceType: 'manual', entityType });
        toast.success('Head created');
      } else {
        await updatePayeeHead(headModal.row.id, { name: headName });
        toast.success('Head updated');
      }
      closeHeadModal();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  // ── Inventory head modal ─────────────────────────────────────────────────
  const [invModal, setInvModal] = useState(false);
  const openAddInventoryHead = () => { setHeadName(''); setHeadSubcatId(''); setInvModal(true); };
  const closeInvModal = () => setInvModal(false);

  const saveInventoryHead = async () => {
    if (!headName.trim()) return toast.error('Head name is required');
    if (!headSubcatId) return toast.error('Select a Sub Category');
    setSaving(true);
    try {
      await createPayeeHead({ name: headName, sourceType: 'inventory', entityType, inventorySubcategoryId: headSubcatId });
      toast.success('Inventory head created');
      closeInvModal();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  // ── Surgery/Anesthesia / IPD Consultant head modal ───────────────────────
  // Sub Account here is replaced by an admission-number picker (Surgery/
  // Anesthesia) or a date-filtered pending-fees picker (IPD Consultant) —
  // both handled in Voucher Expense — and the payee list is Clinic doctors
  // whose staff category matches one of the ones checked below — e.g.
  // checking both "Surgeon" and "Anaesthetic" lets one Sub GL pay either role.
  const [surgModal, setSurgModal] = useState(false);
  const [surgModalSourceType, setSurgModalSourceType] = useState('surgery');
  const [surgCategoryIds, setSurgCategoryIds] = useState(new Set());
  const openAddSurgeryHead = () => { setHeadName(''); setSurgCategoryIds(new Set()); setSurgModalSourceType('surgery'); setSurgModal(true); };
  const openAddIpdConsultantHead = () => { setHeadName(''); setSurgCategoryIds(new Set()); setSurgModalSourceType('ipd-consultant'); setSurgModal(true); };
  const closeSurgModal = () => setSurgModal(false);
  const SURG_MODAL_LABEL = surgModalSourceType === 'ipd-consultant' ? 'IPD Consultant' : 'Surgery/Anesthesia';

  const saveSurgeryHead = async () => {
    if (!headName.trim()) return toast.error('Head name is required');
    if (surgCategoryIds.size === 0) return toast.error('Select at least one Staff Category');
    setSaving(true);
    try {
      const head = await createPayeeHead({ name: headName, sourceType: surgModalSourceType, entityType });
      for (const catId of surgCategoryIds) {
        await fetch(`${API}/payee-head-staff-categories`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ headId: head.id, staffCategoryId: catId }),
        });
      }
      await fetchPayeeHeads(entityType);
      toast.success(`${SURG_MODAL_LABEL} head created`);
      closeSurgModal();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const toggleSurgeryCategory = async (head, categoryId) => {
    const already = (head.staffCategoryLinks || []).some((l) => l.staffCategoryId === categoryId);
    try {
      if (already) {
        await fetch(`${API}/payee-head-staff-categories/${head.id}/${categoryId}`, { method: 'DELETE' });
      } else {
        await fetch(`${API}/payee-head-staff-categories`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ headId: head.id, staffCategoryId: categoryId }),
        });
      }
      await fetchPayeeHeads(entityType);
      // Refresh the doctor list too since it depends on the category links
      const r = await fetch(`${API}/linked/surgery-payees?headId=${head.id}`);
      const j = await r.json();
      setSurgeryPayees((prev) => ({ ...prev, [head.id]: Array.isArray(j?.data) ? j.data : [] }));
    } catch { toast.error('Failed to update staff category link'); }
  };

  const removeHead = async (id) => {
    if (!(await confirmDialog({ title: 'Delete head', message: 'Delete this head and all its entries?', confirmLabel: 'Delete', danger: true }))) return;
    try {
      await deletePayeeHead(id);
      toast.success('Deleted');
      if (expandedHead === id) setExpandedHead(null);
    } catch (err) { toast.error(err.message); }
  };

  // ── Entry modal ───────────────────────────────────────────────────────────
  const openAddEntry = (headId) => { setEntryName(''); setEntryModal({ headId }); };
  const closeEntryModal = () => setEntryModal(null);

  // ESC closes whichever overlay modal is open (backdrop-click already handled on each overlay).
  useModalKeys({ active: !!headModal, onEsc: closeHeadModal });
  useModalKeys({ active: invModal, onEsc: closeInvModal });
  useModalKeys({ active: surgModal, onEsc: closeSurgModal });
  useModalKeys({ active: !!entryModal, onEsc: closeEntryModal });
  useModalKeys({ active: !!supplierModal, onEsc: () => setSupplierModal(null) });
  useModalKeys({ active: !!employeeModal, onEsc: () => setEmployeeModal(null) });
  useModalKeys({ active: !!doctorModal, onEsc: () => setDoctorModal(null) });
  useModalKeys({ active: !!customHeadLinkModal, onEsc: () => setCustomHeadLinkModal(null) });

  const saveEntry = async () => {
    if (!entryName.trim()) return toast.error('Entry name is required');
    setSaving(true);
    try {
      await createPayeeEntry({ payeeHeadId: entryModal.headId, name: entryName });
      await fetchPayeeEntries(entryModal.headId);
      toast.success('Entry added');
      closeEntryModal();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const removeEntry = async (id, headId) => {
    if (!(await confirmDialog({ title: 'Remove entry', message: 'Remove this entry?', confirmLabel: 'Remove', danger: true }))) return;
    try { await deletePayeeEntry(id); await fetchPayeeEntries(headId); toast.success('Removed'); }
    catch (err) { toast.error(err.message); }
  };

  const systemHeads = payeeHeads.filter((h) => h.sourceType !== 'manual');
  const customHeads = payeeHeads.filter((h) => h.sourceType === 'manual');

  const renderEntries = (head) => {
    if (head.sourceType === 'employee' || head.sourceType === 'employee-manual') {
      if (linkedEmployees.length === 0) return <p className="list-attach__empty">No employees found in HR module</p>;
      return linkedEmployees.map((e) => (
        <div key={e.id} className="list-attach__entry-row"><span>{empName(e)}</span></div>
      ));
    }
    if (head.sourceType === 'vendor') {
      return null;
    }
    if (head.sourceType === 'advance-loan') {
      return <p className="list-attach__empty">Koi payee list nahi — sirf ek Account link chahiye. "Link to Account" se Sub Account attach karein; jab Employee Management mein Advance/Loan banega, uska voucher isi account pe post hoga.</p>;
    }
    if (head.sourceType === 'slip-admission-refund') {
      return <p className="list-attach__empty">Koi payee list nahi — sirf ek Account link chahiye. "Link to Account" se Sub Account attach karein; jab Clinic mein Slip Refund ya Admission Refund process hoga, uska voucher isi account pe post hoga (is book — {entityType === 'corporate' ? 'Corporate' : 'Non-Corporate'} — ki slips/admissions ke liye).</p>;
    }
    if (head.sourceType === 'doctor') {
      if (linkedDoctors.length === 0) return <p className="list-attach__empty">No doctors found in Clinic module</p>;
      return linkedDoctors.map((d) => (
        <div key={d.id} className="list-attach__entry-row"><span>{d.code} — {d.name}</span></div>
      ));
    }
    if (head.sourceType === 'inventory') {
      if (!head.inventorySubcategoryId && !(head.linkedCustomHeads || []).length) return <p className="list-attach__empty">No Sub Category or Custom Head linked</p>;
      const items = inventoryItems[head.id];
      if (!items) return <p className="list-attach__empty">Loading…</p>;
      if (items.length === 0) return <p className="list-attach__empty">No items found</p>;
      return items.map((item) => (
        <div key={item.optionValue} className="list-attach__entry-row">
          <span>{item.code ? `${item.code} — ` : ''}{item.name}</span>
        </div>
      ));
    }
    if (STAFF_CATEGORY_SOURCE_TYPES.includes(head.sourceType)) {
      const linkedCatIds = new Set((head.staffCategoryLinks || []).map((l) => l.staffCategoryId));
      const payees = surgeryPayees[head.id];
      return (
        <div className="list-attach__surgery-block">
          <div className="list-attach__surgery-cats">
            <span className="list-attach__surgery-cats-label">Staff Categories feeding this list:</span>
            {staffCategories.map((c) => (
              <label key={c.id} className={`list-attach__cat-chip ${linkedCatIds.has(c.id) ? 'checked' : ''}`}>
                <input type="checkbox" checked={linkedCatIds.has(c.id)} onChange={() => toggleSurgeryCategory(head, c.id)} />
                <span>{c.name}</span>
              </label>
            ))}
          </div>
          {!payees ? (
            <p className="list-attach__empty">Loading…</p>
          ) : payees.length === 0 ? (
            <p className="list-attach__empty">Is category ke koi active doctor nahi mile (Clinic → Doctors me Staff Category assign karein)</p>
          ) : payees.map((d) => (
            <div key={d.id} className="list-attach__entry-row">
              <span>{d.code ? `${d.code} — ` : ''}{d.name} <em style={{ opacity: 0.6 }}>({d.categoryName})</em></span>
            </div>
          ))}
        </div>
      );
    }
    // manual
    if (expandedHead !== head.id) return null;
    if (payeeEntries.length === 0) return <p className="list-attach__empty">No entries yet. Click + to add.</p>;
    const isUtilityHead = head.name.toLowerCase().includes('utility');
    return payeeEntries.map((e) => {
      const utilKey = isUtilityHead ? matchUtility(e.name) : null;
      const meters = utilKey ? utilMeterBills.filter((m) => m.utility === utilKey) : [];
      const isEntryOpen = expandedEntry === e.id;
      return (
        <div key={e.id} className="list-attach__entry-block">
          <div
            className="list-attach__entry-row"
            style={utilKey ? { cursor: 'pointer' } : undefined}
            onClick={() => { if (utilKey) setExpandedEntry(isEntryOpen ? null : e.id); }}
          >
            <span>
              {e.name}
              {utilKey && <span className="list-attach__entry-count"> — {meters.length} meter{meters.length === 1 ? '' : 's'}</span>}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {utilKey && (isEntryOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />)}
              <button className="btn-icon danger" aria-label="Remove entry" title="Remove entry" onClick={(ev) => { ev.stopPropagation(); removeEntry(e.id, head.id); }}><Trash2 className="w-3 h-3" /></button>
            </div>
          </div>

          {isEntryOpen && utilKey && (
            <div className="list-attach__meter-list">
              {meters.length === 0 ? (
                <p className="list-attach__empty">Utilities Bill module mein is category ka koi meter nahi mila</p>
              ) : meters.map((m) => (
                <div key={m.meterId} className="list-attach__meter-row">
                  <span className="list-attach__meter-no">{m.meterNo}</span>
                  {m.lastBill ? (
                    <span
                      className="list-attach__bill-date"
                      title={`Rs ${Number(m.lastBill.amount).toLocaleString('en-PK')} — period ${new Date(m.lastBill.fromDate).toLocaleDateString('en-PK', { dateStyle: 'medium' })} to ${new Date(m.lastBill.toDate).toLocaleDateString('en-PK', { dateStyle: 'medium' })}`}
                    >
                      Actual posted: {new Date(m.lastBill.postedAt).toLocaleDateString('en-PK', { dateStyle: 'medium' })}
                    </span>
                  ) : (
                    <span className="list-attach__no-link">Koi actual bill post nahi hua</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    });
  };

  const handleRemoveInventoryLink = async (headId, mainAccountId) => {
    try {
      const r = await fetch(`${API}/payee-head-main-accounts/${headId}/${mainAccountId}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('Failed');
      await fetchPayeeHeads(entityType);
      toast.success('Link removed');
    } catch (err) { toast.error(err.message); }
  };

  const renderLinkedAccounts = (head) => {
    // Inventory / Surgery / IPD Consultant heads link to multiple Main Accounts (not Sub Accounts)
    if (head.sourceType === 'inventory' || STAFF_CATEGORY_SOURCE_TYPES.includes(head.sourceType)) {
      const links = head.linkedMainAccounts || [];
      if (links.length === 0) return <span className="list-attach__no-link">No Main Account linked</span>;
      return (
        <div className="list-attach__linked-list">
          {links.map((lma) => (
            <div key={lma.id} className="list-attach__linked-tag">
              <CheckCircle2 size={11} style={{ color: '#22c55e', flexShrink: 0 }} />
              <span>{lma.mainAccount.code} — {lma.mainAccount.name}</span>
              <button
                className="list-attach__tag-remove"
                title="Remove link"
                onClick={() => handleRemoveInventoryLink(head.id, lma.mainAccountId)}
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      );
    }
    // All other heads link to Sub Accounts
    const links = head.linkedAccounts || [];
    if (links.length === 0) return <span className="list-attach__no-link">No account linked</span>;
    return (
      <div className="list-attach__linked-list">
        {links.map((la) => (
          <div key={la.id} className="list-attach__linked-tag">
            <CheckCircle2 size={11} style={{ color: '#22c55e', flexShrink: 0 }} />
            <span>{la.subAccount.code} — {la.subAccount.name}</span>
            <button
              className="list-attach__tag-remove"
              title="Remove link"
              onClick={() => handleRemoveLink(head.id, la.subAccountId)}
            >
              <X size={10} />
            </button>
          </div>
        ))}
      </div>
    );
  };

  // Generic Main-Account-only link save — used by both Inventory and Surgery
  // heads (both link at Main Account level via the same AccPayeeHeadMainAccount
  // table, just with different downstream "sub account" behaviour).
  const saveInventoryLink = async (headId) => {
    const ls = linkState[headId];
    if (!ls?.mainAccountId) { toast.error('Select a Main Account to link'); return; }

    // Check if already linked
    const head = payeeHeads.find((h) => h.id === headId);
    const alreadyLinked = (head?.linkedMainAccounts || []).some(
      (lma) => String(lma.mainAccountId) === String(ls.mainAccountId)
    );
    if (alreadyLinked) { toast.error('This Main Account is already linked'); return; }

    updLink(headId, { saving: true });
    try {
      const r = await fetch(`${API}/payee-head-main-accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headId, mainAccountId: ls.mainAccountId }),
      });
      if (!r.ok) throw new Error('Failed to link');
      await fetchPayeeHeads(entityType);
      toast.success('Main Account linked');
      setLinkState((prev) => ({ ...prev, [headId]: emptyLink() }));
    } catch (err) { toast.error(err.message); }
    finally { updLink(headId, { saving: false }); }
  };

  // ── Inventory Head <-> Custom Head linking ──────────────────────────────
  // Lets an Inventory Head's Payee list also include one or more Custom
  // Heads' manually-typed names, merged in alongside the real inventory
  // items (see getInventoryItemsForHead on the backend).
  const openCustomHeadLinkModal = (head) => {
    const checked = new Set((head.linkedCustomHeads || []).map((l) => l.customHeadId));
    setCustomHeadLinkModal({ headId: head.id, headName: head.name, checked });
  };

  const toggleCustomHeadLinkCheck = (customHeadId) => {
    setCustomHeadLinkModal((m) => {
      const next = new Set(m.checked);
      next.has(customHeadId) ? next.delete(customHeadId) : next.add(customHeadId);
      return { ...m, checked: next };
    });
  };

  const saveCustomHeadLinks = async () => {
    if (!customHeadLinkModal) return;
    setSavingCustomHeadLinks(true);
    try {
      const head = payeeHeads.find((h) => h.id === customHeadLinkModal.headId);
      const currentIds = new Set((head?.linkedCustomHeads || []).map((l) => l.customHeadId));
      const wantIds = customHeadLinkModal.checked;
      const toAdd = [...wantIds].filter((id) => !currentIds.has(id));
      const toRemove = [...currentIds].filter((id) => !wantIds.has(id));
      const results = await Promise.all([
        ...toAdd.map((id) => fetch(`${API}/payee-head-linked-custom-heads`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ headId: customHeadLinkModal.headId, customHeadId: id }),
        })),
        ...toRemove.map((id) => fetch(`${API}/payee-head-linked-custom-heads/${customHeadLinkModal.headId}/${id}`, { method: 'DELETE' })),
      ]);
      if (results.some((r) => !r.ok)) throw new Error('Kuch links save nahi ho paye — dobara try karein');
      await fetchPayeeHeads(entityType);
      toast.success('Custom Heads linked');
      setCustomHeadLinkModal(null);
    } catch (err) { toast.error(err.message || 'Failed to save'); }
    finally { setSavingCustomHeadLinks(false); }
  };

  const renderLinkSection = (head) => {
    const ls = linkState[head.id] || emptyLink();

    // Inventory / Surgery / IPD Consultant heads: link only up to Main Account
    if (head.sourceType === 'inventory' || STAFF_CATEGORY_SOURCE_TYPES.includes(head.sourceType)) {
      return (
        <div className="list-attach__link-form">
          <div className="list-attach__link-title">Link to Main Account</div>
          <div className="list-attach__link-grid">
            <div className="list-attach__link-field">
              <label>Main GL</label>
              <SearchableSelect
                options={mainGLs}
                value={ls.mainGlId}
                onChange={(v) => loadSubGLs(head.id, v)}
                getLabel={codeNameLabel}
                placeholder="Select Main GL"
              />
            </div>
            <div className="list-attach__link-field">
              <label>Sub GL</label>
              <SearchableSelect
                options={ls.subGLs}
                value={ls.subGlId}
                onChange={(v) => loadMainAccs(head.id, v)}
                disabled={!ls.mainGlId}
                getLabel={codeNameLabel}
                placeholder="Select Sub GL"
              />
            </div>
            <div className="list-attach__link-field">
              <label>Main Account</label>
              <SearchableSelect
                options={ls.mainAccs}
                value={ls.mainAccountId}
                onChange={(v) => updLink(head.id, { mainAccountId: v })}
                disabled={!ls.subGlId}
                getLabel={codeNameLabel}
                placeholder="Select Main Account"
              />
            </div>
          </div>
          <div className="list-attach__link-actions">
            <button className="list-attach__link-cancel" onClick={() => closeLink(head.id)}>Close</button>
            <button className="list-attach__link-save" onClick={() => saveInventoryLink(head.id)} disabled={ls.saving || !ls.mainAccountId}>
              {ls.saving ? 'Saving…' : '+ Link'}
            </button>
          </div>
        </div>
      );
    }

    // All other heads: full cascade to Sub Account
    return (
      <div className="list-attach__link-form">
        <div className="list-attach__link-title">Add Account Link</div>
        <div className="list-attach__link-grid">
          <div className="list-attach__link-field">
            <label>Main GL</label>
            <SearchableSelect
              options={mainGLs}
              value={ls.mainGlId}
              onChange={(v) => loadSubGLs(head.id, v)}
              getLabel={codeNameLabel}
              placeholder="Select Main GL"
            />
          </div>
          <div className="list-attach__link-field">
            <label>Sub GL</label>
            <SearchableSelect
              options={ls.subGLs}
              value={ls.subGlId}
              onChange={(v) => loadMainAccs(head.id, v)}
              disabled={!ls.mainGlId}
              getLabel={codeNameLabel}
              placeholder="Select Sub GL"
            />
          </div>
          <div className="list-attach__link-field">
            <label>Main Account</label>
            <SearchableSelect
              options={ls.mainAccs}
              value={ls.mainAccountId}
              onChange={(v) => loadSubAccs(head.id, v)}
              disabled={!ls.subGlId}
              getLabel={codeNameLabel}
              placeholder="Select Main Account"
            />
          </div>
          <div className="list-attach__link-field">
            <label>Sub Account</label>
            <SearchableSelect
              options={ls.subAccs}
              value={ls.subAccountId}
              disabled={!ls.mainAccountId || ls.subAccs.length === 0}
              onChange={async (v) => {
                updLink(head.id, { subAccountId: v });
                if (head.sourceType === 'vendor' && v) {
                  const r = await fetch(`${API}/payee-entries?headId=${head.id}&subAccountId=${v}`);
                  const j = await r.json();
                  const checkedNames = new Set((Array.isArray(j?.data) ? j.data : []).map((en) => nameKey(en.name)));
                  setSupplierModal({ headId: head.id, subAccountId: v, headName: head.name, allSuppliers: linkedSuppliers, checked: checkedNames });
                }
                if ((head.sourceType === 'employee' || head.sourceType === 'employee-manual') && v) {
                  const r = await fetch(`${API}/payee-entries?headId=${head.id}&subAccountId=${v}`);
                  const j = await r.json();
                  // Employee ticks are kept as normalized name KEYS (see nameKey).
                  const checkedKeys = new Set((Array.isArray(j?.data) ? j.data : []).map((en) => nameKey(en.name)));
                  setEmployeeModal({ headId: head.id, subAccountId: v, headName: head.name, allEmployees: linkedEmployees, checked: checkedKeys });
                }
                if (head.sourceType === 'doctor' && v) {
                  const r = await fetch(`${API}/payee-entries?headId=${head.id}&subAccountId=${v}`);
                  const j = await r.json();
                  const checkedNames = new Set((Array.isArray(j?.data) ? j.data : []).map((en) => nameKey(en.name)));
                  setDoctorModal({ headId: head.id, subAccountId: v, headName: head.name, allDoctors: linkedDoctors, checked: checkedNames });
                }
              }}
              getLabel={codeNameLabel}
              placeholder="Select Sub Account"
            />
          </div>
        </div>
        <div className="list-attach__link-actions">
          <button className="list-attach__link-cancel" onClick={() => closeLink(head.id)}>Close</button>
          <button className="list-attach__link-save" onClick={() => saveLink(head.id)} disabled={ls.saving || !ls.subAccountId}>
            {ls.saving ? 'Saving…' : '+ Add Link'}
          </button>
        </div>
      </div>
    );
  };

  const renderHead = (head) => {
    const badge = SOURCE_BADGE[head.sourceType] || SOURCE_BADGE.manual;
    const isManual = head.sourceType === 'manual';
    const isInventory = head.sourceType === 'inventory';
    const isSurgery = STAFF_CATEGORY_SOURCE_TYPES.includes(head.sourceType);
    const isLinkOpen = expandedLink === head.id;
    const isExpanded = expandedHead === head.id;

    return (
      <div key={head.id} className={`list-attach__head ${isManual ? 'custom' : 'system'}`}>
        <div className="list-attach__head-row">
          <div className="list-attach__head-info">
            <div className="list-attach__head-top">
              <span className="list-attach__head-name">{head.name}</span>
              <span className="list-attach__badge" style={{ background: badge.color }}>{badge.label}</span>
            </div>
            {renderLinkedAccounts(head)}
          </div>
          <div className="list-attach__head-actions">
            <button
              className={`btn-icon ${isLinkOpen ? 'active' : ''}`}
              title="Link to Account"
              onClick={() => isLinkOpen ? closeLink(head.id) : openLink(head)}
            >
              <Link2 className="w-3.5 h-3.5" />
            </button>
            {isInventory && (
              <button className="btn-icon" title="Link Custom Head" onClick={() => openCustomHeadLinkModal(head)}>
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
            {isManual && (
              <>
                <button className="btn-icon" title="Edit" onClick={() => openEditHead(head)}><Pencil className="w-3.5 h-3.5" /></button>
                <button className="btn-icon danger" title="Delete" onClick={() => removeHead(head.id)}><Trash2 className="w-3.5 h-3.5" /></button>
                <button className="btn-icon" title="Add Entry" onClick={() => openAddEntry(head.id)}><Plus className="w-3.5 h-3.5" /></button>
              </>
            )}
            {(isInventory || isSurgery) && (
              <button className="btn-icon danger" title="Delete" onClick={() => removeHead(head.id)}><Trash2 className="w-3.5 h-3.5" /></button>
            )}
            <button
              className="list-attach__expand-btn"
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
              title={isExpanded ? 'Collapse' : 'Expand'}
              onClick={() => toggleHead(head)}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {isLinkOpen && renderLinkSection(head)}

        {isExpanded && (
          <div className="list-attach__entries">
            {renderEntries(head)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="list-attach">
      <div className="list-attach__header">
        <div className="list-attach__header-left">
          <button className="acc-param-page__back" onClick={() => navigate(`/accounts/${entityType}/parameters`)}>
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div>
            <h2>List Attachments</h2>
            <p>Payee heads — Employee/Vendor/Doctor link to Sub Account · Inventory/Surgery link to Main Account</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="acc-param-page__btn-save" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#0ea5e9' }} onClick={openAddInventoryHead}>
            <Plus className="w-4 h-4" /> Add Inventory Head
          </button>
          <button className="acc-param-page__btn-save" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#ec4899' }} onClick={openAddSurgeryHead}>
            <Plus className="w-4 h-4" /> Add Surgery/Anesthesia Head
          </button>
          <button className="acc-param-page__btn-save" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#d946ef' }} onClick={openAddIpdConsultantHead}>
            <Plus className="w-4 h-4" /> Add IPD Consultant Head
          </button>
          <button className="acc-param-page__btn-save" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }} onClick={openAddHead}>
            <Plus className="w-4 h-4" /> Add Custom Head
          </button>
        </div>
      </div>

      {isMaster && salaryLock && (
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
            padding: '0.75rem 1rem', marginBottom: '1rem', borderRadius: 8,
            background: salaryLock.locked ? '#fef3c7' : '#ecfdf5',
            border: `1px solid ${salaryLock.locked ? '#f59e0b' : '#10b981'}`,
          }}
        >
          <div style={{ fontSize: '0.85rem' }}>
            <strong>Salary Lock (superadmin):</strong>{' '}
            {salaryLock.overrideActive ? (
              <span>Override ON — checking <strong>{salaryLock.monthName} {salaryLock.year}</strong> only (backlog ignored for now)</span>
            ) : salaryLock.locked ? (
              <span>🔒 Locked — abhi tak sab employees ka <strong>{salaryLock.monthName} {salaryLock.year}</strong> paid nahi hua, September/agla month available nahi hoga jab tak yeh complete na ho</span>
            ) : (
              <span>✅ Sab caught up — abhi <strong>{salaryLock.monthName} {salaryLock.year}</strong> check ho raha hai</span>
            )}
          </div>
          <button
            className="acc-param-page__btn-save"
            style={{ background: salaryLock.overrideActive ? '#64748b' : '#f59e0b', whiteSpace: 'nowrap' }}
            disabled={savingLock}
            onClick={() => toggleSalaryLock(!salaryLock.overrideActive)}
          >
            {savingLock ? 'Saving…' : salaryLock.overrideActive ? 'Turn Override OFF' : 'Turn Override ON'}
          </button>
        </div>
      )}

      {loading ? (
        <p className="list-attach__empty">Loading…</p>
      ) : (
        <>
          <div className="list-attach__section-label">System-Linked Lists</div>
          <div className="list-attach__list">
            {systemHeads.map(renderHead)}
          </div>

          <div className="list-attach__section-label" style={{ marginTop: '1.5rem' }}>Custom Lists</div>
          <div className="list-attach__list">
            {customHeads.length === 0 ? (
              <p className="list-attach__empty">No custom heads yet. Click "Add Custom Head" to create one.</p>
            ) : customHeads.map(renderHead)}
          </div>
        </>
      )}

      {/* Custom Head Modal */}
      {headModal && (
        <div className="acc-param-page__overlay" onClick={closeHeadModal}>
          <div className="acc-param-page__modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>{headModal.mode === 'add' ? 'Add Custom Head' : 'Edit Head Name'}</h3>
            <div className="acc-param-page__field">
              <label>Head Name</label>
              <input value={headName} onChange={(e) => setHeadName(e.target.value)} placeholder="e.g. NGO Partners" autoFocus />
            </div>
            <div className="acc-param-page__modal-actions">
              <button className="acc-param-page__btn-cancel" onClick={closeHeadModal}>Cancel</button>
              <button className="acc-param-page__btn-save" onClick={saveHead} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Inventory Head Modal */}
      {invModal && (
        <div className="acc-param-page__overlay" onClick={closeInvModal}>
          <div className="acc-param-page__modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>Add Inventory Head</h3>
            <div className="acc-param-page__field">
              <label>Inventory Sub Category</label>
              <SearchableSelect
                options={inventorySubcategories}
                value={headSubcatId}
                onChange={(v) => setHeadSubcatId(v)}
                getLabel={(s) => `${s.category?.name ?? ''} → ${s.name}`}
                placeholder="— Select Sub Category —"
              />
            </div>
            <div className="acc-param-page__field">
              <label>Head Name</label>
              <input value={headName} onChange={(e) => setHeadName(e.target.value)} placeholder="e.g. Medicines" />
            </div>
            <div className="acc-param-page__modal-actions">
              <button className="acc-param-page__btn-cancel" onClick={closeInvModal}>Cancel</button>
              <button className="acc-param-page__btn-save" onClick={saveInventoryHead} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Surgery/Anesthesia / IPD Consultant Head Modal */}
      {surgModal && (
        <div className="acc-param-page__overlay" onClick={closeSurgModal}>
          <div className="acc-param-page__modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>Add {SURG_MODAL_LABEL} Head</h3>
            <div className="acc-param-page__field">
              <label>Head Name</label>
              <input
                value={headName}
                onChange={(e) => setHeadName(e.target.value)}
                placeholder={surgModalSourceType === 'ipd-consultant' ? 'e.g. IPD Consultant Fee' : 'e.g. Anesthesia and Surgery'}
                autoFocus
              />
            </div>
            <div className="acc-param-page__field">
              <label>Staff Categories (payee doctors will be pulled from these)</label>
              {staffCategories.length === 0 ? (
                <p className="list-attach__empty">Clinic → Parameters → Staff Category mein pehle category banayein</p>
              ) : (
                <div className="list-attach__surgery-cats">
                  {staffCategories.map((c) => (
                    <label key={c.id} className={`list-attach__cat-chip ${surgCategoryIds.has(c.id) ? 'checked' : ''}`}>
                      <input
                        type="checkbox"
                        checked={surgCategoryIds.has(c.id)}
                        onChange={() => {
                          setSurgCategoryIds((prev) => {
                            const next = new Set(prev);
                            next.has(c.id) ? next.delete(c.id) : next.add(c.id);
                            return next;
                          });
                        }}
                      />
                      <span>{c.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="acc-param-page__modal-actions">
              <button className="acc-param-page__btn-cancel" onClick={closeSurgModal}>Cancel</button>
              <button className="acc-param-page__btn-save" onClick={saveSurgeryHead} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Supplier Modal */}
      {supplierModal && (
        <div className="acc-param-page__overlay" onClick={() => setSupplierModal(null)}>
          <div className="list-attach__supplier-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="list-attach__supplier-modal__header">
              <div>
                <div className="list-attach__supplier-modal__title">Select Suppliers</div>
                <div className="list-attach__supplier-modal__sub">{supplierModal.headName}</div>
              </div>
              <button className="list-attach__supplier-modal__close" aria-label="Close" title="Close" onClick={() => setSupplierModal(null)}>✕</button>
            </div>

            <div className="list-attach__supplier-modal__select-all">
              <label className="list-attach__check-label">
                <input
                  type="checkbox"
                  checked={supplierModal.allSuppliers.length > 0 && supplierModal.allSuppliers.every((s) => supplierModal.checked.has(nameKey(s.name)))}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? new Set(supplierModal.allSuppliers.map((s) => nameKey(s.name)))
                      : new Set();
                    setSupplierModal((m) => ({ ...m, checked: next }));
                  }}
                />
                <span>Select All</span>
              </label>
              <span className="list-attach__supplier-modal__count">
                {supplierModal.allSuppliers.filter((s) => supplierModal.checked.has(nameKey(s.name))).length} / {supplierModal.allSuppliers.length} selected
              </span>
            </div>

            <div className="list-attach__supplier-modal__list">
              {supplierModal.allSuppliers.map((s) => (
                <label
                  key={s.id}
                  className={`list-attach__supplier-modal__item ${supplierModal.checked.has(nameKey(s.name)) ? 'checked' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={supplierModal.checked.has(nameKey(s.name))}
                    onChange={() => {
                      const next = new Set(supplierModal.checked);
                      const k = nameKey(s.name);
                      next.has(k) ? next.delete(k) : next.add(k);
                      setSupplierModal((m) => ({ ...m, checked: next }));
                    }}
                  />
                  <span className="list-attach__supplier-modal__name">{s.name}{s.code ? <span style={{ color: '#94a3b8', marginLeft: 6 }}>({s.code})</span> : null}</span>
                </label>
              ))}
            </div>

            <div className="list-attach__supplier-modal__footer">
              <button className="list-attach__link-cancel" onClick={() => setSupplierModal(null)}>Cancel</button>
              <button className="list-attach__link-save" onClick={saveSupplierSelection} disabled={savingSuppliers}>
                {savingSuppliers ? 'Saving…' : 'Save & Apply'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Employee Modal */}
      {employeeModal && (
        <div className="acc-param-page__overlay" onClick={() => setEmployeeModal(null)}>
          <div className="list-attach__supplier-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="list-attach__supplier-modal__header">
              <div>
                <div className="list-attach__supplier-modal__title">Select Employees</div>
                <div className="list-attach__supplier-modal__sub">{employeeModal.headName}</div>
              </div>
              <button className="list-attach__supplier-modal__close" aria-label="Close" title="Close" onClick={() => setEmployeeModal(null)}>✕</button>
            </div>
            <div className="list-attach__supplier-modal__select-all">
              <label className="list-attach__check-label">
                <input
                  type="checkbox"
                  checked={employeeModal.allEmployees.length > 0 && employeeModal.allEmployees.every((emp) => employeeModal.checked.has(nameKey(empName(emp))))}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? new Set(employeeModal.allEmployees.map((emp) => nameKey(empName(emp))))
                      : new Set();
                    setEmployeeModal((m) => ({ ...m, checked: next }));
                  }}
                />
                <span>Select All</span>
              </label>
              <span className="list-attach__supplier-modal__count">
                {/* Count employees, not distinct names — two employees sharing
                    a name are both ticked by one key and both shown. */}
                {employeeModal.allEmployees.filter((emp) => employeeModal.checked.has(nameKey(empName(emp)))).length} / {employeeModal.allEmployees.length} selected
              </span>
            </div>
            <div className="list-attach__supplier-modal__list">
              {employeeModal.allEmployees.map((emp) => {
                const fullName = empName(emp);
                const key = nameKey(fullName);
                const isChecked = employeeModal.checked.has(key);
                return (
                  <label key={emp.id} className={`list-attach__supplier-modal__item ${isChecked ? 'checked' : ''}`}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {
                        const next = new Set(employeeModal.checked);
                        next.has(key) ? next.delete(key) : next.add(key);
                        setEmployeeModal((m) => ({ ...m, checked: next }));
                      }}
                    />
                    <span className="list-attach__supplier-modal__name">
                      {fullName}{emp.empCode ? <span style={{ color: '#94a3b8', marginLeft: 6 }}>({emp.empCode})</span> : null}
                    </span>
                  </label>
                );
              })}
            </div>
            <div className="list-attach__supplier-modal__footer">
              <button className="list-attach__link-cancel" onClick={() => setEmployeeModal(null)}>Cancel</button>
              <button className="list-attach__link-save" onClick={saveEmployeeSelection} disabled={savingEmployees}>
                {savingEmployees ? 'Saving…' : 'Save & Apply'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Doctor Modal */}
      {doctorModal && (
        <div className="acc-param-page__overlay" onClick={() => setDoctorModal(null)}>
          <div className="list-attach__supplier-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="list-attach__supplier-modal__header">
              <div>
                <div className="list-attach__supplier-modal__title">Select Doctors / Consultants</div>
                <div className="list-attach__supplier-modal__sub">{doctorModal.headName}</div>
              </div>
              <button className="list-attach__supplier-modal__close" aria-label="Close" title="Close" onClick={() => setDoctorModal(null)}>✕</button>
            </div>
            <div className="list-attach__supplier-modal__select-all">
              <label className="list-attach__check-label">
                <input
                  type="checkbox"
                  checked={doctorModal.allDoctors.length > 0 && doctorModal.allDoctors.every((d) => doctorModal.checked.has(nameKey(d.name)))}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? new Set(doctorModal.allDoctors.map((d) => nameKey(d.name)))
                      : new Set();
                    setDoctorModal((m) => ({ ...m, checked: next }));
                  }}
                />
                <span>Select All</span>
              </label>
              <span className="list-attach__supplier-modal__count">
                {doctorModal.allDoctors.filter((d) => doctorModal.checked.has(nameKey(d.name))).length} / {doctorModal.allDoctors.length} selected
              </span>
            </div>
            <div className="list-attach__supplier-modal__list">
              {doctorModal.allDoctors.map((d) => (
                <label key={d.id} className={`list-attach__supplier-modal__item ${doctorModal.checked.has(nameKey(d.name)) ? 'checked' : ''}`}>
                  <input
                    type="checkbox"
                    checked={doctorModal.checked.has(nameKey(d.name))}
                    onChange={() => {
                      const next = new Set(doctorModal.checked);
                      const k = nameKey(d.name);
                      next.has(k) ? next.delete(k) : next.add(k);
                      setDoctorModal((m) => ({ ...m, checked: next }));
                    }}
                  />
                  <span className="list-attach__supplier-modal__name">{d.code ? `${d.code} — ` : ''}{d.name}</span>
                </label>
              ))}
            </div>
            <div className="list-attach__supplier-modal__footer">
              <button className="list-attach__link-cancel" onClick={() => setDoctorModal(null)}>Cancel</button>
              <button className="list-attach__link-save" onClick={saveDoctorSelection} disabled={savingDoctors}>
                {savingDoctors ? 'Saving…' : 'Save & Apply'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Link Custom Head(s) to an Inventory Head */}
      {customHeadLinkModal && (
        <div className="acc-param-page__overlay" onClick={() => setCustomHeadLinkModal(null)}>
          <div className="list-attach__supplier-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="list-attach__supplier-modal__header">
              <div>
                <div className="list-attach__supplier-modal__title">Link Custom Heads</div>
                <div className="list-attach__supplier-modal__sub">{customHeadLinkModal.headName} — their entries merge into this Inventory Head's Payee list</div>
              </div>
              <button className="list-attach__supplier-modal__close" aria-label="Close" title="Close" onClick={() => setCustomHeadLinkModal(null)}>✕</button>
            </div>
            <div className="list-attach__supplier-modal__list">
              {customHeads.length === 0 ? (
                <p className="list-attach__empty">No Custom Heads yet — create one first via "Add Custom Head".</p>
              ) : customHeads.map((ch) => (
                <label key={ch.id} className={`list-attach__supplier-modal__item ${customHeadLinkModal.checked.has(ch.id) ? 'checked' : ''}`}>
                  <input
                    type="checkbox"
                    checked={customHeadLinkModal.checked.has(ch.id)}
                    onChange={() => toggleCustomHeadLinkCheck(ch.id)}
                  />
                  <span className="list-attach__supplier-modal__name">{ch.name}</span>
                </label>
              ))}
            </div>
            <div className="list-attach__supplier-modal__footer">
              <button className="list-attach__link-cancel" onClick={() => setCustomHeadLinkModal(null)}>Cancel</button>
              <button className="list-attach__link-save" onClick={saveCustomHeadLinks} disabled={savingCustomHeadLinks}>
                {savingCustomHeadLinks ? 'Saving…' : 'Save & Apply'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Entry Modal */}
      {entryModal && (
        <div className="acc-param-page__overlay" onClick={closeEntryModal}>
          <div className="acc-param-page__modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>Add Entry</h3>
            <div className="acc-param-page__field">
              <label>Name</label>
              <input value={entryName} onChange={(e) => setEntryName(e.target.value)} placeholder="Entry name" autoFocus />
            </div>
            <div className="acc-param-page__modal-actions">
              <button className="acc-param-page__btn-cancel" onClick={closeEntryModal}>Cancel</button>
              <button className="acc-param-page__btn-save" onClick={saveEntry} disabled={saving}>{saving ? 'Saving…' : 'Add'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
