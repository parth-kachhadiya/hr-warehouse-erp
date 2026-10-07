import client from './client';

export const listSales = (status) => client.get('/sales', { params: status ? { status } : {} });
export const previewSale = (data) => client.post('/sales/preview', data);
export const createSale = (data) => client.post('/sales', data);
export const recordPayment = (saleId, data) => client.post(`/sales/${saleId}/payments`, data);
export const deliverOrder = (saleId, Quantity) => client.post(`/sales/${saleId}/deliver`, { Quantity });
export const voidSale = (saleId, reason) => client.post(`/sales/${saleId}/void`, { reason });
