import client from './client';

export const listPayments = () => client.get('/payments');
export const listReceivables = () => client.get('/payments/receivables');
