import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { authMe, logout } from '../../api.js';

// ===== ໂຄງໜ້າຄົວ (/kitchen) ແຍກຈາກ admin: ກວດລັອກອິນ + ແຖບເທິງ ບໍ່ມີເມນູ admin =====
export default function KitchenLayout() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // ໃຊ້ສະໄຕລ໌ສີຄີມຂອງໜ້າ admin ເດີມ (CSS ຂອງໜ້າຄົວຂຶ້ນຕົ້ນດ້ວຍ body.is-admin)
  useEffect(() => {
    document.body.classList.add('is-admin');
    return () => document.body.classList.remove('is-admin');
  }, []);

  useEffect(() => {
    authMe()
      .then(setUser)
      .catch(() => navigate('/kitchen/login', { replace: true }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogout() {
    try { await logout(); } catch (e) {}
    navigate('/kitchen/login', { replace: true });
  }

  if (loading) return <p style={{ padding: 40, textAlign: 'center' }}>ກຳລັງກວດສອບ...</p>;
  if (!user) return null;

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