import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { authMe, logout } from '../api.js';

// ===== ແທນ auth-guard.js ເກົ່າ: ກວດ login + ສະແດງແຖບເທິງສຸດ + nav =====
export default function AdminLayout() {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    authMe()
      .then(setAdmin)
      .catch(() => navigate('/admin/login'))
      .finally(() => setLoading(false));
  }, []);

  async function handleLogout() {
    await logout();
    navigate('/admin/login');
  }

  if (loading) return <p style={{ padding: 40, textAlign: 'center' }}>ກຳລັງກວດສອບ...</p>;
  if (!admin) return null;

  const isActive = (path) => (location.pathname === path ? 'active' : '');

  return (
    <>
      <div className="topbar">
        <span>ສະບາຍດີ, {admin.name}</span>
        <button onClick={handleLogout}>ອອກຈາກລະບົບ</button>
      </div>
      <header>
        <h1>ຈັດການຮ້ານອາຫານ</h1>
        <nav>
          <Link to="/admin" className={isActive('/admin')}>ເມນູ</Link>
          <Link to="/admin/orders" className={isActive('/admin/orders')}>ຄຳສັ່ງອາຫານ</Link>
          <Link to="/admin/tables" className={isActive('/admin/tables')}>ໂຕະອາຫານ</Link>
          <Link to="/admin/kitchen" className={isActive('/admin/kitchen')}>ຄົວ</Link>
          <Link to="/admin/qrcode" className={isActive('/admin/qrcode')}>QR Code</Link>
          <Link to="/admin/dashboard" className={isActive('/admin/dashboard')}>ລາຍງານ</Link>
          <Link to="/admin/staff" className={isActive('/admin/staff')}>ພະນັກງານ</Link>
        </nav>
      </header>
      <Outlet context={{ admin }} />
    </>
  );
}
