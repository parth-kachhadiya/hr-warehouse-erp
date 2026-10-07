import client from './client';

export const listSettlements = () => client.get('/settlements');
export const paySeller = (data) => client.post('/settlements', data);
