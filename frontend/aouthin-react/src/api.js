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
export const updateProductField = (id, field, value) =>
  request(`/products/${id}`, { method: 'PUT', body: JSON.stringify({ [field]: value }) });
export const updateProductImage = (id, formData) =>
  request(`/products/${id}/image`, { method: 'PUT', body: formData });

// ---- Options: ປະເພດອາຫານ / ລະດັບຄວາມເຜັດ ----
export const getOptions = () => request('/settings/options');
export const addOption = (type, value) =>
  request(`/settings/options/${type}`, { method: 'POST', body: JSON.stringify({ value }) });
export const removeOption = (type, value) =>
  request(`/settings/options/${type}`, { method: 'DELETE', body: JSON.stringify({ value }) });

// ---- Orders / Bills ----
export const getOrders = () => request('/orders');
export const getBills = () => request('/orders/bills');
export const createOrder = (table_number, items) =>
  request('/orders', { method: 'POST', body: JSON.stringify({ table_number, items }) });
export const updateOrderStatus = (id, status) =>
  request(`/orders/${id}`, { method: 'PUT', body: JSON.stringify({ status }) });
export const cancelOrder = (id) => request(`/orders/${id}`, { method: 'DELETE' });
export const closeBill = (billId) => request(`/orders/bills/${billId}/close`, { method: 'PUT' });

// ---- QR Code ----
export const getMenuQR = () => request('/qrcode');
export const getTableQRs = () => request('/qrcode/tables');

// ---- Settings (QR ຮັບເງິນ) ----
export const getPaymentQR = () => request('/settings/qr');
export const uploadPaymentQR = (formData) =>
  request('/settings/qr', { method: 'POST', body: formData });

// ---- Staff calls ----
export const getStaffCalls = () => request('/staffcall');
export const callStaff = (table_number) =>
  request('/staffcall', { method: 'POST', body: JSON.stringify({ table_number }) });
export const ackStaffCall = (id) => request(`/staffcall/${id}/ack`, { method: 'PUT' });

// ---- Admins ----
export const getAdmins = () => request('/admins');
export const addAdmin = (username, password, name) =>
  request('/admins', { method: 'POST', body: JSON.stringify({ username, password, name }) });
export const deleteAdmin = (id) => request(`/admins/${id}`, { method: 'DELETE' });
export const resetAdminPassword = (id, password) =>
  request(`/admins/${id}/reset-password`, { method: 'PUT', body: JSON.stringify({ password }) });

// ---- ໂຕະ (ເພີ່ມ / ລຶບ / ນັບ) ----
export const addTable = () => request('/tables', { method: 'POST' });
export const deleteLastTable = () => request('/tables', { method: 'DELETE' });
export const getTableCount = () => request('/tables/count');
export const getOpenBills = () => request('/orders/bills');
// ---- ສັ່ງອອນລາຍ ----
export const createOnlineOrder = (payload) =>
  request('/orders/online', { method: 'POST', body: JSON.stringify(payload) });
export const getOnlineBill = (id, phone) =>
  request(`/orders/online/${id}?phone=${encodeURIComponent(phone)}`);
export const uploadOnlineSlip = (id, phone, file) => {
  const fd = new FormData();
  fd.append('customer_phone', phone);
  fd.append('slip', file);
  return request(`/orders/online/${id}/slip`, { method: 'POST', body: fd });
};