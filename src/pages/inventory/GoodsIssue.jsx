import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, useLocation } from 'react-router-dom';
import useModalKeys from '../../hooks/useModalKeys';
import useFocusTrap from '../../hooks/useFocusTrap';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { ChevronDown, ChevronUp, ClipboardList, Download, FileText, PackageCheck, Pencil, Plus, Printer, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useInventoryStore } from '../../store/useInventoryStore';
import { exportRowsToExcel, exportRowsToPdf } from '../../utils/exportInventoryReports';
import { printGINDocument, printAllGINs, printGDDocument } from '../../utils/printPO';
import { useAuthStore } from '../../store/useAuthStore';
import { hasPermission, canBackDate } from '../../utils/permissions';
import { useEmployeeStore } from '../../store/useEmployeeStore';

const CLINIC_API = 'http://localhost:5001/api/clinic';

// ── Admission Lookup Modal — pick an admitted patient to fill Admission Number ─
function AdmissionSearchModal({ onSelect, onClose }) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const timer = useRef(null);

  function runSearch(term) {
    fetch(`${CLINIC_API}/admission/adjustment/search?q=${encodeURIComponent(term)}`)
      .then((r) => r.json())
      .then((j) => setRows(j.data || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => { runSearch(''); }, []);

  function handleChange(val) {
    setQ(val);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { setLoading(true); runSearch(val); }, 300);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85dvh]">
        <div className="bg-blue-50 border-b border-blue-100 px-5 py-3 flex items-center justify-between shrink-0">
          <h2 className="text-sm font-bold text-blue-800">Select Admitted Patient</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="px-5 py-3 border-b border-slate-100 shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              value={q}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="Search by Admission # or Patient Name…"
              className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
        <div className="overflow-y-auto">
          {loading ? (
            <div className="text-center text-sm text-slate-400 py-8">Loading…</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase border-b border-slate-200">
                  <th className="px-4 py-2 text-left">Admission #</th>
                  <th className="px-4 py-2 text-left">Patient</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} onClick={() => onSelect(r)} className="cursor-pointer hover:bg-blue-50">
                    <td className="px-4 py-2 font-medium">{r.admissionNo}</td>
                    <td className="px-4 py-2">{r.patientName}</td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr><td colSpan={2} className="text-center text-slate-400 py-6">Koi admit patient nahi mila</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GoodsIssue() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { user } = useAuthStore();
  const canGD     = hasPermission(user, 'inventory', 'gd');
  const canGIN    = hasPermission(user, 'inventory', 'gin');
  const canEditGIN = hasPermission(user, 'inventory', 'gin', 'edit');
  const allowBackDating = canBackDate(user);
  const today = new Date().toISOString().slice(0, 10);

  const { employees, fetchEmployees } = useEmployeeStore();
  const [ginIssuedById, setGinIssuedById] = useState('');
  const [ginIssuedBySearch, setGinIssuedBySearch] = useState('');
  const [ginIssuedByOpen, setGinIssuedByOpen] = useState(false);
  const [ginIssuedByHighlight, setGinIssuedByHighlight] = useState(-1);
  const ginIssuedByRef = useRef(null);
  const ginIssuedByListRef = useRef(null);

  const [ginQuery, setGinQuery] = useState('');
  const [gdQuery, setGdQuery] = useState('');
  const [showReprint, setShowReprint] = useState(false);
  const [reprintTab, setReprintTab] = useState('GD');
  const [reprintQuery, setReprintQuery] = useState('');
  const [showGDForm, setShowGDForm] = useState(false);
  const [showGINForm, setShowGINForm] = useState(false);
  const [showGDTable, setShowGDTable] = useState(false);
  const [showGINTable, setShowGINTable] = useState(false);
  const [gdFilters, setGdFilters] = useState({
    status: '',
    departmentId: '',
    categoryId: '',
    subcategoryId: '',
    dateFrom: '',
    dateTo: '',
  });
  const [ginFilters, setGinFilters] = useState({
    departmentId: '',
    categoryId: '',
    subcategoryId: '',
    dateFrom: '',
    dateTo: '',
  });

  const gdItemSearchRef = useRef(null);
  const gdDropdownListRef = useRef(null);
  const gdQtyRefs = useRef({});
  const gdFormRef = useRef(null);
  const ginFormRef = useRef(null);
  const successModalRef = useRef(null);
  const [gdDepartmentId, setGdDepartmentId] = useState('');
  const [gdRequestDate, setGdRequestDate] = useState(new Date().toISOString().slice(0, 10));
  const [gdItemSearch, setGdItemSearch] = useState('');
  const [gdItemDropdownOpen, setGdItemDropdownOpen] = useState(false);
  const [gdItemHighlightedIndex, setGdItemHighlightedIndex] = useState(-1);
  const [gdDropdownRect, setGdDropdownRect] = useState(null);
  const [gdSelectedItems, setGdSelectedItems] = useState([]);
  const [gdAdmissionEnabled, setGdAdmissionEnabled] = useState(false);
  const [gdAdmissionNumber, setGdAdmissionNumber] = useState('');
  const [showGdAdmitModal, setShowGdAdmitModal] = useState(false);
  const [gdCommentEnabled, setGdCommentEnabled] = useState(false);
  const [gdComment, setGdComment] = useState('');

  const [selectedGDHeaderId, setSelectedGDHeaderId] = useState('');
  const [ginIssueDate, setGinIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [ginIssuedQtys, setGinIssuedQtys] = useState({});
  const [createdGDHeader, setCreatedGDHeader] = useState(null);

  const [editingGIN, setEditingGIN] = useState(null);
  const [editGINForm, setEditGINForm] = useState({});
  const [editGINQtys, setEditGINQtys] = useState({});
  const [editGINSaving, setEditGINSaving] = useState(false);
  const [editGINIssuedBySearch, setEditGINIssuedBySearch] = useState('');
  const [editGINIssuedByOpen, setEditGINIssuedByOpen] = useState(false);

  const {
    loading,
    gds,
    gdHeaders,
    gins,
    items,
    masterOptions,
    fetchItems,
    fetchMastersOptions,
    fetchGDs,
    fetchGDHeaders,
    fetchGINs,
    createGDBatch,
    createGIN,
    updateGIN,
  } = useInventoryStore();

  useEffect(() => {
    Promise.all([
      fetchItems({ status: 'active' }),
      fetchMastersOptions(),
      fetchGDs(),
      fetchGDHeaders(),
      fetchGINs(),
      fetchEmployees(),
    ]).catch((err) => toast.error(err.message || 'Failed to load issuance data'));
  }, [fetchItems, fetchMastersOptions, fetchGDs, fetchGINs, fetchEmployees]);

  useEffect(() => {
    const gdHeaderId = searchParams.get('gdHeaderId');
    if (gdHeaderId && canGIN) {
      setSelectedGDHeaderId(gdHeaderId);
      setShowGINForm(true);
      setShowGDForm(false);
    }
  }, [searchParams, canGIN]);

  useEffect(() => {
    if (location.state?.openGD && canGD) { setShowGDForm(true); setShowGINForm(false); setShowReprint(false); }
    if (location.state?.openGIN && canGIN) { setShowGINForm(true); setShowGDForm(false); setShowReprint(false); }
  }, [location.state, canGD, canGIN]);

  const fakeEvent = { preventDefault: () => {} };

  useModalKeys({
    active: showGDForm,
    onEsc: () => {
      if (showGdAdmitModal) { setShowGdAdmitModal(false); return; }
      setShowGDForm(false); setGdDepartmentId(''); setGdSelectedItems([]); setGdItemSearch(''); setGdAdmissionEnabled(false); setGdAdmissionNumber(''); setGdCommentEnabled(false); setGdComment('');
    },
    onCtrlS: () => handleCreateGD(fakeEvent, false),
    onCtrlP: () => handleCreateGD(fakeEvent, true),
  });

  useModalKeys({
    active: showGINForm,
    onEsc: () => { setShowGINForm(false); setSelectedGDHeaderId(''); setGinIssuedQtys({}); setGinIssuedById(''); setGinIssuedBySearch(''); },
    onCtrlS: () => handleCreateGIN(fakeEvent, false),
    onCtrlP: () => handleCreateGIN(fakeEvent, true),
  });

  useModalKeys({
    active: showReprint,
    onEsc: () => setShowReprint(false),
  });

  useModalKeys({
    active: !!createdGDHeader,
    onEsc: () => setCreatedGDHeader(null),
  });

  useModalKeys({
    active: !showGDForm && !showGINForm && !showReprint && !createdGDHeader,
    onCtrlN: () => {
      if (canGD) { setShowGDForm(true); setShowGINForm(false); setShowReprint(false); }
      else if (canGIN) { setShowGINForm(true); setShowGDForm(false); setShowReprint(false); }
    },
  });

  useFocusTrap(gdFormRef, showGDForm);
  useFocusTrap(ginFormRef, showGINForm);
  useFocusTrap(successModalRef, !!createdGDHeader);

  const filteredGINRows = useMemo(() => {
    const q = ginQuery.trim().toLowerCase();
    const rows = gins || [];
    if (!q) return rows;
    return rows.filter((r) => [
      r.code,
      r.department?.name,
      r.item?.name,
      r.gd?.code,
    ].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [gins, ginQuery]);

  const filteredGDRows = useMemo(() => {
    const q = gdQuery.trim().toLowerCase();
    const rows = gds || [];
    if (!q) return rows;
    return rows.filter((r) => [
      r.code,
      r.item?.name,
      r.department?.name,
      r.demandCategoryType?.name,
      r.status,
    ].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [gds, gdQuery]);

  const filteredGdSubcategories = useMemo(() => {
    const catId = Number(gdFilters.categoryId);
    if (!catId) return masterOptions.subcategories || [];
    return (masterOptions.subcategories || []).filter((sub) => Number(sub.categoryId) === catId);
  }, [gdFilters.categoryId, masterOptions.subcategories]);

  const filteredGinSubcategories = useMemo(() => {
    const catId = Number(ginFilters.categoryId);
    if (!catId) return masterOptions.subcategories || [];
    return (masterOptions.subcategories || []).filter((sub) => Number(sub.categoryId) === catId);
  }, [ginFilters.categoryId, masterOptions.subcategories]);

  const filteredIssuedByEmployees = useMemo(() => {
    const q = ginIssuedBySearch.trim().toLowerCase();
    const list = employees || [];
    if (!q) return list.slice(0, 20);
    return list.filter((e) =>
      `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
      (e.empCode || '').toLowerCase().includes(q)
    ).slice(0, 20);
  }, [employees, ginIssuedBySearch]);

  useEffect(() => {
    if (ginIssuedByListRef.current && ginIssuedByHighlight >= 0) {
      const el = ginIssuedByListRef.current.children[ginIssuedByHighlight];
      if (el) el.scrollIntoView({ block: 'nearest' });
    }
  }, [ginIssuedByHighlight]);

  useEffect(() => {
    if (gdDropdownListRef.current && gdItemHighlightedIndex >= 0) {
      const el = gdDropdownListRef.current.children[gdItemHighlightedIndex];
      if (el) el.scrollIntoView({ block: 'nearest' });
    }
  }, [gdItemHighlightedIndex]);

  const gdItemSearchResults = useMemo(() => {
    const q = gdItemSearch.trim().toLowerCase();
    if (!q) return (items || []).slice(0, 20);
    return (items || []).filter((it) =>
      String(it.name || '').toLowerCase().includes(q) ||
      String(it.code || '').toLowerCase().includes(q)
    ).slice(0, 20);
  }, [items, gdItemSearch]);

  const addGdItem = (item) => {
    if (gdSelectedItems.find((i) => i.itemId === item.id)) {
      toast.error('Item already added');
      return;
    }
    setGdSelectedItems((prev) => [...prev, {
      itemId: item.id, itemName: item.name, itemCode: item.code,
      quantityRequested: '',
      locationEnabled: false, location: '',
    }]);
    setGdItemSearch('');
    setGdItemDropdownOpen(false);
    setTimeout(() => gdQtyRefs.current[item.id]?.focus(), 0);
  };

  const removeGdItem = (itemId) => setGdSelectedItems((prev) => prev.filter((i) => i.itemId !== itemId));

  const updateGdItemQty = (itemId, qty) =>
    setGdSelectedItems((prev) => prev.map((i) => i.itemId === itemId ? { ...i, quantityRequested: qty } : i));

  const toggleGdItemLocation = (itemId, checked) =>
    setGdSelectedItems((prev) => prev.map((i) => i.itemId === itemId
      ? { ...i, locationEnabled: checked, location: checked ? i.location : '' }
      : i));

  const updateGdItemLocation = (itemId, val) =>
    setGdSelectedItems((prev) => prev.map((i) => i.itemId === itemId ? { ...i, location: val } : i));

  const handleCreateGD = async (e, andPrint = false) => {
    e.preventDefault();
    if (!gdDepartmentId) { toast.error('Please select a department'); return; }
    if (gdSelectedItems.length === 0) { toast.error('Please add at least one item'); return; }
    const badQty = gdSelectedItems.find((i) => !i.quantityRequested || Number(i.quantityRequested) <= 0);
    if (badQty) { toast.error(`Enter quantity for: ${badQty.itemName}`); return; }
    if (gdAdmissionEnabled && !gdAdmissionNumber.trim()) { toast.error('Please enter admission number'); return; }
    try {
      const result = await createGDBatch({
        departmentId: Number(gdDepartmentId),
        requestDate: new Date(gdRequestDate).toISOString(),
        items: gdSelectedItems.map((i) => ({
          itemId: i.itemId,
          quantityRequested: Number(i.quantityRequested),
          ...(i.locationEnabled && i.location.trim() ? { location: i.location.trim() } : {}),
        })),
        admissionNumber: gdAdmissionEnabled ? gdAdmissionNumber.trim() : undefined,
        comment: gdCommentEnabled ? gdComment.trim() : undefined,
        // Stored once at creation (User ID Management's logged-in name) — print's
        // "Generated by" always reads this back, not whoever is printing right now.
        createdByName: user?.name || user?.email || '',
      });
      await Promise.all([fetchGDs(gdFilters), fetchGDHeaders()]);
      setGdDepartmentId('');
      setGdRequestDate(new Date().toISOString().slice(0, 10));
      setGdSelectedItems([]);
      setGdItemSearch('');
      setGdAdmissionEnabled(false);
      setGdAdmissionNumber('');
      setGdCommentEnabled(false);
      setGdComment('');
      setShowGDForm(false);
      setCreatedGDHeader(result);
      if (andPrint && result) printGDDocument(result, { printedBy: result.createdByName || user?.name || user?.email || '', generatedAt: new Date().toLocaleString('en-PK', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) });
    } catch (err) {
      toast.error(err.message || 'Failed to create GD');
    }
  };

  const selectedGDHeader = useMemo(
    () => (gdHeaders || []).find((h) => h.id === Number(selectedGDHeaderId)) || null,
    [gdHeaders, selectedGDHeaderId]
  );

  const handleCreateGIN = async (e, andPrint = false) => {
    e.preventDefault();
    if (!selectedGDHeaderId) { toast.error('Please select a GD'); return; }
    const items = (selectedGDHeader?.gdItems || []).map((gdItem) => ({
      gdItemId: gdItem.id,
      issuedQuantity: Number(ginIssuedQtys[gdItem.id] ?? gdItem.quantityRequested),
    }));
    try {
      const newGIN = await createGIN({
        gdHeaderId: Number(selectedGDHeaderId),
        items,
        issueDate: new Date(ginIssueDate).toISOString(),
        issuedById: ginIssuedById || undefined,
        // Stored once at creation — same "Generated by" fix as GD, see above.
        createdByName: user?.name || user?.email || '',
      });
      await Promise.all([fetchGINs(ginFilters), fetchGDHeaders(), fetchGDs(gdFilters), fetchItems()]);
      setSelectedGDHeaderId('');
      setGinIssueDate(new Date().toISOString().slice(0, 10));
      setGinIssuedQtys({});
      setGinIssuedById('');
      setGinIssuedBySearch('');
      setShowGINForm(false);
      toast.success('GIN created');
      if (andPrint && newGIN) printGINDocument(newGIN, { printedBy: newGIN.createdByName || user?.name || user?.email || '', generatedAt: new Date().toLocaleString('en-PK', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) });
    } catch (err) {
      toast.error(err.message || 'Failed to create GIN');
    }
  };

  const applyGDFilters = async () => {
    try {
      await fetchGDs(gdFilters);
    } catch (err) {
      toast.error(err.message || 'Failed to apply GD filters');
    }
  };

  const resetGDFilters = async () => {
    const empty = {
      status: '', departmentId: '', categoryId: '', subcategoryId: '', dateFrom: '', dateTo: '',
    };
    setGdFilters(empty);
    try {
      await fetchGDs(empty);
    } catch (err) {
      toast.error(err.message || 'Failed to reset GD filters');
    }
  };

  const applyGINFilters = async () => {
    try {
      await fetchGINs(ginFilters);
    } catch (err) {
      toast.error(err.message || 'Failed to apply GIN filters');
    }
  };

  const resetGINFilters = async () => {
    const empty = { departmentId: '', categoryId: '', subcategoryId: '', dateFrom: '', dateTo: '' };
    setGinFilters(empty);
    try {
      await fetchGINs(empty);
    } catch (err) {
      toast.error(err.message || 'Failed to reset GIN filters');
    }
  };

  const openEditGIN = (gin) => {
    setEditingGIN(gin);
    const empId = gin.issuedById || gin.issuedBy?.id || '';
    const empName = gin.issuedBy ? `${gin.issuedBy.firstName} ${gin.issuedBy.lastName}` : '';
    setEditGINForm({
      departmentId: gin.departmentId ? String(gin.departmentId) : '',
      issueDate: gin.issueDate ? new Date(gin.issueDate).toISOString().slice(0, 10) : '',
      issuedById: empId ? String(empId) : '',
    });
    const qtys = {};
    for (const gi of (gin.ginItems || [])) {
      qtys[gi.id] = String(gi.issuedQuantity ?? '');
    }
    setEditGINQtys(qtys);
    setEditGINIssuedBySearch(empName);
    setEditGINIssuedByOpen(false);
  };

  const handleSaveEditGIN = async () => {
    if (!editingGIN) return;
    setEditGINSaving(true);
    try {
      const ginItemsPayload = Object.entries(editGINQtys)
        .map(([id, qty]) => ({ id: Number(id), issuedQuantity: Number(qty) }))
        .filter((x) => Number.isFinite(x.issuedQuantity) && x.issuedQuantity >= 0);

      await updateGIN(editingGIN.id, {
        departmentId: editGINForm.departmentId ? Number(editGINForm.departmentId) : undefined,
        issueDate: editGINForm.issueDate || undefined,
        issuedById: editGINForm.issuedById ? Number(editGINForm.issuedById) : null,
        ginItems: ginItemsPayload,
      });
      await fetchGINs();
      setEditingGIN(null);
      toast.success('GIN updated');
    } catch (err) {
      toast.error(err.message || 'Failed to update GIN');
    } finally {
      setEditGINSaving(false);
    }
  };

  const editGINFilteredEmployees = useMemo(() => {
    const q = editGINIssuedBySearch.trim().toLowerCase();
    const list = employees || [];
    if (!q) return list.slice(0, 20);
    return list.filter((e) =>
      `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
      (e.empCode || '').toLowerCase().includes(q)
    ).slice(0, 20);
  }, [employees, editGINIssuedBySearch]);

  const gdExportRows = useMemo(() => filteredGDRows.map((row) => ({
    gdCode: row.code,
    item: row.item?.name || '-',
    category: row.item?.category?.name || '-',
    subcategory: row.item?.subcategory?.name || '-',
    department: row.department?.name || '-',
    demandCategoryType: row.demandCategoryType?.name || '-',
    quantityRequested: row.quantityRequested,
    status: row.status,
    requestDate: row.requestDate ? new Date(row.requestDate).toLocaleDateString() : '-',
  })), [filteredGDRows]);

  const ginExportRows = useMemo(() => {
    const rows = [];
    for (const row of filteredGINRows) {
      const ginCode = row.code;
      const gdRef = row.gdHeader?.code || row.gd?.code || '-';
      const dept = row.department?.name || row.gdHeader?.department?.name || '-';
      const date = row.issueDate ? new Date(row.issueDate).toLocaleDateString() : '-';
      if (row.ginItems && row.ginItems.length > 0) {
        for (const gi of row.ginItems) {
          rows.push({ ginCode, gdRef, department: dept, item: gi.item?.name || '-', issuedQuantity: gi.issuedQuantity, issueDate: date });
        }
      } else {
        rows.push({ ginCode, gdRef, department: dept, item: row.item?.name || '-', issuedQuantity: row.issuedQuantity ?? '-', issueDate: date });
      }
    }
    return rows;
  }, [filteredGINRows]);

  return (
    <div className="p-6">

      {showGdAdmitModal && (
        <AdmissionSearchModal
          onClose={() => setShowGdAdmitModal(false)}
          onSelect={(row) => { setGdAdmissionNumber(row.admissionNo); setShowGdAdmitModal(false); }}
        />
      )}

      {createdGDHeader && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div ref={successModalRef} className="bg-white w-full sm:rounded-xl sm:max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]">

            {/* Header */}
            <div className="bg-green-50 border-b border-green-100 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-green-800">GD Created Successfully</h2>
                <p className="text-xs sm:text-sm text-green-600 mt-0.5">Code: <span className="font-semibold">{createdGDHeader.code}</span></p>
              </div>
              <span className="text-xl sm:text-2xl">✓</span>
            </div>

            {/* Meta row */}
            <div className="px-4 sm:px-6 pt-3 pb-2 shrink-0">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs sm:text-sm text-slate-500">
                <span>Dept: <span className="font-medium text-slate-800">{createdGDHeader.department?.name || '-'}</span></span>
                <span>Date: <span className="font-medium text-slate-800">{new Date(createdGDHeader.requestDate).toLocaleDateString()}</span></span>
              </div>
            </div>

            {/* Items table — scrollable on small screens */}
            <div className="px-4 sm:px-6 pb-3 overflow-y-auto">
              <table className="w-full text-xs sm:text-sm border border-slate-200 rounded-md overflow-hidden">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs uppercase border-b border-slate-200">
                    <th className="px-3 sm:px-4 py-2 text-left">#</th>
                    <th className="px-3 sm:px-4 py-2 text-left">Item</th>
                    <th className="px-3 sm:px-4 py-2 text-right">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(createdGDHeader.gdItems || []).map((item, idx) => (
                    <tr key={item.id}>
                      <td className="px-3 sm:px-4 py-2 text-slate-400">{idx + 1}</td>
                      <td className="px-3 sm:px-4 py-2 font-medium">{item.item?.name || '-'}</td>
                      <td className="px-3 sm:px-4 py-2 text-right">{item.quantityRequested}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="px-4 sm:px-6 py-3 sm:py-4 bg-slate-50 border-t border-slate-100 flex gap-2 justify-end shrink-0">
              <Button label="Print" icon={Printer} onClick={() => printGDDocument(createdGDHeader, { printedBy: createdGDHeader.createdByName || user?.name || user?.email || '', generatedAt: new Date().toLocaleString('en-PK', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) })} />
              <Button variant="outline" label="Close" onClick={() => setCreatedGDHeader(null)} />
            </div>
          </div>
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Goods Issuance Note (GIN)</h1>
        <p className="text-slate-500 text-sm mb-5">Issue stock to hospital departments</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {canGD && (
          <button
            onClick={() => { setShowGDForm((s) => !s); setShowGINForm(false); }}
            className={`flex items-center gap-4 p-5 rounded-xl border-2 text-left transition-all ${
              showGDForm
                ? 'border-blue-500 bg-blue-50'
                : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50'
            }`}
          >
            <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
              <ClipboardList className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-base">New GD</p>
              <p className="text-slate-500 text-sm">Create Goods Demand request</p>
            </div>
            <Plus className="w-5 h-5 text-slate-400 ml-auto" />
          </button>
          )}

          {canGIN && (
          <button
            onClick={() => { setShowGINForm((s) => !s); setShowGDForm(false); }}
            className={`flex items-center gap-4 p-5 rounded-xl border-2 text-left transition-all ${
              showGINForm
                ? 'border-green-500 bg-green-50'
                : 'border-slate-200 bg-white hover:border-green-300 hover:bg-green-50'
            }`}
          >
            <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
              <PackageCheck className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-base">Issue Goods (GIN)</p>
              <p className="text-slate-500 text-sm">Issue stock to department</p>
            </div>
            <Plus className="w-5 h-5 text-slate-400 ml-auto" />
          </button>
          )}
        </div>

        <div className="mt-3">
          <button
            onClick={() => { setShowReprint((s) => !s); setShowGDForm(false); setShowGINForm(false); setReprintQuery(''); }}
            className={`flex items-center gap-4 p-5 rounded-xl border-2 text-left transition-all w-full ${
              showReprint
                ? 'border-red-400 bg-red-50'
                : 'border-slate-200 bg-white hover:border-red-300 hover:bg-red-50'
            }`}
          >
            <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
              <Printer className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-base">Reprint Document</p>
              <p className="text-slate-500 text-sm">Reprint existing GD or GIN with DUPLICATE watermark</p>
            </div>
          </button>
        </div>
      </div>

      {showReprint && (
        <Card className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-2">
              {['GD', 'GIN'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => { setReprintTab(tab); setReprintQuery(''); }}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md border transition-colors ${
                    reprintTab === tab
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-white text-slate-600 border-slate-300 hover:border-red-300'
                  }`}
                >
                  Reprint {tab}
                </button>
              ))}
            </div>
            <button onClick={() => setShowReprint(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
          </div>

          <div className="relative mb-3">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={reprintTab === 'GD' ? 'Search by GD code or department...' : 'Search by GIN code or department...'}
              value={reprintQuery}
              onChange={(e) => setReprintQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-blue-500"
              autoFocus
            />
          </div>

          <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
            {reprintTab === 'GD' ? (
              (gdHeaders || [])
                .filter((r) => {
                  const q = reprintQuery.trim().toLowerCase();
                  if (!q) return true;
                  return [r.code, r.department?.name].some((v) => String(v || '').toLowerCase().includes(q));
                })
                .slice(0, 15)
                .map((gd) => (
                  <div key={gd.id} className="flex items-center justify-between py-2.5 px-1">
                    <div>
                      <span className="font-medium text-sm text-slate-800">{gd.code}</span>
                      <span className="text-slate-400 text-xs mx-2">|</span>
                      <span className="text-xs text-slate-500">{gd.department?.name || '-'}</span>
                      <span className="text-slate-400 text-xs mx-2">|</span>
                      <span className="text-xs text-slate-500">{(gd.gdItems || []).length} item(s)</span>
                      {gd.requestDate && <span className="text-slate-400 text-xs ml-2">({new Date(gd.requestDate).toLocaleDateString()})</span>}
                    </div>
                    <button
                      onClick={() => printGDDocument(gd, {
                        // "Generated by" is whoever actually created this GD
                        // (stored at creation time) — never the current
                        // session, so it doesn't just repeat "Reprint by".
                        // Older GDs created before this existed have no stored
                        // name; '-' is honest there rather than guessing.
                        printedBy: gd.createdByName || '-',
                        generatedAt: gd.requestDate ? new Date(gd.requestDate).toLocaleDateString('en-PK', { day: '2-digit', month: 'long', year: 'numeric' }) : '',
                        isReprint: true,
                        reprintedBy: user?.name || user?.email || '',
                        reprintedAt: new Date().toLocaleString('en-PK', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }),
                      })}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-md hover:bg-red-50 transition-colors whitespace-nowrap"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Reprint
                    </button>
                  </div>
                ))
            ) : (
              (gins || [])
                .filter((r) => {
                  const q = reprintQuery.trim().toLowerCase();
                  if (!q) return true;
                  return [r.code, r.department?.name, r.gdHeader?.code].some((v) => String(v || '').toLowerCase().includes(q));
                })
                .slice(0, 15)
                .map((gin) => (
                  <div key={gin.id} className="py-2.5 px-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-sm text-slate-800">{gin.code}</span>
                        <span className="text-slate-400 text-xs mx-2">|</span>
                        <span className="text-xs text-slate-500">{gin.department?.name || gin.gdHeader?.department?.name || '-'}</span>
                        {gin.gdHeader?.code && <><span className="text-slate-400 text-xs mx-2">|</span><span className="text-xs text-slate-400">GD: {gin.gdHeader.code}</span></>}
                        {gin.issueDate && <span className="text-slate-400 text-xs ml-2">({new Date(gin.issueDate).toLocaleDateString()})</span>}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {canEditGIN && (
                          <button
                            onClick={() => openEditGIN(gin)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-md hover:bg-blue-50 transition-colors whitespace-nowrap"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Edit
                          </button>
                        )}
                        <button
                          onClick={() => printGINDocument(gin, {
                            // Same fix as GD reprint above — "Generated by" is
                            // the actual creator (stored at creation), not the
                            // current session.
                            printedBy: gin.createdByName || '-',
                            generatedAt: gin.issueDate ? new Date(gin.issueDate).toLocaleDateString('en-PK', { day: '2-digit', month: 'long', year: 'numeric' }) : '',
                            isReprint: true,
                            reprintedBy: user?.name || user?.email || '',
                            reprintedAt: new Date().toLocaleString('en-PK', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }),
                          })}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-md hover:bg-red-50 transition-colors whitespace-nowrap"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Reprint
                        </button>
                      </div>
                    </div>
                    {editingGIN?.id === gin.id && (
                      <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Department</label>
                          <select
                            value={editGINForm.departmentId}
                            onChange={(e) => setEditGINForm((f) => ({ ...f, departmentId: e.target.value }))}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-blue-500 bg-white"
                          >
                            <option value="">— Select Department —</option>
                            {(masterOptions.departments || []).map((d) => (
                              <option key={d.id} value={String(d.id)}>{d.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Issue Date</label>
                          <input type="date" value={editGINForm.issueDate}
                            onChange={(e) => setEditGINForm((f) => ({ ...f, issueDate: e.target.value }))}
                            min={allowBackDating ? undefined : today}
                            max={allowBackDating ? undefined : today}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-blue-500" />
                        </div>
                        <div className="relative">
                          <label className="block text-xs text-slate-500 mb-1">Issued To</label>
                          <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            <input
                              type="text"
                              placeholder="Search employee..."
                              value={editGINIssuedBySearch}
                              onChange={(e) => { setEditGINIssuedBySearch(e.target.value); setEditGINIssuedByOpen(true); if (!e.target.value) setEditGINForm((f) => ({ ...f, issuedById: '' })); }}
                              onFocus={() => setEditGINIssuedByOpen(true)}
                              onBlur={() => setTimeout(() => setEditGINIssuedByOpen(false), 150)}
                              className="pl-9 pr-4 py-1.5 border border-slate-300 rounded-md text-sm w-full focus:outline-none focus:border-blue-500"
                            />
                            {editGINForm.issuedById && <span className="absolute right-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-green-500" />}
                          </div>
                          {editGINIssuedByOpen && editGINFilteredEmployees.length > 0 && (
                            <div className="absolute z-30 top-full left-0 right-0 bg-white border border-slate-200 rounded-md shadow-lg max-h-40 overflow-y-auto">
                              {editGINFilteredEmployees.map((emp) => (
                                <div key={emp.id}
                                  onMouseDown={() => { setEditGINForm((f) => ({ ...f, issuedById: String(emp.id) })); setEditGINIssuedBySearch(`${emp.firstName} ${emp.lastName}`); setEditGINIssuedByOpen(false); }}
                                  className="px-3 py-2 text-sm cursor-pointer flex justify-between items-center hover:bg-blue-50">
                                  <span className="font-medium">{emp.firstName} {emp.lastName}</span>
                                  <span className="text-slate-400 text-xs">{emp.empCode || ''}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        {(editingGIN?.ginItems || []).length > 0 && (
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">Issued Quantities</label>
                            <div className="border border-slate-200 rounded-md overflow-hidden bg-white">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="bg-slate-50 text-slate-500 uppercase border-b border-slate-200">
                                    <th className="px-3 py-1.5 text-left font-semibold">Item</th>
                                    <th className="px-3 py-1.5 text-center font-semibold w-28">Issued Qty</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {(editingGIN.ginItems || []).map((gi) => (
                                    <tr key={gi.id}>
                                      <td className="px-3 py-1.5 font-medium text-slate-800">{gi.item?.name || '-'}</td>
                                      <td className="px-3 py-1.5 text-center">
                                        <input
                                          type="number"
                                          min="0"
                                          step="1"
                                          value={editGINQtys[gi.id] ?? ''}
                                          onChange={(e) => setEditGINQtys((prev) => ({ ...prev, [gi.id]: e.target.value }))}
                                          className="w-20 px-2 py-1 border border-slate-300 rounded text-xs text-center focus:outline-none focus:border-blue-500"
                                        />
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setEditingGIN(null)}
                            className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50">
                            Cancel
                          </button>
                          <button onClick={handleSaveEditGIN} disabled={editGINSaving}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">
                            {editGINSaving ? 'Saving...' : 'Save Changes'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
            )}
            {((reprintTab === 'GD' ? gdHeaders : gins) || []).length === 0 && (
              <p className="text-center text-slate-400 text-sm py-6">No records found.</p>
            )}
          </div>
        </Card>
      )}

      {canGD && showGDForm && (
        <Card className="mb-4" title="Create Goods Demand (GD)">
          <form ref={gdFormRef} onSubmit={handleCreateGD} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <select
                value={gdDepartmentId}
                onChange={(e) => setGdDepartmentId(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                required
              >
                <option value="">Select Department</option>
                {(masterOptions.departments || []).map((dep) => (
                  <option key={dep.id} value={dep.id}>{dep.name} ({dep.code})</option>
                ))}
              </select>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Request Date</label>
                <input
                  type="date"
                  value={gdRequestDate}
                  onChange={(e) => setGdRequestDate(e.target.value)}
                  min={allowBackDating ? undefined : today}
                  max={allowBackDating ? undefined : today}
                  className="px-3 py-2 border border-slate-300 rounded-md text-sm w-full"
                  required
                />
              </div>

              <div className="relative">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    ref={gdItemSearchRef}
                    type="text"
                    placeholder="Search and add item..."
                    value={gdItemSearch}
                    onChange={(e) => { setGdItemSearch(e.target.value); setGdItemDropdownOpen(true); setGdItemHighlightedIndex(-1); if (gdItemSearchRef.current) setGdDropdownRect(gdItemSearchRef.current.getBoundingClientRect()); }}
                    onFocus={() => { setGdItemDropdownOpen(true); if (gdItemSearchRef.current) setGdDropdownRect(gdItemSearchRef.current.getBoundingClientRect()); }}
                    onBlur={() => setTimeout(() => { setGdItemDropdownOpen(false); setGdItemHighlightedIndex(-1); }, 150)}
                    onKeyDown={(e) => {
                      if (!gdItemDropdownOpen) {
                        if (e.key === 'ArrowDown') { e.preventDefault(); setGdItemDropdownOpen(true); setGdItemHighlightedIndex(0); }
                        return;
                      }
                      if (e.key === 'ArrowDown') { e.preventDefault(); setGdItemHighlightedIndex((p) => Math.min(p + 1, gdItemSearchResults.length - 1)); }
                      else if (e.key === 'ArrowUp') { e.preventDefault(); setGdItemHighlightedIndex((p) => Math.max(p - 1, 0)); }
                      else if (e.key === 'Enter') { e.preventDefault(); if (gdItemHighlightedIndex >= 0 && gdItemSearchResults[gdItemHighlightedIndex]) { addGdItem(gdItemSearchResults[gdItemHighlightedIndex]); setGdItemHighlightedIndex(-1); } }
                      else if (e.key === 'Tab') { e.preventDefault(); setGdItemHighlightedIndex((p) => Math.min(p + 1, gdItemSearchResults.length - 1)); }
                      else if (e.key === 'Escape') { setGdItemDropdownOpen(false); setGdItemHighlightedIndex(-1); }
                    }}
                    className="pl-9 pr-4 py-2 border border-slate-300 rounded-md text-sm w-full focus:outline-none focus:border-blue-500"
                  />
                </div>
                {gdItemDropdownOpen && gdItemSearchResults.length > 0 && gdDropdownRect && createPortal(
                  <div
                    style={{
                      position: 'fixed',
                      left: gdDropdownRect.left,
                      width: gdDropdownRect.width,
                      zIndex: 9999,
                      ...(window.innerHeight - gdDropdownRect.bottom < 244
                        ? { bottom: window.innerHeight - gdDropdownRect.top + 4 }
                        : { top: gdDropdownRect.bottom + 4 }),
                    }}
                    className="bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto"
                    ref={gdDropdownListRef}
                  >
                    {gdItemSearchResults.map((item, idx) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => addGdItem(item)}
                        className={`w-full text-left px-4 py-2 text-sm border-b border-slate-100 last:border-0 ${idx === gdItemHighlightedIndex ? 'bg-blue-100 text-blue-900' : 'hover:bg-slate-50'}`}
                      >
                        <span className="font-medium">{item.name}</span>
                        <span className="text-slate-400 ml-2 text-xs">({item.code})</span>
                      </button>
                    ))}
                  </div>,
                  document.body
                )}
              </div>
            </div>

            {gdSelectedItems.length > 0 && (
              <div className="border border-slate-200 rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs uppercase border-b border-slate-200">
                      <th className="px-4 py-2 text-left font-semibold">#</th>
                      <th className="px-4 py-2 text-left font-semibold">Item</th>
                      <th className="px-4 py-2 text-left font-semibold">Code</th>
                      <th className="px-4 py-2 text-left font-semibold">Qty Requested</th>
                      <th className="px-4 py-2 text-left font-semibold">Location</th>
                      <th className="px-4 py-2 text-left font-semibold"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {gdSelectedItems.map((row, idx) => (
                      <tr key={row.itemId}>
                        <td className="px-4 py-2 text-slate-500">{idx + 1}</td>
                        <td className="px-4 py-2 font-medium">{row.itemName}</td>
                        <td className="px-4 py-2 text-slate-500">{row.itemCode}</td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            placeholder="Qty"
                            value={row.quantityRequested}
                            onChange={(e) => updateGdItemQty(row.itemId, e.target.value)}
                            ref={(el) => { if (el) gdQtyRefs.current[row.itemId] = el; }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                gdItemSearchRef.current?.focus();
                              }
                            }}
                            className="px-2 py-1 border border-slate-300 rounded text-sm w-24 focus:outline-none focus:border-blue-500"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none text-slate-500 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={row.locationEnabled}
                              onChange={(e) => toggleGdItemLocation(row.itemId, e.target.checked)}
                              className="w-3.5 h-3.5 accent-blue-600"
                            />
                            Add Location
                          </label>
                          {row.locationEnabled && (
                            <input
                              type="text"
                              placeholder="e.g. Ward A, Room 3"
                              value={row.location}
                              onChange={(e) => updateGdItemLocation(row.itemId, e.target.value)}
                              className="mt-1.5 px-2 py-1 border border-blue-300 rounded text-xs w-36 focus:outline-none focus:border-blue-500"
                              autoFocus
                            />
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <button
                            type="button"
                            onClick={() => removeGdItem(row.itemId)}
                            className="text-red-500 hover:text-red-700 text-xs font-medium"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={gdAdmissionEnabled}
                    onChange={(e) => {
                      setGdAdmissionEnabled(e.target.checked);
                      if (e.target.checked) { setShowGdAdmitModal(true); }
                      else { setGdAdmissionNumber(''); }
                    }}
                    className="w-4 h-4 accent-blue-600"
                  />
                  Admission Number
                </label>
                {gdAdmissionEnabled && (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Enter admission number"
                      value={gdAdmissionNumber}
                      onChange={(e) => setGdAdmissionNumber(e.target.value)}
                      className="px-3 py-2 border border-blue-300 rounded-md text-sm w-full focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowGdAdmitModal(true)}
                      title="Search admitted patients"
                      className="shrink-0 p-2 border border-blue-300 rounded-md text-blue-600 hover:bg-blue-50"
                    >
                      <Search size={14} />
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={gdCommentEnabled}
                    onChange={(e) => { setGdCommentEnabled(e.target.checked); if (!e.target.checked) setGdComment(''); }}
                    className="w-4 h-4 accent-blue-600"
                  />
                  Comment
                </label>
                {gdCommentEnabled && (
                  <textarea
                    placeholder="Enter comment..."
                    value={gdComment}
                    onChange={(e) => setGdComment(e.target.value)}
                    rows={2}
                    className="px-3 py-2 border border-blue-300 rounded-md text-sm w-full focus:outline-none focus:border-blue-500 resize-none"
                  />
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" label={loading ? 'Saving...' : `Save GD (${gdSelectedItems.length} item${gdSelectedItems.length !== 1 ? 's' : ''})`} disabled={loading || gdSelectedItems.length === 0} />
              <Button type="button" label={loading ? 'Saving...' : 'Save & Print'} disabled={loading || gdSelectedItems.length === 0} onClick={(e) => handleCreateGD(e, true)} />
              <Button type="button" variant="secondary" label="Cancel" onClick={() => { setShowGDForm(false); setGdDepartmentId(''); setGdSelectedItems([]); setGdItemSearch(''); setGdAdmissionEnabled(false); setGdAdmissionNumber(''); setGdCommentEnabled(false); setGdComment(''); }} />
            </div>
          </form>
        </Card>
      )}

      {canGIN && showGINForm && (
        <Card className="mb-4" title="Create Goods Issuance (GIN)">
          <form ref={ginFormRef} onSubmit={handleCreateGIN} className="space-y-4">
            <div className="flex flex-wrap gap-3 items-end">
              <select
                value={selectedGDHeaderId}
                onChange={(e) => { setSelectedGDHeaderId(e.target.value); setGinIssuedQtys({}); }}
                className="px-3 py-2 border border-slate-300 rounded-md text-sm flex-1 min-w-[220px]"
                required
              >
                <option value="">Select GD (by header code)</option>
                {(gdHeaders || []).filter((h) => h.status === 'open').map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.code} — {h.department?.name || '-'} [{h.status}] ({h.gdItems?.length || 0} items)
                  </option>
                ))}
              </select>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Issue Date</label>
                <input
                  type="date"
                  value={ginIssueDate}
                  onChange={(e) => setGinIssueDate(e.target.value)}
                  min={allowBackDating ? undefined : today}
                  max={allowBackDating ? undefined : today}
                  className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                  required
                />
              </div>
              <div className="relative min-w-[220px]">
                <label className="block text-xs text-slate-500 mb-1">Issued To</label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    ref={ginIssuedByRef}
                    type="text"
                    placeholder="Search employee..."
                    value={ginIssuedBySearch}
                    onChange={(e) => { setGinIssuedBySearch(e.target.value); setGinIssuedByOpen(true); setGinIssuedByHighlight(-1); if (!e.target.value) setGinIssuedById(''); }}
                    onFocus={() => setGinIssuedByOpen(true)}
                    onBlur={() => setTimeout(() => { setGinIssuedByOpen(false); setGinIssuedByHighlight(-1); }, 150)}
                    onKeyDown={(e) => {
                      if (!ginIssuedByOpen) { if (e.key === 'ArrowDown') { e.preventDefault(); setGinIssuedByOpen(true); setGinIssuedByHighlight(0); } return; }
                      if (e.key === 'ArrowDown' || e.key === 'Tab') { e.preventDefault(); setGinIssuedByHighlight((p) => Math.min(p + 1, filteredIssuedByEmployees.length - 1)); }
                      else if (e.key === 'ArrowUp') { e.preventDefault(); setGinIssuedByHighlight((p) => Math.max(p - 1, 0)); }
                      else if (e.key === 'Enter') {
                        e.preventDefault();
                        const emp = filteredIssuedByEmployees[ginIssuedByHighlight];
                        if (emp) { setGinIssuedById(String(emp.id)); setGinIssuedBySearch(`${emp.firstName} ${emp.lastName}`); setGinIssuedByOpen(false); setGinIssuedByHighlight(-1); }
                      }
                      else if (e.key === 'Escape') { setGinIssuedByOpen(false); setGinIssuedByHighlight(-1); }
                    }}
                    className="pl-9 pr-4 py-2 border border-slate-300 rounded-md text-sm w-full focus:outline-none focus:border-blue-500"
                  />
                  {ginIssuedById && <span className="absolute right-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-green-500" />}
                </div>
                {ginIssuedByOpen && filteredIssuedByEmployees.length > 0 && (
                  <div ref={ginIssuedByListRef} className="absolute z-30 top-full left-0 right-0 bg-white border border-slate-200 rounded-md shadow-lg max-h-[300px] overflow-y-auto">
                    {filteredIssuedByEmployees.map((emp, idx) => (
                      <div
                        key={emp.id}
                        onMouseDown={() => { setGinIssuedById(String(emp.id)); setGinIssuedBySearch(`${emp.firstName} ${emp.lastName}`); setGinIssuedByOpen(false); setGinIssuedByHighlight(-1); }}
                        className={`px-3 py-2 text-sm cursor-pointer flex justify-between items-center ${idx === ginIssuedByHighlight ? 'bg-blue-100 text-blue-900' : 'hover:bg-blue-50'}`}
                      >
                        <span className="font-medium">{emp.firstName} {emp.lastName}</span>
                        <span className="text-slate-400 text-xs">{emp.empCode || ''}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {selectedGDHeader && (
              <div className="border border-slate-200 rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs uppercase border-b border-slate-200">
                      <th className="px-4 py-2 text-left font-semibold">#</th>
                      <th className="px-4 py-2 text-left font-semibold">Item</th>
                      <th className="px-4 py-2 text-left font-semibold">Stock</th>
                      <th className="px-4 py-2 text-left font-semibold">Demanded</th>
                      <th className="px-4 py-2 text-left font-semibold">Issue Qty</th>
                      <th className="px-4 py-2 text-left font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(selectedGDHeader.gdItems || []).map((gdItem, idx) => {
                      const stock = Number(gdItem.item?.currentStock || 0);
                      const stockColor = stock <= 0 ? 'text-red-500 bg-red-50' : stock <= 10 ? 'text-orange-500 bg-orange-50' : 'text-green-600 bg-green-50';
                      return (
                      <tr key={gdItem.id} className={gdItem.status === 'closed' ? 'opacity-40' : ''}>
                        <td className="px-4 py-2 text-slate-500">{idx + 1}</td>
                        <td className="px-4 py-2 font-medium">{gdItem.item?.name || '-'}</td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${stockColor}`}>{stock}</span>
                        </td>
                        <td className="px-4 py-2 text-slate-600">{gdItem.quantityRequested}</td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            min="0"
                            placeholder={gdItem.quantityRequested}
                            value={ginIssuedQtys[gdItem.id] ?? ''}
                            onChange={(e) => setGinIssuedQtys((prev) => ({ ...prev, [gdItem.id]: e.target.value }))}
                            disabled={gdItem.status === 'closed'}
                            className="px-2 py-1 border border-slate-300 rounded text-sm w-24 focus:outline-none focus:border-blue-500 disabled:bg-slate-100"
                          />
                        </td>
                        <td className="px-4 py-2 capitalize text-xs">
                          <span className={`px-2 py-0.5 rounded-full font-medium ${gdItem.status === 'closed' ? 'bg-green-100 text-green-700' : gdItem.status === 'partial' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>
                            {gdItem.status}
                          </span>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex gap-2">
              <Button type="submit" label={loading ? 'Saving...' : 'Save GIN'} disabled={loading || !selectedGDHeaderId} />
              <Button type="button" label={loading ? 'Saving...' : 'Save & Print'} disabled={loading || !selectedGDHeaderId} onClick={(e) => handleCreateGIN(e, true)} />
              <Button type="button" variant="secondary" label="Cancel" onClick={() => { setShowGINForm(false); setSelectedGDHeaderId(''); setGinIssuedQtys({}); setGinIssuedById(''); setGinIssuedBySearch(''); }} />
            </div>
          </form>
        </Card>
      )}

      {/* {canGD && (
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-slate-700">📋 GD Records</p>
        <button
          onClick={() => setShowGDTable((prev) => !prev)}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
        >
          {showGDTable ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {showGDTable ? 'Hide' : 'Show'}
        </button>
      </div>
      )} */}

      {/* {canGD && showGDTable && (
      <Card className="p-0 overflow-hidden mb-6">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search GD..."
                value={gdQuery}
                onChange={(e) => setGdQuery(e.target.value)}
                className="pl-9 pr-4 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-blue-500 w-56"
              />
            </div>

            <select
              value={gdFilters.status}
              onChange={(e) => setGdFilters((p) => ({ ...p, status: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
            >
              <option value="">All Status</option>
              <option value="open">Open</option>
              <option value="partial">Partial</option>
              <option value="closed">Closed</option>
            </select>

            <select
              value={gdFilters.departmentId}
              onChange={(e) => setGdFilters((p) => ({ ...p, departmentId: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
            >
              <option value="">All Departments</option>
              {(masterOptions.departments || []).map((dep) => (
                <option key={dep.id} value={dep.id}>{dep.name}</option>
              ))}
            </select>

            <select
              value={gdFilters.categoryId}
              onChange={(e) => setGdFilters((p) => ({ ...p, categoryId: e.target.value, subcategoryId: '' }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
            >
              <option value="">All Categories</option>
              {(masterOptions.categories || []).map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>

            <select
              value={gdFilters.subcategoryId}
              onChange={(e) => setGdFilters((p) => ({ ...p, subcategoryId: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
            >
              <option value="">All Subcategories</option>
              {filteredGdSubcategories.map((sub) => (
                <option key={sub.id} value={sub.id}>{sub.name}</option>
              ))}
            </select>

            <input
              type="date"
              value={gdFilters.dateFrom}
              onChange={(e) => setGdFilters((p) => ({ ...p, dateFrom: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
            />
            <input
              type="date"
              value={gdFilters.dateTo}
              onChange={(e) => setGdFilters((p) => ({ ...p, dateTo: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
            />

            <Button label="Apply" size="sm" variant="outline" onClick={applyGDFilters} />
            <Button label="Reset" size="sm" variant="secondary" onClick={resetGDFilters} />
          </div>

          <div className="flex items-center gap-2">
            <p className="text-xs text-slate-500">{filteredGDRows.length} GD(s)</p>
            <Button
              label="Excel"
              icon={Download}
              size="sm"
              variant="outline"
              onClick={() => exportRowsToExcel({ fileName: 'inventory-gd-report', sheetName: 'GD', rows: gdExportRows })}
            />
            <Button
              label="PDF"
              icon={FileText}
              size="sm"
              variant="outline"
              onClick={() => exportRowsToPdf({ fileName: 'inventory-gd-report', title: 'GD Report', rows: gdExportRows })}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                <th className="px-6 py-4 font-semibold">GD No</th>
                <th className="px-6 py-4 font-semibold">Item</th>
                <th className="px-6 py-4 font-semibold">Department</th>
                <th className="px-6 py-4 font-semibold">Qty Requested</th>
                <th className="px-6 py-4 font-semibold">Request Date</th>
                <th className="px-6 py-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredGDRows.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-500">No GD records found.</td>
                </tr>
              ) : (
                filteredGDRows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-6 py-4">{row.code}</td>
                    <td className="px-6 py-4">{row.item?.name || '-'}</td>
                    <td className="px-6 py-4">{row.department?.name || '-'}</td>
                    <td className="px-6 py-4">{row.quantityRequested}</td>
                    <td className="px-6 py-4">{row.requestDate ? new Date(row.requestDate).toLocaleDateString() : '-'}</td>
                    <td className="px-6 py-4 capitalize">{row.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
      )} */}

      {/* {canGIN && (
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-slate-700">📦 GIN Records</p>
        <button
          onClick={() => setShowGINTable((prev) => !prev)}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
        >
          {showGINTable ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {showGINTable ? 'Hide' : 'Show'}
        </button>
      </div>
      )}

      {canGIN && showGINTable && (
      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search Issue Notes..." 
                value={ginQuery}
                onChange={(e) => setGinQuery(e.target.value)}
                className="pl-9 pr-4 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-blue-500 w-56"
              />
            </div>

            <select
              value={ginFilters.departmentId}
              onChange={(e) => setGinFilters((p) => ({ ...p, departmentId: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
            >
              <option value="">All Departments</option>
              {(masterOptions.departments || []).map((dep) => (
                <option key={dep.id} value={dep.id}>{dep.name}</option>
              ))}
            </select>

            <select
              value={ginFilters.categoryId}
              onChange={(e) => setGinFilters((p) => ({ ...p, categoryId: e.target.value, subcategoryId: '' }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
            >
              <option value="">All Categories</option>
              {(masterOptions.categories || []).map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>

            <select
              value={ginFilters.subcategoryId}
              onChange={(e) => setGinFilters((p) => ({ ...p, subcategoryId: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
            >
              <option value="">All Subcategories</option>
              {filteredGinSubcategories.map((sub) => (
                <option key={sub.id} value={sub.id}>{sub.name}</option>
              ))}
            </select>

            <input
              type="date"
              value={ginFilters.dateFrom}
              onChange={(e) => setGinFilters((p) => ({ ...p, dateFrom: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
            />
            <input
              type="date"
              value={ginFilters.dateTo}
              onChange={(e) => setGinFilters((p) => ({ ...p, dateTo: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
            />

            <Button label="Apply" size="sm" variant="outline" onClick={applyGINFilters} />
            <Button label="Reset" size="sm" variant="secondary" onClick={resetGINFilters} />
          </div>

          <div className="flex items-center gap-2">
            <p className="text-xs text-slate-500">{filteredGINRows.length} GIN(s)</p>
            <Button
              label="Excel"
              icon={Download}
              size="sm"
              variant="outline"
              onClick={() => exportRowsToExcel({ fileName: 'inventory-gin-report', sheetName: 'GIN', rows: ginExportRows })}
            />
            <Button
              label="PDF"
              icon={FileText}
              size="sm"
              variant="outline"
              onClick={() => exportRowsToPdf({ fileName: 'inventory-gin-report', title: 'GIN Report', rows: ginExportRows })}
            />
            <Button
              label="Print All"
              icon={Printer}
              size="sm"
              variant="outline"
              onClick={() => printAllGINs(filteredGINRows)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                <th className="px-6 py-4 font-semibold">GIN No</th>
                <th className="px-6 py-4 font-semibold">GD Ref</th>
                <th className="px-6 py-4 font-semibold">Department</th>
                <th className="px-6 py-4 font-semibold">Items Issued</th>
                <th className="px-6 py-4 font-semibold">Issue Date</th>
                <th className="px-6 py-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredGINRows.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                    No Issuance Note (GIN) records found.
                  </td>
                </tr>
              ) : (
                filteredGINRows.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="px-6 py-4 font-medium">{row.code}</td>
                    <td className="px-6 py-4 text-slate-500">{row.gdHeader?.code || row.gd?.code || '-'}</td>
                    <td className="px-6 py-4">{row.department?.name || row.gdHeader?.department?.name || '-'}</td>
                    <td className="px-6 py-4">
                      {row.ginItems && row.ginItems.length > 0 ? (
                        <ul className="space-y-0.5">
                          {row.ginItems.map((gi) => (
                            <li key={gi.id} className="text-sm">
                              {gi.item?.name || '-'} <span className="text-slate-400">× {gi.issuedQuantity}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-sm">{row.item?.name || '-'} × {row.issuedQuantity ?? '-'}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">{row.issueDate ? new Date(row.issueDate).toLocaleDateString() : '-'}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        title="Print GIN"
                        onClick={() => printGINDocument(row)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 border border-slate-300 rounded-md hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition-colors"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Print
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
      )} */}
    </div>
  );
}
