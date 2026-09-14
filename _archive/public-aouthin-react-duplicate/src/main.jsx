import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import Menu from './pages/menu/Menu.jsx';
import CustomerBill from './pages/menu/Bill.jsx';

import Login from './pages/admin/Login.jsx';
import AdminLayout from './components/AdminLayout.jsx';
import Products from './pages/admin/Products.jsx';
import Orders from './pages/admin/Orders.jsx';
import Tables from './pages/admin/Tables.jsx';
import Kitchen from './pages/admin/Kitchen.jsx';
import AdminBill from './pages/admin/Bill.jsx';
import QrCodePage from './pages/admin/QrCodePage.jsx';
import Settings from './pages/admin/Settings.jsx';
import Dashboard from './pages/admin/Dashboard.jsx';
import Staff from './pages/admin/Staff.jsx';

import './styles/menu.css';
import './styles/admin.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
      <BrowserRouter basename="/app">
      <Routes>
        {/* ===== ຝັ່ງລູກຄ້າ ===== */}
        <Route path="/menu" element={<Menu />} />
        <Route path="/menu/bill" element={<CustomerBill />} />

        {/* ===== ຝັ່ງຫຼັງບ້ານ ===== */}
        <Route path="/admin/login" element={<Login />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Products />} />
          <Route path="orders" element={<Orders />} />
          <Route path="tables" element={<Tables />} />
          <Route path="kitchen" element={<Kitchen />} />
          <Route path="bill" element={<AdminBill />} />
          <Route path="qrcode" element={<QrCodePage />} />
          <Route path="settings" element={<Settings />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="staff" element={<Staff />} />
        </Route>

        <Route path="/" element={<Navigate to="/menu" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
