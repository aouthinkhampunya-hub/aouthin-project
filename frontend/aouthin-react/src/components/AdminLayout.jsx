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
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: '16px',
        padding: '10px 24px',
        background: 'linear-gradient(to right, #8B0000, #a30000)',
        color: 'white',
        boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
        fontSize: '14px'
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          👋 ສະບາຍດີແອັດມິນ <strong>{admin.name}</strong>
        </span>
        <button
          onClick={handleLogout}
          style={{
            cursor: 'pointer',
            padding: '6px 16px',
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.4)',
            borderRadius: '6px',
            color: 'white',
            fontSize: '13px',
            transition: 'background 0.2s'
          }}
          onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
          onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
        >
          ອອກຈາກລະບົບ
        </button>
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