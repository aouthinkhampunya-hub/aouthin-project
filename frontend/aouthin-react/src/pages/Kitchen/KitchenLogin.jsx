import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authMe, login } from '../../api.js';

// ===== ໜ້າລັອກອິນຂອງຄົວ (ແຍກຈາກລັອກອິນ admin) ທີ່ /kitchen/login =====
export default function KitchenLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  // ຖ້າລັອກອິນຢູ່ແລ້ວ ໄປໜ້າຄົວເລີຍ
  useEffect(() => {
    authMe().then(() => navigate('/kitchen', { replace: true })).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) {
      setError('ກະລຸນາໃສ່ຊື່ຜູ້ໃຊ້ ແລະ ລະຫັດຜ່ານ');
      return;
    }
    setBusy(true);
    try {
      await login(username.trim(), password, 'kitchen');
      navigate('/kitchen', { replace: true });
    } catch (err) {
      setError(err.error || 'ເຂົ້າສູ່ລະບົບບໍ່ສຳເລັດ');
    }
    setBusy(false);
  }

  const inputStyle = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '14px 16px',
    marginBottom: 12,
    border: '2px solid #e8d5c4',
    borderRadius: 12,
    fontSize: 16,
    fontFamily: 'inherit',
    outline: 'none',
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        boxSizing: 'border-box',
        background: 'linear-gradient(160deg, #2b1b0e 0%, #7a1f0f 100%)',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: 380,
          padding: '32px 26px 26px',
          borderRadius: 24,
          background: '#fff',
          boxShadow: '0 24px 70px rgba(0, 0, 0, 0.45)',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ textAlign: 'center', fontSize: 46, lineHeight: 1 }}>👨‍🍳</div>
        <h1
          style={{
            margin: '10px 0 4px',
            textAlign: 'center',
            fontSize: 24,
            fontWeight: 900,
            color: '#7a1f0f',
          }}
        >
          ເຂົ້າສູ່ລະບົບຄົວ
        </h1>
        <p style={{ margin: '0 0 20px', textAlign: 'center', color: '#6b5a4c', fontSize: 14 }}>
          ຮ້ານອາຫານຕາມສັ່ງ AOUTHIN
        </p>

        <input
          style={inputStyle}
          type="text"
          placeholder="ຊື່ຜູ້ໃຊ້"
          autoComplete="username"
          autoFocus
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          style={inputStyle}
          type="password"
          placeholder="ລະຫັດຜ່ານ"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && (
          <p style={{ margin: '0 0 12px', color: '#c0392b', fontSize: 14, fontWeight: 700 }}>
            ⚠️ {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          style={{
            width: '100%',
            padding: '14px 16px',
            border: 'none',
            borderRadius: 12,
            background: busy ? '#b8967f' : '#7a1f0f',
            color: '#fff',
            fontSize: 17,
            fontWeight: 800,
            fontFamily: 'inherit',
            cursor: busy ? 'default' : 'pointer',
          }}
        >
          {busy ? 'ກຳລັງເຂົ້າສູ່ລະບົບ...' : 'ເຂົ້າສູ່ລະບົບ'}
        </button>
      </form>
    </div>
  );
}