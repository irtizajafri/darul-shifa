import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import useModalKeys from '../../hooks/useModalKeys';
import Card from '../../components/ui/Card';
import { useAuthStore } from '../../store/useAuthStore';
import { hasPermission } from '../../utils/permissions';
import NoTabAccess from '../../components/auth/NoTabAccess';
import Button from '../../components/ui/Button';
import { Printer, Download, BarChart3, Menu, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useInventoryStore } from '../../store/useInventoryStore';
import { useEmployeeStore } from '../../store/useEmployeeStore';
import { exportRowsToExcel, exportRowsToPdf, printRowsToPdf, printRowsHtml, exportItemLedgerPdf } from '../../utils/exportInventoryReports';
import { printPODocument } from '../../utils/printPO';
import { printGRNDocument } from '../../utils/printGRN';
import SearchableSelect from '../../components/ui/SearchableSelect';
import AdmissionPickerModal from '../../components/inventory/AdmissionPickerModal';
import { formatDate } from '../../utils/helpers';

const REPORT_TYPES = [
  'Item List', 'Stock Position', 'Item Ledger', 'Reorder Report',
  'Receiving Report', 'Issuance Report', 'GD Report', 'Discard Report', 'Repairing Report',
  'Short Expiry', 'Expiry', 'Daily Sales', 'Supplier Ledger', 'Purchase Order Report'
];

export default function InventoryReports() {
  const { user } = useAuthStore();
  const [activeReport, setActiveReport] = useState('Stock Position');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [ledgerFilters, setLedgerFilters] = useState({
    dateFrom: '',
    dateTo: '',
    itemId: '',
    categoryId: '',
    subcategoryId: '',
    assetType: '',
    departmentId: '',
    location: '',
  });
  const [ledgerSummary, setLedgerSummary] = useState(false);
  const [receivingSummary, setReceivingSummary] = useState(false);
  // Issuance Report view: 'details' | 'item' (item-wise summary) |
  // 'patient' (patient-wise summary, Cash and Panel with their own totals).
  const [issuanceView, setIssuanceView] = useState('details');
  const issuanceSummary = issuanceView === 'item';
  const [pendingPrint, setPendingPrint] = useState(false);
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
    issuedById: '',
    location: '',
    // Admitted patient's medicine — GINs issued against this Admission #.
    admissionNumber: '',
    // '' all issuance | 'admission' any admitted patient | 'cash' | 'panel'
    patientType: '',
  });
  const [showIssuanceAdmPicker, setShowIssuanceAdmPicker] = useState(false);
  const [gdFilters, setGdFilters] = useState({
    dateFrom: '',
    dateTo: '',
    departmentId: '',
    categoryId: '',
    subcategoryId: '',
    itemId: '',
    status: '',
    location: '',
  });
  const [discardFilters, setDiscardFilters] = useState({
    dateFrom: '',
    dateTo: '',
    itemId: '',
    categoryId: '',
    subcategoryId: '',
    assetType: '',
    location: '',
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
    itemId: '',
    assetType: '',
    brand: '',
    location: '',
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
    admissionOnly: false,
  });
  const [itemListFilters, setItemListFilters] = useState({
    assetType: '',
    dateFrom: '',
    dateTo: '',
    itemCode: '',
    categoryId: '',
    subcategoryId: '',
    location: '',
  });
  const [reorderFilters, setReorderFilters] = useState({
    assetType: '',
    dateFrom: '',
    dateTo: '',
    itemCode: '',
    categoryId: '',
    subcategoryId: '',
    location: '',
  });
  const [supplierLedgerFilters, setSupplierLedgerFilters] = useState({
    dateFrom: '',
    dateTo: '',
    supplierName: '',
    categoryId: '',
    subcategoryId: '',
    assetType: '',
  });
  const [supplierDropdownOpen, setSupplierDropdownOpen] = useState(false);
  const [supplierDropdownRect, setSupplierDropdownRect] = useState(null);
  const supplierSearchRef = useRef(null);

  const {
    items,
    grns,
    gins,
    gds,
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
    fetchGDs,
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
    fetchItemLocationMap,
  } = useInventoryStore();

  const { employees, fetchEmployees } = useEmployeeStore();

  // itemId → "Loc A, Loc B" — GD/GIN-stamped Location(s) on that item's
  // asset units, used by every item-level report's Location filter/column
  // (Item List, Reorder, Discard). Fetched once; Stock Position/Repairing
  // compute their own copy server-side since they need it live per request.
  const [itemLocationMap, setItemLocationMap] = useState({});

  useEffect(() => {
    Promise.all([fetchItems(), fetchReorderAlerts(), fetchMastersOptions(), fetchEmployees()]).catch((err) => {
      toast.error(err.message || 'Failed to load inventory reports data');
    });
    fetchItemLocationMap().then(setItemLocationMap).catch(() => setItemLocationMap({}));
  }, [fetchItems, fetchReorderAlerts, fetchMastersOptions, fetchEmployees, fetchItemLocationMap]);

  // Portal-rendered supplier dropdown (createPortal to document.body) only
  // closed on the input's own onBlur — if the window itself loses focus, or
  // the page scrolls, while a re-render (e.g. an API response) swaps it out
  // from under a stray mousedown, the portal can get stuck open and eat clicks.
  useEffect(() => {
    if (!supplierDropdownOpen) return;
    const closeDropdown = () => setSupplierDropdownOpen(false);
    window.addEventListener('blur', closeDropdown);
    window.addEventListener('scroll', closeDropdown, true);
    return () => {
      window.removeEventListener('blur', closeDropdown);
      window.removeEventListener('scroll', closeDropdown, true);
    };
  }, [supplierDropdownOpen]);

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
    if (activeReport !== 'GD Report') return;
    fetchGDs({}).catch((err) => {
      toast.error(err.message || 'Failed to load GD report');
    });
  }, [activeReport, fetchGDs]);

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

  const gdSubcategoryOptions = useMemo(() => {
    const selectedCategoryId = Number(gdFilters.categoryId || 0);
    if (!selectedCategoryId) return masterOptions?.subcategories || [];
    return (masterOptions?.subcategories || []).filter((sub) => Number(sub.categoryId) === selectedCategoryId);
  }, [masterOptions?.subcategories, gdFilters.categoryId]);

  const gdItemOptions = useMemo(() => {
    const selectedCategoryId = Number(gdFilters.categoryId || 0);
    const selectedSubcategoryId = Number(gdFilters.subcategoryId || 0);
    return (items || []).filter((item) => {
      if (selectedCategoryId && Number(item.categoryId) !== selectedCategoryId) return false;
      if (selectedSubcategoryId && Number(item.subcategoryId) !== selectedSubcategoryId) return false;
      return true;
    });
  }, [items, gdFilters.categoryId, gdFilters.subcategoryId]);

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
    fetchExpiryReport(expiryFilters).then(() => setPendingPrint(true)).catch((err) => {
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

  const itemListSubcategoryOptions = useMemo(() => {
    const selectedCategoryId = Number(itemListFilters.categoryId || 0);
    if (!selectedCategoryId) return masterOptions?.subcategories || [];
    return (masterOptions?.subcategories || []).filter((sub) => Number(sub.categoryId) === selectedCategoryId);
  }, [masterOptions?.subcategories, itemListFilters.categoryId]);

  const reorderSubcategoryOptions = useMemo(() => {
    const selectedCategoryId = Number(reorderFilters.categoryId || 0);
    if (!selectedCategoryId) return masterOptions?.subcategories || [];
    return (masterOptions?.subcategories || []).filter((sub) => Number(sub.categoryId) === selectedCategoryId);
  }, [masterOptions?.subcategories, reorderFilters.categoryId]);

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

  const fixedAssetBrandOptions = useMemo(() => {
    const brands = (items || [])
      .filter((i) => i.itemType === 'fixed asset' && i.brand)
      .map((i) => i.brand);
    return [...new Set(brands)].sort();
  }, [items]);

  // Sourced from the Location master (Master Setup > Locations) — same list
  // GD/GIN's "Add Location" picker uses, since that's what actually stamps
  // AssetInstance.location now (the old per-item assetLocation note is gone
  // from this report).
  const fixedAssetLocationOptions = useMemo(() => {
    return [...new Set((masterOptions?.locations || []).map((l) => l.name))].sort();
  }, [masterOptions?.locations]);

  const updateRepairingFilter = (key, value) => {
    setRepairingFilters((prev) => {
      if (key === 'categoryId') return { ...prev, categoryId: value, subcategoryId: '', itemId: '' };
      if (key === 'subcategoryId') return { ...prev, subcategoryId: value, itemId: '' };
      return { ...prev, [key]: value };
    });
  };

  const applyRepairingFilters = () => {
    fetchMaintenanceRecords(repairingFilters).then(() => setPendingPrint(true)).catch((err) => {
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
    fetchGRNs(receivingFilters).then(() => setPendingPrint(true)).catch((err) => {
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
    fetchGINs(issuanceFilters).then(() => setPendingPrint(true)).catch((err) => {
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
      issuedById: '',
      location: '',
      admissionNumber: '',
      patientType: '',
    };
    setIssuanceFilters(emptyFilters);
    fetchGINs(emptyFilters).catch((err) => {
      toast.error(err.message || 'Failed to load issuance report');
    });
  };

  const updateGdFilter = (key, value) => {
    setGdFilters((prev) => {
      if (key === 'categoryId') return { ...prev, categoryId: value, subcategoryId: '', itemId: '' };
      if (key === 'subcategoryId') return { ...prev, subcategoryId: value, itemId: '' };
      return { ...prev, [key]: value };
    });
  };

  const applyGdFilters = () => {
    const filterSummary = buildFilterSummary('GD Report');
    const printedBy = getPrintedBy();
    const generatedAt = getGeneratedAt();
    const meta = { filterSummary, printedBy, generatedAt };
    fetchGDs(gdFilters).then((rawData) => {
      const rows = (Array.isArray(rawData) ? rawData : [])
        .filter((gd) => !gdFilters.itemId || String(gd.itemId) === String(gdFilters.itemId))
        .filter((gd) => !gdFilters.status || gd.status === gdFilters.status)
        .filter((gd) => !gdFilters.location || (gd.location || '').toLowerCase().includes(gdFilters.location.toLowerCase()))
        .map((gd) => ({
          'GD Code': gd.code,
          Date: gd.requestDate ? new Date(gd.requestDate).toLocaleDateString('en-PK') : '-',
          Item: gd.item?.name || '-',
          'Item Code': gd.item?.code || '-',
          Category: gd.item?.category?.name || '-',
          Subcategory: gd.item?.subcategory?.name || '-',
          Department: gd.department?.name || '-',
          'Demand Type': gd.demandCategoryType?.name || '-',
          Location: gd.location || '-',
          'Qty Requested': Number(gd.quantityRequested || 0),
          Status: gd.status || '-',
        }));
      printRowsToPdf({ title: 'Goods Demand Report', rows, ...meta });
    }).catch((err) => {
      toast.error(err.message || 'Failed to load GD report');
    });
  };

  const resetGdFilters = () => {
    const emptyFilters = { dateFrom: '', dateTo: '', departmentId: '', categoryId: '', subcategoryId: '', itemId: '', status: '', location: '' };
    setGdFilters(emptyFilters);
    fetchGDs(emptyFilters).catch((err) => {
      toast.error(err.message || 'Failed to load GD report');
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
    fetchGDNs(discardFilters).then(() => setPendingPrint(true)).catch((err) => {
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
      location: '',
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
    fetchShortExpiryReport(shortExpiryFilters).then(() => setPendingPrint(true)).catch((err) => {
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
    fetchStockPositionReport(stockPositionFilters).then(() => setPendingPrint(true)).catch((err) => {
      toast.error(err.message || 'Failed to load stock position report');
    });
  };

  const resetStockPositionFilters = () => {
    const emptyFilters = {
      asOfDate: '',
      categoryId: '',
      subcategoryId: '',
      itemId: '',
      assetType: '',
      brand: '',
      location: '',
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
    fetchSupplierLedgerReport(supplierLedgerFilters).then(() => setPendingPrint(true)).catch((err) => {
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

  const supplierGroups = useMemo(() => {
    const rows = supplierLedgerReport?.rows || [];
    const map = {};
    rows.forEach((row) => {
      const key = row.supplierName || '-';
      if (!map[key]) {
        map[key] = { supplierName: key, totalRecords: 0, totalAmount: 0, rows: [] };
      }
      map[key].rows.push(row);
      map[key].totalRecords += 1;
      map[key].totalAmount += Number(row.totalAmount || 0);
    });
    return Object.values(map);
  }, [supplierLedgerReport?.rows]);

  const supplierLedgerExportRows = useMemo(() => {
    return (supplierLedgerReport?.rows || []).map((row) => ({
      Date: formatDate(row.date),
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
    fetchDailySalesReport(dailySalesFilters).then(() => setPendingPrint(true)).catch((err) => {
      toast.error(err.message || 'Failed to load daily sales report');
    });
  };

  const resetDailySalesFilters = () => {
    const empty = { dateFrom: '', dateTo: '', customerName: '', categoryId: '', subcategoryId: '', assetType: '', admissionOnly: false };
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
          Date: formatDate(inv.invoiceDate),
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
    fetchItemLedgerReport(ledgerFilters).then(() => setPendingPrint(true)).catch((err) => {
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
      departmentId: '',
      location: '',
    };
    setLedgerFilters(emptyFilters);
    fetchItemLedgerReport(emptyFilters).catch((err) => {
      toast.error(err.message || 'Failed to load item ledger report');
    });
  };

  const reportRows = useMemo(() => {
    if (activeReport === 'Item List') {
      return (items || [])
        .filter((row) => {
          if (itemListFilters.assetType && row.itemType !== itemListFilters.assetType) return false;
          if (itemListFilters.itemCode) {
            const q = itemListFilters.itemCode.toLowerCase();
            if (!row.code?.toLowerCase().includes(q) && !row.name?.toLowerCase().includes(q)) return false;
          }
          if (itemListFilters.categoryId && String(row.categoryId) !== String(itemListFilters.categoryId)) return false;
          if (itemListFilters.subcategoryId && String(row.subcategoryId) !== String(itemListFilters.subcategoryId)) return false;
          if (itemListFilters.dateFrom && row.createdAt?.slice(0, 10) < itemListFilters.dateFrom) return false;
          if (itemListFilters.dateTo && row.createdAt?.slice(0, 10) > itemListFilters.dateTo) return false;
          if (itemListFilters.location) {
            const loc = itemLocationMap[row.id] || '';
            if (!loc.toLowerCase().includes(itemListFilters.location.toLowerCase())) return false;
          }
          return true;
        })
        .map((row) => ({
          key: row.id,
          code: row.code,
          name: row.name,
          category: row.category?.name || '-',
          subcategory: row.subcategory?.name || '-',
          unit: row.unit || '-',
          storage: row.storage?.name || '-',
          reorderLevel: row.reorderLevel || 0,
          location: row.itemType === 'fixed asset' ? (itemLocationMap[row.id] || '-') : '-',
          status: row.status || 'active',
        }));
    }

    if (activeReport === 'Reorder Report') {
      return (reorderAlerts || [])
        .filter((row) => {
          if (reorderFilters.assetType && row.item?.itemType !== reorderFilters.assetType) return false;
          if (reorderFilters.itemCode && !row.item?.code?.toLowerCase().includes(reorderFilters.itemCode.toLowerCase())) return false;
          if (reorderFilters.categoryId && String(row.item?.categoryId) !== String(reorderFilters.categoryId)) return false;
          if (reorderFilters.subcategoryId && String(row.item?.subcategoryId) !== String(reorderFilters.subcategoryId)) return false;
          if (reorderFilters.dateFrom && row.createdAt?.slice(0, 10) < reorderFilters.dateFrom) return false;
          if (reorderFilters.dateTo && row.createdAt?.slice(0, 10) > reorderFilters.dateTo) return false;
          if (reorderFilters.location) {
            const loc = itemLocationMap[row.item?.id] || '';
            if (!loc.toLowerCase().includes(reorderFilters.location.toLowerCase())) return false;
          }
          return true;
        })
        .map((row) => ({
          key: row.id,
          code: row.item?.code,
          name: row.item?.name,
          category: row.item?.category?.name || '-',
          stock: row.currentQty,
          threshold: row.thresholdQty,
          location: row.item?.itemType === 'fixed asset' ? (itemLocationMap[row.item?.id] || '-') : '-',
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
  }, [activeReport, items, reorderAlerts, stockPositionReport, itemListFilters, reorderFilters, itemLocationMap]);

  const ledgerExportRows = useMemo(() => {
    const result = [];
    for (const group of (itemLedgerReport?.groups || [])) {
      if (Number(group.openingBalance || 0) > 0 && (group.rows || []).length === 0) {
        result.push({
          Date: 'Opening',
          'Item Code': group.itemCode,
          'Item Name': group.itemName,
          Category: group.category,
          Subcategory: group.subcategory,
          'Received Qty': Number(group.openingBalance || 0).toFixed(2),
          'Received Rate': '-',
          'Received Amount': Number(group.openingAmount || 0).toFixed(2),
          'Issuance Qty': '0.00',
          'Issuance Amount': '0.00',
          'Issuance Breakdown': '-',
          'Remaining Qty': Number(group.openingBalance || 0).toFixed(2),
          'Remaining Amount': Number(group.openingAmount || 0).toFixed(2),
          'Remaining Breakdown': '-',
          Unit: group.baseUnit,
          Source: 'OPENING',
          Reference: '-',
        });
      }
      for (const row of (group.rows || [])) {
        result.push({
          Date: row.date ? new Date(row.date).toLocaleDateString('en-PK') : 'Opening',
          'Item Code': row.itemCode,
          'Item Name': row.itemName,
          Category: row.category,
          Subcategory: row.subcategory,
          'Received Qty': Number(row.receivedQuantity || 0).toFixed(2),
          'Received Rate': Number(row.receivedRate || 0).toFixed(2),
          'Received Amount': Number(row.receivedAmount || 0).toFixed(2),
          'Issuance Qty': Number(row.issuanceQuantity || 0).toFixed(2),
          'Issuance Amount': Number(row.issuanceAmount || 0).toFixed(2),
          'Issuance Breakdown': row.issuanceBreakdown || '-',
          Department: row.departmentName || '-',
          'Remaining Qty': Number(row.remainingQuantity || 0).toFixed(2),
          'Remaining Amount': Number(row.remainingAmount || 0).toFixed(2),
          'Remaining Breakdown': row.remainingBreakdown || '-',
          Unit: row.baseUnit,
          Source: row.sourceType,
          Reference: row.referenceNo,
        });
      }
    }
    return result;
  }, [itemLedgerReport?.groups]);

  const ledgerSummaryExportRows = useMemo(() => {
    return (itemLedgerReport?.groups || []).map((group) => {
      const rows = group.rows || [];
      const totalReceived = rows.reduce((s, r) => s + Number(r.receivedQuantity || 0), 0);
      const totalReceivedAmt = rows.reduce((s, r) => s + Number(r.receivedAmount || 0), 0);
      const totalIssued = rows.reduce((s, r) => s + Number(r.issuanceQuantity || 0), 0);
      const totalIssuedAmt = rows.reduce((s, r) => s + Number(r.issuanceAmount || 0), 0);
      const lastRow = rows[rows.length - 1];
      return {
        'Item Code': group.itemCode,
        'Item Name': group.itemName,
        Category: group.category,
        Subcategory: group.subcategory,
        'Opening Qty': Number(group.openingBalance || 0).toFixed(2),
        'Total Received': totalReceived.toFixed(2),
        'Received Amount': totalReceivedAmt.toFixed(2),
        'Total Issued': totalIssued.toFixed(2),
        'Issued Amount': totalIssuedAmt.toFixed(2),
        'Remaining Qty': lastRow ? Number(lastRow.remainingQuantity || 0).toFixed(2) : (Number(group.openingBalance || 0) + totalReceived - totalIssued).toFixed(2),
        'Remaining Amount': lastRow ? Number(lastRow.remainingAmount || 0).toFixed(2) : '0.00',
        'Remaining Breakdown': lastRow ? (lastRow.remainingBreakdown || '-') : '-',
      };
    });
  }, [itemLedgerReport?.groups]);

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
      manufacturer: row.manufacturer || '',
      model: row.model || '',
    }));
  }, [grns]);

  const receivingExportRows = useMemo(() => {
    return receivingRows.map((row) => ({
      Date: formatDate(row.date, 'dd MMM yyyy, hh:mm a'),
      Item: row.item,
      'Item Code': row.itemCode,
      Category: row.category,
      Subcategory: row.subcategory,
      Supplier: row.supplier,
      Manufacturer: row.manufacturer || '-',
      Model: row.model || '-',
      Quantity: row.quantity,
      Rate: row.rate,
      Amount: row.amount,
    }));
  }, [receivingRows]);

  const receivingSummaryExportRows = useMemo(() => {
    return Object.values(
      receivingRows.reduce((acc, row) => {
        const key = row.itemCode;
        if (!acc[key]) acc[key] = { 'Item Code': row.itemCode, Item: row.item, Category: row.category, Subcategory: row.subcategory, 'Total Qty': 0, 'Total Amount': 0 };
        acc[key]['Total Qty'] += Number(row.quantity || 0);
        acc[key]['Total Amount'] += Number(row.amount || 0);
        return acc;
      }, {})
    ).map((r) => ({ ...r, 'Total Qty': Number(r['Total Qty']).toFixed(2), 'Total Amount': Number(r['Total Amount']).toFixed(2) }));
  }, [receivingRows]);

  const issuanceRows = useMemo(() => {
    const rows = [];
    for (const gin of (gins || [])) {
      const dept = gin.department?.name || gin.gdHeader?.department?.name || '-';
      const issuedBy = gin.issuedBy ? `${gin.issuedBy.firstName} ${gin.issuedBy.lastName}` : '-';
      if (gin.ginItems && gin.ginItems.length > 0) {
        // The server returns a GIN if ANY of its lines matches; keep only the
        // lines that match every item-level filter (a multi-item GIN can mix
        // categories / subcategories / asset types).
        const f = issuanceFilters;
        const filteredGinItems = gin.ginItems.filter((gi) =>
          (!f.itemId || String(gi.itemId) === String(f.itemId))
          && (!f.categoryId || String(gi.item?.categoryId) === String(f.categoryId))
          && (!f.subcategoryId || String(gi.item?.subcategoryId) === String(f.subcategoryId))
          && (!f.assetType || gi.item?.itemType === f.assetType));
        filteredGinItems.forEach((gi, idx) => {
          const qty = Number(gi.issuedQuantity || 0);
          const rate = Number(gi.item?.lastGrnRate || gi.item?.purchasePrice || 0);
          const location = gi.gdItem?.location || '-';
          if (issuanceFilters.location && !location.toLowerCase().includes(issuanceFilters.location.toLowerCase())) return;
          rows.push({
            key: `${gin.id}-${idx}`,
            ginCode: gin.code,
            date: gin.issueDate,
            item: gi.item?.name || '-',
            itemCode: gi.item?.code || '-',
            category: gi.item?.category?.name || '-',
            subcategory: gi.item?.subcategory?.name || '-',
            department: dept,
            issuedBy,
            location,
            admissionNumber: gin.admissionNumber || '',
            patientName: gin.patientName || gin.admissionPatientName || '',
            patientCategory: gin.patientCategory || null,
            // Rate locked on the GIN line when it was issued (Patient + Item view).
            ginRate: Number(gi.unitRate ?? rate),
            quantity: qty,
            rate,
            amount: qty * rate,
          });
        });
      } else {
        const qty = Number(gin.issuedQuantity || 0);
        const rate = Number(gin.item?.lastGrnRate || gin.item?.purchasePrice || 0);
        const location = gin.gd?.location || '-';
        if (!(issuanceFilters.location && !location.toLowerCase().includes(issuanceFilters.location.toLowerCase()))) {
          rows.push({
            key: gin.id,
            ginCode: gin.code,
            date: gin.issueDate,
            item: gin.item?.name || '-',
            itemCode: gin.item?.code || '-',
            category: gin.item?.category?.name || '-',
            subcategory: gin.item?.subcategory?.name || '-',
            department: dept,
            issuedBy,
            location,
            admissionNumber: gin.admissionNumber || '',
            patientName: gin.patientName || gin.admissionPatientName || '',
            patientCategory: gin.patientCategory || null,
            ginRate: Number(gin.unitRate ?? rate),
            quantity: qty,
            rate,
            amount: qty * rate,
          });
        }
      }
    }
    return rows;
  }, [gins, issuanceFilters]);

  // Patient filters on → each line says whose medicine it was.
  const issuanceShowsPatient = Boolean(issuanceFilters.patientType || issuanceFilters.admissionNumber?.trim());
  const issuanceExportRows = useMemo(() => {
    return issuanceRows.map((row) => ({
      'GIN Code': row.ginCode || '-',
      Date: formatDate(row.date),
      ...(issuanceShowsPatient ? { 'Admission #': row.admissionNumber || '-', Patient: row.patientName || '-' } : {}),
      Item: row.item,
      'Item Code': row.itemCode,
      Category: row.category,
      Subcategory: row.subcategory,
      Department: row.department,
      'Issued By': row.issuedBy,
      Location: row.location,
      'Issued Qty': row.quantity,
      Rate: Number(row.rate || 0).toFixed(2),
      Amount: Number(row.amount || 0).toFixed(2),
    }));
  }, [issuanceRows, issuanceShowsPatient]);

  const issuanceSummaryExportRows = useMemo(() => {
    return Object.values(
      issuanceRows.reduce((acc, row) => {
        const key = row.itemCode;
        if (!acc[key]) acc[key] = { 'Item Code': row.itemCode, Item: row.item, Category: row.category, Subcategory: row.subcategory, 'Total Issued Qty': 0, 'Total Amount': 0 };
        acc[key]['Total Issued Qty'] += Number(row.quantity || 0);
        acc[key]['Total Amount'] += Number(row.amount || 0);
        return acc;
      }, {})
    ).map((r) => ({ ...r, 'Total Issued Qty': Number(r['Total Issued Qty']).toFixed(2), 'Total Amount': Number(r['Total Amount']).toFixed(2) }));
  }, [issuanceRows]);

  // Patient-wise summary — one line per admission, Cash patients first then
  // Panel, each group with its own total line, then a Grand Total line.
  // Department (non-patient) issuance has no patient, so it's left out.
  const issuancePatientSummaryRows = useMemo(() => {
    const byAdm = new Map();
    issuanceRows.forEach((r) => {
      if (!r.admissionNumber) return;
      if (!byAdm.has(r.admissionNumber)) {
        byAdm.set(r.admissionNumber, { type: r.patientCategory, adm: r.admissionNumber, patient: r.patientName, gins: new Set(), qty: 0, amount: 0 });
      }
      const a = byAdm.get(r.admissionNumber);
      a.gins.add(r.ginCode);
      a.qty += Number(r.quantity || 0);
      a.amount += Number(r.amount || 0);
      if (!a.patient && r.patientName) a.patient = r.patientName;
    });
    const groups = [['cash', 'Cash'], ['panel', 'Panel'], [null, 'Unknown']];
    const out = [];
    let gQty = 0; let gAmt = 0; let gCount = 0;
    groups.forEach(([key, label]) => {
      const list = [...byAdm.values()].filter((a) => (a.type || null) === key).sort((x, y) => x.adm.localeCompare(y.adm));
      if (!list.length) return;
      let qty = 0; let amt = 0;
      list.forEach((a) => {
        qty += a.qty; amt += a.amount;
        out.push({ Type: label, 'Admission #': a.adm, Patient: a.patient || '-', GINs: a.gins.size, 'Total Qty': a.qty.toFixed(2), Amount: a.amount.toFixed(2) });
      });
      out.push({ Type: `${label} Total`, 'Admission #': `${list.length} patient(s)`, Patient: '', GINs: '', 'Total Qty': qty.toFixed(2), Amount: amt.toFixed(2) });
      gQty += qty; gAmt += amt; gCount += list.length;
    });
    if (out.length) out.push({ Type: 'Grand Total', 'Admission #': `${gCount} patient(s)`, Patient: '', GINs: '', 'Total Qty': gQty.toFixed(2), Amount: gAmt.toFixed(2) });
    return out;
  }, [issuanceRows]);

  // Patient + Item-wise — per admission, per medicine and GIN rate: how many
  // times it went (GIN lines), total qty, rate, amount; a Total line per
  // patient and a Grand Total. Amounts here use the GIN's own issue rate.
  const issuancePatientItemRows = useMemo(() => {
    const TYPE = { cash: 'Cash', panel: 'Panel' };
    const TYPE_ORDER = { cash: 0, panel: 1 }; // Unknown (no such admission) last
    const byAdm = new Map();
    issuanceRows.forEach((r) => {
      if (!r.admissionNumber) return;
      if (!byAdm.has(r.admissionNumber)) byAdm.set(r.admissionNumber, { type: r.patientCategory, patient: r.patientName, items: new Map() });
      const a = byAdm.get(r.admissionNumber);
      if (!a.patient && r.patientName) a.patient = r.patientName;
      const key = `${r.itemCode}::${r.ginRate}`;
      if (!a.items.has(key)) a.items.set(key, { code: r.itemCode, name: r.item, rate: r.ginRate, times: 0, qty: 0 });
      const it = a.items.get(key);
      it.times += 1;
      it.qty += Number(r.quantity || 0);
    });
    const out = [];
    let gQty = 0; let gAmt = 0;
    [...byAdm.entries()]
      .sort(([x, ax], [y, ay]) => (TYPE_ORDER[ax.type] ?? 2) - (TYPE_ORDER[ay.type] ?? 2) || x.localeCompare(y))
      .forEach(([adm, a]) => {
        let qty = 0; let amt = 0;
        [...a.items.values()]
          .sort((x, y) => x.name.localeCompare(y.name) || x.rate - y.rate)
          .forEach((it) => {
            const amount = it.qty * it.rate;
            qty += it.qty; amt += amount;
            out.push({
              Type: TYPE[a.type] || 'Unknown', 'Admission #': adm, Patient: a.patient || '-',
              'Item Code': it.code, Item: it.name, 'Kitni Dafa': it.times,
              'Total Qty': it.qty.toFixed(2), Rate: it.rate.toFixed(2), Amount: amount.toFixed(2),
            });
          });
        out.push({ Type: 'Total', 'Admission #': adm, Patient: a.patient || '-', 'Item Code': '', Item: '', 'Kitni Dafa': '', 'Total Qty': qty.toFixed(2), Rate: '', Amount: amt.toFixed(2) });
        gQty += qty; gAmt += amt;
      });
    if (out.length) out.push({ Type: 'Grand Total', 'Admission #': `${byAdm.size} patient(s)`, Patient: '', 'Item Code': '', Item: '', 'Kitni Dafa': '', 'Total Qty': gQty.toFixed(2), Rate: '', Amount: gAmt.toFixed(2) });
    return out;
  }, [issuanceRows]);

  // What Print / PDF / Excel output for the chosen Issuance view.
  const issuanceOutput = issuanceView === 'patient'
    ? { title: 'Issuance Summary — Patient-wise (Cash / Panel)', file: 'inventory-issuance-patient-summary', rows: issuancePatientSummaryRows, grandTotal: false }
    : issuanceView === 'patientItem'
      ? { title: 'Issuance Summary — Patient + Item-wise', file: 'inventory-issuance-patient-item-summary', rows: issuancePatientItemRows, grandTotal: false }
    : issuanceSummary
      ? { title: 'Issuance Summary', file: 'inventory-issuance-summary', rows: issuanceSummaryExportRows, grandTotal: true }
      : { title: 'Issuance Report', file: 'inventory-issuance-report', rows: issuanceExportRows, grandTotal: true };

  const gdRows = useMemo(() => {
    return (gds || [])
      .filter((gd) => !gdFilters.itemId || String(gd.itemId) === String(gdFilters.itemId))
      .filter((gd) => !gdFilters.location || (gd.location || '').toLowerCase().includes(gdFilters.location.toLowerCase()))
      .map((gd) => ({
        key: gd.id,
        gdCode: gd.code,
        date: gd.requestDate,
        item: gd.item?.name || '-',
        itemCode: gd.item?.code || '-',
        category: gd.item?.category?.name || '-',
        subcategory: gd.item?.subcategory?.name || '-',
        department: gd.department?.name || '-',
        demandType: gd.demandCategoryType?.name || '-',
        quantityRequested: Number(gd.quantityRequested || 0),
        status: gd.status || '-',
        location: gd.location || '',
      }));
  }, [gds, gdFilters.itemId, gdFilters.location]);

  const gdExportRows = useMemo(() => {
    return gdRows.map((row) => ({
      'GD Code': row.gdCode,
      Date: row.date ? new Date(row.date).toLocaleDateString('en-PK') : '-',
      Item: row.item,
      'Item Code': row.itemCode,
      Category: row.category,
      Subcategory: row.subcategory,
      Department: row.department,
      'Demand Type': row.demandType,
      Location: row.location || '-',
      'Qty Requested': row.quantityRequested,
      Status: row.status,
    }));
  }, [gdRows]);

  const discardRows = useMemo(() => {
    return (gdns || []).map((row) => ({
      key: row.id,
      date: row.discardedDate,
      item: row.item?.name || '-',
      itemCode: row.item?.code || '-',
      category: row.item?.category?.name || '-',
      subcategory: row.item?.subcategory?.name || '-',
      location: row.item?.itemType === 'fixed asset' ? (itemLocationMap[row.item?.id] || '-') : '-',
      quantity: Number(row.quantity || 0),
      amount: Number(row.amount || 0),
    }));
  }, [gdns, itemLocationMap]);

  const discardExportRows = useMemo(() => {
    return discardRows.map((row) => ({
      Date: formatDate(row.date, 'dd MMM yyyy, hh:mm a'),
      Item: row.item,
      'Item Code': row.itemCode,
      Category: row.category,
      Subcategory: row.subcategory,
      Location: row.location,
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
      'Expiry Date': formatDate(row.expiryDate),
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
      Date: formatDate(row.date),
      'Date Log': formatDate(row.dateLog),
      Item: row.item,
      'Item Code': row.itemCode,
      Category: row.category,
      Subcategory: row.subcategory,
      Quantity: row.quantity,
      'Days Left': row.daysLeft,
    }));
  }, [shortExpiryRows]);

  // "PD0302010-01, PD0302010-05, PD0302010-09" → "PD0302010-01,05,09" — every
  // unit of one maintenance record shares the same base item code, so only
  // the first tag needs it in full; the rest just need their own suffix.
  function formatAssetTags(tags) {
    if (tags.length === 0) return '';
    if (tags.length === 1) return tags[0];
    const lastDash = tags[0].lastIndexOf('-');
    if (lastDash === -1) return tags.join(', ');
    const prefix = tags[0].slice(0, lastDash);
    const suffixes = tags.map((tag) => {
      const dash = tag.lastIndexOf('-');
      return dash !== -1 && tag.slice(0, dash) === prefix ? tag.slice(dash + 1) : tag;
    });
    return `${prefix}-${suffixes.join(',')}`;
  }

  const repairingRows = useMemo(() => {
    return (maintenanceRecords || []).map((row) => {
      // Fixed-asset records can carry several units at once (Select Asset
      // Units for Repair) — each may itself have a different Location (see
      // GD/GIN's "Add Location" → asset unit stamping), so join whatever's
      // set rather than assuming one shared value.
      const locations = [...new Set((row.assetInstances || []).map((a) => a.location).filter(Boolean))];
      // The base item code (e.g. "PD0302010") is shared by every unit of
      // that item — for a fixed asset with specific units picked, that's
      // incomplete (doesn't say WHICH unit went in for repair). Show the
      // actual asset tag(s) instead whenever units were tracked.
      const assetTags = (row.assetInstances || []).map((a) => a.assetTag).filter(Boolean);
      return {
        key: row.id,
        moNumber: row.moNumber || '-',
        date: row.date,
        item: row.item?.name || row.itemName || '-',
        itemCode: assetTags.length > 0 ? formatAssetTags(assetTags) : (row.item?.code || row.itemCode || '-'),
        category: row.item?.category?.name || row.categoryName || '-',
        subcategory: row.item?.subcategory?.name || row.subcategoryName || '-',
        supplier: row.supplier?.name || row.supplierName || '-',
        location: locations.length > 0 ? locations.join(', ') : '-',
        cost: row.cost != null ? Number(row.cost) : null,
        actualCost: row.actualCost != null ? Number(row.actualCost) : null,
        natureOfRepair: row.natureOfRepair || '-',
        status: row.status || 'in_repair',
        checkedBy: row.checkedBy || '-',
        warrantyDays: row.warrantyDays != null ? row.warrantyDays : '-',
        returnDate: row.receivedDate || null,
      };
    });
  }, [maintenanceRecords]);

  const repairingExportRows = useMemo(() => {
    return repairingRows.map((row) => ({
      'MO No': row.moNumber,
      Date: formatDate(row.date),
      Item: row.item,
      'Item Code': row.itemCode,
      Category: row.category,
      Subcategory: row.subcategory,
      Supplier: row.supplier,
      Location: row.location,
      'Est. Cost (PKR)': row.cost != null ? row.cost : '-',
      'Actual Cost (PKR)': row.actualCost != null ? row.actualCost : '-',
      'Nature of Repair': row.natureOfRepair,
      'Checked By': row.checkedBy,
      'Warranty (Days)': row.warrantyDays,
      Status: row.status === 'in_repair' ? 'In Repair' : row.status === 'completed' ? 'Completed' : 'Discarded',
      'Return Date': formatDate(row.returnDate),
    }));
  }, [repairingRows]);

  // PDF/Print only — no per-row Category/Subcategory column; those show in
  // the filter-summary header instead (only when actually filtered on),
  // same convention every other report's PDF already follows. Excel keeps
  // the full column set from repairingExportRows above.
  const repairingPdfRows = useMemo(() => {
    return repairingExportRows.map((row) => {
      const copy = { ...row };
      delete copy.Category;
      delete copy.Subcategory;
      return copy;
    });
  }, [repairingExportRows]);

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
      poDate: row.poDate,
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
      'PO Date': formatDate(row.poDate),
      'Expected Date': formatDate(row.expectedDate),
      Status: row.status,
    }));
  }, [poRows]);

  const stockPositionExportRows = useMemo(() => {
    return (stockPositionReport?.rows || []).map((row) => ({
      Code: row.code,
      Name: row.name,
      Category: row.category,
      Subcategory: row.subcategory || '-',
      'Item Type': row.itemType || '-',
      Location: row.itemType === 'fixed asset' ? (row.location || '-') : '-',
      Quantity: Number(row.currentQuantity || 0).toFixed(2),
      Unit: row.unit,
      'Amount (Rs.)': Number(row.currentAmount || 0).toFixed(2),
      'FIFO Breakdown': row.breakdown || '-',
      Status: row.status,
    }));
  }, [stockPositionReport?.rows]);

  const itemListExportRows = useMemo(() => {
    return (reportRows || []).map((row) => ({
      Code: row.code,
      Name: row.name,
      Category: row.category,
      Subcategory: row.subcategory,
      Unit: row.unit,
      Storage: row.storage,
      Location: row.location,
      'Reorder Level': row.reorderLevel,
      Status: row.status,
    }));
  }, [reportRows]);

  const reorderExportRows = useMemo(() => {
    return (reportRows || []).map((row) => ({
      Code: row.code,
      Name: row.name,
      Category: row.category,
      'Current Stock': row.stock,
      'Reorder Level': row.threshold,
      Location: row.location,
      Status: row.status,
    }));
  }, [reportRows]);

  const getPrintedBy = () => user?.name || user?.username || user?.email || 'Unknown';
  const getGeneratedAt = () => new Date().toLocaleString('en-PK', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

  const buildFilterSummary = (report) => {
    const parts = [];
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PK') : null;
    const catName = (id) => (masterOptions?.categories || []).find((c) => String(c.id) === String(id))?.name;
    const subName = (id) => (masterOptions?.subcategories || []).find((s) => String(s.id) === String(id))?.name;
    const itemName = (id) => (items || []).find((i) => String(i.id) === String(id))?.name;
    const deptName = (id) => (masterOptions?.departments || []).find((d) => String(d.id) === String(id))?.name;
    const supName = (id) => (masterOptions?.suppliers || []).find((s) => String(s.id) === String(id))?.name;

    const push = (label, val) => { if (val) parts.push(`${label}: ${val}`); };

    if (report === 'Item Ledger') {
      push('From', fmtDate(ledgerFilters.dateFrom));
      push('To', fmtDate(ledgerFilters.dateTo));
      push('Department', deptName(ledgerFilters.departmentId));
      push('Category', catName(ledgerFilters.categoryId));
      push('Subcategory', subName(ledgerFilters.subcategoryId));
      push('Item', itemName(ledgerFilters.itemId));
      push('Type', ledgerFilters.assetType);
      push('Location', ledgerFilters.location);
      if (ledgerSummary) parts.push('View: Summary');
    } else if (report === 'Receiving Report') {
      push('From', fmtDate(receivingFilters.dateFrom));
      push('To', fmtDate(receivingFilters.dateTo));
      push('Supplier', supName(receivingFilters.supplierId));
      push('Category', catName(receivingFilters.categoryId));
      push('Subcategory', subName(receivingFilters.subcategoryId));
      push('Item', itemName(receivingFilters.itemId));
      push('Type', receivingFilters.assetType);
      if (receivingSummary) parts.push('View: Summary');
    } else if (report === 'Issuance Report') {
      push('From', fmtDate(issuanceFilters.dateFrom));
      push('To', fmtDate(issuanceFilters.dateTo));
      push('Department', deptName(issuanceFilters.departmentId));
      push('Category', catName(issuanceFilters.categoryId));
      push('Subcategory', subName(issuanceFilters.subcategoryId));
      push('Item', itemName(issuanceFilters.itemId));
      push('Type', issuanceFilters.assetType);
      push('Location', issuanceFilters.location);
      push('Patient Type', { admission: 'All Admitted (Cash + Panel)', cash: 'Cash Patients', panel: 'Panel Patients' }[issuanceFilters.patientType]);
      push('Admission #', issuanceFilters.admissionNumber?.trim());
      if (issuanceFilters.issuedById) {
        const emp = (employees || []).find((e) => String(e.id) === String(issuanceFilters.issuedById));
        if (emp) push('Issued By', `${emp.firstName} ${emp.lastName}`);
      }
      if (issuanceView === 'item') parts.push('View: Item-wise Summary');
      if (issuanceView === 'patient') parts.push('View: Patient-wise Summary (Cash / Panel)');
      if (issuanceView === 'patientItem') parts.push('View: Patient + Item-wise Summary (rate = GIN issue rate)');
    } else if (report === 'GD Report') {
      push('From', fmtDate(gdFilters.dateFrom));
      push('To', fmtDate(gdFilters.dateTo));
      push('Department', deptName(gdFilters.departmentId));
      push('Category', catName(gdFilters.categoryId));
      push('Subcategory', subName(gdFilters.subcategoryId));
      push('Item', itemName(gdFilters.itemId));
      push('Status', gdFilters.status);
      push('Location', gdFilters.location);
    } else if (report === 'Discard Report') {
      push('From', fmtDate(discardFilters.dateFrom));
      push('To', fmtDate(discardFilters.dateTo));
      push('Item', itemName(discardFilters.itemId));
      push('Location', discardFilters.location);
    } else if (report === 'Stock Position') {
      push('As Of', fmtDate(stockPositionFilters.asOfDate));
      push('Category', catName(stockPositionFilters.categoryId));
      push('Subcategory', subName(stockPositionFilters.subcategoryId));
      push('Item', itemName(stockPositionFilters.itemId));
      push('Type', stockPositionFilters.assetType);
      if (stockPositionFilters.assetType === 'fixed asset') {
        push('Location', stockPositionFilters.location);
        push('Brand', stockPositionFilters.brand);
      }
    } else if (report === 'Short Expiry') {
      push('Expiry From', fmtDate(shortExpiryFilters.dateFrom));
      push('Expiry To', fmtDate(shortExpiryFilters.dateTo));
      push('Category', catName(shortExpiryFilters.categoryId));
      push('Subcategory', subName(shortExpiryFilters.subcategoryId));
      push('Item', itemName(shortExpiryFilters.itemId));
    } else if (report === 'Expiry') {
      push('Expiry From', fmtDate(expiryFilters.dateFrom));
      push('Expiry To', fmtDate(expiryFilters.dateTo));
      push('Category', catName(expiryFilters.categoryId));
      push('Subcategory', subName(expiryFilters.subcategoryId));
      push('Item', itemName(expiryFilters.itemId));
    } else if (report === 'Daily Sales') {
      push('From', fmtDate(dailySalesFilters.dateFrom));
      push('To', fmtDate(dailySalesFilters.dateTo));
      push('Customer', dailySalesFilters.customerName);
      push('Category', catName(dailySalesFilters.categoryId));
      push('Subcategory', subName(dailySalesFilters.subcategoryId));
      push('Item', itemName(dailySalesFilters.itemId));
      if (dailySalesFilters.admissionOnly) parts.push('View: Admission Only');
    } else if (report === 'Supplier Ledger') {
      push('From', fmtDate(supplierLedgerFilters.dateFrom));
      push('To', fmtDate(supplierLedgerFilters.dateTo));
      push('Supplier', supplierLedgerFilters.supplierName);
      push('Category', catName(supplierLedgerFilters.categoryId));
      push('Subcategory', subName(supplierLedgerFilters.subcategoryId));
      push('Type', supplierLedgerFilters.assetType);
    } else if (report === 'Purchase Order Report') {
      push('From', fmtDate(poFilters.dateFrom));
      push('To', fmtDate(poFilters.dateTo));
      push('Supplier', supName(poFilters.supplierId));
      push('Category', catName(poFilters.categoryId));
      push('Subcategory', subName(poFilters.subcategoryId));
      push('Type', poFilters.assetType);
    } else if (report === 'Repairing Report') {
      push('From', fmtDate(repairingFilters.dateFrom));
      push('To', fmtDate(repairingFilters.dateTo));
      push('Status', repairingFilters.status);
      push('Category', catName(repairingFilters.categoryId));
      push('Subcategory', subName(repairingFilters.subcategoryId));
      push('Item', itemName(repairingFilters.itemId));
    } else if (report === 'Item List') {
      push('Category', catName(itemListFilters.categoryId));
      push('Subcategory', subName(itemListFilters.subcategoryId));
      push('Type', itemListFilters.assetType);
      push('Status', itemListFilters.status);
      push('Location', itemListFilters.location);
    } else if (report === 'Reorder Report') {
      push('Category', catName(reorderFilters.categoryId));
      push('Subcategory', subName(reorderFilters.subcategoryId));
      push('Type', reorderFilters.assetType);
      push('Location', reorderFilters.location);
    }

    return parts;
  };

  const handleExportPdf = () => {
    const filterSummary = buildFilterSummary(activeReport);
    const printedBy = getPrintedBy();
    const generatedAt = getGeneratedAt();
    const meta = { filterSummary, printedBy, generatedAt };
    if (activeReport === 'Item List') {
      exportRowsToPdf({ fileName: 'item-list', title: 'Item List', rows: itemListExportRows, ...meta });
      return;
    }
    if (activeReport === 'Reorder Report') {
      exportRowsToPdf({ fileName: 'reorder-report', title: 'Reorder Report', rows: reorderExportRows, ...meta });
      return;
    }
    if (activeReport === 'Stock Position') {
      exportRowsToPdf({ fileName: 'stock-position-report', title: 'Stock Position Report', rows: stockPositionExportRows, ...meta });
      return;
    }
    if (activeReport === 'Item Ledger') {
      exportItemLedgerPdf({ fileName: ledgerSummary ? 'inventory-item-ledger-summary' : 'inventory-item-ledger-report', title: ledgerSummary ? 'Inventory Item Ledger Summary' : 'Inventory Item Ledger Report', rows: ledgerSummary ? ledgerSummaryExportRows : ledgerExportRows, isSummary: ledgerSummary, mode: 'download', ...meta });
      return;
    }
    if (activeReport === 'Receiving Report') {
      exportRowsToPdf({ fileName: receivingSummary ? 'inventory-receiving-summary' : 'inventory-receiving-report', title: receivingSummary ? 'Inventory Receiving Summary' : 'Inventory Receiving Report', rows: receivingSummary ? receivingSummaryExportRows : receivingExportRows, ...meta });
      return;
    }
    if (activeReport === 'Issuance Report') {
      exportRowsToPdf({ fileName: issuanceOutput.file, title: `Inventory ${issuanceOutput.title}`, rows: issuanceOutput.rows, grandTotal: issuanceOutput.grandTotal, ...meta });
      return;
    }
    if (activeReport === 'GD Report') {
      fetchGDs(gdFilters).then((rawData) => {
        const rows = (Array.isArray(rawData) ? rawData : [])
          .filter((gd) => !gdFilters.itemId || String(gd.itemId) === String(gdFilters.itemId))
          .filter((gd) => !gdFilters.status || gd.status === gdFilters.status)
          .map((gd) => ({
            'GD Code': gd.code,
            Date: gd.requestDate ? new Date(gd.requestDate).toLocaleDateString('en-PK') : '-',
            Item: gd.item?.name || '-',
            'Item Code': gd.item?.code || '-',
            Category: gd.item?.category?.name || '-',
            Subcategory: gd.item?.subcategory?.name || '-',
            Department: gd.department?.name || '-',
            'Demand Type': gd.demandCategoryType?.name || '-',
            Location: gd.location || '-',
            'Qty Requested': Number(gd.quantityRequested || 0),
            Status: gd.status || '-',
          }));
        exportRowsToPdf({ fileName: 'gd-report', title: 'Goods Demand Report', rows, ...meta });
      }).catch((err) => toast.error(err.message || 'Failed to export GD report'));
      return;
    }
    if (activeReport === 'Discard Report') {
      exportRowsToPdf({ fileName: 'inventory-discard-report', title: 'Inventory Discard Report', rows: discardExportRows, ...meta });
      return;
    }
    if (activeReport === 'Short Expiry') {
      exportRowsToPdf({ fileName: 'inventory-short-expiry-report', title: 'Inventory Short Expiry Report', rows: shortExpiryExportRows, ...meta });
      return;
    }
    if (activeReport === 'Expiry') {
      exportRowsToPdf({ fileName: 'inventory-expiry-report', title: 'Inventory Expiry Report', rows: expiryExportRows, ...meta });
      return;
    }
    if (activeReport === 'Repairing Report') {
      exportRowsToPdf({ fileName: 'inventory-repairing-report', title: 'Maintenance / Repairing Report', rows: repairingPdfRows, ...meta });
      return;
    }
    if (activeReport === 'Purchase Order Report') {
      exportRowsToPdf({ fileName: 'inventory-po-report', title: 'Purchase Order Report', rows: poExportRows, ...meta });
      return;
    }
    if (activeReport === 'Daily Sales') {
      exportRowsToPdf({ fileName: 'daily-sales-report', title: 'Daily Sales Report', rows: dailySalesExportRows, ...meta });
      return;
    }
    if (activeReport === 'Supplier Ledger') {
      exportRowsToPdf({ fileName: 'supplier-ledger-report', title: 'Supplier Ledger Report', rows: supplierLedgerExportRows, ...meta });
      return;
    }
    exportRowsToPdf({ fileName: `inventory-${activeReport.toLowerCase().replace(/\s+/g, '-')}`, title: activeReport, rows: reportRows, ...meta });
  };

  const handlePrint = () => {
    const filterSummary = buildFilterSummary(activeReport);
    const printedBy = getPrintedBy();
    const generatedAt = getGeneratedAt();
    const meta = { filterSummary, printedBy, generatedAt };

    if (activeReport === 'Item List') { printRowsToPdf({ title: 'Item List', rows: itemListExportRows, ...meta }); return; }
    if (activeReport === 'Reorder Report') { printRowsToPdf({ title: 'Reorder Report', rows: reorderExportRows, ...meta }); return; }
    if (activeReport === 'Stock Position') { printRowsToPdf({ title: 'Stock Position Report', rows: stockPositionExportRows, ...meta }); return; }
    if (activeReport === 'Item Ledger') { exportItemLedgerPdf({ title: ledgerSummary ? 'Item Ledger Summary' : 'Item Ledger Report', rows: ledgerSummary ? ledgerSummaryExportRows : ledgerExportRows, isSummary: ledgerSummary, mode: 'print', ...meta }); return; }
    if (activeReport === 'Receiving Report') { printRowsToPdf({ title: receivingSummary ? 'Receiving Summary' : 'Receiving Report', rows: receivingSummary ? receivingSummaryExportRows : receivingExportRows, ...meta }); return; }
    // Portrait A4, Arial 8pt (HTML print).
    if (activeReport === 'Issuance Report') { printRowsHtml({ title: issuanceOutput.title, rows: issuanceOutput.rows, grandTotal: issuanceOutput.grandTotal, ...meta }); return; }
    if (activeReport === 'GD Report') {
      fetchGDs(gdFilters).then((rawData) => {
        const rows = (Array.isArray(rawData) ? rawData : [])
          .filter((gd) => !gdFilters.itemId || String(gd.itemId) === String(gdFilters.itemId))
          .filter((gd) => !gdFilters.status || gd.status === gdFilters.status)
          .map((gd) => ({
            'GD Code': gd.code,
            Date: gd.requestDate ? new Date(gd.requestDate).toLocaleDateString('en-PK') : '-',
            Item: gd.item?.name || '-',
            'Item Code': gd.item?.code || '-',
            Category: gd.item?.category?.name || '-',
            Subcategory: gd.item?.subcategory?.name || '-',
            Department: gd.department?.name || '-',
            'Demand Type': gd.demandCategoryType?.name || '-',
            Location: gd.location || '-',
            'Qty Requested': Number(gd.quantityRequested || 0),
            Status: gd.status || '-',
          }));
        printRowsToPdf({ title: 'Goods Demand Report', rows, ...meta });
      }).catch((err) => toast.error(err.message || 'Failed to print GD report'));
      return;
    }
    if (activeReport === 'Discard Report') { printRowsToPdf({ title: 'Discard Report', rows: discardExportRows, ...meta }); return; }
    if (activeReport === 'Short Expiry') { printRowsToPdf({ title: 'Short Expiry Report', rows: shortExpiryExportRows, ...meta }); return; }
    if (activeReport === 'Expiry') { printRowsToPdf({ title: 'Expiry Report', rows: expiryExportRows, ...meta }); return; }
    if (activeReport === 'Repairing Report') { printRowsToPdf({ title: 'Maintenance / Repairing Report', rows: repairingPdfRows, ...meta }); return; }
    if (activeReport === 'Purchase Order Report') { printRowsToPdf({ title: 'Purchase Order Report', rows: poExportRows, ...meta }); return; }
    if (activeReport === 'Daily Sales') { printRowsToPdf({ title: 'Daily Sales Report', rows: dailySalesExportRows, ...meta }); return; }
    if (activeReport === 'Supplier Ledger') { printRowsToPdf({ title: 'Supplier Ledger Report', rows: supplierLedgerExportRows, ...meta }); return; }
  };

  const handleExportExcel = () => {
    if (activeReport === 'Item Ledger') {
      exportRowsToExcel({
        fileName: ledgerSummary ? 'inventory-item-ledger-summary' : 'inventory-item-ledger-report',
        sheetName: 'ItemLedger',
        rows: ledgerSummary ? ledgerSummaryExportRows : ledgerExportRows,
      });
      return;
    }

    if (activeReport === 'Receiving Report') {
      exportRowsToExcel({
        fileName: receivingSummary ? 'inventory-receiving-summary' : 'inventory-receiving-report',
        sheetName: 'ReceivingReport',
        rows: receivingSummary ? receivingSummaryExportRows : receivingExportRows,
      });
      return;
    }

    if (activeReport === 'Issuance Report') {
      exportRowsToExcel({
        fileName: issuanceOutput.file,
        sheetName: 'IssuanceReport',
        rows: issuanceOutput.rows,
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

  useEffect(() => {
    if (!pendingPrint) return;
    const t = setTimeout(() => {
      setPendingPrint(false);
      handlePrint();
    }, 80);
    return () => clearTimeout(t);
  }, [pendingPrint]);

  useModalKeys({ onCtrlP: handlePrint });

  // ── Report-type permission filtering ─────────────────────────────────────
  // Permission key = report label lowercased with spaces → dashes
  const toPermKey = (label) => label.toLowerCase().replace(/\s+/g, '-');
  const visibleReportTypes = useMemo(
    () => REPORT_TYPES.filter((r) => hasPermission(user, 'inventory', 'inventory-reports', toPermKey(r))),
    [user]
  );
  const effectiveReport = visibleReportTypes.includes(activeReport)
    ? activeReport
    : (visibleReportTypes[0] ?? activeReport);

  if (visibleReportTypes.length === 0) return <NoTabAccess />;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventory Reports</h1>
          <p className="text-slate-500 text-sm">View, print and export analytical stock reports</p>
        </div>
        <div className="flex gap-2 items-center">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 bg-white rounded-lg border border-slate-200 hover:bg-slate-50"
            title={sidebarOpen ? 'Hide menu' : 'Show menu'}
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <Button variant="outline" label="Export CSV" icon={Download} onClick={handleExportExcel} />
          <Button variant="outline" label="Export PDF" icon={Download} onClick={handleExportPdf} />
          <Button variant="outline" label="Print" icon={Printer} onClick={handlePrint} />
        </div>
      </div>

      <div className="flex gap-4 lg:gap-6 relative">
        {/* Sidebar menus for reports - Responsive */}
        {sidebarOpen && (
          <div className="fixed md:relative top-0 left-0 h-screen md:h-auto w-64 flex-shrink-0 bg-white md:bg-transparent z-30 md:z-auto">
            <Card className="p-2 h-full md:h-auto rounded-none md:rounded-lg">
              <div className="space-y-1 pt-12 md:pt-0 max-h-screen md:max-h-none overflow-y-auto">
                {visibleReportTypes.map(report => (
                  <button
                    key={report}
                    onClick={() => {
                      setActiveReport(report);
                      setSidebarOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 rounded-md text-sm transition-colors ${
                      effectiveReport === report
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
        )}

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/30 md:hidden z-20"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Report Content */}
        <div className="flex-1 min-w-0">
          <Card className="p-0 overflow-hidden h-full min-h-[500px] flex flex-col">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <h2 className="font-semibold text-black">{activeReport}</h2>
            </div>
            {effectiveReport === 'Stock Position' ? (
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
                    <SearchableSelect
                      options={categoryOptions}
                      value={stockPositionFilters.categoryId}
                      onChange={(val) => updateStockPositionFilter('categoryId', val)}
                      placeholder="All Categories"
                      getLabel={(opt) => `${opt.name} (${opt.code})`}
                      getKey={(opt) => opt.id}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Subcategory</label>
                    <SearchableSelect
                      options={stockPositionSubcategoryOptions}
                      value={stockPositionFilters.subcategoryId}
                      onChange={(val) => updateStockPositionFilter('subcategoryId', val)}
                      placeholder="All Subcategories"
                      getLabel={(opt) => `${opt.name} (${opt.code})`}
                      getKey={(opt) => opt.id}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Item</label>
                    <SearchableSelect
                      options={(items || []).filter((it) =>
                        !stockPositionFilters.categoryId || String(it.categoryId) === String(stockPositionFilters.categoryId)
                      ).filter((it) =>
                        !stockPositionFilters.subcategoryId || String(it.subcategoryId) === String(stockPositionFilters.subcategoryId)
                      )}
                      value={stockPositionFilters.itemId}
                      onChange={(val) => updateStockPositionFilter('itemId', val)}
                      placeholder="All Items"
                    />
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

                {stockPositionFilters.assetType === 'fixed asset' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">Location</label>
                      <SearchableSelect
                        options={fixedAssetLocationOptions}
                        value={stockPositionFilters.location}
                        onChange={(val) => updateStockPositionFilter('location', val)}
                        placeholder="All Locations"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">Brand</label>
                      <SearchableSelect
                        options={fixedAssetBrandOptions}
                        value={stockPositionFilters.brand}
                        onChange={(val) => updateStockPositionFilter('brand', val)}
                        placeholder="All Brands"
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button size="sm" label="Apply" onClick={applyStockPositionFilters} />
                  <Button size="sm" variant="outline" label="Reset" onClick={resetStockPositionFilters} />
                </div>
                {false && (<>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Card className="p-3">
                    <p className="text-xs text-slate-500">Items in Stock</p>
                    <p className="text-lg font-semibold text-black">{stockPositionReport?.total?.itemCount || 0}</p>
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
                          <th className="px-4 py-3">Location</th>
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
                            <td className="px-4 py-3 font-medium text-black">{row.name}</td>
                            <td className="px-4 py-3">{row.category}</td>
                            <td className="px-4 py-3 text-slate-500">{row.itemType === 'fixed asset' ? (row.location || '-') : '-'}</td>
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
                </>)}
              </div>
            ) : effectiveReport === 'Item Ledger' ? (
              <div className="p-4 space-y-4 overflow-y-auto">
                {/* Filters */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="text-xs font-medium text-slate-500 block mb-1">Date From</label>
                      <input
                        type="date"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
                        value={ledgerFilters.dateFrom}
                        onChange={(e) => updateLedgerFilter('dateFrom', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-500 block mb-1">Date To</label>
                      <input
                        type="date"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
                        value={ledgerFilters.dateTo}
                        onChange={(e) => updateLedgerFilter('dateTo', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-500 block mb-1">Department (GIN)</label>
                      <SearchableSelect
                        options={masterOptions?.departments || []}
                        value={ledgerFilters.departmentId}
                        onChange={(val) => updateLedgerFilter('departmentId', val)}
                        placeholder="All Departments"
                        getLabel={(opt) => opt.name}
                        getKey={(opt) => opt.id}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-500 block mb-1">Category</label>
                      <SearchableSelect
                        options={categoryOptions}
                        value={ledgerFilters.categoryId}
                        onChange={(val) => updateLedgerFilter('categoryId', val)}
                        placeholder="All Categories"
                        getLabel={(opt) => `${opt.name} (${opt.code})`}
                        getKey={(opt) => opt.id}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-500 block mb-1">Subcategory</label>
                      <SearchableSelect
                        options={subcategoryOptions}
                        value={ledgerFilters.subcategoryId}
                        onChange={(val) => updateLedgerFilter('subcategoryId', val)}
                        placeholder="All Subcategories"
                        getLabel={(opt) => `${opt.name} (${opt.code})`}
                        getKey={(opt) => opt.id}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-500 block mb-1">Item</label>
                      <SearchableSelect
                        options={itemOptions}
                        value={ledgerFilters.itemId}
                        onChange={(val) => updateLedgerFilter('itemId', val)}
                        placeholder="All Items"
                        getLabel={(item) => `${item.name} (${item.code})`}
                        getKey={(item) => item.id}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-500 block mb-1">Asset Type</label>
                      <select
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
                        value={ledgerFilters.assetType}
                        onChange={(e) => updateLedgerFilter('assetType', e.target.value)}
                      >
                        <option value="">All Types</option>
                        <option value="current asset">Current Asset</option>
                        <option value="fixed asset">Fixed Asset</option>
                      </select>
                    </div>
                    {ledgerFilters.assetType === 'fixed asset' && (
                      <div>
                        <label className="text-xs font-medium text-slate-500 block mb-1">Location</label>
                        <SearchableSelect
                          options={fixedAssetLocationOptions}
                          value={ledgerFilters.location}
                          onChange={(val) => updateLedgerFilter('location', val)}
                          placeholder="All Locations"
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <Button size="sm" label="Apply Filters" onClick={applyLedgerFilters} />
                    <Button size="sm" variant="outline" label="Reset" onClick={resetLedgerFilters} />
                    <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-600 ml-auto">
                      <input
                        type="checkbox"
                        checked={ledgerSummary}
                        onChange={(e) => setLedgerSummary(e.target.checked)}
                        className="w-4 h-4 accent-blue-600 rounded"
                      />
                      <span className="font-medium">Summary View</span>
                    </label>
                  </div>
                </div>

                {false && (<>
                {/* Summary stat cards */}
                {(itemLedgerReport?.groups || []).length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col gap-0.5">
                      <p className="text-xs text-slate-500">Items</p>
                      <p className="text-xl font-bold text-black">{itemLedgerReport?.summary?.itemCount || 0}</p>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col gap-0.5">
                      <p className="text-xs text-slate-500">Total Received</p>
                      <p className="text-xl font-bold text-emerald-600">{Number(itemLedgerReport?.summary?.totalReceived || 0).toFixed(2)}</p>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col gap-0.5">
                      <p className="text-xs text-slate-500">Total Issued</p>
                      <p className="text-xl font-bold text-rose-500">{Number(itemLedgerReport?.summary?.totalIssued || 0).toFixed(2)}</p>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col gap-0.5">
                      <p className="text-xs text-slate-500">Closing Balance</p>
                      <p className="text-xl font-bold text-blue-600">{Number(itemLedgerReport?.summary?.closingBalance || 0).toFixed(2)}</p>
                    </div>
                  </div>
                )}

                {/* Report Table */}
                {(itemLedgerReport?.groups || []).length > 0 ? (
                  ledgerSummary ? (
                    /* ── Summary View ── */
                    <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-gradient-to-r from-slate-700 to-slate-600 text-white">
                            <th className="px-3 py-3 min-w-[72px] font-semibold rounded-tl-xl">Code</th>
                            <th className="px-3 py-3 min-w-[140px] font-semibold">Item Name</th>
                            <th className="px-3 py-3 min-w-[90px] font-semibold">Category</th>
                            <th className="px-3 py-3 min-w-[90px] font-semibold">Subcategory</th>
                            <th className="px-3 py-3 min-w-[80px] font-semibold text-right">Opening</th>
                            <th className="px-3 py-3 min-w-[80px] font-semibold text-right text-emerald-200">Received</th>
                            <th className="px-3 py-3 min-w-[90px] font-semibold text-right text-emerald-200">Rcvd Amt</th>
                            <th className="px-3 py-3 min-w-[80px] font-semibold text-right text-rose-200">Issued</th>
                            <th className="px-3 py-3 min-w-[90px] font-semibold text-right text-rose-200">Iss Amt</th>
                            <th className="px-3 py-3 min-w-[80px] font-semibold text-right text-blue-200">Remaining</th>
                            <th className="px-3 py-3 min-w-[90px] font-semibold text-right text-blue-200 rounded-tr-xl">Rem Amt</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(itemLedgerReport.groups).map((group, idx) => {
                            const rows = group.rows || [];
                            const totalReceived = rows.reduce((s, r) => s + Number(r.receivedQuantity || 0), 0);
                            const totalReceivedAmt = rows.reduce((s, r) => s + Number(r.receivedAmount || 0), 0);
                            const totalIssued = rows.reduce((s, r) => s + Number(r.issuanceQuantity || 0), 0);
                            const totalIssuedAmt = rows.reduce((s, r) => s + Number(r.issuanceAmount || 0), 0);
                            const lastRow = rows[rows.length - 1];
                            const remainingQty = lastRow ? Number(lastRow.remainingQuantity || 0) : Number(group.openingBalance || 0) + totalReceived - totalIssued;
                            const remainingAmt = lastRow ? Number(lastRow.remainingAmount || 0) : 0;
                            return (
                              <tr key={group.itemId} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-blue-50 transition-colors`}>
                                <td className="px-3 py-2.5 font-mono text-slate-500">{group.itemCode}</td>
                                <td className="px-3 py-2.5 font-semibold text-black">{group.itemName}</td>
                                <td className="px-3 py-2.5 text-slate-600">{group.category}</td>
                                <td className="px-3 py-2.5 text-slate-600">{group.subcategory}</td>
                                <td className="px-3 py-2.5 text-right text-slate-700">{Number(group.openingBalance || 0).toFixed(2)}</td>
                                <td className="px-3 py-2.5 text-right font-medium text-emerald-600">{totalReceived.toFixed(2)}</td>
                                <td className="px-3 py-2.5 text-right text-emerald-600">{totalReceivedAmt.toFixed(2)}</td>
                                <td className="px-3 py-2.5 text-right font-semibold text-rose-500">{totalIssued.toFixed(2)}</td>
                                <td className="px-3 py-2.5 text-right text-rose-500">{totalIssuedAmt.toFixed(2)}</td>
                                <td className="px-3 py-2.5 text-right font-bold text-blue-600">{remainingQty.toFixed(2)}</td>
                                <td className="px-3 py-2.5 text-right font-semibold text-blue-600">{remainingAmt.toFixed(2)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    /* ── Detail View ── */
                    <div className="space-y-4">
                      {(itemLedgerReport?.groups || []).map((group) => {
                        const rows = group.rows || [];
                        const totalRcvd = rows.reduce((s, r) => s + Number(r.receivedQuantity || 0), 0);
                        const totalIss = rows.reduce((s, r) => s + Number(r.issuanceQuantity || 0), 0);
                        const lastRow = rows[rows.length - 1];
                        const closingQty = lastRow ? Number(lastRow.remainingQuantity || 0) : Number(group.openingBalance || 0) + totalRcvd - totalIss;
                        return (
                          <div key={group.itemId} className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                            {/* Item header */}
                            <div className="px-4 py-3 bg-gradient-to-r from-slate-700 to-slate-600 flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <p className="font-semibold text-white text-sm">{group.itemName}</p>
                                <p className="text-xs text-slate-300 mt-0.5">{group.itemCode} · {group.category} / {group.subcategory}</p>
                              </div>
                              <div className="flex flex-wrap gap-3 text-xs">
                                <span className="bg-white/10 text-white rounded-lg px-2.5 py-1">Opening: <strong>{Number(group.openingBalance || 0).toFixed(2)} {group.baseUnit}</strong></span>
                                <span className="bg-emerald-500/20 text-emerald-200 rounded-lg px-2.5 py-1">Received: <strong>{totalRcvd.toFixed(2)}</strong></span>
                                <span className="bg-rose-500/20 text-rose-200 rounded-lg px-2.5 py-1">Issued: <strong>{totalIss.toFixed(2)}</strong></span>
                                <span className="bg-blue-500/20 text-blue-200 rounded-lg px-2.5 py-1">Closing: <strong>{closingQty.toFixed(2)}</strong></span>
                              </div>
                            </div>
                            {rows.length === 0 ? (
                              <div className="px-4 py-6 text-center text-sm text-slate-400 bg-white">No transactions in selected date range — opening stock only.</div>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs">
                                  <thead>
                                    <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                                      <th className="px-3 py-2 font-semibold uppercase tracking-wide">Date</th>
                                      <th className="px-3 py-2 font-semibold uppercase tracking-wide">Source</th>
                                      <th className="px-3 py-2 font-semibold uppercase tracking-wide">Ref No</th>
                                      <th className="px-3 py-2 font-semibold uppercase tracking-wide text-slate-600">Department</th>
                                      <th className="px-3 py-2 font-semibold uppercase tracking-wide text-right text-emerald-600 min-w-[72px]">Rcvd Qty</th>
                                      <th className="px-3 py-2 font-semibold uppercase tracking-wide text-right text-emerald-600 min-w-[60px]">Rate</th>
                                      <th className="px-3 py-2 font-semibold uppercase tracking-wide text-right text-emerald-600 min-w-[80px]">Rcvd Amt</th>
                                      <th className="px-3 py-2 font-semibold uppercase tracking-wide text-right text-rose-500 min-w-[72px]">Iss Qty</th>
                                      <th className="px-3 py-2 font-semibold uppercase tracking-wide text-right text-rose-500 min-w-[80px]">Iss Amt</th>
                                      <th className="px-3 py-2 font-semibold uppercase tracking-wide text-right text-blue-600 min-w-[72px]">Rem Qty</th>
                                      <th className="px-3 py-2 font-semibold uppercase tracking-wide text-right text-blue-600 min-w-[80px]">Rem Amt</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {rows.map((row, ridx) => {
                                      const isReceipt = Number(row.receivedQuantity || 0) > 0;
                                      const isIssue = Number(row.issuanceQuantity || 0) > 0;
                                      return (
                                        <tr key={row.key} className={`${ridx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'} hover:bg-blue-50/50 transition-colors`}>
                                          <td className="px-3 py-2 text-slate-600">{row.date ? new Date(row.date).toLocaleDateString('en-PK') : '—'}</td>
                                          <td className="px-3 py-2">
                                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${isReceipt ? 'bg-emerald-50 text-emerald-700' : isIssue ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>
                                              {row.sourceType || '—'}
                                            </span>
                                          </td>
                                          <td className="px-3 py-2 font-mono text-slate-500">{row.referenceNo || '—'}</td>
                                          <td className="px-3 py-2 text-slate-600">{row.departmentName || <span className="text-slate-300">—</span>}</td>
                                          <td className="px-3 py-2 text-right font-medium text-emerald-600">{isReceipt ? Number(row.receivedQuantity).toFixed(2) : <span className="text-slate-300">—</span>}</td>
                                          <td className="px-3 py-2 text-right text-slate-600">{isReceipt ? Number(row.receivedRate || 0).toFixed(2) : <span className="text-slate-300">—</span>}</td>
                                          <td className="px-3 py-2 text-right text-emerald-600">{isReceipt ? Number(row.receivedAmount || 0).toFixed(2) : <span className="text-slate-300">—</span>}</td>
                                          <td className="px-3 py-2 text-right font-semibold text-rose-500">{isIssue ? Number(row.issuanceQuantity).toFixed(2) : <span className="text-slate-300">—</span>}</td>
                                          <td className="px-3 py-2 text-right text-rose-500">{isIssue ? Number(row.issuanceAmount || 0).toFixed(2) : <span className="text-slate-300">—</span>}</td>
                                          <td className="px-3 py-2 text-right font-bold text-blue-600">{Number(row.remainingQuantity || 0).toFixed(2)}</td>
                                          <td className="px-3 py-2 text-right font-semibold text-blue-600">{Number(row.remainingAmount || 0).toFixed(2)}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                      <BarChart3 size={22} className="text-slate-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-500">No ledger entries found</p>
                    <p className="text-xs mt-1">Adjust filters and click Apply Filters</p>
                  </div>
                )}
                </>)}
              </div>
            ) : effectiveReport === 'Receiving Report' ? (
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
                    <SearchableSelect
                      options={masterOptions?.suppliers || []}
                      value={receivingFilters.supplierId}
                      onChange={(val) => updateReceivingFilter('supplierId', val)}
                      placeholder="All Suppliers"
                      getLabel={(opt) => `${opt.name} (${opt.code})`}
                      getKey={(opt) => opt.id}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Category</label>
                    <SearchableSelect
                      options={categoryOptions}
                      value={receivingFilters.categoryId}
                      onChange={(val) => updateReceivingFilter('categoryId', val)}
                      placeholder="All Categories"
                      getLabel={(opt) => `${opt.name} (${opt.code})`}
                      getKey={(opt) => opt.id}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Subcategory</label>
                    <SearchableSelect
                      options={receivingSubcategoryOptions}
                      value={receivingFilters.subcategoryId}
                      onChange={(val) => updateReceivingFilter('subcategoryId', val)}
                      placeholder="All Subcategories"
                      getLabel={(opt) => `${opt.name} (${opt.code})`}
                      getKey={(opt) => opt.id}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Item</label>
                    <SearchableSelect
                      options={receivingItemOptions}
                      value={receivingFilters.itemId}
                      onChange={(val) => updateReceivingFilter('itemId', val)}
                      placeholder="All Items"
                      getLabel={(opt) => `${opt.name} (${opt.code})`}
                      getKey={(opt) => opt.id}
                    />
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

                <div className="flex items-center gap-4">
                  <Button size="sm" label="Apply" onClick={applyReceivingFilters} />
                  <Button size="sm" variant="outline" label="Reset" onClick={resetReceivingFilters} />
                  <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={receivingSummary}
                      onChange={(e) => setReceivingSummary(e.target.checked)}
                      className="w-4 h-4 accent-blue-600"
                    />
                    Summary
                  </label>
                </div>

                {false && (<>
                {receivingRows.length > 0 ? (
                  receivingSummary ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                            <th className="px-4 py-3">Item Code</th>
                            <th className="px-4 py-3">Item</th>
                            <th className="px-4 py-3">Category</th>
                            <th className="px-4 py-3">Subcategory</th>
                            <th className="px-4 py-3">Total Qty</th>
                            <th className="px-4 py-3">Total Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {Object.values(
                            receivingRows.reduce((acc, row) => {
                              const key = row.itemCode;
                              if (!acc[key]) {
                                acc[key] = { itemCode: row.itemCode, item: row.item, category: row.category, subcategory: row.subcategory, totalQty: 0, totalAmount: 0 };
                              }
                              acc[key].totalQty += Number(row.quantity || 0);
                              acc[key].totalAmount += Number(row.amount || 0);
                              return acc;
                            }, {})
                          ).map((r) => (
                            <tr key={r.itemCode} className="hover:bg-slate-50">
                              <td className="px-4 py-3 text-xs">{r.itemCode}</td>
                              <td className="px-4 py-3 font-medium text-black">{r.item}</td>
                              <td className="px-4 py-3">{r.category}</td>
                              <td className="px-4 py-3">{r.subcategory}</td>
                              <td className="px-4 py-3 text-emerald-700 font-semibold">{r.totalQty.toFixed(2)}</td>
                              <td className="px-4 py-3 font-semibold text-black">{r.totalAmount.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
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
                          <th className="px-4 py-3">Manufacturer</th>
                          <th className="px-4 py-3">Model</th>
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
                              <td className="px-4 py-3">{formatDate(row.date)}</td>
                              <td className="px-4 py-3 font-medium text-black">{row.item}</td>
                              <td className="px-4 py-3">{row.itemCode}</td>
                              <td className="px-4 py-3">{row.category}</td>
                              <td className="px-4 py-3">{row.subcategory}</td>
                              <td className="px-4 py-3">{row.supplier}</td>
                              <td className="px-4 py-3 text-slate-500">{row.manufacturer || <span className="text-slate-300">—</span>}</td>
                              <td className="px-4 py-3 text-slate-500">{row.model || <span className="text-slate-300">—</span>}</td>
                              <td className="px-4 py-3">{row.quantity}</td>
                              <td className="px-4 py-3">{row.rate.toFixed(2)}</td>
                              <td className="px-4 py-3 font-semibold text-black">{row.amount.toFixed(2)}</td>
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
                                      manufacturer: rawGRN.manufacturer || '',
                                      model: rawGRN.model || '',
                                    }],
                                    printedBy: getPrintedBy(),
                                    generatedAt: getGeneratedAt(),
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
                  )
                ) : (
                  <div className="text-center text-slate-400 py-10">No receiving entries found for selected filters.</div>
                )}
                </>)}
              </div>
            ) : effectiveReport === 'Issuance Report' ? (
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
                    <label className="text-xs text-slate-500 block mb-1">Admission #</label>
                    <div className="flex gap-1">
                      <input
                        type="text"
                        className="w-full min-w-0 rounded-md border border-slate-300 px-3 py-2 text-sm"
                        placeholder="All Patients"
                        value={issuanceFilters.admissionNumber}
                        onChange={(e) => updateIssuanceFilter('admissionNumber', e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') applyIssuanceFilters(); }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowIssuanceAdmPicker(true)}
                        className="shrink-0 rounded-md border border-slate-300 px-2 text-xs text-slate-600 hover:bg-slate-50"
                        title="Browse admitted patients"
                      >
                        ···
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Patient Type</label>
                    <select
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={issuanceFilters.patientType}
                      onChange={(e) => updateIssuanceFilter('patientType', e.target.value)}
                    >
                      <option value="">All (sab issuance)</option>
                      <option value="admission">All Admitted (Cash + Panel)</option>
                      <option value="cash">Cash Patients</option>
                      <option value="panel">Panel Patients</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Department</label>
                    <SearchableSelect
                      options={masterOptions?.departments || []}
                      value={issuanceFilters.departmentId}
                      onChange={(val) => updateIssuanceFilter('departmentId', val)}
                      placeholder="All Departments"
                      getLabel={(opt) => `${opt.name} (${opt.code})`}
                      getKey={(opt) => opt.id}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Category</label>
                    <SearchableSelect
                      options={categoryOptions}
                      value={issuanceFilters.categoryId}
                      onChange={(val) => updateIssuanceFilter('categoryId', val)}
                      placeholder="All Categories"
                      getLabel={(opt) => `${opt.name} (${opt.code})`}
                      getKey={(opt) => opt.id}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Subcategory</label>
                    <SearchableSelect
                      options={issuanceSubcategoryOptions}
                      value={issuanceFilters.subcategoryId}
                      onChange={(val) => updateIssuanceFilter('subcategoryId', val)}
                      placeholder="All Subcategories"
                      getLabel={(opt) => `${opt.name} (${opt.code})`}
                      getKey={(opt) => opt.id}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Item</label>
                    <SearchableSelect
                      options={issuanceItemOptions}
                      value={issuanceFilters.itemId}
                      onChange={(val) => updateIssuanceFilter('itemId', val)}
                      placeholder="All Items"
                      getLabel={(opt) => `${opt.name} (${opt.code})`}
                      getKey={(opt) => opt.id}
                    />
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
                  {issuanceFilters.assetType === 'fixed asset' && (
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">Location</label>
                      <SearchableSelect
                        options={fixedAssetLocationOptions}
                        value={issuanceFilters.location}
                        onChange={(val) => updateIssuanceFilter('location', val)}
                        placeholder="All Locations"
                      />
                    </div>
                  )}
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Issued To</label>
                    <SearchableSelect
                      options={employees || []}
                      value={issuanceFilters.issuedById}
                      onChange={(val) => updateIssuanceFilter('issuedById', val)}
                      placeholder="All Employees"
                      getLabel={(emp) => `${emp.firstName} ${emp.lastName} ${emp.email || emp.empCode || ''}`}
                      getKey={(emp) => emp.id}
                      renderOption={(emp) => {
                        const initials = `${(emp.firstName || '')[0] || ''}${(emp.lastName || '')[0] || ''}`.toUpperCase();
                        const colors = ['bg-pink-200 text-pink-700', 'bg-blue-200 text-blue-700', 'bg-green-200 text-green-700', 'bg-amber-200 text-amber-700', 'bg-purple-200 text-purple-700', 'bg-teal-200 text-teal-700'];
                        const color = colors[emp.id % colors.length];
                        return (
                          <div className="flex items-center gap-3 py-0.5">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${color}`}>{initials}</div>
                            <div className="min-w-0">
                              <p className="font-semibold text-black text-sm leading-tight">{emp.firstName} {emp.lastName}</p>
                              <p className="text-xs text-slate-400 truncate">{emp.email || emp.empCode || ''}</p>
                            </div>
                          </div>
                        );
                      }}
                      renderSelected={(emp) => {
                        const initials = `${(emp.firstName || '')[0] || ''}${(emp.lastName || '')[0] || ''}`.toUpperCase();
                        const colors = ['bg-pink-200 text-pink-700', 'bg-blue-200 text-blue-700', 'bg-green-200 text-green-700', 'bg-amber-200 text-amber-700', 'bg-purple-200 text-purple-700', 'bg-teal-200 text-teal-700'];
                        const color = colors[emp.id % colors.length];
                        return (
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${color}`}>{initials}</div>
                            <span className="text-slate-900 text-sm">{emp.firstName} {emp.lastName}</span>
                          </div>
                        );
                      }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <Button size="sm" label="Apply" onClick={applyIssuanceFilters} />
                  <Button size="sm" variant="outline" label="Reset" onClick={resetIssuanceFilters} />
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    View
                    <select
                      className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      value={issuanceView}
                      onChange={(e) => setIssuanceView(e.target.value)}
                    >
                      <option value="details">Details</option>
                      <option value="item">Summary — Item-wise</option>
                      <option value="patient">Summary — Patient-wise (Cash / Panel)</option>
                      <option value="patientItem">Summary — Patient + Item-wise</option>
                    </select>
                  </label>
                </div>

                {false && (<>
                {issuanceRows.length > 0 ? (
                  issuanceSummary ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                            <th className="px-4 py-3">Item Code</th>
                            <th className="px-4 py-3">Item</th>
                            <th className="px-4 py-3">Category</th>
                            <th className="px-4 py-3">Subcategory</th>
                            <th className="px-4 py-3">Total Issued Qty</th>
                            <th className="px-4 py-3">Total Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {Object.values(
                            issuanceRows.reduce((acc, row) => {
                              const key = row.itemCode;
                              if (!acc[key]) {
                                acc[key] = { itemCode: row.itemCode, item: row.item, category: row.category, subcategory: row.subcategory, totalQty: 0, totalAmount: 0 };
                              }
                              acc[key].totalQty += Number(row.quantity || 0);
                              acc[key].totalAmount += Number(row.amount || 0);
                              return acc;
                            }, {})
                          ).map((r) => (
                            <tr key={r.itemCode} className="hover:bg-slate-50">
                              <td className="px-4 py-3 text-xs">{r.itemCode}</td>
                              <td className="px-4 py-3 font-medium text-black">{r.item}</td>
                              <td className="px-4 py-3">{r.category}</td>
                              <td className="px-4 py-3">{r.subcategory}</td>
                              <td className="px-4 py-3 text-rose-700 font-semibold">{r.totalQty.toFixed(2)}</td>
                              <td className="px-4 py-3 font-semibold text-blue-700">{r.totalAmount.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                          <th className="px-4 py-3">GIN Code</th>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Item</th>
                          <th className="px-4 py-3">Item Code</th>
                          <th className="px-4 py-3">Category</th>
                          <th className="px-4 py-3">Subcategory</th>
                          <th className="px-4 py-3">Department</th>
                          <th className="px-4 py-3">Issued Qty</th>
                          <th className="px-4 py-3">Rate</th>
                          <th className="px-4 py-3">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {issuanceRows.map((row) => (
                          <tr key={row.key}>
                            <td className="px-4 py-3 text-slate-500 text-xs">{row.ginCode || '-'}</td>
                            <td className="px-4 py-3">{formatDate(row.date)}</td>
                            <td className="px-4 py-3 font-medium text-black">{row.item}</td>
                            <td className="px-4 py-3">{row.itemCode}</td>
                            <td className="px-4 py-3">{row.category}</td>
                            <td className="px-4 py-3">{row.subcategory}</td>
                            <td className="px-4 py-3">{row.department}</td>
                            <td className="px-4 py-3 font-semibold text-black">{row.quantity}</td>
                            <td className="px-4 py-3 text-slate-600">{Number(row.rate || 0).toFixed(2)}</td>
                            <td className="px-4 py-3 font-semibold text-blue-700">{Number(row.amount || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  )
                ) : (
                  <div className="text-center text-slate-400 py-10">No issuance entries found for selected filters.</div>
                )}
                </>)}
              </div>
            ) : effectiveReport === 'Short Expiry' ? (
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
                    <SearchableSelect
                      options={categoryOptions}
                      value={shortExpiryFilters.categoryId}
                      onChange={(val) => updateShortExpiryFilter('categoryId', val)}
                      placeholder="All Categories"
                      getLabel={(opt) => `${opt.name} (${opt.code})`}
                      getKey={(opt) => opt.id}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Subcategory</label>
                    <SearchableSelect
                      options={shortExpirySubcategoryOptions}
                      value={shortExpiryFilters.subcategoryId}
                      onChange={(val) => updateShortExpiryFilter('subcategoryId', val)}
                      placeholder="All Subcategories"
                      getLabel={(opt) => `${opt.name} (${opt.code})`}
                      getKey={(opt) => opt.id}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Item</label>
                    <SearchableSelect
                      options={shortExpiryItemOptions}
                      value={shortExpiryFilters.itemId}
                      onChange={(val) => updateShortExpiryFilter('itemId', val)}
                      placeholder="All Expiry Items"
                      getLabel={(opt) => `${opt.name} (${opt.code})`}
                      getKey={(opt) => opt.id}
                    />
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

                {false && (<>
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
                            <td className="px-4 py-3">{formatDate(row.date)}</td>
                            <td className="px-4 py-3 font-medium text-black">{row.item}</td>
                            <td className="px-4 py-3">{row.itemCode}</td>
                            <td className="px-4 py-3">{row.category}</td>
                            <td className="px-4 py-3">{row.subcategory}</td>
                            <td className="px-4 py-3 font-semibold text-black">{Number(row.quantity || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center text-slate-400 py-10">No short-expiry entries found for selected filters.</div>
                )}
                </>)}
              </div>
            ) : effectiveReport === 'Expiry' ? (
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
                    <SearchableSelect
                      options={categoryOptions}
                      value={expiryFilters.categoryId}
                      onChange={(val) => updateExpiryFilter('categoryId', val)}
                      placeholder="All Categories"
                      getLabel={(opt) => `${opt.name} (${opt.code})`}
                      getKey={(opt) => opt.id}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Subcategory</label>
                    <SearchableSelect
                      options={expirySubcategoryOptions}
                      value={expiryFilters.subcategoryId}
                      onChange={(val) => updateExpiryFilter('subcategoryId', val)}
                      placeholder="All Subcategories"
                      getLabel={(opt) => `${opt.name} (${opt.code})`}
                      getKey={(opt) => opt.id}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Item</label>
                    <SearchableSelect
                      options={expiryItemOptions}
                      value={expiryFilters.itemId}
                      onChange={(val) => updateExpiryFilter('itemId', val)}
                      placeholder="All Expiry Items"
                      getLabel={(opt) => `${opt.name} (${opt.code})`}
                      getKey={(opt) => opt.id}
                    />
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

                {false && (<>
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
                              {formatDate(row.expiryDate)}
                            </td>
                            <td className="px-4 py-3 font-medium text-black">{row.item}</td>
                            <td className="px-4 py-3">{row.itemCode}</td>
                            <td className="px-4 py-3">{row.category}</td>
                            <td className="px-4 py-3">{row.subcategory}</td>
                            <td className="px-4 py-3 font-semibold text-black">{Number(row.quantity || 0).toFixed(2)}</td>
                            <td className="px-4 py-3">{row.referenceId}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center text-slate-400 py-10">No expired items found for selected filters.</div>
                )}
                </>)}
              </div>
            ) : effectiveReport === 'GD Report' ? (
              <div className="p-4 space-y-4 overflow-y-auto">
                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Date From</label>
                    <input type="date" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={gdFilters.dateFrom} onChange={(e) => updateGdFilter('dateFrom', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Date To</label>
                    <input type="date" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={gdFilters.dateTo} onChange={(e) => updateGdFilter('dateTo', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Department</label>
                    <SearchableSelect options={masterOptions?.departments || []} value={gdFilters.departmentId}
                      onChange={(val) => updateGdFilter('departmentId', val)} placeholder="All Departments"
                      getLabel={(opt) => opt.name} getKey={(opt) => opt.id} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Category</label>
                    <SearchableSelect options={categoryOptions} value={gdFilters.categoryId}
                      onChange={(val) => updateGdFilter('categoryId', val)} placeholder="All Categories"
                      getLabel={(opt) => opt.name} getKey={(opt) => opt.id} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Subcategory</label>
                    <SearchableSelect options={gdSubcategoryOptions} value={gdFilters.subcategoryId}
                      onChange={(val) => updateGdFilter('subcategoryId', val)} placeholder="All Subcategories"
                      getLabel={(opt) => opt.name} getKey={(opt) => opt.id} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Item</label>
                    <SearchableSelect options={gdItemOptions} value={gdFilters.itemId}
                      onChange={(val) => updateGdFilter('itemId', val)} placeholder="All Items" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Status</label>
                    <select className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={gdFilters.status} onChange={(e) => updateGdFilter('status', e.target.value)}>
                      <option value="">All Statuses</option>
                      <option value="open">Open</option>
                      <option value="partial">Partial</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Location</label>
                    <SearchableSelect options={fixedAssetLocationOptions} value={gdFilters.location}
                      onChange={(val) => updateGdFilter('location', val)} placeholder="All Locations" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" label="Apply" onClick={applyGdFilters} />
                  <Button size="sm" variant="outline" label="Reset" onClick={resetGdFilters} />
                </div>

              </div>
            ) : effectiveReport === 'Discard Report' ? (
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
                    <SearchableSelect
                      options={categoryOptions}
                      value={discardFilters.categoryId}
                      onChange={(val) => updateDiscardFilter('categoryId', val)}
                      placeholder="All Categories"
                      getLabel={(opt) => `${opt.name} (${opt.code})`}
                      getKey={(opt) => opt.id}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Subcategory</label>
                    <SearchableSelect
                      options={discardSubcategoryOptions}
                      value={discardFilters.subcategoryId}
                      onChange={(val) => updateDiscardFilter('subcategoryId', val)}
                      placeholder="All Subcategories"
                      getLabel={(opt) => `${opt.name} (${opt.code})`}
                      getKey={(opt) => opt.id}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Item</label>
                    <SearchableSelect
                      options={discardItemOptions}
                      value={discardFilters.itemId}
                      onChange={(val) => updateDiscardFilter('itemId', val)}
                      placeholder="All Items"
                      getLabel={(opt) => `${opt.name} (${opt.code})`}
                      getKey={(opt) => opt.id}
                    />
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
                  {discardFilters.assetType === 'fixed asset' && (
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">Location</label>
                      <SearchableSelect
                        options={fixedAssetLocationOptions}
                        value={discardFilters.location}
                        onChange={(val) => updateDiscardFilter('location', val)}
                        placeholder="All Locations"
                      />
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button size="sm" label="Apply" onClick={applyDiscardFilters} />
                  <Button size="sm" variant="outline" label="Reset" onClick={resetDiscardFilters} />
                </div>

                {false && (<>
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
                            <td className="px-4 py-3">{formatDate(row.date)}</td>
                            <td className="px-4 py-3 font-medium text-black">{row.item}</td>
                            <td className="px-4 py-3">{row.itemCode}</td>
                            <td className="px-4 py-3">{row.category}</td>
                            <td className="px-4 py-3">{row.subcategory}</td>
                            <td className="px-4 py-3">{Number(row.quantity || 0).toFixed(2)}</td>
                            <td className="px-4 py-3 font-semibold text-black">{Number(row.amount || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center text-slate-400 py-10">No discard entries found for selected filters.</div>
                )}
                </>)}
              </div>
            ) : effectiveReport === 'Repairing Report' ? (
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
                    <SearchableSelect
                      options={masterOptions?.suppliers || []}
                      value={repairingFilters.supplierId}
                      onChange={(val) => updateRepairingFilter('supplierId', val)}
                      placeholder="All Suppliers"
                      getLabel={(opt) => `${opt.name} (${opt.code})`}
                      getKey={(opt) => opt.id}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Category</label>
                    <SearchableSelect
                      options={categoryOptions}
                      value={repairingFilters.categoryId}
                      onChange={(val) => updateRepairingFilter('categoryId', val)}
                      placeholder="All Categories"
                      getLabel={(opt) => `${opt.name} (${opt.code})`}
                      getKey={(opt) => opt.id}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Subcategory</label>
                    <SearchableSelect
                      options={repairingSubcategoryOptions}
                      value={repairingFilters.subcategoryId}
                      onChange={(val) => updateRepairingFilter('subcategoryId', val)}
                      placeholder="All Subcategories"
                      getLabel={(opt) => `${opt.name} (${opt.code})`}
                      getKey={(opt) => opt.id}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Item</label>
                    <SearchableSelect
                      options={repairingItemOptions}
                      value={repairingFilters.itemId}
                      onChange={(val) => updateRepairingFilter('itemId', val)}
                      placeholder="All Items"
                      getLabel={(opt) => `${opt.name} (${opt.code})`}
                      getKey={(opt) => opt.id}
                    />
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
                {/* No on-screen report detail here by design — Export CSV /
                    Export PDF / Print (top toolbar) are the only output. */}
              </div>
            ) : effectiveReport === 'Daily Sales' ? (
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
                    <SearchableSelect
                      options={categoryOptions}
                      value={dailySalesFilters.categoryId}
                      onChange={(val) => updateDailySalesFilter('categoryId', val)}
                      placeholder="All Categories"
                      getLabel={(opt) => `${opt.name} (${opt.code})`}
                      getKey={(opt) => opt.id}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Subcategory</label>
                    <SearchableSelect
                      options={dailySalesSubcategoryOptions}
                      value={dailySalesFilters.subcategoryId}
                      onChange={(val) => updateDailySalesFilter('subcategoryId', val)}
                      placeholder="All Subcategories"
                      getLabel={(opt) => `${opt.name} (${opt.code})`}
                      getKey={(opt) => opt.id}
                    />
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
                <div className="flex items-center gap-4">
                  <Button size="sm" label="Apply" onClick={applyDailySalesFilters} />
                  <Button size="sm" variant="outline" label="Reset" onClick={resetDailySalesFilters} />
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={dailySalesFilters.admissionOnly}
                      onChange={(e) => {
                        const newFilters = { ...dailySalesFilters, admissionOnly: e.target.checked };
                        setDailySalesFilters(newFilters);
                        fetchDailySalesReport(newFilters).catch((err) => toast.error(err.message || 'Failed to load'));
                      }}
                      className="w-4 h-4 accent-blue-600"
                    />
                    Admission Only
                  </label>
                </div>

                {false && (<>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <Card className="p-3">
                    <p className="text-xs text-slate-500">Invoices</p>
                    <p className="text-lg font-semibold text-black">{dailySalesReport?.summary?.invoiceCount || 0}</p>
                  </Card>
                  <Card className="p-3">
                    <p className="text-xs text-slate-500">Total Qty</p>
                    <p className="text-lg font-semibold text-black">{Number(dailySalesReport?.summary?.grandTotalQty || 0).toFixed(2)}</p>
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
                            <p className="font-semibold text-black">{inv.invoiceCode}</p>
                            <p className="text-xs text-slate-500">
                              {formatDate(inv.invoiceDate)} • {inv.customerName}
                            </p>
                          </div>
                          <div className="text-right text-xs text-slate-500">
                            <p>Retail: <span className="font-semibold text-emerald-700">{Number(inv.subtotalRetail || 0).toFixed(2)}</span></p>
                            <p>Profit: <span className="font-semibold text-blue-700">{Number(inv.subtotalProfit || 0).toFixed(2)}</span></p>
                          </div>
                        </div>
                        <div className="overflow-x-auto">
                          {dailySalesFilters.admissionOnly ? (
                            <table className="w-full text-left border-collapse text-sm">
                              <thead>
                                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                                  <th className="px-4 py-2">Item</th>
                                  <th className="px-4 py-2">Category</th>
                                  <th className="px-4 py-2">Subcategory</th>
                                  <th className="px-4 py-2">Qty</th>
                                  <th className="px-4 py-2 text-right">Rate</th>
                                  <th className="px-4 py-2 text-right">Amount</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {(inv.lines || []).map((line, idx) => (
                                  <tr key={idx} className="hover:bg-slate-50">
                                    <td className="px-4 py-2 font-medium text-black">{line.itemName} <span className="text-xs text-slate-400">({line.itemCode})</span></td>
                                    <td className="px-4 py-2 text-xs">{line.category}</td>
                                    <td className="px-4 py-2 text-xs">{line.subcategory}</td>
                                    <td className="px-4 py-2">{line.qty}</td>
                                    <td className="px-4 py-2 text-right">{Number(line.saleRate).toFixed(2)}</td>
                                    <td className="px-4 py-2 text-right font-semibold">{Number(line.totalRetail).toFixed(2)}</td>
                                  </tr>
                                ))}
                                <tr className="bg-slate-50 text-xs font-semibold border-t border-slate-200">
                                  <td colSpan={4} className="px-4 py-2 text-right text-slate-500">Total</td>
                                  <td />
                                  <td className="px-4 py-2 text-right">{Number(inv.subtotalRetail || 0).toFixed(2)}</td>
                                </tr>
                              </tbody>
                            </table>
                          ) : (
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
                                    <td className="px-4 py-2 font-medium text-black">{line.itemName} <span className="text-xs text-slate-400">({line.itemCode})</span></td>
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
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-slate-400 py-10">No sales found for selected filters.</div>
                )}
                </>)}
              </div>
            ) : effectiveReport === 'Supplier Ledger' ? (
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
                  <div className="relative">
                    <label className="text-xs text-slate-500 block mb-1">Supplier Name</label>
                    <input
                      ref={supplierSearchRef}
                      type="text"
                      placeholder="Search supplier..."
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={supplierLedgerFilters.supplierName}
                      onChange={(e) => { updateSupplierLedgerFilter('supplierName', e.target.value); setSupplierDropdownOpen(true); if (supplierSearchRef.current) setSupplierDropdownRect(supplierSearchRef.current.getBoundingClientRect()); }}
                      onFocus={() => { setSupplierDropdownOpen(true); if (supplierSearchRef.current) setSupplierDropdownRect(supplierSearchRef.current.getBoundingClientRect()); }}
                      onBlur={() => setTimeout(() => setSupplierDropdownOpen(false), 150)}
                    />
                    {supplierDropdownOpen && supplierDropdownRect && (() => {
                      const q = supplierLedgerFilters.supplierName.trim().toLowerCase();
                      const filtered = (masterOptions?.suppliers || []).filter((s) => !q || s.name.toLowerCase().includes(q)).slice(0, 30);
                      if (!filtered.length) return null;
                      return createPortal(
                        <div
                          style={{
                            position: 'fixed',
                            left: supplierDropdownRect.left,
                            width: supplierDropdownRect.width,
                            zIndex: 9999,
                            ...(window.innerHeight - supplierDropdownRect.bottom < 244
                              ? { bottom: window.innerHeight - supplierDropdownRect.top + 4 }
                              : { top: supplierDropdownRect.bottom + 4 }),
                          }}
                          className="bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto"
                        >
                          {filtered.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onMouseDown={() => { updateSupplierLedgerFilter('supplierName', s.name); setSupplierDropdownOpen(false); }}
                              className="w-full text-left px-4 py-2 text-sm border-b border-slate-100 last:border-0 hover:bg-slate-50"
                            >
                              {s.name}
                            </button>
                          ))}
                        </div>,
                        document.body
                      );
                    })()}
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Category</label>
                    <SearchableSelect
                      options={categoryOptions}
                      value={supplierLedgerFilters.categoryId}
                      onChange={(val) => updateSupplierLedgerFilter('categoryId', val)}
                      placeholder="All Categories"
                      getLabel={(opt) => opt.name}
                      getKey={(opt) => opt.id}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Subcategory</label>
                    <SearchableSelect
                      options={supplierLedgerSubcategoryOptions}
                      value={supplierLedgerFilters.subcategoryId}
                      onChange={(val) => updateSupplierLedgerFilter('subcategoryId', val)}
                      placeholder="All Subcategories"
                      getLabel={(opt) => opt.name}
                      getKey={(opt) => opt.id}
                    />
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

                {false && (<>
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Card className="p-3">
                    <p className="text-xs text-slate-500">Total Records</p>
                    <p className="text-lg font-semibold text-black">{supplierLedgerReport?.summary?.totalRecords || 0}</p>
                  </Card>
                  <Card className="p-3">
                    <p className="text-xs text-slate-500">Total GRN Value</p>
                    <p className="text-lg font-semibold text-blue-700">Rs. {Number(supplierLedgerReport?.summary?.totalGrnValue || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}</p>
                  </Card>
                </div>

                {/* Grouped Cards */}
                {supplierGroups.length > 0 ? (
                  <div className="space-y-4">
                    {supplierGroups.map((group) => (
                      <Card key={group.supplierName} className="p-0 overflow-hidden">
                        {/* Card Header — Supplier Name + Summary */}
                        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-black">{group.supplierName}</p>
                            <p className="text-xs text-slate-500">
                              Records: {group.totalRecords} • Total: Rs. {Number(group.totalAmount).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                        </div>
                        {/* Table inside Card */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-sm">
                            <thead>
                              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                                <th className="px-4 py-3 min-w-[100px]">Date</th>
                                <th className="px-4 py-3 min-w-[140px]">Item</th>
                                <th className="px-4 py-3 min-w-[100px]">Category</th>
                                <th className="px-4 py-3 min-w-[100px]">Subcategory</th>
                                <th className="px-4 py-3 min-w-[100px]">Asset Type</th>
                                <th className="px-4 py-3 min-w-[70px] text-right">Qty</th>
                                <th className="px-4 py-3 min-w-[100px] text-right">GRN Price</th>
                                <th className="px-4 py-3 min-w-[110px] text-right">Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {group.rows.map((row) => (
                                <tr key={row.grnId} className="hover:bg-slate-50">
                                  <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                                    {formatDate(row.date)}
                                  </td>
                                  <td className="px-4 py-3 text-xs">
                                    <div className="font-medium text-black">{row.itemName}</div>
                                    <div className="text-slate-400">{row.itemCode}</div>
                                  </td>
                                  <td className="px-4 py-3 text-xs text-slate-600">{row.categoryName}</td>
                                  <td className="px-4 py-3 text-xs text-slate-600">{row.subcategoryName}</td>
                                  <td className="px-4 py-3 text-xs">
                                    <span className={`px-2 py-0.5 rounded-full font-medium ${
                                      row.itemType === 'fixed asset'
                                        ? 'bg-purple-50 text-purple-700'
                                        : 'bg-blue-50 text-blue-700'
                                    }`}>
                                      {row.itemType}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-xs text-right text-emerald-700 font-semibold">{row.receivedQuantity}</td>
                                  <td className="px-4 py-3 text-xs text-right text-slate-600">Rs. {Number(row.grnPrice).toLocaleString()}</td>
                                  <td className="px-4 py-3 text-xs text-right font-semibold text-blue-700">Rs. {Number(row.totalAmount).toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="bg-slate-50 border-t border-slate-200 font-semibold text-xs">
                                <td colSpan={7} className="px-4 py-2 text-right text-slate-600">Supplier Total</td>
                                <td className="px-4 py-2 text-right text-blue-700">
                                  Rs. {Number(group.totalAmount).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-slate-400 py-10">No GRN records found for selected filters.</div>
                )}
                </>)}
              </div>
            ) : effectiveReport === 'Item List' ? (
              <div className="p-4 space-y-4 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Date From</label>
                    <input
                      type="date"
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={itemListFilters.dateFrom}
                      onChange={(e) => setItemListFilters((p) => ({ ...p, dateFrom: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Date To</label>
                    <input
                      type="date"
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={itemListFilters.dateTo}
                      onChange={(e) => setItemListFilters((p) => ({ ...p, dateTo: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Item Code / Name</label>
                    <input
                      type="text"
                      placeholder="Search code or name..."
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={itemListFilters.itemCode}
                      onChange={(e) => setItemListFilters((p) => ({ ...p, itemCode: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Category</label>
                    <SearchableSelect
                      options={categoryOptions}
                      value={itemListFilters.categoryId}
                      onChange={(val) => setItemListFilters((p) => ({ ...p, categoryId: val, subcategoryId: '' }))}
                      placeholder="All Categories"
                      getLabel={(opt) => opt.name}
                      getKey={(opt) => opt.id}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Subcategory</label>
                    <SearchableSelect
                      options={itemListSubcategoryOptions}
                      value={itemListFilters.subcategoryId}
                      onChange={(val) => setItemListFilters((p) => ({ ...p, subcategoryId: val }))}
                      placeholder="All Subcategories"
                      getLabel={(opt) => opt.name}
                      getKey={(opt) => opt.id}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Asset Type</label>
                    <select
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={itemListFilters.assetType}
                      onChange={(e) => setItemListFilters((p) => ({ ...p, assetType: e.target.value }))}
                    >
                      <option value="">All Types</option>
                      <option value="current asset">Current Asset</option>
                      <option value="fixed asset">Fixed Asset</option>
                    </select>
                  </div>
                  {itemListFilters.assetType === 'fixed asset' && (
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">Location</label>
                      <SearchableSelect
                        options={fixedAssetLocationOptions}
                        value={itemListFilters.location}
                        onChange={(val) => setItemListFilters((p) => ({ ...p, location: val }))}
                        placeholder="All Locations"
                      />
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" label="Apply" onClick={() => setPendingPrint(true)} />
                  <Button size="sm" variant="outline" label="Reset" onClick={() => setItemListFilters({ assetType: '', dateFrom: '', dateTo: '', itemCode: '', categoryId: '', subcategoryId: '', location: '' })} />
                </div>
                {false && (<>
                {reportRows.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                          <th className="px-4 py-3">Code</th>
                          <th className="px-4 py-3">Name</th>
                          <th className="px-4 py-3">Category</th>
                          <th className="px-4 py-3">Subcategory</th>
                          <th className="px-4 py-3">Unit</th>
                          <th className="px-4 py-3">Storage/Shelf</th>
                          <th className="px-4 py-3">Reorder Level</th>
                          <th className="px-4 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {reportRows.map((row) => (
                          <tr key={row.key}>
                            <td className="px-4 py-3">{row.code}</td>
                            <td className="px-4 py-3 font-medium text-black">{row.name}</td>
                            <td className="px-4 py-3">{row.category}</td>
                            <td className="px-4 py-3">{row.subcategory}</td>
                            <td className="px-4 py-3">{row.unit}</td>
                            <td className="px-4 py-3">{row.storage}</td>
                            <td className="px-4 py-3">{row.reorderLevel}</td>
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
                      <p>No items found for selected filters.</p>
                    </div>
                  </div>
                )}
                </>)}
              </div>
            ) : effectiveReport === 'Purchase Order Report' ? (
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
                    <SearchableSelect
                      options={masterOptions?.suppliers || []}
                      value={poFilters.supplierId}
                      onChange={(val) => setPoFilters((p) => ({ ...p, supplierId: val }))}
                      placeholder="All Suppliers"
                      getLabel={(opt) => opt.name}
                      getKey={(opt) => opt.id}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Item</label>
                    <SearchableSelect
                      options={items || []}
                      value={poFilters.itemId}
                      onChange={(val) => setPoFilters((p) => ({ ...p, itemId: val }))}
                      placeholder="All Items"
                      getLabel={(opt) => opt.name}
                      getKey={(opt) => opt.id}
                    />
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
                  <Button size="sm" label="Apply" onClick={() => setPendingPrint(true)} />
                  <Button size="sm" variant="outline" label="Reset" onClick={() => setPoFilters({ status: '', supplierId: '', itemId: '', dateFrom: '', dateTo: '', assetType: '' })} />
                </div>

                {false && (<>
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
                          <th className="px-4 py-3">PO Date</th>
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
                              <td className="px-4 py-3 font-medium text-black">{row.code}</td>
                              <td className="px-4 py-3">{row.supplier}</td>
                              <td className="px-4 py-3">{row.item}</td>
                              <td className="px-4 py-3">{row.requiredQuantity}</td>
                              <td className="px-4 py-3">{row.orderedRate !== '-' ? Number(row.orderedRate).toLocaleString() : '-'}</td>
                              <td className="px-4 py-3">{formatDate(row.poDate)}</td>
                              <td className="px-4 py-3">{formatDate(row.expectedDate)}</td>
                              <td className="px-4 py-3 capitalize">{row.status}</td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => rawPO && printPODocument(rawPO, { printedBy: getPrintedBy(), generatedAt: getGeneratedAt() })}
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
                </>)}
              </div>
            ) : (
              <div className="p-4 space-y-4 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Date From</label>
                    <input
                      type="date"
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={reorderFilters.dateFrom}
                      onChange={(e) => setReorderFilters((p) => ({ ...p, dateFrom: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Date To</label>
                    <input
                      type="date"
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={reorderFilters.dateTo}
                      onChange={(e) => setReorderFilters((p) => ({ ...p, dateTo: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Item Code</label>
                    <input
                      type="text"
                      placeholder="Search code..."
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={reorderFilters.itemCode}
                      onChange={(e) => setReorderFilters((p) => ({ ...p, itemCode: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Category</label>
                    <SearchableSelect
                      options={categoryOptions}
                      value={reorderFilters.categoryId}
                      onChange={(val) => setReorderFilters((p) => ({ ...p, categoryId: val, subcategoryId: '' }))}
                      placeholder="All Categories"
                      getLabel={(opt) => opt.name}
                      getKey={(opt) => opt.id}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Subcategory</label>
                    <SearchableSelect
                      options={reorderSubcategoryOptions}
                      value={reorderFilters.subcategoryId}
                      onChange={(val) => setReorderFilters((p) => ({ ...p, subcategoryId: val }))}
                      placeholder="All Subcategories"
                      getLabel={(opt) => opt.name}
                      getKey={(opt) => opt.id}
                    />
                  </div>
                  <div>
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
                  {reorderFilters.assetType === 'fixed asset' && (
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">Location</label>
                      <SearchableSelect
                        options={fixedAssetLocationOptions}
                        value={reorderFilters.location}
                        onChange={(val) => setReorderFilters((p) => ({ ...p, location: val }))}
                        placeholder="All Locations"
                      />
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" label="Apply" onClick={() => setPendingPrint(true)} />
                  <Button size="sm" variant="outline" label="Reset" onClick={() => setReorderFilters({ assetType: '', dateFrom: '', dateTo: '', itemCode: '', categoryId: '', subcategoryId: '', location: '' })} />
                </div>
                {false && (<>
                {reportRows.length > 0 ? (
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
                            <td className="px-4 py-3 font-medium text-black">{row.name}</td>
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
                      <p>No data found for Reorder Report.</p>
                    </div>
                  </div>
                )}
                </>)}
              </div>
            )}
          </Card>
        </div>
      </div>

      {showIssuanceAdmPicker && (
        <AdmissionPickerModal
          onSelect={(r) => {
            setShowIssuanceAdmPicker(false);
            const next = { ...issuanceFilters, admissionNumber: r.admissionNo };
            setIssuanceFilters(next);
            fetchGINs(next).then(() => setPendingPrint(true)).catch((err) => toast.error(err.message || 'Failed to load issuance report'));
          }}
          onClose={() => setShowIssuanceAdmPicker(false)}
        />
      )}
    </div>
  );
}
