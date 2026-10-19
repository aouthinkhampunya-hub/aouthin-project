import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { authMe, logout } from '../../api.js';

// ໃຜເຂົ້າຫ້ອງຄົວໄດ້: ເຈົ້າຂອງຮ້ານ + ພະນັກງານຄົວ (ຫ້າມສະເພາະພະນັກງານທົ່ວໄປ role = 'staff')
const canEnterKitchen = (u) => !!u && u.role !== 'staff';

export default function KitchenLayout() {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ok | denied | nologin
  const navigate = useNavigate();

  useEffect(() => {
    document.body.classList.add('is-admin');
    return () => document.body.classList.remove('is-admin');
  }, []);

  useEffect(() => {
    authMe()
      .then((u) => {
        if (canEnterKitchen(u)) {
          setUser(u);
          setStatus('ok');
        } else {
          setStatus('denied');
        }
      })
      .catch(() => setStatus('nologin'));
  }, []);

  useEffect(() => {
    if (status === 'nologin') navigate('/kitchen/login', { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function handleLogout() {
    try { await logout(); } catch (e) {}
    navigate('/kitchen/login', { replace: true });
  }

  if (status === 'loading' || status === 'nologin') {
    return <p style={{ padding: 40, textAlign: 'center' }}>ກຳລັງກວດສອບ...</p>;
  }

  if (status === 'denied') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            maxWidth: 380,
            padding: '32px 26px',
            borderRadius: 24,
            background: '#fff',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 46 }}>🚫</div>
          <h2 style={{ margin: '10px 0 8px', color: '#7a1f0f' }}>ບໍ່ມີສິດເຂົ້າໜ້ານີ້</h2>
          <p style={{ margin: '0 0 20px', color: '#6b5a4c', fontSize: 15 }}>
            ໜ້ານີ້ສຳລັບເຈົ້າຂອງຮ້ານ ແລະ ພະນັກງານຄົວເທົ່ານັ້ນ
          </p>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: '14px 16px',
              border: 'none',
              borderRadius: 12,
              background: '#7a1f0f',
              color: '#fff',
              fontSize: 16,
              fontWeight: 800,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            ອອກຈາກລະບົບ ແລ້ວເຂົ້າດ້ວຍບັນຊີຄົວ
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          padding: '12px 24px',
          background: 'linear-gradient(to right, #8B0000, #a30000)',
          color: 'white',
          boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
          fontSize: 14,
        }}
      >
        <strong style={{ fontSize: 18 }}>👨‍🍳 ຫ້ອງຄົວ AOUTHIN</strong>
        <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span>{user.name}</span>
          <button
            onClick={handleLogout}
            style={{
              cursor: 'pointer',
              padding: '6px 16px',
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.4)',
              borderRadius: 6,
              color: 'white',
              fontSize: 13,
              fontFamily: 'inherit',
            }}
          >
            ອອກຈາກລະບົບ
          </button>
        </span>
      </div>
      <Outlet context={{ user }} />
    </>
  );
}