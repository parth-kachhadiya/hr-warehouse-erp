import client from './client';

export const listAssets = (params = {}) => client.get('/assets', { params });
export const getWarehouseSpace = () => client.get('/assets/space');
export const addAsset = (data) => client.post('/assets', data);
export const updateAsset = (id, data) => client.put(`/assets/${id}`, data);
export const adjustQuantity = (id, newQuantity, reason) => client.post(`/assets/${id}/adjust`, { newQuantity, reason });
export const archiveAsset = (id, reason) => client.post(`/assets/${id}/archive`, { reason });
export const changeStatus = (id, Status) => client.post(`/assets/${id}/status`, { Status });

export const uploadPhotos = (id, files) => {
  const form = new FormData();
  Array.from(files).forEach((f) => form.append('photos', f));
  return client.post(`/assets/${id}/photos`, form);
};

export const uploadVideo = (id, file) => {
  const form = new FormData();
  form.append('video', file);
  return client.post(`/assets/${id}/video`, form);
};
