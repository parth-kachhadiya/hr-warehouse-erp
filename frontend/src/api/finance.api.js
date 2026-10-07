import client from './client';

export const getFinanceSummary = () => client.get('/finance/summary');
export const getDeadStock = () => client.get('/finance/dead-stock');
export const listExpenses = () => client.get('/expenses');
export const addExpense = (data) => client.post('/expenses', data);
export const voidExpense = (id, reason) => client.post(`/expenses/${id}/void`, { reason });
