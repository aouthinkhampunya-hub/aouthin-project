import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { authMe, logout, API_BASE } from '../api.js';

// ===== ແທນ auth-guard.js ເກົ່າ: ກວດ login + ສະແດງແຖບເທິງສຸດ + nav =====
export default function AdminLayout() {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [contactCount, setContactCount] = useState(0); // ຈຳນວນເລື່ອງທີ່ຍັງບໍ່ໄດ້ຕິດຕໍ່ລູກຄ້າ
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    authMe()
      .then((data) => {
        // ບັນຊີຄົວ ເຂົ້າໜ້າ admin ບໍ່ໄດ້ → ສົ່ງໄປໜ້າຄົວ
        if (data.role === 'kitchen') {
          navigate('/kitchen');
          return;
        }
        setAdmin(data);
      })
      .catch(() => navigate('/admin/login'))
      .finally(() => setLoading(false));
  }, []);

  // ເລກສີແດງຂອງແທັບ "ຕິດຕໍ່ລູກຄ້າ": ກວດທຸກ 10 ວິນາທີ + ເມື່ອປ່ຽນໜ້າ + ເມື່ອໜ້າຕິດຕໍ່ລູກຄ້າແຈ້ງວ່າມີການປ່ຽນ
  useEffect(() => {
    if (!admin) return undefined;
    let stop = false;
    const loadCount = async () => {
      try {
        const res = await fetch(API_BASE + '/api/kitchen-alerts/count', { credentials: 'include' });
        const d = await res.json().catch(() => ({}));
        if (!stop && res.ok) setContactCount(Number(d.open) || 0);
      } catch (e) { /* ignore */ }
    };
    loadCount();
    const t = setInterval(loadCount, 10000);
    window.addEventListener('kitchen-alerts-changed', loadCount);
    return () => {
      stop = true;
      clearInterval(t);
      window.removeEventListener('kitchen-alerts-changed', loadCount);
    };
  }, [admin, location.pathname]);

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
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px 16px',
        padding: '10px 24px',
        background: 'linear-gradient(to right, #8B0000, #a30000)',
        color: 'white',
        boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
        fontSize: '14px'
      }}>
        <span style={{
          fontSize: '19px',
          fontWeight: 700,
          letterSpacing: '0.5px',
          color: '#ffffff',
          whiteSpace: 'nowrap'
        }}>
          ຈັດການຮ້ານອາຫານ
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
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
      </div>
      <header>
        <nav>
          <Link to="/admin" className={isActive('/admin')}>ເມນູ</Link>
          <Link to="/admin/orders" className={isActive('/admin/orders')}>ບັນທືກການສັ່ງ</Link>
          <Link to="/admin/tables" className={isActive('/admin/tables')}>ອໍເດີ້ອາຫານ</Link>
          <Link to="/admin/qrcode" className={isActive('/admin/qrcode')}>QR Code</Link>
          <Link to="/admin/dashboard" className={isActive('/admin/dashboard')}>ລາຍງານ</Link>
          <Link to="/admin/staff" className={isActive('/admin/staff')}>ພະນັກງານ</Link>
          <Link to="/admin/contact" className={isActive('/admin/contact')}>
            📞 ຕິດຕໍ່ລູກຄ້າ
            {contactCount > 0 && (
              <span
                style={{
                  display: 'inline-block',
                  marginLeft: 8,
                  minWidth: 22,
                  padding: '1px 7px',
                  borderRadius: 999,
                  background: '#d9362b',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 900,
                  lineHeight: 1.5,
                  textAlign: 'center',
                }}
              >
                {contactCount}
              </span>
            )}
          </Link>
        </nav>
      </header>
      <Outlet context={{ admin }} />
    </>
  );
}