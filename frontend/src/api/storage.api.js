import client from './client';

export const runStorageBilling = () => client.post('/storage/run');
export const listStorageLedger = (month) => client.get('/storage/ledger', { params: month ? { month } : {} });
export const sellerSpaceSummary = () => client.get('/storage/seller-space');
