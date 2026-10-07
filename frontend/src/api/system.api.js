import client from './client';

export const listCategories = () => client.get('/system/categories');
export const addCategory = (Name) => client.post('/system/categories', { Name });
export const removeCategory = (id) => client.post(`/system/categories/${id}/remove`);
export const listCustomFields = () => client.get('/system/custom-fields');
export const addCustomField = (FieldName) => client.post('/system/custom-fields', { FieldName });
export const removeCustomField = (id) => client.post(`/system/custom-fields/${id}/remove`);
export const getSettings = () => client.get('/system/settings');
export const updateSettings = (data) => client.put('/system/settings', data);
export const runHealthCheck = () => client.get('/system/health');
