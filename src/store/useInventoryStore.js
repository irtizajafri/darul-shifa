import { create } from 'zustand';

const API_URL = 'http://localhost:5001/api/inventory';

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.ok === false) {
    throw new Error(json?.message || `Request failed (${res.status})`);
  }

  return json?.data;
}

export const useInventoryStore = create((set) => ({
  loading: false,
  error: null,
  categories: [],
  subcategories: [],
  suppliers: [],
  storages: [],
  departments: [],
  demandCategoryTypes: [],
  items: [],
  purchaseOrders: [],
  grns: [],
  gds: [],
  gins: [],
  salesInvoices: [],
  gdns: [],
  reorderAlerts: [],
  itemLedgerReport: {
    rows: [],
    groups: [],
    summary: {
      itemCount: 0,
      openingBalance: 0,
      totalReceived: 0,
      totalIssued: 0,
      closingBalance: 0,
    },
  },
  stockPositionReport: {
    rows: [],
    total: {
      itemCount: 0,
      totalQuantity: 0,
      totalAmount: 0,
    },
  },
  shortExpiryReportRows: [],
  masterOptions: {
    categories: [],
    subcategories: [],
    suppliers: [],
    storages: [],
    departments: [],
    demandCategoryTypes: [],
  },

  fetchCategories: async ({ search = '', status = '' } = {}) => {
    set({ loading: true, error: null });
    try {
      const qs = new URLSearchParams();
      if (search) qs.set('search', search);
      if (status) qs.set('status', status);
      const data = await request(`/categories?${qs.toString()}`);
      set({ categories: Array.isArray(data) ? data : [], loading: false });
      return data;
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  createCategory: async (payload) => request('/categories', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  fetchSubcategories: async ({ search = '', status = '', categoryId = '' } = {}) => {
    set({ loading: true, error: null });
    try {
      const qs = new URLSearchParams();
      if (search) qs.set('search', search);
      if (status) qs.set('status', status);
      if (categoryId) qs.set('categoryId', String(categoryId));
      const data = await request(`/subcategories?${qs.toString()}`);
      set({ subcategories: Array.isArray(data) ? data : [], loading: false });
      return data;
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  createSubcategory: async (payload) => request('/subcategories', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  fetchSuppliers: async ({ search = '', status = '' } = {}) => {
    set({ loading: true, error: null });
    try {
      const qs = new URLSearchParams();
      if (search) qs.set('search', search);
      if (status) qs.set('status', status);
      const data = await request(`/suppliers?${qs.toString()}`);
      set({ suppliers: Array.isArray(data) ? data : [], loading: false });
      return data;
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  createSupplier: async (payload) => request('/suppliers', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  fetchStorages: async ({ search = '', status = '' } = {}) => {
    set({ loading: true, error: null });
    try {
      const qs = new URLSearchParams();
      if (search) qs.set('search', search);
      if (status) qs.set('status', status);
      const data = await request(`/storages?${qs.toString()}`);
      set({ storages: Array.isArray(data) ? data : [], loading: false });
      return data;
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  createStorage: async (payload) => request('/storages', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  fetchDepartments: async ({ search = '', status = '' } = {}) => {
    set({ loading: true, error: null });
    try {
      const qs = new URLSearchParams();
      if (search) qs.set('search', search);
      if (status) qs.set('status', status);
      const data = await request(`/departments?${qs.toString()}`);
      set({ departments: Array.isArray(data) ? data : [], loading: false });
      return data;
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  createDepartment: async (payload) => request('/departments', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  fetchDemandCategoryTypes: async ({ search = '', status = '' } = {}) => {
    set({ loading: true, error: null });
    try {
      const qs = new URLSearchParams();
      if (search) qs.set('search', search);
      if (status) qs.set('status', status);
      const data = await request(`/demand-category-types?${qs.toString()}`);
      set({ demandCategoryTypes: Array.isArray(data) ? data : [], loading: false });
      return data;
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  createDemandCategoryType: async (payload) => request('/demand-category-types', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  fetchItems: async ({ search = '', status = '', categoryId = '', supplierId = '' } = {}) => {
    set({ loading: true, error: null });
    try {
      const qs = new URLSearchParams();
      if (search) qs.set('search', search);
      if (status) qs.set('status', status);
      if (categoryId) qs.set('categoryId', String(categoryId));
      if (supplierId) qs.set('supplierId', String(supplierId));
      const data = await request(`/items?${qs.toString()}`);
      set({ items: Array.isArray(data) ? data : [], loading: false });
      return data;
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  createItem: async (payload) => request('/items', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  updateItemStatus: async (itemId, status) => request(`/items/${itemId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }),

  deleteItem: async (itemId) => request(`/items/${itemId}`, {
    method: 'DELETE',
  }),

  fetchPurchaseOrders: async ({ search = '', status = '', supplierId = '', itemId = '', dateFrom = '', dateTo = '' } = {}) => {
    set({ loading: true, error: null });
    try {
      const qs = new URLSearchParams();
      if (search) qs.set('search', search);
      if (status) qs.set('status', status);
      if (supplierId) qs.set('supplierId', String(supplierId));
      if (itemId) qs.set('itemId', String(itemId));
  if (dateFrom) qs.set('dateFrom', String(dateFrom));
  if (dateTo) qs.set('dateTo', String(dateTo));
      const data = await request(`/po?${qs.toString()}`);
      set({ purchaseOrders: Array.isArray(data) ? data : [], loading: false });
      return data;
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  createPurchaseOrder: async (payload) => request('/po', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  fetchGRNs: async ({ search = '', supplierId = '', itemId = '', categoryId = '', subcategoryId = '', dateFrom = '', dateTo = '' } = {}) => {
    set({ loading: true, error: null });
    try {
      const qs = new URLSearchParams();
      if (search) qs.set('search', search);
      if (supplierId) qs.set('supplierId', String(supplierId));
      if (itemId) qs.set('itemId', String(itemId));
      if (categoryId) qs.set('categoryId', String(categoryId));
      if (subcategoryId) qs.set('subcategoryId', String(subcategoryId));
  if (dateFrom) qs.set('dateFrom', String(dateFrom));
  if (dateTo) qs.set('dateTo', String(dateTo));
      const data = await request(`/grn?${qs.toString()}`);
      set({ grns: Array.isArray(data) ? data : [], loading: false });
      return data;
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  createGRN: async (payload) => request('/grn', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  fetchGDs: async ({ search = '', status = '', departmentId = '', demandCategoryTypeId = '', categoryId = '', subcategoryId = '', dateFrom = '', dateTo = '' } = {}) => {
    set({ loading: true, error: null });
    try {
      const qs = new URLSearchParams();
      if (search) qs.set('search', search);
      if (status) qs.set('status', status);
      if (departmentId) qs.set('departmentId', String(departmentId));
      if (demandCategoryTypeId) qs.set('demandCategoryTypeId', String(demandCategoryTypeId));
  if (categoryId) qs.set('categoryId', String(categoryId));
  if (subcategoryId) qs.set('subcategoryId', String(subcategoryId));
  if (dateFrom) qs.set('dateFrom', String(dateFrom));
  if (dateTo) qs.set('dateTo', String(dateTo));
      const data = await request(`/gd?${qs.toString()}`);
      set({ gds: Array.isArray(data) ? data : [], loading: false });
      return data;
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  createGD: async (payload) => request('/gd', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  fetchGINs: async ({ search = '', departmentId = '', itemId = '', categoryId = '', subcategoryId = '', dateFrom = '', dateTo = '' } = {}) => {
    set({ loading: true, error: null });
    try {
      const qs = new URLSearchParams();
      if (search) qs.set('search', search);
      if (departmentId) qs.set('departmentId', String(departmentId));
      if (itemId) qs.set('itemId', String(itemId));
  if (categoryId) qs.set('categoryId', String(categoryId));
  if (subcategoryId) qs.set('subcategoryId', String(subcategoryId));
  if (dateFrom) qs.set('dateFrom', String(dateFrom));
  if (dateTo) qs.set('dateTo', String(dateTo));
      const data = await request(`/gin?${qs.toString()}`);
      set({ gins: Array.isArray(data) ? data : [], loading: false });
      return data;
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  createGIN: async (payload) => request('/gin', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  fetchSalesInvoices: async ({ search = '', itemId = '', customerType = '', dateFrom = '', dateTo = '' } = {}) => {
    set({ loading: true, error: null });
    try {
      const qs = new URLSearchParams();
      if (search) qs.set('search', search);
      if (itemId) qs.set('itemId', String(itemId));
      if (customerType) qs.set('customerType', String(customerType));
      if (dateFrom) qs.set('dateFrom', String(dateFrom));
      if (dateTo) qs.set('dateTo', String(dateTo));
      const data = await request(`/sales-invoices?${qs.toString()}`);
      set({ salesInvoices: Array.isArray(data) ? data : [], loading: false });
      return data;
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  createSalesInvoice: async (payload) => request('/sales-invoices', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  fetchGDNs: async ({ search = '', itemId = '', categoryId = '', subcategoryId = '', dateFrom = '', dateTo = '' } = {}) => {
    set({ loading: true, error: null });
    try {
      const qs = new URLSearchParams();
      if (search) qs.set('search', search);
      if (itemId) qs.set('itemId', String(itemId));
      if (categoryId) qs.set('categoryId', String(categoryId));
      if (subcategoryId) qs.set('subcategoryId', String(subcategoryId));
      if (dateFrom) qs.set('dateFrom', String(dateFrom));
      if (dateTo) qs.set('dateTo', String(dateTo));
      const data = await request(`/gdn?${qs.toString()}`);
      set({ gdns: Array.isArray(data) ? data : [], loading: false });
      return data;
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  createGDN: async (payload) => request('/gdn', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  fetchMastersOptions: async ({ search = '' } = {}) => {
    try {
      const qs = new URLSearchParams();
      if (search) qs.set('search', search);
      const data = await request(`/masters/options?${qs.toString()}`);
      set({
        masterOptions: {
          categories: data?.categories || [],
          subcategories: data?.subcategories || [],
          suppliers: data?.suppliers || [],
          storages: data?.storages || [],
          departments: data?.departments || [],
          demandCategoryTypes: data?.demandCategoryTypes || [],
        },
      });
      return data;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  fetchReorderAlerts: async () => {
    try {
      const data = await request('/alerts/reorder');
      set({ reorderAlerts: Array.isArray(data) ? data : [] });
      return data;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  fetchItemLedgerReport: async ({ dateFrom = '', dateTo = '', itemId = '', categoryId = '', subcategoryId = '' } = {}) => {
    set({ loading: true, error: null });
    try {
      const qs = new URLSearchParams();
      if (dateFrom) qs.set('dateFrom', String(dateFrom));
      if (dateTo) qs.set('dateTo', String(dateTo));
      if (itemId) qs.set('itemId', String(itemId));
      if (categoryId) qs.set('categoryId', String(categoryId));
      if (subcategoryId) qs.set('subcategoryId', String(subcategoryId));

      const data = await request(`/reports/item-ledger?${qs.toString()}`);
      const safeData = {
        rows: Array.isArray(data?.rows) ? data.rows : [],
        groups: Array.isArray(data?.groups) ? data.groups : [],
        summary: {
          itemCount: Number(data?.summary?.itemCount || 0),
          openingBalance: Number(data?.summary?.openingBalance || 0),
          totalReceived: Number(data?.summary?.totalReceived || 0),
          totalIssued: Number(data?.summary?.totalIssued || 0),
          closingBalance: Number(data?.summary?.closingBalance || 0),
        },
      };

      set({ itemLedgerReport: safeData, loading: false });
      return safeData;
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  fetchShortExpiryReport: async ({
    dateFrom = '',
    dateTo = '',
    dateLog = '',
    dateLogFrom = '',
    dateLogTo = '',
    itemId = '',
    categoryId = '',
    subcategoryId = '',
  } = {}) => {
    set({ loading: true, error: null });
    try {
      const qs = new URLSearchParams();
      if (dateFrom) qs.set('dateFrom', String(dateFrom));
      if (dateTo) qs.set('dateTo', String(dateTo));
      if (dateLog) qs.set('dateLog', String(dateLog));
      if (dateLogFrom) qs.set('dateLogFrom', String(dateLogFrom));
      if (dateLogTo) qs.set('dateLogTo', String(dateLogTo));
      if (itemId) qs.set('itemId', String(itemId));
      if (categoryId) qs.set('categoryId', String(categoryId));
      if (subcategoryId) qs.set('subcategoryId', String(subcategoryId));

      const data = await request(`/reports/short-expiry?${qs.toString()}`);
      const rows = Array.isArray(data) ? data : [];

      set({ shortExpiryReportRows: rows, loading: false });
      return rows;
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  fetchStockPositionReport: async ({ asOfDate = '', categoryId = '', subcategoryId = '' } = {}) => {
    set({ loading: true, error: null });
    try {
      const qs = new URLSearchParams();
      if (asOfDate) qs.set('asOfDate', String(asOfDate));
      if (categoryId) qs.set('categoryId', String(categoryId));
      if (subcategoryId) qs.set('subcategoryId', String(subcategoryId));

      const data = await request(`/reports/stock-position?${qs.toString()}`);
      const safeData = {
        rows: Array.isArray(data?.rows) ? data.rows : [],
        total: {
          itemCount: Number(data?.total?.itemCount || 0),
          totalQuantity: Number(data?.total?.totalQuantity || 0),
          totalAmount: Number(data?.total?.totalAmount || 0),
        },
        asOfDate: data?.asOfDate || null,
      };

      set({ stockPositionReport: safeData, loading: false });
      return safeData;
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  getLastGRNRate: async (itemId, supplierId) => {
    try {
      if (!itemId || !supplierId) return null;
      // Use existing /grn endpoint and get last record
      const grnList = await request(`/grn?itemId=${itemId}&supplierId=${supplierId}`);
      if (!Array.isArray(grnList) || grnList.length === 0) return null;
      
      // Get the first/last record (most recent)
      const lastGRN = grnList[0];
      return {
        rate: lastGRN.receivedRate,
        quantity: lastGRN.receivedQuantity,
      };
    } catch (err) {
      // Silently fail - no rate found is not an error
      return null;
    }
  },
}));
