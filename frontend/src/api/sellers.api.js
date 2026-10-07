import client from './client';

export const listSellers = (includeArchived = false) => client.get('/sellers', { params: { includeArchived } });
export const createSeller = (data) => client.post('/sellers', data);
export const updateSeller = (id, data) => client.put(`/sellers/${id}`, data);
export const archiveSeller = (id) => client.post(`/sellers/${id}/archive`);
