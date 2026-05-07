import { useEffect, useMemo, useState } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Printer, Download, Filter, BarChart3 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useInventoryStore } from '../../store/useInventoryStore';
import { exportRowsToExcel, exportRowsToPdf } from '../../utils/exportInventoryReports';

const REPORT_TYPES = [
  'Item List', 'Stock Position', 'Item Ledger', 'Reorder Report', 
  'Receiving Report', 'Issuance Report', 'Discard Report', 'Repairing Report', 
  'Short Expiry', 'Expiry', 'Daily Sales', 'Supplier Ledger'
];

export default function InventoryReports() {
  const [activeReport, setActiveReport] = useState('Stock Position');
  const [ledgerFilters, setLedgerFilters] = useState({
    dateFrom: '',
    dateTo: '',
    itemId: '',
    categoryId: '',
    subcategoryId: '',
  });
  const [receivingFilters, setReceivingFilters] = useState({
    dateFrom: '',
    dateTo: '',
    itemId: '',
    supplierId: '',
    categoryId: '',
    subcategoryId: '',
  });
  const [issuanceFilters, setIssuanceFilters] = useState({
    dateFrom: '',
    dateTo: '',
    itemId: '',
    departmentId: '',
    categoryId: '',
    subcategoryId: '',
  });
  const [discardFilters, setDiscardFilters] = useState({
    dateFrom: '',
    dateTo: '',
    itemId: '',
    categoryId: '',
    subcategoryId: '',
  });
  const [shortExpiryFilters, setShortExpiryFilters] = useState({
    dateFrom: '',
    dateTo: '',
    dateLog: '',
    dateLogFrom: '',
    dateLogTo: '',
    itemId: '',
    categoryId: '',
    subcategoryId: '',
  });

  const {
    items,
    grns,
    gins,
    gdns,
    reorderAlerts,
    masterOptions,
    itemLedgerReport,
    shortExpiryReportRows,
    fetchItems,
    fetchGRNs,
    fetchGINs,
    fetchGDNs,
    fetchReorderAlerts,
    fetchMastersOptions,
    fetchItemLedgerReport,
    fetchShortExpiryReport,
  } = useInventoryStore();

  useEffect(() => {
    Promise.all([fetchItems(), fetchReorderAlerts(), fetchMastersOptions()]).catch((err) => {
      toast.error(err.message || 'Failed to load inventory reports data');
    });
  }, [fetchItems, fetchReorderAlerts, fetchMastersOptions]);

  useEffect(() => {
    if (activeReport !== 'Item Ledger') return;

    fetchItemLedgerReport({}).catch((err) => {
      toast.error(err.message || 'Failed to load item ledger report');
    });
  }, [activeReport, fetchItemLedgerReport]);

  useEffect(() => {
    if (activeReport !== 'Receiving Report') return;

    fetchGRNs({}).catch((err) => {
      toast.error(err.message || 'Failed to load receiving report');
    });
  }, [activeReport, fetchGRNs]);

  useEffect(() => {
    if (activeReport !== 'Issuance Report') return;

    fetchGINs({}).catch((err) => {
      toast.error(err.message || 'Failed to load issuance report');
    });
  }, [activeReport, fetchGINs]);

  useEffect(() => {
    if (activeReport !== 'Discard Report') return;

    fetchGDNs({}).catch((err) => {
      toast.error(err.message || 'Failed to load discard report');
    });
  }, [activeReport, fetchGDNs]);

  useEffect(() => {
    if (activeReport !== 'Short Expiry') return;

    fetchShortExpiryReport({}).catch((err) => {
      toast.error(err.message || 'Failed to load short expiry report');
    });
  }, [activeReport, fetchShortExpiryReport]);

  const categoryOptions = masterOptions?.categories || [];
  const subcategoryOptions = useMemo(() => {
    const selectedCategoryId = Number(ledgerFilters.categoryId || 0);
    if (!selectedCategoryId) return masterOptions?.subcategories || [];
    return (masterOptions?.subcategories || []).filter((sub) => Number(sub.categoryId) === selectedCategoryId);
  }, [masterOptions?.subcategories, ledgerFilters.categoryId]);

  const itemOptions = useMemo(() => {
    const selectedCategoryId = Number(ledgerFilters.categoryId || 0);
    const selectedSubcategoryId = Number(ledgerFilters.subcategoryId || 0);

    return (items || []).filter((item) => {
      if (selectedCategoryId && Number(item.categoryId) !== selectedCategoryId) return false;
      if (selectedSubcategoryId && Number(item.subcategoryId) !== selectedSubcategoryId) return false;
      return true;
    });
  }, [items, ledgerFilters.categoryId, ledgerFilters.subcategoryId]);

  const receivingSubcategoryOptions = useMemo(() => {
    const selectedCategoryId = Number(receivingFilters.categoryId || 0);
    if (!selectedCategoryId) return masterOptions?.subcategories || [];
    return (masterOptions?.subcategories || []).filter((sub) => Number(sub.categoryId) === selectedCategoryId);
  }, [masterOptions?.subcategories, receivingFilters.categoryId]);

  const receivingItemOptions = useMemo(() => {
    const selectedCategoryId = Number(receivingFilters.categoryId || 0);
    const selectedSubcategoryId = Number(receivingFilters.subcategoryId || 0);

    return (items || []).filter((item) => {
      if (selectedCategoryId && Number(item.categoryId) !== selectedCategoryId) return false;
      if (selectedSubcategoryId && Number(item.subcategoryId) !== selectedSubcategoryId) return false;
      return true;
    });
  }, [items, receivingFilters.categoryId, receivingFilters.subcategoryId]);

  const issuanceSubcategoryOptions = useMemo(() => {
    const selectedCategoryId = Number(issuanceFilters.categoryId || 0);
    if (!selectedCategoryId) return masterOptions?.subcategories || [];
    return (masterOptions?.subcategories || []).filter((sub) => Number(sub.categoryId) === selectedCategoryId);
  }, [masterOptions?.subcategories, issuanceFilters.categoryId]);

  const issuanceItemOptions = useMemo(() => {
    const selectedCategoryId = Number(issuanceFilters.categoryId || 0);
    const selectedSubcategoryId = Number(issuanceFilters.subcategoryId || 0);

    return (items || []).filter((item) => {
      if (selectedCategoryId && Number(item.categoryId) !== selectedCategoryId) return false;
      if (selectedSubcategoryId && Number(item.subcategoryId) !== selectedSubcategoryId) return false;
      return true;
    });
  }, [items, issuanceFilters.categoryId, issuanceFilters.subcategoryId]);

  const discardSubcategoryOptions = useMemo(() => {
    const selectedCategoryId = Number(discardFilters.categoryId || 0);
    if (!selectedCategoryId) return masterOptions?.subcategories || [];
    return (masterOptions?.subcategories || []).filter((sub) => Number(sub.categoryId) === selectedCategoryId);
  }, [masterOptions?.subcategories, discardFilters.categoryId]);

  const discardItemOptions = useMemo(() => {
    const selectedCategoryId = Number(discardFilters.categoryId || 0);
    const selectedSubcategoryId = Number(discardFilters.subcategoryId || 0);

    return (items || []).filter((item) => {
      if (selectedCategoryId && Number(item.categoryId) !== selectedCategoryId) return false;
      if (selectedSubcategoryId && Number(item.subcategoryId) !== selectedSubcategoryId) return false;
      return true;
    });
  }, [items, discardFilters.categoryId, discardFilters.subcategoryId]);

  const shortExpirySubcategoryOptions = useMemo(() => {
    const selectedCategoryId = Number(shortExpiryFilters.categoryId || 0);
    if (!selectedCategoryId) return masterOptions?.subcategories || [];
    return (masterOptions?.subcategories || []).filter((sub) => Number(sub.categoryId) === selectedCategoryId);
  }, [masterOptions?.subcategories, shortExpiryFilters.categoryId]);

  const shortExpiryItemOptions = useMemo(() => {
    const selectedCategoryId = Number(shortExpiryFilters.categoryId || 0);
    const selectedSubcategoryId = Number(shortExpiryFilters.subcategoryId || 0);

    return (items || []).filter((item) => {
      if (selectedCategoryId && Number(item.categoryId) !== selectedCategoryId) return false;
      if (selectedSubcategoryId && Number(item.subcategoryId) !== selectedSubcategoryId) return false;
      return Boolean(item.hasExpiry);
    });
  }, [items, shortExpiryFilters.categoryId, shortExpiryFilters.subcategoryId]);

  const updateReceivingFilter = (key, value) => {
    setReceivingFilters((prev) => {
      if (key === 'categoryId') {
        return {
          ...prev,
          categoryId: value,
          subcategoryId: '',
          itemId: '',
        };
      }

      if (key === 'subcategoryId') {
        return {
          ...prev,
          subcategoryId: value,
          itemId: '',
        };
      }

      return { ...prev, [key]: value };
    });
  };

  const applyReceivingFilters = () => {
    fetchGRNs(receivingFilters).catch((err) => {
      toast.error(err.message || 'Failed to load receiving report');
    });
  };

  const resetReceivingFilters = () => {
    const emptyFilters = {
      dateFrom: '',
      dateTo: '',
      itemId: '',
      supplierId: '',
      categoryId: '',
      subcategoryId: '',
    };
    setReceivingFilters(emptyFilters);
    fetchGRNs(emptyFilters).catch((err) => {
      toast.error(err.message || 'Failed to load receiving report');
    });
  };

  const updateIssuanceFilter = (key, value) => {
    setIssuanceFilters((prev) => {
      if (key === 'categoryId') {
        return {
          ...prev,
          categoryId: value,
          subcategoryId: '',
          itemId: '',
        };
      }

      if (key === 'subcategoryId') {
        return {
          ...prev,
          subcategoryId: value,
          itemId: '',
        };
      }

      return { ...prev, [key]: value };
    });
  };

  const applyIssuanceFilters = () => {
    fetchGINs(issuanceFilters).catch((err) => {
      toast.error(err.message || 'Failed to load issuance report');
    });
  };

  const resetIssuanceFilters = () => {
    const emptyFilters = {
      dateFrom: '',
      dateTo: '',
      itemId: '',
      departmentId: '',
      categoryId: '',
      subcategoryId: '',
    };
    setIssuanceFilters(emptyFilters);
    fetchGINs(emptyFilters).catch((err) => {
      toast.error(err.message || 'Failed to load issuance report');
    });
  };

  const updateDiscardFilter = (key, value) => {
    setDiscardFilters((prev) => {
      if (key === 'categoryId') {
        return {
          ...prev,
          categoryId: value,
          subcategoryId: '',
          itemId: '',
        };
      }

      if (key === 'subcategoryId') {
        return {
          ...prev,
          subcategoryId: value,
          itemId: '',
        };
      }

      return { ...prev, [key]: value };
    });
  };

  const applyDiscardFilters = () => {
    fetchGDNs(discardFilters).catch((err) => {
      toast.error(err.message || 'Failed to load discard report');
    });
  };

  const resetDiscardFilters = () => {
    const emptyFilters = {
      dateFrom: '',
      dateTo: '',
      itemId: '',
      categoryId: '',
      subcategoryId: '',
    };
    setDiscardFilters(emptyFilters);
    fetchGDNs(emptyFilters).catch((err) => {
      toast.error(err.message || 'Failed to load discard report');
    });
  };

  const updateShortExpiryFilter = (key, value) => {
    setShortExpiryFilters((prev) => {
      if (key === 'categoryId') {
        return {
          ...prev,
          categoryId: value,
          subcategoryId: '',
          itemId: '',
        };
      }

      if (key === 'subcategoryId') {
        return {
          ...prev,
          subcategoryId: value,
          itemId: '',
        };
      }

      if (key === 'dateLog') {
        return {
          ...prev,
          dateLog: value,
          ...(value ? { dateLogFrom: '', dateLogTo: '' } : {}),
        };
      }

      if (key === 'dateLogFrom' || key === 'dateLogTo') {
        return {
          ...prev,
          dateLog: '',
          [key]: value,
        };
      }

      return { ...prev, [key]: value };
    });
  };

  const applyShortExpiryFilters = () => {
    fetchShortExpiryReport(shortExpiryFilters).catch((err) => {
      toast.error(err.message || 'Failed to load short expiry report');
    });
  };

  const resetShortExpiryFilters = () => {
    const emptyFilters = {
      dateFrom: '',
      dateTo: '',
      dateLog: '',
      dateLogFrom: '',
      dateLogTo: '',
      itemId: '',
      categoryId: '',
      subcategoryId: '',
    };
    setShortExpiryFilters(emptyFilters);
    fetchShortExpiryReport(emptyFilters).catch((err) => {
      toast.error(err.message || 'Failed to load short expiry report');
    });
  };

  const updateLedgerFilter = (key, value) => {
    setLedgerFilters((prev) => {
      if (key === 'categoryId') {
        return {
          ...prev,
          categoryId: value,
          subcategoryId: '',
          itemId: '',
        };
      }

      if (key === 'subcategoryId') {
        return {
          ...prev,
          subcategoryId: value,
          itemId: '',
        };
      }

      return { ...prev, [key]: value };
    });
  };

  const applyLedgerFilters = () => {
    fetchItemLedgerReport(ledgerFilters).catch((err) => {
      toast.error(err.message || 'Failed to load item ledger report');
    });
  };

  const resetLedgerFilters = () => {
    const emptyFilters = {
      dateFrom: '',
      dateTo: '',
      itemId: '',
      categoryId: '',
      subcategoryId: '',
    };
    setLedgerFilters(emptyFilters);
    fetchItemLedgerReport(emptyFilters).catch((err) => {
      toast.error(err.message || 'Failed to load item ledger report');
    });
  };

  const reportRows = useMemo(() => {
    if (activeReport === 'Reorder Report') {
      return (reorderAlerts || []).map((row) => ({
        key: row.id,
        code: row.item?.code,
        name: row.item?.name,
        category: row.item?.category?.name || '-',
        stock: row.currentQty,
        threshold: row.thresholdQty,
        status: row.status,
      }));
    }

    if (activeReport === 'Stock Position') {
      return (items || []).map((row) => ({
        key: row.id,
        code: row.code,
        name: row.name,
        category: row.category?.name || '-',
        stock: row.currentStock,
        threshold: row.reorderLevel,
        status: row.status,
      }));
    }

    return [];
  }, [activeReport, items, reorderAlerts]);

  const ledgerExportRows = useMemo(() => {
    return (itemLedgerReport?.rows || []).map((row) => ({
      Date: row.date ? new Date(row.date).toLocaleString() : '-',
      'Item Code': row.itemCode,
      'Item Name': row.itemName,
      Category: row.category,
      Subcategory: row.subcategory,
      'Received Qty': row.receivedQuantity,
      'Issuance Qty': row.issuanceQuantity,
      'Remaining Qty': row.remainingQuantity,
      Unit: row.baseUnit,
      Source: row.sourceType,
      Reference: row.referenceNo,
    }));
  }, [itemLedgerReport?.rows]);

  const receivingRows = useMemo(() => {
    return (grns || []).map((row) => ({
      key: row.id,
      date: row.receivedDate,
      item: row.item?.name || '-',
      itemCode: row.item?.code || '-',
      category: row.category?.name || '-',
      subcategory: row.subcategory?.name || '-',
      supplier: row.supplier?.name || '-',
      quantity: Number(row.receivedQuantity || 0),
      rate: Number(row.receivedRate || 0),
      amount: Number(row.totalAmount || 0),
    }));
  }, [grns]);

  const receivingExportRows = useMemo(() => {
    return receivingRows.map((row) => ({
      Date: row.date ? new Date(row.date).toLocaleString() : '-',
      Item: row.item,
      'Item Code': row.itemCode,
      Category: row.category,
      Subcategory: row.subcategory,
      Supplier: row.supplier,
      Quantity: row.quantity,
      Rate: row.rate,
      Amount: row.amount,
    }));
  }, [receivingRows]);

  const issuanceRows = useMemo(() => {
    return (gins || []).map((row) => ({
      key: row.id,
      date: row.issueDate,
      item: row.item?.name || '-',
      itemCode: row.item?.code || '-',
      category: row.item?.category?.name || '-',
      subcategory: row.item?.subcategory?.name || '-',
      department: row.department?.name || '-',
      quantity: Number(row.issuedQuantity || 0),
    }));
  }, [gins]);

  const issuanceExportRows = useMemo(() => {
    return issuanceRows.map((row) => ({
      Date: row.date ? new Date(row.date).toLocaleString() : '-',
      Item: row.item,
      'Item Code': row.itemCode,
      Category: row.category,
      Subcategory: row.subcategory,
      Department: row.department,
      Quantity: row.quantity,
    }));
  }, [issuanceRows]);

  const discardRows = useMemo(() => {
    return (gdns || []).map((row) => ({
      key: row.id,
      date: row.discardedDate,
      item: row.item?.name || '-',
      itemCode: row.item?.code || '-',
      category: row.item?.category?.name || '-',
      subcategory: row.item?.subcategory?.name || '-',
      quantity: Number(row.quantity || 0),
      amount: Number(row.amount || 0),
    }));
  }, [gdns]);

  const discardExportRows = useMemo(() => {
    return discardRows.map((row) => ({
      Date: row.date ? new Date(row.date).toLocaleString() : '-',
      Item: row.item,
      'Item Code': row.itemCode,
      Category: row.category,
      Subcategory: row.subcategory,
      Quantity: row.quantity,
      Amount: row.amount,
    }));
  }, [discardRows]);

  const shortExpiryRows = useMemo(() => {
    return (shortExpiryReportRows || []).map((row, index) => ({
      key: row.key || `${row.itemId || row.itemCode || 'item'}-${row.date || 'date'}-${row.dateLog || index}`,
      date: row.date,
      dateLog: row.dateLog,
      item: row.itemName || '-',
      itemCode: row.itemCode || '-',
      category: row.category || '-',
      subcategory: row.subcategory || '-',
      quantity: Number(row.quantity || 0),
      daysLeft: Number(row.daysLeft || 0),
    }));
  }, [shortExpiryReportRows]);

  const shortExpiryExportRows = useMemo(() => {
    return shortExpiryRows.map((row) => ({
      Date: row.date ? new Date(row.date).toLocaleDateString() : '-',
      'Date Log': row.dateLog ? new Date(row.dateLog).toLocaleDateString() : '-',
      Item: row.item,
      'Item Code': row.itemCode,
      Category: row.category,
      Subcategory: row.subcategory,
      Quantity: row.quantity,
      'Days Left': row.daysLeft,
    }));
  }, [shortExpiryRows]);

  const handleExportPdf = () => {
    if (activeReport === 'Item Ledger') {
      exportRowsToPdf({
        fileName: 'inventory-item-ledger-report',
        title: 'Inventory Item Ledger Report',
        rows: ledgerExportRows,
      });
      return;
    }

    if (activeReport === 'Receiving Report') {
      exportRowsToPdf({
        fileName: 'inventory-receiving-report',
        title: 'Inventory Receiving Report',
        rows: receivingExportRows,
      });
      return;
    }

    if (activeReport === 'Issuance Report') {
      exportRowsToPdf({
        fileName: 'inventory-issuance-report',
        title: 'Inventory Issuance Report',
        rows: issuanceExportRows,
      });
      return;
    }

    if (activeReport === 'Discard Report') {
      exportRowsToPdf({
        fileName: 'inventory-discard-report',
        title: 'Inventory Discard Report',
        rows: discardExportRows,
      });
      return;
    }

    if (activeReport === 'Short Expiry') {
      exportRowsToPdf({
        fileName: 'inventory-short-expiry-report',
        title: 'Inventory Short Expiry Report',
        rows: shortExpiryExportRows,
      });
      return;
    }

    exportRowsToPdf({
      fileName: `inventory-${activeReport.toLowerCase().replace(/\s+/g, '-')}`,
      title: activeReport,
      rows: reportRows,
    });
  };

  const handleExportExcel = () => {
    if (activeReport === 'Item Ledger') {
      exportRowsToExcel({
        fileName: 'inventory-item-ledger-report',
        sheetName: 'ItemLedger',
        rows: ledgerExportRows,
      });
      return;
    }

    if (activeReport === 'Receiving Report') {
      exportRowsToExcel({
        fileName: 'inventory-receiving-report',
        sheetName: 'ReceivingReport',
        rows: receivingExportRows,
      });
      return;
    }

    if (activeReport === 'Issuance Report') {
      exportRowsToExcel({
        fileName: 'inventory-issuance-report',
        sheetName: 'IssuanceReport',
        rows: issuanceExportRows,
      });
      return;
    }

    if (activeReport === 'Discard Report') {
      exportRowsToExcel({
        fileName: 'inventory-discard-report',
        sheetName: 'DiscardReport',
        rows: discardExportRows,
      });
      return;
    }

    if (activeReport === 'Short Expiry') {
      exportRowsToExcel({
        fileName: 'inventory-short-expiry-report',
        sheetName: 'ShortExpiryReport',
        rows: shortExpiryExportRows,
      });
      return;
    }

    exportRowsToExcel({
      fileName: `inventory-${activeReport.toLowerCase().replace(/\s+/g, '-')}`,
      sheetName: activeReport.replace(/\s+/g, ''),
      rows: reportRows,
    });
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventory Reports</h1>
          <p className="text-slate-500 text-sm">View, print and export analytical stock reports</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" label="Export CSV" icon={Download} onClick={handleExportExcel} />
          <Button variant="outline" label="Export PDF" icon={Download} onClick={handleExportPdf} />
          <Button label="Print" icon={Printer} onClick={() => window.print()} />
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar menus for reports */}
        <div className="w-64 flex-shrink-0">
          <Card className="p-2">
            <div className="space-y-1">
              {REPORT_TYPES.map(report => (
                <button
                  key={report}
                  onClick={() => setActiveReport(report)}
                  className={`w-full text-left px-4 py-2.5 rounded-md text-sm transition-colors ${
                    activeReport === report 
                    ? 'bg-blue-50 text-blue-700 font-medium' 
                    : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {report}
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* Report Content */}
        <div className="flex-1">
          <Card className="p-0 overflow-hidden h-full min-h-[500px] flex flex-col">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">{activeReport}</h2>
              <Button variant="outline" size="sm" label="Filters" icon={Filter} />
            </div>
            {activeReport === 'Item Ledger' ? (
              <div className="p-4 space-y-4 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Date From</label>
                    <input
                      type="date"
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={ledgerFilters.dateFrom}
                      onChange={(e) => updateLedgerFilter('dateFrom', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Date To</label>
                    <input
                      type="date"
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={ledgerFilters.dateTo}
                      onChange={(e) => updateLedgerFilter('dateTo', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Category</label>
                    <select
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={ledgerFilters.categoryId}
                      onChange={(e) => updateLedgerFilter('categoryId', e.target.value)}
                    >
                      <option value="">All Categories</option>
                      {categoryOptions.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name} ({cat.code})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Subcategory</label>
                    <select
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={ledgerFilters.subcategoryId}
                      onChange={(e) => updateLedgerFilter('subcategoryId', e.target.value)}
                    >
                      <option value="">All Subcategories</option>
                      {subcategoryOptions.map((sub) => (
                        <option key={sub.id} value={sub.id}>{sub.name} ({sub.code})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Item</label>
                    <select
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={ledgerFilters.itemId}
                      onChange={(e) => updateLedgerFilter('itemId', e.target.value)}
                    >
                      <option value="">All Items</option>
                      {itemOptions.map((item) => (
                        <option key={item.id} value={item.id}>{item.name} ({item.code})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" label="Apply" onClick={applyLedgerFilters} />
                  <Button size="sm" variant="outline" label="Reset" onClick={resetLedgerFilters} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  <Card className="p-3">
                    <p className="text-xs text-slate-500">Items</p>
                    <p className="text-lg font-semibold text-slate-800">{itemLedgerReport?.summary?.itemCount || 0}</p>
                  </Card>
                  <Card className="p-3">
                    <p className="text-xs text-slate-500">Opening</p>
                    <p className="text-lg font-semibold text-slate-800">{Number(itemLedgerReport?.summary?.openingBalance || 0).toFixed(2)}</p>
                  </Card>
                  <Card className="p-3">
                    <p className="text-xs text-slate-500">Received</p>
                    <p className="text-lg font-semibold text-emerald-700">{Number(itemLedgerReport?.summary?.totalReceived || 0).toFixed(2)}</p>
                  </Card>
                  <Card className="p-3">
                    <p className="text-xs text-slate-500">Issued</p>
                    <p className="text-lg font-semibold text-rose-700">{Number(itemLedgerReport?.summary?.totalIssued || 0).toFixed(2)}</p>
                  </Card>
                  <Card className="p-3">
                    <p className="text-xs text-slate-500">Closing</p>
                    <p className="text-lg font-semibold text-blue-700">{Number(itemLedgerReport?.summary?.closingBalance || 0).toFixed(2)}</p>
                  </Card>
                </div>

                {(itemLedgerReport?.groups || []).length > 0 ? (
                  <div className="space-y-4">
                    {(itemLedgerReport?.groups || []).map((group) => (
                      <Card key={group.itemId} className="p-0 overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                          <p className="font-semibold text-slate-800">{group.itemName} ({group.itemCode})</p>
                          <p className="text-xs text-slate-500">
                            {group.category} / {group.subcategory} • Opening: {Number(group.openingBalance || 0).toFixed(2)} {group.baseUnit}
                          </p>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-sm">
                            <thead>
                              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3">Item Code</th>
                                <th className="px-4 py-3">Item Name</th>
                                <th className="px-4 py-3">Category</th>
                                <th className="px-4 py-3">Subcategory</th>
                                <th className="px-4 py-3">Received Qty</th>
                                <th className="px-4 py-3">Issuance Qty</th>
                                <th className="px-4 py-3">Remaining Qty</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {(group.rows || []).map((row) => (
                                <tr key={row.key}>
                                  <td className="px-4 py-3">{row.date ? new Date(row.date).toLocaleString() : '-'}</td>
                                  <td className="px-4 py-3">{row.itemCode}</td>
                                  <td className="px-4 py-3 font-medium text-slate-800">{row.itemName}</td>
                                  <td className="px-4 py-3">{row.category}</td>
                                  <td className="px-4 py-3">{row.subcategory}</td>
                                  <td className="px-4 py-3 text-emerald-700">{Number(row.receivedQuantity || 0).toFixed(2)}</td>
                                  <td className="px-4 py-3 text-rose-700">{Number(row.issuanceQuantity || 0).toFixed(2)}</td>
                                  <td className="px-4 py-3 text-blue-700 font-semibold">{Number(row.remainingQuantity || 0).toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-slate-400 py-10">No item ledger entries found for selected filters.</div>
                )}
              </div>
            ) : activeReport === 'Receiving Report' ? (
              <div className="p-4 space-y-4 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Date From</label>
                    <input
                      type="date"
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={receivingFilters.dateFrom}
                      onChange={(e) => updateReceivingFilter('dateFrom', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Date To</label>
                    <input
                      type="date"
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={receivingFilters.dateTo}
                      onChange={(e) => updateReceivingFilter('dateTo', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Supplier</label>
                    <select
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={receivingFilters.supplierId}
                      onChange={(e) => updateReceivingFilter('supplierId', e.target.value)}
                    >
                      <option value="">All Suppliers</option>
                      {(masterOptions?.suppliers || []).map((sup) => (
                        <option key={sup.id} value={sup.id}>{sup.name} ({sup.code})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Category</label>
                    <select
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={receivingFilters.categoryId}
                      onChange={(e) => updateReceivingFilter('categoryId', e.target.value)}
                    >
                      <option value="">All Categories</option>
                      {categoryOptions.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name} ({cat.code})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Subcategory</label>
                    <select
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={receivingFilters.subcategoryId}
                      onChange={(e) => updateReceivingFilter('subcategoryId', e.target.value)}
                    >
                      <option value="">All Subcategories</option>
                      {receivingSubcategoryOptions.map((sub) => (
                        <option key={sub.id} value={sub.id}>{sub.name} ({sub.code})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Item</label>
                    <select
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={receivingFilters.itemId}
                      onChange={(e) => updateReceivingFilter('itemId', e.target.value)}
                    >
                      <option value="">All Items</option>
                      {receivingItemOptions.map((item) => (
                        <option key={item.id} value={item.id}>{item.name} ({item.code})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" label="Apply" onClick={applyReceivingFilters} />
                  <Button size="sm" variant="outline" label="Reset" onClick={resetReceivingFilters} />
                </div>

                {receivingRows.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Item</th>
                          <th className="px-4 py-3">Item Code</th>
                          <th className="px-4 py-3">Category</th>
                          <th className="px-4 py-3">Subcategory</th>
                          <th className="px-4 py-3">Supplier</th>
                          <th className="px-4 py-3">Quantity</th>
                          <th className="px-4 py-3">Rate</th>
                          <th className="px-4 py-3">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {receivingRows.map((row) => (
                          <tr key={row.key}>
                            <td className="px-4 py-3">{row.date ? new Date(row.date).toLocaleDateString() : '-'}</td>
                            <td className="px-4 py-3 font-medium text-slate-800">{row.item}</td>
                            <td className="px-4 py-3">{row.itemCode}</td>
                            <td className="px-4 py-3">{row.category}</td>
                            <td className="px-4 py-3">{row.subcategory}</td>
                            <td className="px-4 py-3">{row.supplier}</td>
                            <td className="px-4 py-3">{row.quantity}</td>
                            <td className="px-4 py-3">{row.rate.toFixed(2)}</td>
                            <td className="px-4 py-3 font-semibold text-slate-800">{row.amount.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center text-slate-400 py-10">No receiving entries found for selected filters.</div>
                )}
              </div>
            ) : activeReport === 'Issuance Report' ? (
              <div className="p-4 space-y-4 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Date From</label>
                    <input
                      type="date"
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={issuanceFilters.dateFrom}
                      onChange={(e) => updateIssuanceFilter('dateFrom', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Date To</label>
                    <input
                      type="date"
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={issuanceFilters.dateTo}
                      onChange={(e) => updateIssuanceFilter('dateTo', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Department</label>
                    <select
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={issuanceFilters.departmentId}
                      onChange={(e) => updateIssuanceFilter('departmentId', e.target.value)}
                    >
                      <option value="">All Departments</option>
                      {(masterOptions?.departments || []).map((dep) => (
                        <option key={dep.id} value={dep.id}>{dep.name} ({dep.code})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Category</label>
                    <select
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={issuanceFilters.categoryId}
                      onChange={(e) => updateIssuanceFilter('categoryId', e.target.value)}
                    >
                      <option value="">All Categories</option>
                      {categoryOptions.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name} ({cat.code})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Subcategory</label>
                    <select
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={issuanceFilters.subcategoryId}
                      onChange={(e) => updateIssuanceFilter('subcategoryId', e.target.value)}
                    >
                      <option value="">All Subcategories</option>
                      {issuanceSubcategoryOptions.map((sub) => (
                        <option key={sub.id} value={sub.id}>{sub.name} ({sub.code})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Item</label>
                    <select
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={issuanceFilters.itemId}
                      onChange={(e) => updateIssuanceFilter('itemId', e.target.value)}
                    >
                      <option value="">All Items</option>
                      {issuanceItemOptions.map((item) => (
                        <option key={item.id} value={item.id}>{item.name} ({item.code})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" label="Apply" onClick={applyIssuanceFilters} />
                  <Button size="sm" variant="outline" label="Reset" onClick={resetIssuanceFilters} />
                </div>

                {issuanceRows.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Item</th>
                          <th className="px-4 py-3">Item Code</th>
                          <th className="px-4 py-3">Category</th>
                          <th className="px-4 py-3">Subcategory</th>
                          <th className="px-4 py-3">Department</th>
                          <th className="px-4 py-3">Quantity</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {issuanceRows.map((row) => (
                          <tr key={row.key}>
                            <td className="px-4 py-3">{row.date ? new Date(row.date).toLocaleDateString() : '-'}</td>
                            <td className="px-4 py-3 font-medium text-slate-800">{row.item}</td>
                            <td className="px-4 py-3">{row.itemCode}</td>
                            <td className="px-4 py-3">{row.category}</td>
                            <td className="px-4 py-3">{row.subcategory}</td>
                            <td className="px-4 py-3">{row.department}</td>
                            <td className="px-4 py-3 font-semibold text-slate-800">{row.quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center text-slate-400 py-10">No issuance entries found for selected filters.</div>
                )}
              </div>
            ) : activeReport === 'Short Expiry' ? (
              <div className="p-4 space-y-4 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Expiry Date From</label>
                    <input
                      type="date"
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={shortExpiryFilters.dateFrom}
                      onChange={(e) => updateShortExpiryFilter('dateFrom', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Expiry Date To</label>
                    <input
                      type="date"
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={shortExpiryFilters.dateTo}
                      onChange={(e) => updateShortExpiryFilter('dateTo', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Category</label>
                    <select
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={shortExpiryFilters.categoryId}
                      onChange={(e) => updateShortExpiryFilter('categoryId', e.target.value)}
                    >
                      <option value="">All Categories</option>
                      {categoryOptions.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name} ({cat.code})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Subcategory</label>
                    <select
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={shortExpiryFilters.subcategoryId}
                      onChange={(e) => updateShortExpiryFilter('subcategoryId', e.target.value)}
                    >
                      <option value="">All Subcategories</option>
                      {shortExpirySubcategoryOptions.map((sub) => (
                        <option key={sub.id} value={sub.id}>{sub.name} ({sub.code})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Item</label>
                    <select
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={shortExpiryFilters.itemId}
                      onChange={(e) => updateShortExpiryFilter('itemId', e.target.value)}
                    >
                      <option value="">All Expiry Items</option>
                      {shortExpiryItemOptions.map((item) => (
                        <option key={item.id} value={item.id}>{item.name} ({item.code})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Date Log (Single)</label>
                    <input
                      type="date"
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={shortExpiryFilters.dateLog}
                      onChange={(e) => updateShortExpiryFilter('dateLog', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Date Log From</label>
                    <input
                      type="date"
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={shortExpiryFilters.dateLogFrom}
                      onChange={(e) => updateShortExpiryFilter('dateLogFrom', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Date Log To</label>
                    <input
                      type="date"
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={shortExpiryFilters.dateLogTo}
                      onChange={(e) => updateShortExpiryFilter('dateLogTo', e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" label="Apply" onClick={applyShortExpiryFilters} />
                  <Button size="sm" variant="outline" label="Reset" onClick={resetShortExpiryFilters} />
                </div>

                {shortExpiryRows.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Item</th>
                          <th className="px-4 py-3">Item Code</th>
                          <th className="px-4 py-3">Category</th>
                          <th className="px-4 py-3">Subcategory</th>
                          <th className="px-4 py-3">Quantity</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {shortExpiryRows.map((row) => (
                          <tr key={row.key}>
                            <td className="px-4 py-3">{row.date ? new Date(row.date).toLocaleDateString() : '-'}</td>
                            <td className="px-4 py-3 font-medium text-slate-800">{row.item}</td>
                            <td className="px-4 py-3">{row.itemCode}</td>
                            <td className="px-4 py-3">{row.category}</td>
                            <td className="px-4 py-3">{row.subcategory}</td>
                            <td className="px-4 py-3 font-semibold text-slate-800">{Number(row.quantity || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center text-slate-400 py-10">No short-expiry entries found for selected filters.</div>
                )}
              </div>
            ) : activeReport === 'Discard Report' ? (
              <div className="p-4 space-y-4 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Date From</label>
                    <input
                      type="date"
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={discardFilters.dateFrom}
                      onChange={(e) => updateDiscardFilter('dateFrom', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Date To</label>
                    <input
                      type="date"
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={discardFilters.dateTo}
                      onChange={(e) => updateDiscardFilter('dateTo', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Category</label>
                    <select
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={discardFilters.categoryId}
                      onChange={(e) => updateDiscardFilter('categoryId', e.target.value)}
                    >
                      <option value="">All Categories</option>
                      {categoryOptions.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name} ({cat.code})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Subcategory</label>
                    <select
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={discardFilters.subcategoryId}
                      onChange={(e) => updateDiscardFilter('subcategoryId', e.target.value)}
                    >
                      <option value="">All Subcategories</option>
                      {discardSubcategoryOptions.map((sub) => (
                        <option key={sub.id} value={sub.id}>{sub.name} ({sub.code})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Item</label>
                    <select
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={discardFilters.itemId}
                      onChange={(e) => updateDiscardFilter('itemId', e.target.value)}
                    >
                      <option value="">All Items</option>
                      {discardItemOptions.map((item) => (
                        <option key={item.id} value={item.id}>{item.name} ({item.code})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" label="Apply" onClick={applyDiscardFilters} />
                  <Button size="sm" variant="outline" label="Reset" onClick={resetDiscardFilters} />
                </div>

                {discardRows.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Item</th>
                          <th className="px-4 py-3">Item Code</th>
                          <th className="px-4 py-3">Category</th>
                          <th className="px-4 py-3">Subcategory</th>
                          <th className="px-4 py-3">Quantity</th>
                          <th className="px-4 py-3">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {discardRows.map((row) => (
                          <tr key={row.key}>
                            <td className="px-4 py-3">{row.date ? new Date(row.date).toLocaleDateString() : '-'}</td>
                            <td className="px-4 py-3 font-medium text-slate-800">{row.item}</td>
                            <td className="px-4 py-3">{row.itemCode}</td>
                            <td className="px-4 py-3">{row.category}</td>
                            <td className="px-4 py-3">{row.subcategory}</td>
                            <td className="px-4 py-3">{Number(row.quantity || 0).toFixed(2)}</td>
                            <td className="px-4 py-3 font-semibold text-slate-800">{Number(row.amount || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center text-slate-400 py-10">No discard entries found for selected filters.</div>
                )}
              </div>
            ) : reportRows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                      <th className="px-4 py-3">Code</th>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Current Stock</th>
                      <th className="px-4 py-3">Reorder Level</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportRows.map((row) => (
                      <tr key={row.key}>
                        <td className="px-4 py-3">{row.code}</td>
                        <td className="px-4 py-3 font-medium text-slate-800">{row.name}</td>
                        <td className="px-4 py-3">{row.category}</td>
                        <td className="px-4 py-3">{row.stock}</td>
                        <td className="px-4 py-3">{row.threshold}</td>
                        <td className="px-4 py-3 capitalize">{row.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400 p-12 text-center">
                <div>
                  <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>
                    {activeReport === 'Stock Position' || activeReport === 'Reorder Report'
                      ? `No data found for ${activeReport}.`
                      : `Select date ranges and filters to generate the ${activeReport} data.`}
                  </p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
