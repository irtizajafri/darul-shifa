import { create } from 'zustand';

const API = 'http://localhost:5001/api/accounts';

async function req(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.ok === false) throw new Error(json?.message || `Request failed (${res.status})`);
  return json?.data;
}

export const useAccountsStore = create((set) => ({
  // Main GL
  mainGLs: [],
  fetchMainGLs: async (entityType) => {
    const data = await req(`/main-gl?entityType=${entityType}`);
    set({ mainGLs: Array.isArray(data) ? data : [] });
  },
  createMainGL: async (body) => {
    const data = await req('/main-gl', { method: 'POST', body: JSON.stringify(body) });
    set((s) => ({ mainGLs: [...s.mainGLs, data] }));
    return data;
  },
  updateMainGL: async (id, body) => {
    const data = await req(`/main-gl/${id}`, { method: 'PUT', body: JSON.stringify(body) });
    set((s) => ({ mainGLs: s.mainGLs.map((r) => (r.id === id ? data : r)) }));
    return data;
  },
  deleteMainGL: async (id) => {
    await req(`/main-gl/${id}`, { method: 'DELETE' });
    set((s) => ({ mainGLs: s.mainGLs.filter((r) => r.id !== id) }));
  },

  // Sub GL
  subGLs: [],
  fetchSubGLs: async (entityType, mainGlId) => {
    const qs = mainGlId ? `?entityType=${entityType}&mainGlId=${mainGlId}` : `?entityType=${entityType}`;
    const data = await req(`/sub-gl${qs}`);
    set({ subGLs: Array.isArray(data) ? data : [] });
  },
  createSubGL: async (body) => {
    const data = await req('/sub-gl', { method: 'POST', body: JSON.stringify(body) });
    set((s) => ({ subGLs: [...s.subGLs, data] }));
    return data;
  },
  updateSubGL: async (id, body) => {
    const data = await req(`/sub-gl/${id}`, { method: 'PUT', body: JSON.stringify(body) });
    set((s) => ({ subGLs: s.subGLs.map((r) => (r.id === id ? data : r)) }));
    return data;
  },
  deleteSubGL: async (id) => {
    await req(`/sub-gl/${id}`, { method: 'DELETE' });
    set((s) => ({ subGLs: s.subGLs.filter((r) => r.id !== id) }));
  },

  // Main Account
  mainAccounts: [],
  fetchMainAccounts: async (entityType, subGlId) => {
    const qs = subGlId ? `?entityType=${entityType}&subGlId=${subGlId}` : `?entityType=${entityType}`;
    const data = await req(`/main-account${qs}`);
    set({ mainAccounts: Array.isArray(data) ? data : [] });
  },
  createMainAccount: async (body) => {
    const data = await req('/main-account', { method: 'POST', body: JSON.stringify(body) });
    set((s) => ({ mainAccounts: [...s.mainAccounts, data] }));
    return data;
  },
  updateMainAccount: async (id, body) => {
    const data = await req(`/main-account/${id}`, { method: 'PUT', body: JSON.stringify(body) });
    set((s) => ({ mainAccounts: s.mainAccounts.map((r) => (r.id === id ? data : r)) }));
    return data;
  },
  deleteMainAccount: async (id) => {
    await req(`/main-account/${id}`, { method: 'DELETE' });
    set((s) => ({ mainAccounts: s.mainAccounts.filter((r) => r.id !== id) }));
  },

  // Sub Account
  subAccounts: [],
  fetchSubAccounts: async (entityType, mainAccountId) => {
    const qs = mainAccountId ? `?entityType=${entityType}&mainAccountId=${mainAccountId}` : `?entityType=${entityType}`;
    const data = await req(`/sub-account${qs}`);
    set({ subAccounts: Array.isArray(data) ? data : [] });
  },
  createSubAccount: async (body) => {
    const data = await req('/sub-account', { method: 'POST', body: JSON.stringify(body) });
    set((s) => ({ subAccounts: [...s.subAccounts, data] }));
    return data;
  },
  updateSubAccount: async (id, body) => {
    const data = await req(`/sub-account/${id}`, { method: 'PUT', body: JSON.stringify(body) });
    set((s) => ({ subAccounts: s.subAccounts.map((r) => (r.id === id ? data : r)) }));
    return data;
  },
  deleteSubAccount: async (id) => {
    await req(`/sub-account/${id}`, { method: 'DELETE' });
    set((s) => ({ subAccounts: s.subAccounts.filter((r) => r.id !== id) }));
  },

  // Payee Heads
  payeeHeads: [],
  fetchPayeeHeads: async (entityType) => {
    const data = await req(`/payee-heads?entityType=${entityType}`);
    set({ payeeHeads: Array.isArray(data) ? data : [] });
  },
  createPayeeHead: async (body) => {
    const data = await req('/payee-heads', { method: 'POST', body: JSON.stringify(body) });
    set((s) => ({ payeeHeads: [...s.payeeHeads, data] }));
    return data;
  },
  updatePayeeHead: async (id, body) => {
    const data = await req(`/payee-heads/${id}`, { method: 'PUT', body: JSON.stringify(body) });
    set((s) => ({ payeeHeads: s.payeeHeads.map((r) => (r.id === id ? data : r)) }));
    return data;
  },
  deletePayeeHead: async (id) => {
    await req(`/payee-heads/${id}`, { method: 'DELETE' });
    set((s) => ({ payeeHeads: s.payeeHeads.filter((r) => r.id !== id) }));
  },
  addHeadAccount: async (headId, subAccountId) => {
    return req('/payee-head-accounts', { method: 'POST', body: JSON.stringify({ headId, subAccountId }) });
  },
  removeHeadAccount: async (headId, subAccountId) => {
    return req(`/payee-head-accounts/${headId}/${subAccountId}`, { method: 'DELETE' });
  },

  // Payee Entries
  payeeEntries: [],
  fetchPayeeEntries: async (headId) => {
    const data = await req(`/payee-entries?headId=${headId}`);
    set({ payeeEntries: Array.isArray(data) ? data : [] });
  },
  createPayeeEntry: async (body) => {
    const data = await req('/payee-entries', { method: 'POST', body: JSON.stringify(body) });
    set((s) => ({ payeeEntries: [...s.payeeEntries, data] }));
    return data;
  },
  deletePayeeEntry: async (id) => {
    await req(`/payee-entries/${id}`, { method: 'DELETE' });
    set((s) => ({ payeeEntries: s.payeeEntries.filter((r) => r.id !== id) }));
  },

  // System linked lists
  linkedEmployees: [],
  fetchLinkedEmployees: async () => {
    const data = await req('/linked/employees');
    set({ linkedEmployees: Array.isArray(data) ? data : [] });
  },
  linkedSuppliers: [],
  fetchLinkedSuppliers: async () => {
    const data = await req('/linked/suppliers');
    set({ linkedSuppliers: Array.isArray(data) ? data : [] });
  },
  linkedDoctors: [],
  fetchLinkedDoctors: async () => {
    const data = await req('/linked/doctors');
    set({ linkedDoctors: Array.isArray(data) ? data : [] });
  },

  // Bank Accounts
  bankAccounts: [],
  fetchBankAccounts: async (entityType) => {
    const data = await req(`/bank-accounts?entityType=${entityType}`);
    set({ bankAccounts: Array.isArray(data) ? data : [] });
  },
  createBankAccount: async (body) => {
    const data = await req('/bank-accounts', { method: 'POST', body: JSON.stringify(body) });
    set((s) => ({ bankAccounts: [...s.bankAccounts, data] }));
    return data;
  },
  updateBankAccount: async (id, body) => {
    const data = await req(`/bank-accounts/${id}`, { method: 'PUT', body: JSON.stringify(body) });
    set((s) => ({ bankAccounts: s.bankAccounts.map((r) => (r.id === id ? data : r)) }));
    return data;
  },
  deleteBankAccount: async (id) => {
    await req(`/bank-accounts/${id}`, { method: 'DELETE' });
    set((s) => ({ bankAccounts: s.bankAccounts.filter((r) => r.id !== id) }));
  },

  // Cheque Serials
  chequeSerials: [],
  fetchChequeSerials: async (entityType, bankAccountId) => {
    const qs = bankAccountId
      ? `?bankAccountId=${bankAccountId}`
      : `?entityType=${entityType}`;
    const data = await req(`/cheque-serials${qs}`);
    set({ chequeSerials: Array.isArray(data) ? data : [] });
  },
  createChequeSerial: async (body) => {
    const data = await req('/cheque-serials', { method: 'POST', body: JSON.stringify(body) });
    set((s) => ({ chequeSerials: [...s.chequeSerials, data] }));
    return data;
  },
  deleteChequeSerial: async (id) => {
    await req(`/cheque-serials/${id}`, { method: 'DELETE' });
    set((s) => ({ chequeSerials: s.chequeSerials.filter((r) => r.id !== id) }));
  },

  // Income Categories
  incomeCategories: [],
  fetchIncomeCategories: async (entityType) => {
    const data = await req(`/income-categories?entityType=${entityType}`);
    set({ incomeCategories: Array.isArray(data) ? data : [] });
  },
  createIncomeCategory: async (body) => {
    const data = await req('/income-categories', { method: 'POST', body: JSON.stringify(body) });
    set((s) => ({ incomeCategories: [...s.incomeCategories, data] }));
    return data;
  },
  updateIncomeCategory: async (id, body) => {
    const data = await req(`/income-categories/${id}`, { method: 'PUT', body: JSON.stringify(body) });
    set((s) => ({ incomeCategories: s.incomeCategories.map((r) => (r.id === id ? data : r)) }));
    return data;
  },
  deleteIncomeCategory: async (id) => {
    await req(`/income-categories/${id}`, { method: 'DELETE' });
    set((s) => ({ incomeCategories: s.incomeCategories.filter((r) => r.id !== id) }));
  },
}));
