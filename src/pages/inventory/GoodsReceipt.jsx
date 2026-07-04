import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import useModalKeys from '../../hooks/useModalKeys';
import useFocusTrap from '../../hooks/useFocusTrap';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Plus, Printer, Search, X, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { useInventoryStore } from '../../store/useInventoryStore';
import { useAuthStore } from '../../store/useAuthStore';
import { hasPermission } from '../../utils/permissions';
import { printGRNDocument } from '../../utils/printGRN';

function SearchableSelect({ options, value, onChange, placeholder, getLabel, getValue, className = '' }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const selected = options.find((o) => String(getValue(o)) === String(value));
  const filtered = useMemo(
    () => !search ? options : options.filter((o) => getLabel(o).toLowerCase().includes(search.toLowerCase())),
    [options, search, getLabel]
  );

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) { setOpen(false); setSearch(''); setHighlightedIndex(-1); }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (listRef.current && highlightedIndex >= 0) {
      const el = listRef.current.children[highlightedIndex];
      if (el) el.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  const selectOption = (o) => {
    onChange(String(getValue(o)));
    setSearch('');
    setOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!open) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSearch(''); setOpen(true); setHighlightedIndex(0); }
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'Tab') {
      e.preventDefault();
      setHighlightedIndex((p) => Math.min(p + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((p) => Math.max(p - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && filtered[highlightedIndex]) selectOption(filtered[highlightedIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setSearch('');
      setHighlightedIndex(-1);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        ref={inputRef}
        type="text"
        value={open ? search : (selected ? getLabel(selected) : '')}
        onChange={(e) => { setSearch(e.target.value); setOpen(true); setHighlightedIndex(-1); }}
        onFocus={() => { setSearch(''); setOpen(true); }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-blue-500"
        autoComplete="off"
      />
      {open && (
        <div ref={listRef} className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-[520px] overflow-y-auto">
          {filtered.length === 0
            ? <div className="px-3 py-2 text-sm text-slate-400">No results</div>
            : filtered.map((o, idx) => (
              <div
                key={getValue(o)}
                onMouseDown={() => selectOption(o)}
                className={`px-3 py-2 text-sm cursor-pointer ${idx === highlightedIndex ? 'bg-blue-100 text-blue-900' : String(getValue(o)) === String(value) ? 'bg-blue-50 font-medium hover:bg-blue-50' : 'hover:bg-blue-50'}`}
              >
                {getLabel(o)}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

export default function GoodsReceipt() {
  const { user } = useAuthStore();
  const canEditGRN = hasPermission(user, 'inventory', 'grn', 'edit');
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showReprint, setShowReprint] = useState(false);
  const createFormRef = useRef(null);
  const [reprintQuery, setReprintQuery] = useState('');
  const [selectedPoCode, setSelectedPoCode] = useState('');
  const [headerReceivedDate, setHeaderReceivedDate] = useState(new Date().toISOString().slice(0, 10));
  const [headerBillDate, setHeaderBillDate] = useState('');
  const [paymentType, setPaymentType] = useState('cash');
  const [paymentNote, setPaymentNote] = useState('');
  const [draftLines, setDraftLines] = useState([]);
  const [editingGRN, setEditingGRN] = useState(null);
  const [editGRNForm, setEditGRNForm] = useState({});
  const [editGRNSaving, setEditGRNSaving] = useState(false);

  const {
    loading,
    grns,
    purchaseOrders,
    masterOptions,
    fetchGRNs,
    fetchPurchaseOrders,
    fetchMastersOptions,
    createGRN,
    updateGRN,
  } = useInventoryStore();

  useEffect(() => {
    Promise.all([
      fetchGRNs(),
      fetchPurchaseOrders({ status: 'open' }),
      fetchMastersOptions(),
    ]).catch((err) => toast.error(err.message || 'Failed to load GRN data'));
  }, [fetchGRNs, fetchPurchaseOrders, fetchMastersOptions]);

  useEffect(() => {
    if (location.state?.openCreate) {
      setShowCreate(true);
    }
  }, [location.state]);

  const getRootCode = (code) => {
    if (!code) return code;
    return code.replace(/-\d{2}$/, '');
  };

  const uniquePoCodes = useMemo(() => {
    const seen = new Set();
    const result = [];
    for (const po of (purchaseOrders || [])) {
      if (po.status !== 'open') continue;
      const root = getRootCode(po.code);
      if (seen.has(root)) continue;
      seen.add(root);
      result.push({ ...po, rootCode: root });
    }
    return result;
  }, [purchaseOrders]);

  useEffect(() => {
    if (!selectedPoCode) {
      setDraftLines([]);
      return;
    }
    const lines = (purchaseOrders || []).filter((po) => po.status === 'open' && getRootCode(po.code) === selectedPoCode);
    setDraftLines(lines.map((po) => ({
      poId: po.id,
      itemName: po.item?.name || '-',
      itemCode: po.item?.code || '-',
      hasExpiry: po.item?.hasExpiry || false,
      requiredQuantity: po.requiredQuantity,
      receivedQuantity: String(po.requiredQuantity || ''),
      receivedRate: String(po.orderedRate || ''),
      retailPrice: '',
      expiryDate: '',
    })));
  }, [selectedPoCode, purchaseOrders]);

  const updateDraftLine = (idx, key, value) => {
    setDraftLines((prev) => prev.map((line, i) => i === idx ? { ...line, [key]: value } : line));
  };

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = grns || [];
    if (!q) return rows;
    return rows.filter((r) => [
      r.code,
      r.purchaseOrder?.code,
      r.supplier?.name,
      r.item?.name,
    ].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [grns, query]);

  const handleSaveGRN = async (shouldPrint = false) => {
    if (!selectedPoCode) {
      toast.error('Please select a PO');
      return;
    }
    for (const line of draftLines) {
      if (!line.receivedQuantity || Number(line.receivedQuantity) < 1) {
        toast.error(`Enter valid quantity for ${line.itemName}`);
        return;
      }
      if (!line.receivedRate || Number(line.receivedRate) < 0) {
        toast.error(`Enter valid rate for ${line.itemName}`);
        return;
      }
      if (line.hasExpiry && !line.expiryDate) {
        toast.error(`Expiry date required for ${line.itemName}`);
        return;
      }
    }
    try {
      const results = [];
      for (const line of draftLines) {
        const grn = await createGRN({
          poId: Number(line.poId),
          receivedQuantity: Number(line.receivedQuantity),
          receivedRate: Number(line.receivedRate),
          retailPrice: line.retailPrice ? Number(line.retailPrice) : undefined,
          receivedDate: headerReceivedDate || undefined,
          billDate: headerBillDate || undefined,
          expiryDate: line.expiryDate || undefined,
          paymentType,
          paymentNote: paymentType === 'installment' ? paymentNote : undefined,
        });
        results.push({ grn, line });
      }

      if (shouldPrint && results.length > 0) {
        const firstGrn = results[0].grn;
        const supplierPO = (purchaseOrders || []).find((p) => p.id === results[0].line.poId);
        printGRNDocument({
          grnCode: firstGrn?.code || '',
          date: firstGrn?.receivedDate || new Date(),
          supplierName: supplierPO?.supplier?.name || '',
          items: results.map(({ grn, line }) => ({
            itemName: line.itemName,
            orderedQty: line.requiredQuantity,
            receivedQty: Number(line.receivedQuantity),
            rateEst: grn?.orderedRate ?? line.receivedRate,
            rateReceived: Number(line.receivedRate),
            amountReceived: Number(line.receivedQuantity) * Number(line.receivedRate),
          })),
          printedBy: user?.name || user?.email || '',
          generatedAt: new Date().toLocaleString('en-PK', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }),
        });
      }

      await Promise.all([fetchGRNs(), fetchPurchaseOrders({ status: 'open' })]);
      setSelectedPoCode('');
      setDraftLines([]);
      setHeaderReceivedDate(new Date().toISOString().slice(0, 10));
      setHeaderBillDate('');
      setPaymentType('cash');
      setPaymentNote('');
      setShowCreate(false);
      toast.success(`GRN saved (${draftLines.length} item${draftLines.length !== 1 ? 's' : ''})`);
    } catch (err) {
      toast.error(err.message || 'Failed to save GRN');
    }
  };

  const handleCancelGRN = () => {
    setSelectedPoCode('');
    setDraftLines([]);
    setHeaderReceivedDate(new Date().toISOString().slice(0, 10));
    setHeaderBillDate('');
    setPaymentType('cash');
    setPaymentNote('');
    setShowCreate(false);
  };

  useModalKeys({
    active: showCreate,
    onEsc: handleCancelGRN,
    onCtrlS: () => handleSaveGRN(false),
    onCtrlP: () => handleSaveGRN(true),
  });

  useModalKeys({
    active: showReprint,
    onEsc: () => setShowReprint(false),
  });

  useModalKeys({
    active: !showCreate && !showReprint,
    onCtrlN: () => { setShowCreate(true); setShowReprint(false); },
  });

  useFocusTrap(createFormRef, showCreate);

  const openEditGRN = (grn) => {
    setEditingGRN(grn);
    setEditGRNForm({
      supplierId: grn.supplierId ? String(grn.supplierId) : '',
      receivedDate: grn.receivedDate ? new Date(grn.receivedDate).toISOString().slice(0, 10) : '',
      billDate: grn.billDate ? new Date(grn.billDate).toISOString().slice(0, 10) : '',
      receivedQuantity: grn.receivedQuantity != null ? String(grn.receivedQuantity) : '',
      receivedRate: grn.receivedRate != null ? String(grn.receivedRate) : '',
      paymentType: grn.paymentType || 'cash',
      paymentNote: grn.paymentNote || '',
    });
  };

  const handleSaveEditGRN = async () => {
    if (!editingGRN) return;
    setEditGRNSaving(true);
    try {
      await updateGRN(editingGRN.id, editGRNForm);
      await fetchGRNs();
      setEditingGRN(null);
      toast.success('GRN updated');
    } catch (err) {
      toast.error(err.message || 'Failed to update GRN');
    } finally {
      setEditGRNSaving(false);
    }
  };



  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Goods Receiving Note (GRN)</h1>
          <p className="text-slate-500 text-sm">Receive items and update inward stock</p>
        </div>
        <div className="flex gap-2">
          <Button label="New GRN" icon={Plus} onClick={() => { setShowCreate((s) => !s); setShowReprint(false); }} />
          <Button label="Reprint GRN" icon={Printer} variant="outline" onClick={() => { setShowReprint((s) => !s); setShowCreate(false); setReprintQuery(''); }} />
        </div>
      </div>

      {showReprint && (
        <Card className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-700">Reprint GRN (DUPLICATE)</h3>
            <button onClick={() => setShowReprint(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
          </div>
          <div className="relative mb-3">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by GRN code, supplier or item..."
              value={reprintQuery}
              onChange={(e) => setReprintQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-blue-500"
              autoFocus
            />
          </div>
          <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
            {(grns || [])
              .filter((r) => {
                const q = reprintQuery.trim().toLowerCase();
                if (!q) return true;
                return [r.code, r.supplier?.name, r.item?.name, r.purchaseOrder?.code]
                  .some((v) => String(v || '').toLowerCase().includes(q));
              })
              .slice(0, 15)
              .map((grn) => (
                <div key={grn.id} className="py-2.5 px-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-sm text-slate-800">{grn.code}</span>
                      <span className="text-slate-400 text-xs mx-2">|</span>
                      <span className="text-xs text-slate-500">{grn.supplier?.name || '-'}</span>
                      <span className="text-slate-400 text-xs mx-2">|</span>
                      <span className="text-xs text-slate-500">{grn.item?.name || '-'}</span>
                      {grn.receivedDate && <span className="text-slate-400 text-xs ml-2">({new Date(grn.receivedDate).toLocaleDateString()})</span>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {canEditGRN && (
                        <button
                          onClick={() => openEditGRN(grn)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-md hover:bg-blue-50 transition-colors whitespace-nowrap"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Edit
                        </button>
                      )}
                      <button
                        onClick={() => printGRNDocument({
                          grnCode: grn.code,
                          date: grn.receivedDate,
                          supplierName: grn.supplier?.name || '',
                          items: [{
                            itemName: grn.item?.name,
                            orderedQty: grn.purchaseOrder?.requiredQuantity,
                            receivedQty: grn.receivedQuantity,
                            rateEst: grn.purchaseOrder?.orderedRate ?? grn.receivedRate,
                            rateReceived: grn.receivedRate,
                            amountReceived: grn.totalAmount,
                          }],
                          isReprint: true,
                          reprintedBy: user?.name || user?.email || '',
                          reprintedAt: new Date().toLocaleString('en-PK', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }),
                          printedBy: user?.name || user?.email || '',
                          generatedAt: grn.receivedDate ? new Date(grn.receivedDate).toLocaleDateString('en-PK', { day: '2-digit', month: 'long', year: 'numeric' }) : '',
                        })}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-md hover:bg-red-50 transition-colors whitespace-nowrap"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Reprint
                      </button>
                    </div>
                  </div>
                  {editingGRN?.id === grn.id && (
                    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Supplier</label>
                        <select
                          value={editGRNForm.supplierId}
                          onChange={(e) => setEditGRNForm((f) => ({ ...f, supplierId: e.target.value }))}
                          className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-blue-500 bg-white"
                        >
                          <option value="">— Select Supplier —</option>
                          {(masterOptions.suppliers || []).map((s) => (
                            <option key={s.id} value={String(s.id)}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Received Date</label>
                          <input type="date" value={editGRNForm.receivedDate}
                            onChange={(e) => setEditGRNForm((f) => ({ ...f, receivedDate: e.target.value }))}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-blue-500" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Bill Date</label>
                          <input type="date" value={editGRNForm.billDate}
                            onChange={(e) => setEditGRNForm((f) => ({ ...f, billDate: e.target.value }))}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-blue-500" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Received Qty</label>
                          <input type="number" min="0" step="0.01" value={editGRNForm.receivedQuantity}
                            onChange={(e) => setEditGRNForm((f) => ({ ...f, receivedQuantity: e.target.value }))}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-blue-500" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Rate</label>
                          <input type="number" min="0" step="0.01" value={editGRNForm.receivedRate}
                            onChange={(e) => setEditGRNForm((f) => ({ ...f, receivedRate: e.target.value }))}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-blue-500" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Payment Type</label>
                        <div className="flex gap-4 px-3 py-2 border border-slate-300 rounded-md bg-white">
                          {['cash', 'installment'].map((pt) => (
                            <label key={pt} className="flex items-center gap-1.5 text-sm cursor-pointer capitalize">
                              <input type="radio" name="editPaymentType" value={pt}
                                checked={editGRNForm.paymentType === pt}
                                onChange={() => setEditGRNForm((f) => ({ ...f, paymentType: pt, paymentNote: pt === 'cash' ? '' : f.paymentNote }))} />
                              {pt}
                            </label>
                          ))}
                        </div>
                      </div>
                      {editGRNForm.paymentType === 'installment' && (
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Installment Note</label>
                          <textarea rows={2} value={editGRNForm.paymentNote}
                            onChange={(e) => setEditGRNForm((f) => ({ ...f, paymentNote: e.target.value }))}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-sm resize-none focus:outline-none focus:border-blue-500" />
                        </div>
                      )}
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setEditingGRN(null)}
                          className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50">
                          Cancel
                        </button>
                        <button onClick={handleSaveEditGRN} disabled={editGRNSaving}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">
                          {editGRNSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            {(grns || []).length === 0 && (
              <p className="text-center text-slate-400 text-sm py-6">No GRN records found.</p>
            )}
          </div>
        </Card>
      )}

      {showCreate && (
        <Card className="mb-4">
          <div ref={createFormRef} className="space-y-4">
            {/* Header: PO select + Bill Date + Payment Type */}
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Select PO</label>
                <SearchableSelect
                  options={uniquePoCodes}
                  value={selectedPoCode}
                  onChange={(val) => setSelectedPoCode(val)}
                  placeholder="Search PO..."
                  getLabel={(po) => `${po.rootCode} (${po.supplier?.name || '-'})`}
                  getValue={(po) => po.rootCode}
                  className="min-w-[280px]"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Received Date</label>
                <input
                  type="date"
                  value={headerReceivedDate}
                  onChange={(e) => setHeaderReceivedDate(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Bill Date (optional)</label>
                <input
                  type="date"
                  value={headerBillDate}
                  onChange={(e) => setHeaderBillDate(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Payment Type</label>
                <div className="flex gap-4 px-3 py-2 border border-slate-300 rounded-md bg-white">
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="paymentType"
                      value="cash"
                      checked={paymentType === 'cash'}
                      onChange={() => { setPaymentType('cash'); setPaymentNote(''); }}
                    />
                    Cash
                  </label>
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="paymentType"
                      value="installment"
                      checked={paymentType === 'installment'}
                      onChange={() => setPaymentType('installment')}
                    />
                    Installment
                  </label>
                </div>
              </div>
            </div>

            {paymentType === 'installment' && (
              <div>
                <label className="block text-xs text-slate-500 mb-1">Installment Note</label>
                <textarea
                  rows={2}
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="e.g. 1st installment 5000 on 1st June, 2nd installment 5000 on 1st July..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>
            )}

            {/* Inline editable items table */}
            {draftLines.length > 0 && (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-500 text-xs uppercase tracking-wide">
                      <th className="px-4 py-2">#</th>
                      <th className="px-4 py-2">Item</th>
                      <th className="px-4 py-2">Req Qty</th>
                      <th className="px-4 py-2">Received Qty *</th>
                      <th className="px-4 py-2">Rate *</th>
                      <th className="px-4 py-2">Retail Price</th>
                      <th className="px-4 py-2">Expiry Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {draftLines.map((line, idx) => (
                      <tr key={`draft-${idx}`} className="hover:bg-slate-50">
                        <td className="px-4 py-2 text-slate-400">{idx + 1}</td>
                        <td className="px-4 py-2 font-medium text-slate-800">
                          {line.itemName}
                          <span className="text-slate-400 text-xs ml-1">({line.itemCode})</span>
                        </td>
                        <td className="px-4 py-2 text-slate-500">{line.requiredQuantity}</td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            min="1"
                            value={line.receivedQuantity}
                            onChange={(e) => updateDraftLine(idx, 'receivedQuantity', e.target.value)}
                            className="w-24 px-2 py-1 border border-slate-300 rounded text-sm"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.receivedRate}
                            onChange={(e) => updateDraftLine(idx, 'receivedRate', e.target.value)}
                            className="w-24 px-2 py-1 border border-slate-300 rounded text-sm"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="optional"
                            value={line.retailPrice}
                            onChange={(e) => updateDraftLine(idx, 'retailPrice', e.target.value)}
                            className="w-24 px-2 py-1 border border-slate-300 rounded text-sm"
                          />
                        </td>
                        <td className="px-4 py-2">
                          {line.hasExpiry ? (
                            <input
                              type="date"
                              value={line.expiryDate}
                              onChange={(e) => updateDraftLine(idx, 'expiryDate', e.target.value)}
                              className="px-2 py-1 border border-slate-300 rounded text-sm"
                              required
                            />
                          ) : (
                            <span className="text-slate-300 text-xs">N/A</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                label={loading ? 'Saving...' : `Save GRN (${draftLines.length} item${draftLines.length !== 1 ? 's' : ''})`}
                disabled={loading || draftLines.length === 0}
                onClick={() => handleSaveGRN(false)}
              />
              <Button
                label={loading ? 'Saving...' : 'Save & Print'}
                disabled={loading || draftLines.length === 0}
                onClick={() => handleSaveGRN(true)}
              />
              <Button
                variant="secondary"
                label="Cancel"
                onClick={handleCancelGRN}
              />
            </div>
          </div>
        </Card>
      )}

      {/* <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search GRN List..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 pr-4 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-blue-500 w-64"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-xs text-slate-500">{filteredRows.length} record(s)</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                <th className="px-6 py-4 font-semibold">GRN No</th>
                <th className="px-6 py-4 font-semibold">Linked PO</th>
                <th className="px-6 py-4 font-semibold">Supplier</th>
                <th className="px-6 py-4 font-semibold">Date Received</th>
                <th className="px-6 py-4 font-semibold">Item</th>
                <th className="px-6 py-4 font-semibold">Qty @ Rate</th>
                <th className="px-6 py-4 font-semibold">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
                    No GRN records found.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-6 py-4">{row.code}</td>
                    <td className="px-6 py-4">{row.purchaseOrder?.code || '-'}</td>
                    <td className="px-6 py-4 font-medium text-slate-800">{row.supplier?.name || '-'}</td>
                    <td className="px-6 py-4">{row.receivedDate ? new Date(row.receivedDate).toLocaleDateString() : '-'}</td>
                    <td className="px-6 py-4">{row.item?.name || '-'}</td>
                    <td className="px-6 py-4">{row.receivedQuantity} @ {row.receivedRate}</td>
                    <td className="px-6 py-4">{row.totalAmount}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card> */}
    </div>
  );
}
