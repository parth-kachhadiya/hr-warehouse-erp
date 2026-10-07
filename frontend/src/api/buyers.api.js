import client from './client';

export const listBuyers = (includeArchived = false) => client.get('/buyers', { params: { includeArchived } });
export const createBuyer = (data) => client.post('/buyers', data);
export const updateBuyer = (id, data) => client.put(`/buyers/${id}`, data);
export const archiveBuyer = (id) => client.post(`/buyers/${id}/archive`);
