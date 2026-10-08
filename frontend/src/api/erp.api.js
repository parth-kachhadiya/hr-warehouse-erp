// Every server call, named after the matching function in the old Apps Script
// (google.script.run.getSellers() becomes getSellers(), and so on).
import client from './client';

// Dashboard
export const getDashboardData = () => client.get('/dashboard');

// Sellers / Buyers
export const getSellers = () => client.get('/sellers');
export const addSeller = (s) => client.post('/sellers', s);
export const getBuyers = () => client.get('/buyers');
export const addBuyer = (b) => client.post('/buyers', b);

// Categories / custom fields / settings / health
export const getCategories = () => client.get('/system/categories');
export const addCategory = (name) => client.post('/system/categories', { name });
export const deleteCategory = (id) => client.delete(`/system/categories/${id}`);
export const getCustomFields = (module) => client.get('/system/custom-fields', { params: { module } });
export const addCustomField = (module, fieldName) => client.post('/system/custom-fields', { module, fieldName });
export const deleteCustomField = (id) => client.delete(`/system/custom-fields/${id}`);
export const syncSystem = () => client.post('/system/sync');
export const getSettings = () => client.get('/system/settings');
export const updateSettings = (s) => client.put('/system/settings', s);
export const getSystemHealth = () => client.get('/system/health');
export const getAuditLog = (limit) => client.get('/audit', { params: { limit } });

// Assets (products)
export const getAssets = () => client.get('/assets');
export const addAsset = (a) => client.post('/assets', a);
export const adjustAssetQuantity = (id, newTotalQty, reason) => client.post(`/assets/${id}/adjust`, { newTotalQty, reason });
export const setAssetStatus = (id, status) => client.post(`/assets/${id}/status`, { status });
export const deleteAsset = (id) => client.delete(`/assets/${id}`);
export const uploadAssetMediaForAsset = (id, file) => {
  const form = new FormData();
  form.append('file', file);
  return client.post(`/assets/${id}/media`, form);
};

// Sales, payments, delivery
export const previewBilling = (assetID, quantity, unitSalePrice) => client.post('/sales/preview', { assetID, quantity, unitSalePrice });
export const createSale = (sale) => client.post('/sales', sale);
export const getSales = () => client.get('/sales');
export const recordPayment = (p) => client.post('/payments', p);
export const markOrderDelivered = (saleID, quantity) => client.post(`/sales/${saleID}/deliver`, { quantity });
export const voidSale = (saleID, reason) => client.post(`/sales/${saleID}/void`, { reason });

// Settlements and storage billing
export const paySeller = (p) => client.post('/settlements', p);
export const runMonthlyStorageBilling = () => client.post('/storage/run');
export const getStorageLedger = () => client.get('/storage/ledger');
export const getSellerSpaceSummary = () => client.get('/storage/seller-space');

// Finance, expenses, dead stock
export const getFinanceSummary = () => client.get('/finance/summary');
export const getDeadStockReport = () => client.get('/finance/dead-stock');
export const getExpenses = () => client.get('/expenses');
export const addExpense = (e) => client.post('/expenses', e);
export const deleteExpense = (id) => client.delete(`/expenses/${id}`);
