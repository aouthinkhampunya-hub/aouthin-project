export const API_BASE = import.meta.env.VITE_API_URL || '';
const BASE = API_BASE + '/api';

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    credentials: 'include',
    headers: options.body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, ...data };
  return data;
}

// ---- Auth ----
export const authCheck = () => request('/auth/check');
export const authMe = () => request('/auth/me');
export const login = (username, password) =>
  request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
export const logout = () => request('/auth/logout', { method: 'POST' });

// ---- Products ----
export const getProducts = () => request('/products');
export const addProduct = (formData) => request('/products', { method: 'POST', body: formData });
export const deleteProduct = (id) => request(`/products/${id}`, { method: 'DELETE' });

// ---- Orders / Bills ----
export const getOrders = () => request('/orders');
export const getBills = () => request('/orders/bills');
export const createOrder = (table_number, items) =>
  request('/orders', { method: 'POST', body: JSON.stringify({ table_number, items }) });
export const updateOrderStatus = (id, status) =>
  request(`/orders/${id}`, { method: 'PUT', body: JSON.stringify({ status }) });
export const cancelOrder = (id) => request(`/orders/${id}`, { method: 'DELETE' });
export const closeBill = (billId) => request(`/orders/bills/${billId}/close`, { method: 'PUT' });

// ---- QR Code (ໜາ scan ເມນ) ----
export const getMenuQR = () => request('/qrcode');

// ---- Settings (QR ຮັບເງິນ) ----
export const getPaymentQR = () => request('/settings/qr');
export const uploadPaymentQR = (formData) =>
  request('/settings/qr', { method: 'POST', body: formData });

// ---- Staff calls (ເອນພະນກງານ) ----
export const getStaffCalls = () => request('/staffcall');
export const callStaff = (table_number) =>
  request('/staffcall', { method: 'POST', body: JSON.stringify({ table_number }) });
export const ackStaffCall = (id) => request(`/staffcall/${id}/ack`, { method: 'PUT' });

// ---- Admins (ພະນັກງານ) ----
export const getAdmins = () => request('/admins');
export const addAdmin = (username, password, name) =>
  request('/admins', { method: 'POST', body: JSON.stringify({ username, password, name }) });
export const deleteAdmin = (id) => request(`/admins/${id}`, { method: 'DELETE' });
export const resetAdminPassword = (id, password) =>
  request(`/admins/${id}/reset-password`, { method: 'PUT', body: JSON.stringify({ password }) });