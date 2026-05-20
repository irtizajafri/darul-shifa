import { useEffect, useMemo, useState } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Printer, Download, Filter, BarChart3, Menu, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useInventoryStore } from '../../store/useInventoryStore';
import { exportRowsToExcel, exportRowsToPdf } from '../../utils/exportInventoryReports';
import { printPODocument } from '../../utils/printPO';
import { printGRNDocument } from '../../utils/printGRN';

const REPORT_TYPES = [
  'Item List', 'Stock Position', 'Item Ledger', 'Reorder Report',
  'Receiving Report', 'Issuance Report', 'Discard Report', 'Repairing Report',
  'Short Expiry', 'Expiry', 'Daily Sales', 'Supplier Ledger', 'Purchase Order Report'
];

export default function InventoryReports() {
  const [activeReport, setActiveReport] = useState('Stock Position');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ledgerFilters, setLedgerFilters] = useState({
    dateFrom: '',
    dateTo: '',
    itemId: '',
    categoryId: '',
    subcategoryId: '',
    assetType: '',
  });
  const [receivingFilters, setReceivingFilters] = useState({
    dateFrom: '',
    dateTo: '',
    itemId: '',
    supplierId: '',
    categoryId: '',
    subcategoryId: '',
    assetType: '',
  });
  const [issuanceFilters, setIssuanceFilters] = useState({
    dateFrom: '',
    dateTo: '',
    itemId: '',
    departmentId: '',
    categoryId: '',
    subcategoryId: '',
    assetType: '',
  });
  const [discardFilters, setDiscardFilters] = useState({
    dateFrom: '',
    dateTo: '',
    itemId: '',
    categoryId: '',
    subcategoryId: '',
    assetType: '',
  });
  const [expiryFilters, setExpiryFilters] = useState({
    exactDate: '',
    itemId: '',
    categoryId: '',
    subcategoryId: '',
    assetType: '',
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
    assetType: '',
  });
  const [stockPositionFilters, setStockPositionFilters] = useState({
    asOfDate: '',
    categoryId: '',
    subcategoryId: '',
    assetType: '',
  });
  const [repairingFilters, setRepairingFilters] = useState({
    dateFrom: '',
    dateTo: '',
    itemId: '',
    supplierId: '',
    categoryId: '',
    subcategoryId: '',
    assetType: '',
  });
  const [poFilters, setPoFilters] = useState({
    status: '',
    supplierId: '',
    itemId: '',
    dateFrom: '',
    dateTo: '',
    assetType: '',
  });
  const [dailySalesFilters, setDailySalesFilters] = useState({
    dateFrom: '',
    dateTo: '',
    customerName: '',
    categoryId: '',
    subcategoryId: '',
    assetType: '',
  });
  const [reorderFilters, setReorderFilters] = useState({
    assetType: '',
  });
  const [supplierLedgerFilters, setSupplierLedgerFilters] = useState({
    dateFrom: '',
    dateTo: '',
    supplierName: '',
    categoryId: '',
    subcategoryId: '',
    assetType: '',
  });

  const {
    items,
    grns,
    gins,
    gdns,
    maintenanceRecords,
    reorderAlerts,
    masterOptions,
    itemLedgerReport,
    stockPositionReport,
    shortExpiryReportRows,
    expiryReportRows,
    dailySalesReport,
    supplierLedgerReport,
    fetchItems,
    fetchGRNs,
    fetchGINs,
    fetchGDNs,
    fetchMaintenanceRecords,
    fetchReorderAlerts,
    fetchMastersOptions,
    fetchItemLedgerReport,
    fetchStockPositionReport,
    fetchShortExpiryReport,
    fetchExpiryReport,
    fetchDailySalesReport,
    fetchSupplierLedgerReport,
    purchaseOrders,
    fetchPurchaseOrders,
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
    if (activeReport !== 'Stock Position') return;

    fetchStockPositionReport({}).catch((err) => {
      toast.error(err.message || 'Failed to load stock position report');
    });
  }, [activeReport, fetchStockPositionReport]);

  useEffect(() => {
    if (activeReport !== 'Short Expiry') return;

    fetchShortExpiryReport({}).catch((err) => {
      toast.error(err.message || 'Failed to load short expiry report');
    });
  }, [activeReport, fetchShortExpiryReport]);

  useEffect(() => {
    if (activeReport !== 'Repairing Report') return;

    fetchMaintenanceRecords({}).catch((err) => {
      toast.error(err.message || 'Failed to load repairing report');
    });
  }, [activeReport, fetchMaintenanceRecords]);

  useEffect(() => {
    if (activeReport !== 'Purchase Order Report') return;

    fetchPurchaseOrders({}).catch((err) => {
      toast.error(err.message || 'Failed to load purchase order report');
    });
  }, [activeReport, fetchPurchaseOrders]);

  useEffect(() => {
    if (activeReport !== 'Expiry') return;

    fetchExpiryReport({}).catch((err) => {
      toast.error(err.message || 'Failed to load expiry report');
    });
  }, [activeReport, fetchExpiryReport]);

  useEffect(() => {
    if (activeReport !== 'Daily Sales') return;
    fetchDailySalesReport({}).catch((err) => {
      toast.error(err.message || 'Failed to load daily sales report');
    });
  }, [activeReport, fetchDailySalesReport]);

  useEffect(() => {
    if (activeReport !== 'Supplier Ledger') return;
    fetchSupplierLedgerReport({}).catch((err) => {
      toast.error(err.message || 'Failed to load supplier ledger report');
    });
  }, [activeReport, fetchSupplierLedgerReport]);

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

  const expirySubcategoryOptions = useMemo(() => {
    const selectedCategoryId = Number(expiryFilters.categoryId || 0);
    if (!selectedCategoryId) return masterOptions?.subcategories || [];
    return (masterOptions?.subcategories || []).filter((sub) => Number(sub.categoryId) === selectedCategoryId);
  }, [masterOptions?.subcategories, expiryFilters.categoryId]);

  const expiryItemOptions = useMemo(() => {
    const selectedCategoryId = Number(expiryFilters.categoryId || 0);
    const selectedSubcategoryId = Number(expiryFilters.subcategoryId || 0);
    return (items || []).filter((item) => {
      if (selectedCategoryId && Number(item.categoryId) !== selectedCategoryId) return false;
      if (selectedSubcategoryId && Number(item.subcategoryId) !== selectedSubcategoryId) return false;
      return Boolean(item.hasExpiry);
    });
  }, [items, expiryFilters.categoryId, expiryFilters.subcategoryId]);

  const updateExpiryFilter = (key, value) => {
    setExpiryFilters((prev) => {
      if (key === 'categoryId') return { ...prev, categoryId: value, subcategoryId: '', itemId: '' };
      if (key === 'subcategoryId') return { ...prev, subcategoryId: value, itemId: '' };
      return { ...prev, [key]: value };
    });
  };

  const applyExpiryFilters = () => {
    fetchExpiryReport(expiryFilters).catch((err) => {
      toast.error(err.message || 'Failed to load expiry report');
    });
  };

  const resetExpiryFilters = () => {
    const empty = { exactDate: '', itemId: '', categoryId: '', subcategoryId: '', assetType: '' };
    setExpiryFilters(empty);
    fetchExpiryReport(empty).catch((err) => {
      toast.error(err.message || 'Failed to load expiry report');
    });
  };

  const repairingSubcategoryOptions = useMemo(() => {
    const selectedCategoryId = Number(repairingFilters.categoryId || 0);
    if (!selectedCategoryId) return masterOptions?.subcategories || [];
    return (masterOptions?.subcategories || []).filter((sub) => Number(sub.categoryId) === selectedCategoryId);
  }, [masterOptions?.subcategories, repairingFilters.categoryId]);

  const repairingItemOptions = useMemo(() => {
    const selectedCategoryId = Number(repairingFilters.categoryId || 0);
    const selectedSubcategoryId = Number(repairingFilters.subcategoryId || 0);
    return (items || []).filter((item) => {
      if (selectedCategoryId && Number(item.categoryId) !== selectedCategoryId) return false;
      if (selectedSubcategoryId && Number(item.subcategoryId) !== selectedSubcategoryId) return false;
      return true;
    });
  }, [items, repairingFilters.categoryId, repairingFilters.subcategoryId]);

  const stockPositionSubcategoryOptions = useMemo(() => {
    const selectedCategoryId = Number(stockPositionFilters.categoryId || 0);
    if (!selectedCategoryId) return masterOptions?.subcategories || [];
    return (masterOptions?.subcategories || []).filter((sub) => Number(sub.categoryId) === selectedCategoryId);
  }, [masterOptions?.subcategories, stockPositionFilters.categoryId]);

  const updateRepairingFilter = (key, value) => {
    setRepairingFilters((prev) => {
      if (key === 'categoryId') return { ...prev, categoryId: value, subcategoryId: '', itemId: '' };
      if (key === 'subcategoryId') return { ...prev, subcategoryId: value, itemId: '' };
      return { ...prev, [key]: value };
    });
  };

  const applyRepairingFilters = () => {
    fetchMaintenanceRecords(repairingFilters).catch((err) => {
      toast.error(err.message || 'Failed to load repairing report');
    });
  };

  const resetRepairingFilters = () => {
    const empty = { dateFrom: '', dateTo: '', itemId: '', supplierId: '', categoryId: '', subcategoryId: '', assetType: '' };
    setRepairingFilters(empty);
    fetchMaintenanceRecords(empty).catch((err) => {
      toast.error(err.message || 'Failed to load repairing report');
    });
  };

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
      assetType: '',
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
      assetType: '',
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
      assetType: '',
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
      assetType: '',
    };
    setShortExpiryFilters(emptyFilters);
    fetchShortExpiryReport(emptyFilters).catch((err) => {
      toast.error(err.message || 'Failed to load short expiry report');
    });
  };

  const updateStockPositionFilter = (key, value) => {
    setStockPositionFilters((prev) => {
      if (key === 'categoryId') {
        return {
          ...prev,
          categoryId: value,
          subcategoryId: '',
        };
      }

      return { ...prev, [key]: value };
    });
  };

  const applyStockPositionFilters = () => {
    fetchStockPositionReport(stockPositionFilters).catch((err) => {
      toast.error(err.message || 'Failed to load stock position report');
    });
  };

  const resetStockPositionFilters = () => {
    const emptyFilters = {
      asOfDate: '',
      categoryId: '',
      subcategoryId: '',
      assetType: '',
    };
    setStockPositionFilters(emptyFilters);
    fetchStockPositionReport(emptyFilters).catch((err) => {
      toast.error(err.message || 'Failed to load stock position report');
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

  const supplierLedgerSubcategoryOptions = useMemo(() => {
    const selectedCategoryId = Number(supplierLedgerFilters.categoryId || 0);
    if (!selectedCategoryId) return masterOptions?.subcategories || [];
    return (masterOptions?.subcategories || []).filter((sub) => Number(sub.categoryId) === selectedCategoryId);
  }, [masterOptions?.subcategories, supplierLedgerFilters.categoryId]);

  const updateSupplierLedgerFilter = (key, value) => {
    setSupplierLedgerFilters((prev) => {
      if (key === 'categoryId') return { ...prev, categoryId: value, subcategoryId: '' };
      return { ...prev, [key]: value };
    });
  };

  const applySupplierLedgerFilters = () => {
    fetchSupplierLedgerReport(supplierLedgerFilters).catch((err) => {
      toast.error(err.message || 'Failed to load supplier ledger report');
    });
  };

  const resetSupplierLedgerFilters = () => {
    const empty = { dateFrom: '', dateTo: '', supplierName: '', categoryId: '', subcategoryId: '', assetType: '' };
    setSupplierLedgerFilters(empty);
    fetchSupplierLedgerReport(empty).catch((err) => {
      toast.error(err.message || 'Failed to load supplier ledger report');
    });
  };

  const supplierLedgerExportRows = useMemo(() => {
    return (supplierLedgerReport?.rows || []).map((row) => ({
      Date: row.date ? new Date(row.date).toLocaleDateString() : '-',
      'GRN Code': row.grnCode,
      Supplier: row.supplierName,
      Item: row.itemName,
      'Item Code': row.itemCode,
      'Asset Type': row.itemType,
      Category: row.categoryName,
      Subcategory: row.subcategoryName,
      'Received Qty': row.receivedQuantity,
      'GRN Price': Number(row.grnPrice).toFixed(2),
      'Total Amount': Number(row.totalAmount).toFixed(2),
    }));
  }, [supplierLedgerReport?.rows]);

  const dailySalesSubcategoryOptions = useMemo(() => {
    const selectedCategoryId = Number(dailySalesFilters.categoryId || 0);
    if (!selectedCategoryId) return masterOptions?.subcategories || [];
    return (masterOptions?.subcategories || []).filter((sub) => Number(sub.categoryId) === selectedCategoryId);
  }, [masterOptions?.subcategories, dailySalesFilters.categoryId]);

  const updateDailySalesFilter = (key, value) => {
    setDailySalesFilters((prev) => {
      if (key === 'categoryId') return { ...prev, categoryId: value, subcategoryId: '' };
      return { ...prev, [key]: value };
    });
  };

  const applyDailySalesFilters = () => {
    fetchDailySalesReport(dailySalesFilters).catch((err) => {
      toast.error(err.message || 'Failed to load daily sales report');
    });
  };

  const resetDailySalesFilters = () => {
    const empty = { dateFrom: '', dateTo: '', customerName: '', categoryId: '', subcategoryId: '', assetType: '' };
    setDailySalesFilters(empty);
    fetchDailySalesReport(empty).catch((err) => {
      toast.error(err.message || 'Failed to load daily sales report');
    });
  };

  const dailySalesExportRows = useMemo(() => {
    const rows = [];
    (dailySalesReport?.invoices || []).forEach((inv) => {
      (inv.lines || []).forEach((line) => {
        rows.push({
          'Invoice No': inv.invoiceCode,
          Date: inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : '-',
          Customer: inv.customerName,
          Item: line.itemName,
          'Item Code': line.itemCode,
          Category: line.category,
          Subcategory: line.subcategory,
          Qty: line.qty,
          'Purchase Price': Number(line.purchasePrice).toFixed(2),
          'Retail Price': Number(line.retailPrice).toFixed(2),
          'Profit/Unit': Number(line.profitPerUnit).toFixed(2),
          'Total Purchase': Number(line.totalPurchase).toFixed(2),
          'Total Retail': Number(line.totalRetail).toFixed(2),
          'Total Profit': Number(line.totalProfit).toFixed(2),
        });
      });
    });
    return rows;
  }, [dailySalesReport]);

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
      assetType: '',
    };
    setLedgerFilters(emptyFilters);
    fetchItemLedgerReport(emptyFilters).catch((err) => {
      toast.error(err.message || 'Failed to load item ledger report');
    });
  };

  const reportRows = useMemo(() => {
    if (activeReport === 'Item List') {
      return (items || [])
        .filter((row) => !reorderFilters.assetType || row.itemType === reorderFilters.assetType)
        .map((row) => ({
          key: row.id,
          code: row.code,
          name: row.name,
          category: row.category?.name || '-',
          subcategory: row.subcategory?.name || '-',
          unit: row.baseUnit || '-',
          reorderLevel: row.reorderLevel || 0,
          status: row.status || 'active',
        }));
    }

    if (activeReport === 'Reorder Report') {
      return (reorderAlerts || [])
        .filter((row) => !reorderFilters.assetType || row.item?.itemType === reorderFilters.assetType)
        .map((row) => ({
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
      return (stockPositionReport?.rows || []).map((row) => ({
        key: row.key,
        code: row.code,
        name: row.name,
        category: row.category,
        stock: row.currentQuantity,
        amount: row.currentAmount,
        breakdown: row.breakdown,
        unit: row.unit,
        status: row.status,
      }));
    }

    return [];
  }, [activeReport, items, reorderAlerts, stockPositionReport, reorderFilters]);

  const ledgerExportRows = useMemo(() => {
    return (itemLedgerReport?.rows || []).map((row) => ({
      Date: row.date ? new Date(row.date).toLocaleString() : '-',
      'Item Code': row.itemCode,
      'Item Name': row.itemName,
      Category: row.category,
      Subcategory: row.subcategory,
      'Received Qty': row.receivedQuantity,
      'Received Rate': row.receivedRate,
      'Received Amount': row.receivedAmount,
      'Issuance Qty': row.issuanceQuantity,
      'Issuance Amount': row.issuanceAmount,
      'Issuance Breakdown': row.issuanceBreakdown,
      'Remaining Qty': row.remainingQuantity,
      'Remaining Amount': row.remainingAmount,
      'Remaining Breakdown': row.remainingBreakdown,
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

  const expiryRows = useMemo(() => {
    return (expiryReportRows || []).map((row) => ({
      key: row.key,
      expiryDate: row.expiryDate,
      item: row.itemName || '-',
      itemCode: row.itemCode || '-',
      category: row.category || '-',
      subcategory: row.subcategory || '-',
      quantity: Number(row.quantity || 0),
      referenceId: row.referenceId || '-',
    }));
  }, [expiryReportRows]);

  const expiryExportRows = useMemo(() => {
    return expiryRows.map((row) => ({
      'Expiry Date': row.expiryDate ? new Date(row.expiryDate).toLocaleDateString() : '-',
      Item: row.item,
      'Item Code': row.itemCode,
      Category: row.category,
      Subcategory: row.subcategory,
      Quantity: row.quantity,
      'GRN Reference': row.referenceId,
    }));
  }, [expiryRows]);

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

  const repairingRows = useMemo(() => {
    return (maintenanceRecords || []).map((row) => ({
      key: row.id,
      date: row.date,
      item: row.item?.name || row.itemName || '-',
      itemCode: row.item?.code || row.itemCode || '-',
      category: row.item?.category?.name || row.categoryName || '-',
      subcategory: row.item?.subcategory?.name || row.subcategoryName || '-',
      supplier: row.supplier?.name || row.supplierName || '-',
      cost: row.cost != null ? Number(row.cost) : null,
      natureOfRepair: row.natureOfRepair || '-',
    }));
  }, [maintenanceRecords]);

  const repairingExportRows = useMemo(() => {
    return repairingRows.map((row) => ({
      Date: row.date ? new Date(row.date).toLocaleDateString() : '-',
      Item: row.item,
      'Item Code': row.itemCode,
      Category: row.category,
      Subcategory: row.subcategory,
      Supplier: row.supplier,
      'Cost (PKR)': row.cost != null ? row.cost : '-',
      'Nature of Repair': row.natureOfRepair,
    }));
  }, [repairingRows]);

  const poRows = useMemo(() => {
    return (purchaseOrders || []).filter((row) => {
      if (poFilters.status && row.status !== poFilters.status) return false;
      if (poFilters.supplierId && String(row.supplierId) !== String(poFilters.supplierId)) return false;
      if (poFilters.itemId && String(row.itemId) !== String(poFilters.itemId)) return false;
      if (poFilters.dateFrom && new Date(row.poDate) < new Date(poFilters.dateFrom)) return false;
      if (poFilters.dateTo && new Date(row.poDate) > new Date(poFilters.dateTo)) return false;
      if (poFilters.assetType && row.item?.itemType !== poFilters.assetType) return false;
      return true;
    }).map((row) => ({
      key: row.id,
      code: row.code,
      supplier: row.supplier?.name || '-',
      item: row.item?.name || '-',
      requiredQuantity: Number(row.requiredQuantity || 0),
      orderedRate: row.orderedRate != null ? Number(row.orderedRate) : '-',
      expectedDate: row.expectedDate,
      status: row.status,
    }));
  }, [purchaseOrders, poFilters]);

  const poExportRows = useMemo(() => {
    return poRows.map((row) => ({
      'PO Number': row.code,
      Supplier: row.supplier,
      Item: row.item,
      'Required Qty': row.requiredQuantity,
      'Ordered Rate': row.orderedRate,
      'Expected Date': row.expectedDate ? new Date(row.expectedDate).toLocaleDateString() : '-',
      Status: row.status,
    }));
  }, [poRows]);

  const stockPositionExportRows = useMemo(() => {
    return (stockPositionReport?.rows || []).map((row) => ({
      Code: row.code,
      Name: row.name,
      Category: row.category,
      Quantity: row.currentQuantity,
      Amount: row.currentAmount,
      Breakdown: row.breakdown,
      Unit: row.unit,
      Status: row.status,
    }));
  }, [stockPositionReport?.rows]);

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

    if (activeReport === 'Expiry') {
      exportRowsToPdf({
        fileName: 'inventory-expiry-report',
        title: 'Inventory Expiry Report',
        rows: expiryExportRows,
      });
      return;
    }

    if (activeReport === 'Repairing Report') {
      exportRowsToPdf({
        fileName: 'inventory-repairing-report',
        title: 'Maintenance / Repairing Report',
        rows: repairingExportRows,
      });
      return;
    }

    if (activeReport === 'Purchase Order Report') {
      exportRowsToPdf({
        fileName: 'inventory-po-report',
        title: 'Purchase Order Report',
        rows: poExportRows,
      });
      return;
    }

    if (activeReport === 'Daily Sales') {
      exportRowsToPdf({
        fileName: 'daily-sales-report',
        title: 'Daily Sales Report',
        rows: dailySalesExportRows,
      });
      return;
    }

    if (activeReport === 'Supplier Ledger') {
      exportRowsToPdf({
        fileName: 'supplier-ledger-report',
        title: 'Supplier Ledger Report',
        rows: supplierLedgerExportRows,
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

    if (activeReport === 'Expiry') {
      exportRowsToExcel({
        fileName: 'inventory-expiry-report',
        sheetName: 'ExpiryReport',
        rows: expiryExportRows,
      });
      return;
    }

    if (activeReport === 'Repairing Report') {
      exportRowsToExcel({
        fileName: 'inventory-repairing-report',
        sheetName: 'RepairingReport',
        rows: repairingExportRows,
      });
      return;
    }

    if (activeReport === 'Purchase Order Report') {
      exportRowsToExcel({
        fileName: 'inventory-po-report',
        sheetName: 'POReport',
        rows: poExportRows,
      });
      return;
    }

    if (activeReport === 'Daily Sales') {
      exportRowsToExcel({
        fileName: 'daily-sales-report',
        sheetName: 'DailySales',
        rows: dailySalesExportRows,
      });
      return;
    }

    if (activeReport === 'Supplier Ledger') {
      exportRowsToExcel({
        fileName: 'supplier-ledger-report',
        sheetName: 'SupplierLedger',
        rows: supplierLedgerExportRows,
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
        </div>
      </div>

      <div className="flex gap-4 lg:gap-6 relative">
        {/* Mobile Menu Button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="md:hidden fixed top-24 left-4 z-40 p-2 bg-white rounded-lg border border-slate-200 hover:bg-slate-50"
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        {/* Sidebar menus for reports - Responsive */}
        <div className={`fixed md:relative top-0 left-0 h-screen md:h-auto w-64 md:w-64 lg:flex-shrink-0 bg-white md:bg-transparent z-30 md:z-auto transition-all ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}>
          <Card className="p-2 h-full md:h-auto rounded-none md:rounded-lg">
            <div className="space-y-1 pt-12 md:pt-0 max-h-screen md:max-h-none overflow-y-auto">
              {REPORT_TYPES.map(report => (
                <button
                  key={report}
                  onClick={() => {
                    setActiveReport(report);
                    setSidebarOpen(false);
                  }}
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

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/30 md:hidden z-20"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Report Content */}
        <div className="flex-1 w-full md:w-auto">
          <Card className="p-0 overflow-hidden h-full min-h-[500px] flex flex-col">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">{activeReport}</h2>
              <Button variant="outline" size="sm" label="Filters" icon={Filter} />
            </div>
            {activeReport === 'Stock Position' ? (
              <div className="p-4 space-y-4 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">As Of Date</label>
                    <input
                      type="date"
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={stockPositionFilters.asOfDate}
                      onChange={(e) => updateStockPositionFilter('asOfDate', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Category</label>
                    <select
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={stockPositionFilters.categoryId}
                      onChange={(e) => updateStockPositionFilter('categoryId', e.target.value)}
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
                      value={stockPositionFilters.subcategoryId}
                      onChange={(e) => updateStockPositionFilter('subcategoryId', e.target.value)}
                    >
                      <option value="">All Subcategories</option>
                      {stockPositionSubcategoryOptions.map((sub) => (
                        <option key={sub.id} value={sub.id}>{sub.name} ({sub.code})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Asset Type</label>
                    <select
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={stockPositionFilters.assetType}
                      onChange={(e) => updateStockPositionFilter('assetType', e.target.value)}
                    >
                      <option value="">All Types</option>
                      <option value="current asset">Current Asset</option>
                      <option value="fixed asset">Fixed Asset</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" label="Apply" onClick={applyStockPositionFilters} />
                  <Button size="sm" variant="outline" label="Reset" onClick={resetStockPositionFilters} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Card className="p-3">
                    <p className="text-xs text-slate-500">Items in Stock</p>
                    <p className="text-lg font-semibold text-slate-800">{stockPositionReport?.total?.itemCount || 0}</p>
                  </Card>
                  <Card className="p-3">
                    <p className="text-xs text-slate-500">Total Quantity</p>
                    <p className="text-lg font-semibold text-blue-700">{Number(stockPositionReport?.total?.totalQuantity || 0).toFixed(2)}</p>
                  </Card>
                  <Card className="p-3">
                    <p className="text-xs text-slate-500">Total Amount</p>
                    <p className="text-lg font-semibold text-emerald-700">Rs. {Number(stockPositionReport?.total?.totalAmount || 0).toFixed(2)}</p>
                  </Card>
                </div>

                {(stockPositionReport?.rows || []).length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                          <th className="px-4 py-3">Code</th>
                          <th className="px-4 py-3">Name</th>
                          <th className="px-4 py-3">Category</th>
                          <th className="px-4 py-3">Quantity</th>
                          <th className="px-4 py-3">Unit</th>
                          <th className="px-4 py-3">Amount (Rs.)</th>
                          <th className="px-4 py-3">FIFO Breakdown</th>
                          <th className="px-4 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(stockPositionReport?.rows || []).map((row) => (
                          <tr key={row.key}>
                            <td className="px-4 py-3">{row.code}</td>
                            <td className="px-4 py-3 font-medium text-slate-800">{row.name}</td>
                            <td className="px-4 py-3">{row.category}</td>
                            <td className="px-4 py-3 text-blue-700">{Number(row.currentQuantity || 0).toFixed(2)}</td>
                            <td className="px-4 py-3">{row.unit}</td>
                            <td className="px-4 py-3 text-emerald-700 font-semibold">{Number(row.currentAmount || 0).toFixed(2)}</td>
                            <td className="px-4 py-3 text-xs text-slate-600">{row.breakdown || '-'}</td>
                            <td className="px-4 py-3 capitalize">{row.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center text-slate-400 py-10">No stock found for selected filters.</div>
                )}
              </div>
            ) : activeReport === 'Item Ledger' ? (
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
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Asset Type</label>
                    <select
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={ledgerFilters.assetType}
                      onChange={(e) => updateLedgerFilter('assetType', e.target.value)}
                    >
                      <option value="">All Types</option>
                      <option value="current asset">Current Asset</option>
                      <option value="fixed asset">Fixed Asset</option>
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
                                <th className="px-4 py-3 min-w-[100px]">Date</th>
                                <th className="px-4 py-3 min-w-[80px]">Item Code</th>
                                <th className="px-4 py-3 min-w-[120px]">Item Name</th>
                                <th className="px-4 py-3 min-w-[100px]">Category</th>
                                <th className="px-4 py-3 min-w-[100px]">Subcategory</th>
                                <th className="px-4 py-3 min-w-[110px]">Received Qty</th>
                                <th className="px-4 py-3 min-w-[80px]">Rate</th>
                                <th className="px-4 py-3 min-w-[120px]">Received Amount</th>
                                <th className="px-4 py-3 min-w-[110px]">Issuance Qty</th>
                                <th className="px-4 py-3 min-w-[120px]">Issuance Amount</th>
                                <th className="px-4 py-3 min-w-[150px]">Issuance Breakdown</th>
                                <th className="px-4 py-3 min-w-[110px] font-bold">Remaining Qty</th>
                                <th className="px-4 py-3 min-w-[120px]">Remaining Amount</th>
                                <th className="px-4 py-3 min-w-[150px]">Remaining Breakdown</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {(group.rows || []).map((row) => (
                                <tr key={row.key} className="hover:bg-slate-50">
                                  <td className="px-4 py-3 text-xs">{row.date ? new Date(row.date).toLocaleDateString() : '-'}</td>
                                  <td className="px-4 py-3 text-xs">{row.itemCode}</td>
                                  <td className="px-4 py-3 font-medium text-slate-800 text-xs">{row.itemName}</td>
                                  <td className="px-4 py-3 text-xs">{row.category}</td>
                                  <td className="px-4 py-3 text-xs">{row.subcategory}</td>
                                  <td className="px-4 py-3 text-emerald-700 text-xs">{Number(row.receivedQuantity || 0).toFixed(2)}</td>
                                  <td className="px-4 py-3 text-xs">{Number(row.receivedRate || 0).toFixed(2)}</td>
                                  <td className="px-4 py-3 text-emerald-700 text-xs">{Number(row.receivedAmount || 0).toFixed(2)}</td>
                                  <td className="px-4 py-3 text-rose-700 font-semibold text-xs">{Number(row.issuanceQuantity || 0).toFixed(2)}</td>
                                  <td className="px-4 py-3 text-rose-700 text-xs">{Number(row.issuanceAmount || 0).toFixed(2)}</td>
                                  <td className="px-4 py-3 text-xs text-rose-700">{row.issuanceBreakdown || '-'}</td>
                                  <td className="px-4 py-3 text-blue-700 font-bold text-xs">{Number(row.remainingQuantity || 0).toFixed(2)}</td>
                                  <td className="px-4 py-3 text-blue-700 font-semibold text-xs">{Number(row.remainingAmount || 0).toFixed(2)}</td>
                                  <td className="px-4 py-3 text-xs text-blue-700">{row.remainingBreakdown || '-'}</td>
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
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Asset Type</label>
                    <select
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={receivingFilters.assetType}
                      onChange={(e) => updateReceivingFilter('assetType', e.target.value)}
                    >
                      <option value="">All Types</option>
                      <option value="current asset">Current Asset</option>
                      <option value="fixed asset">Fixed Asset</option>
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
                          <th className="px-4 py-3">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {receivingRows.map((row) => {
                          const rawGRN = (grns || []).find((g) => g.id === row.key);
                          return (
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
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => rawGRN && printGRNDocument({
                                    grnCode: rawGRN.code,
                                    date: rawGRN.receivedDate,
                                    supplierName: rawGRN.supplier?.name || '',
                                    items: [{
                                      itemName: rawGRN.item?.name || '-',
                                      orderedQty: rawGRN.orderedQuantity,
                                      receivedQty: rawGRN.receivedQuantity,
                                      rateEst: rawGRN.orderedRate,
                                      rateReceived: rawGRN.receivedRate,
                                      amountReceived: rawGRN.totalAmount,
                                    }],
                                  })}
                                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                                  title="Print GRN"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                  Print
                                </button>
                              </td>
                            </tr>
                          );
                        })}
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
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Asset Type</label>
                    <select
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={issuanceFilters.assetType}
                      onChange={(e) => updateIssuanceFilter('assetType', e.target.value)}
                    >
                      <option value="">All Types</option>
                      <option value="current asset">Current Asset</option>
                      <option value="fixed asset">Fixed Asset</option>
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
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Asset Type</label>
                    <select
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={shortExpiryFilters.assetType}
                      onChange={(e) => updateShortExpiryFilter('assetType', e.target.value)}
                    >
                      <option value="">All Types</option>
                      <option value="current asset">Current Asset</option>
                      <option value="fixed asset">Fixed Asset</option>
                    </select>
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
            ) : activeReport === 'Expiry' ? (
              <div className="p-4 space-y-4 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Exact Expiry Date</label>
                    <input
                      type="date"
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={expiryFilters.exactDate}
                      onChange={(e) => updateExpiryFilter('exactDate', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Category</label>
                    <select
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={expiryFilters.categoryId}
                      onChange={(e) => updateExpiryFilter('categoryId', e.target.value)}
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
                      value={expiryFilters.subcategoryId}
                      onChange={(e) => updateExpiryFilter('subcategoryId', e.target.value)}
                    >
                      <option value="">All Subcategories</option>
                      {expirySubcategoryOptions.map((sub) => (
                        <option key={sub.id} value={sub.id}>{sub.name} ({sub.code})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Item</label>
                    <select
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={expiryFilters.itemId}
                      onChange={(e) => updateExpiryFilter('itemId', e.target.value)}
                    >
                      <option value="">All Expiry Items</option>
                      {expiryItemOptions.map((item) => (
                        <option key={item.id} value={item.id}>{item.name} ({item.code})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Asset Type</label>
                    <select
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={expiryFilters.assetType}
                      onChange={(e) => updateExpiryFilter('assetType', e.target.value)}
                    >
                      <option value="">All Types</option>
                      <option value="current asset">Current Asset</option>
                      <option value="fixed asset">Fixed Asset</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" label="Apply" onClick={applyExpiryFilters} />
                  <Button size="sm" variant="outline" label="Reset" onClick={resetExpiryFilters} />
                </div>

                {expiryRows.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                          <th className="px-4 py-3">Expiry Date</th>
                          <th className="px-4 py-3">Item</th>
                          <th className="px-4 py-3">Item Code</th>
                          <th className="px-4 py-3">Category</th>
                          <th className="px-4 py-3">Subcategory</th>
                          <th className="px-4 py-3">Quantity</th>
                          <th className="px-4 py-3">GRN Reference</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {expiryRows.map((row) => (
                          <tr key={row.key} className="bg-red-50">
                            <td className="px-4 py-3 text-red-700 font-semibold">
                              {row.expiryDate ? new Date(row.expiryDate).toLocaleDateString() : '-'}
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-800">{row.item}</td>
                            <td className="px-4 py-3">{row.itemCode}</td>
                            <td className="px-4 py-3">{row.category}</td>
                            <td className="px-4 py-3">{row.subcategory}</td>
                            <td className="px-4 py-3 font-semibold text-slate-800">{Number(row.quantity || 0).toFixed(2)}</td>
                            <td className="px-4 py-3">{row.referenceId}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center text-slate-400 py-10">No expired items found for selected filters.</div>
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
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Asset Type</label>
                    <select
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={discardFilters.assetType}
                      onChange={(e) => updateDiscardFilter('assetType', e.target.value)}
                    >
                      <option value="">All Types</option>
                      <option value="current asset">Current Asset</option>
                      <option value="fixed asset">Fixed Asset</option>
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
            ) : activeReport === 'Repairing Report' ? (
              <div className="p-4 space-y-4 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Date From</label>
                    <input
                      type="date"
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={repairingFilters.dateFrom}
                      onChange={(e) => updateRepairingFilter('dateFrom', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Date To</label>
                    <input
                      type="date"
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={repairingFilters.dateTo}
                      onChange={(e) => updateRepairingFilter('dateTo', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Supplier</label>
                    <select
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={repairingFilters.supplierId}
                      onChange={(e) => updateRepairingFilter('supplierId', e.target.value)}
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
                      value={repairingFilters.categoryId}
                      onChange={(e) => updateRepairingFilter('categoryId', e.target.value)}
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
                      value={repairingFilters.subcategoryId}
                      onChange={(e) => updateRepairingFilter('subcategoryId', e.target.value)}
                    >
                      <option value="">All Subcategories</option>
                      {repairingSubcategoryOptions.map((sub) => (
                        <option key={sub.id} value={sub.id}>{sub.name} ({sub.code})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Item</label>
                    <select
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={repairingFilters.itemId}
                      onChange={(e) => updateRepairingFilter('itemId', e.target.value)}
                    >
                      <option value="">All Items</option>
                      {repairingItemOptions.map((item) => (
                        <option key={item.id} value={item.id}>{item.name} ({item.code})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Asset Type</label>
                    <select
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={repairingFilters.assetType}
                      onChange={(e) => updateRepairingFilter('assetType', e.target.value)}
                    >
                      <option value="">All Types</option>
                      <option value="current asset">Current Asset</option>
                      <option value="fixed asset">Fixed Asset</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" label="Apply" onClick={applyRepairingFilters} />
                  <Button size="sm" variant="outline" label="Reset" onClick={resetRepairingFilters} />
                </div>

                {repairingRows.length > 0 ? (
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
                          <th className="px-4 py-3">Cost (PKR)</th>
                          <th className="px-4 py-3">Nature of Repair</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {repairingRows.map((row) => (
                          <tr key={row.key}>
                            <td className="px-4 py-3">{row.date ? new Date(row.date).toLocaleDateString() : '-'}</td>
                            <td className="px-4 py-3 font-medium text-slate-800">{row.item}</td>
                            <td className="px-4 py-3">{row.itemCode}</td>
                            <td className="px-4 py-3">{row.category}</td>
                            <td className="px-4 py-3">{row.subcategory}</td>
                            <td className="px-4 py-3">{row.supplier}</td>
                            <td className="px-4 py-3 font-semibold text-slate-800">
                              {row.cost != null ? Number(row.cost).toLocaleString() : '-'}
                            </td>
                            <td className="px-4 py-3 max-w-[220px] truncate">{row.natureOfRepair}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center text-slate-400 py-10">No repairing entries found for selected filters.</div>
                )}
              </div>
            ) : activeReport === 'Daily Sales' ? (
              <div className="p-4 space-y-4 overflow-y-auto">
                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Date From</label>
                    <input type="date" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={dailySalesFilters.dateFrom}
                      onChange={(e) => updateDailySalesFilter('dateFrom', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Date To</label>
                    <input type="date" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={dailySalesFilters.dateTo}
                      onChange={(e) => updateDailySalesFilter('dateTo', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Patient Name</label>
                    <input type="text" placeholder="Search patient..." className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={dailySalesFilters.customerName}
                      onChange={(e) => updateDailySalesFilter('customerName', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Category</label>
                    <select className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={dailySalesFilters.categoryId}
                      onChange={(e) => updateDailySalesFilter('categoryId', e.target.value)}>
                      <option value="">All Categories</option>
                      {categoryOptions.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name} ({cat.code})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Subcategory</label>
                    <select className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={dailySalesFilters.subcategoryId}
                      onChange={(e) => updateDailySalesFilter('subcategoryId', e.target.value)}>
                      <option value="">All Subcategories</option>
                      {dailySalesSubcategoryOptions.map((sub) => (
                        <option key={sub.id} value={sub.id}>{sub.name} ({sub.code})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Asset Type</label>
                    <select className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={dailySalesFilters.assetType}
                      onChange={(e) => updateDailySalesFilter('assetType', e.target.value)}>
                      <option value="">All Types</option>
                      <option value="current asset">Current Asset</option>
                      <option value="fixed asset">Fixed Asset</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" label="Apply" onClick={applyDailySalesFilters} />
                  <Button size="sm" variant="outline" label="Reset" onClick={resetDailySalesFilters} />
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <Card className="p-3">
                    <p className="text-xs text-slate-500">Invoices</p>
                    <p className="text-lg font-semibold text-slate-800">{dailySalesReport?.summary?.invoiceCount || 0}</p>
                  </Card>
                  <Card className="p-3">
                    <p className="text-xs text-slate-500">Total Qty</p>
                    <p className="text-lg font-semibold text-slate-800">{Number(dailySalesReport?.summary?.grandTotalQty || 0).toFixed(2)}</p>
                  </Card>
                  <Card className="p-3">
                    <p className="text-xs text-slate-500">Total Purchase</p>
                    <p className="text-lg font-semibold text-rose-700">{Number(dailySalesReport?.summary?.grandTotalPurchase || 0).toFixed(2)}</p>
                  </Card>
                  <Card className="p-3">
                    <p className="text-xs text-slate-500">Total Retail</p>
                    <p className="text-lg font-semibold text-emerald-700">{Number(dailySalesReport?.summary?.grandTotalRetail || 0).toFixed(2)}</p>
                  </Card>
                  <Card className="p-3">
                    <p className="text-xs text-slate-500">Total Profit</p>
                    <p className="text-lg font-semibold text-blue-700">{Number(dailySalesReport?.summary?.grandTotalProfit || 0).toFixed(2)}</p>
                  </Card>
                </div>

                {/* Invoice Cards */}
                {(dailySalesReport?.invoices || []).length > 0 ? (
                  <div className="space-y-4">
                    {(dailySalesReport.invoices || []).map((inv) => (
                      <Card key={inv.invoiceId} className="p-0 overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                          <div>
                            <p className="font-semibold text-slate-800">{inv.invoiceCode}</p>
                            <p className="text-xs text-slate-500">
                              {inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : '-'} • {inv.customerName}
                            </p>
                          </div>
                          <div className="text-right text-xs text-slate-500">
                            <p>Retail: <span className="font-semibold text-emerald-700">{Number(inv.subtotalRetail || 0).toFixed(2)}</span></p>
                            <p>Profit: <span className="font-semibold text-blue-700">{Number(inv.subtotalProfit || 0).toFixed(2)}</span></p>
                          </div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-sm">
                            <thead>
                              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                                <th className="px-4 py-2">Item</th>
                                <th className="px-4 py-2">Category</th>
                                <th className="px-4 py-2">Subcategory</th>
                                <th className="px-4 py-2">Qty</th>
                                <th className="px-4 py-2">Purchase Price</th>
                                <th className="px-4 py-2">Retail Price</th>
                                <th className="px-4 py-2">Profit/Unit</th>
                                <th className="px-4 py-2">Total Retail</th>
                                <th className="px-4 py-2">Total Profit</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {(inv.lines || []).map((line, idx) => (
                                <tr key={idx} className="hover:bg-slate-50">
                                  <td className="px-4 py-2 font-medium text-slate-800">{line.itemName} <span className="text-xs text-slate-400">({line.itemCode})</span></td>
                                  <td className="px-4 py-2 text-xs">{line.category}</td>
                                  <td className="px-4 py-2 text-xs">{line.subcategory}</td>
                                  <td className="px-4 py-2">{line.qty}</td>
                                  <td className="px-4 py-2 text-rose-700">{Number(line.purchasePrice).toFixed(2)}</td>
                                  <td className="px-4 py-2 text-emerald-700">{Number(line.retailPrice).toFixed(2)}</td>
                                  <td className="px-4 py-2 text-blue-700">{Number(line.profitPerUnit).toFixed(2)}</td>
                                  <td className="px-4 py-2 font-semibold text-emerald-700">{Number(line.totalRetail).toFixed(2)}</td>
                                  <td className="px-4 py-2 font-semibold text-blue-700">{Number(line.totalProfit).toFixed(2)}</td>
                                </tr>
                              ))}
                              <tr className="bg-slate-50 text-xs font-semibold border-t border-slate-200">
                                <td colSpan={3} className="px-4 py-2 text-right text-slate-500">Invoice Total</td>
                                <td className="px-4 py-2">{Number(inv.subtotalQty || 0).toFixed(2)}</td>
                                <td className="px-4 py-2 text-rose-700">{Number(inv.subtotalPurchase || 0).toFixed(2)}</td>
                                <td colSpan={2} />
                                <td className="px-4 py-2 text-emerald-700">{Number(inv.subtotalRetail || 0).toFixed(2)}</td>
                                <td className="px-4 py-2 text-blue-700">{Number(inv.subtotalProfit || 0).toFixed(2)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-slate-400 py-10">No sales found for selected filters.</div>
                )}
              </div>
            ) : activeReport === 'Supplier Ledger' ? (
              <div className="p-4 space-y-4 overflow-y-auto">
                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Date From</label>
                    <input
                      type="date"
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={supplierLedgerFilters.dateFrom}
                      onChange={(e) => updateSupplierLedgerFilter('dateFrom', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Date To</label>
                    <input
                      type="date"
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={supplierLedgerFilters.dateTo}
                      onChange={(e) => updateSupplierLedgerFilter('dateTo', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Supplier Name</label>
                    <input
                      type="text"
                      placeholder="Search supplier..."
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={supplierLedgerFilters.supplierName}
                      onChange={(e) => updateSupplierLedgerFilter('supplierName', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Category</label>
                    <select
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={supplierLedgerFilters.categoryId}
                      onChange={(e) => updateSupplierLedgerFilter('categoryId', e.target.value)}
                    >
                      <option value="">All Categories</option>
                      {categoryOptions.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Subcategory</label>
                    <select
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={supplierLedgerFilters.subcategoryId}
                      onChange={(e) => updateSupplierLedgerFilter('subcategoryId', e.target.value)}
                    >
                      <option value="">All Subcategories</option>
                      {supplierLedgerSubcategoryOptions.map((sub) => (
                        <option key={sub.id} value={sub.id}>{sub.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Asset Type</label>
                    <select
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={supplierLedgerFilters.assetType}
                      onChange={(e) => updateSupplierLedgerFilter('assetType', e.target.value)}
                    >
                      <option value="">All Types</option>
                      <option value="current asset">Current Asset</option>
                      <option value="fixed asset">Fixed Asset</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" label="Apply" onClick={applySupplierLedgerFilters} />
                  <Button size="sm" variant="outline" label="Reset" onClick={resetSupplierLedgerFilters} />
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Card className="p-3">
                    <p className="text-xs text-slate-500">Total Records</p>
                    <p className="text-lg font-semibold text-slate-800">{supplierLedgerReport?.summary?.totalRecords || 0}</p>
                  </Card>
                  <Card className="p-3">
                    <p className="text-xs text-slate-500">Total GRN Value</p>
                    <p className="text-lg font-semibold text-blue-700">Rs. {Number(supplierLedgerReport?.summary?.totalGrnValue || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}</p>
                  </Card>
                </div>

                {/* Table */}
                {(supplierLedgerReport?.rows || []).length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Supplier</th>
                          <th className="px-4 py-3">Item</th>
                          <th className="px-4 py-3">Category</th>
                          <th className="px-4 py-3">Subcategory</th>
                          <th className="px-4 py-3">Asset Type</th>
                          <th className="px-4 py-3 text-right">Qty</th>
                          <th className="px-4 py-3 text-right">GRN Price</th>
                          <th className="px-4 py-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(supplierLedgerReport?.rows || []).map((row) => (
                          <tr key={row.grnId} className="hover:bg-slate-50">
                            <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                              {row.date ? new Date(row.date).toLocaleDateString() : '-'}
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-800">{row.supplierName}</td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-slate-800">{row.itemName}</div>
                              <div className="text-xs text-slate-400">{row.itemCode}</div>
                            </td>
                            <td className="px-4 py-3 text-slate-600">{row.categoryName}</td>
                            <td className="px-4 py-3 text-slate-600">{row.subcategoryName}</td>
                            <td className="px-4 py-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                row.itemType === 'fixed asset'
                                  ? 'bg-purple-50 text-purple-700'
                                  : 'bg-blue-50 text-blue-700'
                              }`}>
                                {row.itemType}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-slate-700">{row.receivedQuantity}</td>
                            <td className="px-4 py-3 text-right text-slate-700">Rs. {Number(row.grnPrice).toLocaleString()}</td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-800">Rs. {Number(row.totalAmount).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-50 border-t-2 border-slate-200 font-semibold text-sm">
                          <td colSpan={8} className="px-4 py-3 text-right text-slate-600">Grand Total</td>
                          <td className="px-4 py-3 text-right text-blue-700">
                            Rs. {Number(supplierLedgerReport?.summary?.totalGrnValue || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="text-center text-slate-400 py-10">No GRN records found for selected filters.</div>
                )}
              </div>
            ) : activeReport === 'Purchase Order Report' ? (
              <div className="p-4 space-y-4 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Date From</label>
                    <input
                      type="date"
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={poFilters.dateFrom}
                      onChange={(e) => setPoFilters((p) => ({ ...p, dateFrom: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Date To</label>
                    <input
                      type="date"
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={poFilters.dateTo}
                      onChange={(e) => setPoFilters((p) => ({ ...p, dateTo: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Supplier</label>
                    <select
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={poFilters.supplierId}
                      onChange={(e) => setPoFilters((p) => ({ ...p, supplierId: e.target.value }))}
                    >
                      <option value="">All Suppliers</option>
                      {(masterOptions?.suppliers || []).map((sup) => (
                        <option key={sup.id} value={sup.id}>{sup.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Item</label>
                    <select
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={poFilters.itemId}
                      onChange={(e) => setPoFilters((p) => ({ ...p, itemId: e.target.value }))}
                    >
                      <option value="">All Items</option>
                      {(items || []).map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Status</label>
                    <select
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={poFilters.status}
                      onChange={(e) => setPoFilters((p) => ({ ...p, status: e.target.value }))}
                    >
                      <option value="">All Status</option>
                      <option value="open">Open</option>
                      <option value="received">Received</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Asset Type</label>
                    <select
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={poFilters.assetType}
                      onChange={(e) => setPoFilters((p) => ({ ...p, assetType: e.target.value }))}
                    >
                      <option value="">All Types</option>
                      <option value="current asset">Current Asset</option>
                      <option value="fixed asset">Fixed Asset</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" variant="outline" label="Reset" onClick={() => setPoFilters({ status: '', supplierId: '', itemId: '', dateFrom: '', dateTo: '', assetType: '' })} />
                </div>

                {poRows.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                          <th className="px-4 py-3">PO Number</th>
                          <th className="px-4 py-3">Supplier</th>
                          <th className="px-4 py-3">Item</th>
                          <th className="px-4 py-3">Req Qty</th>
                          <th className="px-4 py-3">Ordered Rate</th>
                          <th className="px-4 py-3">Expected Date</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {poRows.map((row) => {
                          const rawPO = (purchaseOrders || []).find((p) => p.id === row.key);
                          return (
                            <tr key={row.key}>
                              <td className="px-4 py-3 font-medium text-slate-800">{row.code}</td>
                              <td className="px-4 py-3">{row.supplier}</td>
                              <td className="px-4 py-3">{row.item}</td>
                              <td className="px-4 py-3">{row.requiredQuantity}</td>
                              <td className="px-4 py-3">{row.orderedRate !== '-' ? Number(row.orderedRate).toLocaleString() : '-'}</td>
                              <td className="px-4 py-3">{row.expectedDate ? new Date(row.expectedDate).toLocaleDateString() : '-'}</td>
                              <td className="px-4 py-3 capitalize">{row.status}</td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => rawPO && printPODocument(rawPO)}
                                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                                  title="Print PO"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                  Print
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center text-slate-400 py-10">No purchase orders found for selected filters.</div>
                )}
              </div>
            ) : (
              <div className="p-4 space-y-4 overflow-y-auto">
                <div className="flex items-center gap-3">
                  <div className="w-48">
                    <label className="text-xs text-slate-500 block mb-1">Asset Type</label>
                    <select
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={reorderFilters.assetType}
                      onChange={(e) => setReorderFilters((p) => ({ ...p, assetType: e.target.value }))}
                    >
                      <option value="">All Types</option>
                      <option value="current asset">Current Asset</option>
                      <option value="fixed asset">Fixed Asset</option>
                    </select>
                  </div>
                  {reorderFilters.assetType && (
                    <button
                      className="mt-5 text-xs text-slate-500 hover:text-slate-700 underline"
                      onClick={() => setReorderFilters({ assetType: '' })}
                    >
                      Reset
                    </button>
                  )}
                </div>
                {reportRows.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                          {activeReport === 'Item List' ? (
                            <>
                              <th className="px-4 py-3">Code</th>
                              <th className="px-4 py-3">Name</th>
                              <th className="px-4 py-3">Category</th>
                              <th className="px-4 py-3">Subcategory</th>
                              <th className="px-4 py-3">Unit</th>
                              <th className="px-4 py-3">Reorder Level</th>
                              <th className="px-4 py-3">Status</th>
                            </>
                          ) : (
                            <>
                              <th className="px-4 py-3">Code</th>
                              <th className="px-4 py-3">Name</th>
                              <th className="px-4 py-3">Category</th>
                              <th className="px-4 py-3">Current Stock</th>
                              <th className="px-4 py-3">Reorder Level</th>
                              <th className="px-4 py-3">Status</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {reportRows.map((row) => (
                          <tr key={row.key}>
                            <td className="px-4 py-3">{row.code}</td>
                            <td className="px-4 py-3 font-medium text-slate-800">{row.name}</td>
                            <td className="px-4 py-3">{row.category}</td>
                            {activeReport === 'Item List' ? (
                              <>
                                <td className="px-4 py-3">{row.subcategory}</td>
                                <td className="px-4 py-3">{row.unit}</td>
                                <td className="px-4 py-3">{row.reorderLevel}</td>
                                <td className="px-4 py-3 capitalize">{row.status}</td>
                              </>
                            ) : (
                              <>
                                <td className="px-4 py-3">{row.stock}</td>
                                <td className="px-4 py-3">{row.threshold}</td>
                                <td className="px-4 py-3 capitalize">{row.status}</td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-slate-400 p-12 text-center">
                    <div>
                      <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No data found for {activeReport}.</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
