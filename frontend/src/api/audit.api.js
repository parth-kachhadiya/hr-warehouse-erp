import client from './client';

export const listAudit = () => client.get('/audit');
