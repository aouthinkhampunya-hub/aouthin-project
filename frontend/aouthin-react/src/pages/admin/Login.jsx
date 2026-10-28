import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../../api.js';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      // area 'admin': ບັນຊີຄົວຈະຖືກປະຕິເສດ ແລະ ຖືກບອກໃຫ້ໄປໜ້າລັອກອິນຄົວ
      await login(username, password, 'admin');
      navigate('/admin');
    } catch (err) {
      setError(err.error || 'ເຂົ້າສູ່ລະບົບບໍ່ສຳເລັດ');
      setLoading(false);
    }
  }

  return (
    <div className="lg-root">
      <style>{`
        @keyframes lgFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes lgIn {
          from { opacity: 0; transform: translateY(18px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes lgShake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          75% { transform: translateX(6px); }
        }
        @keyframes lgSpin { to { transform: rotate(360deg); } }

        body .lg-root {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          z-index: 9000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          box-sizing: border-box;
          overflow: auto;
          background:
            radial-gradient(circle at 15% 20%, rgba(255, 201, 60, 0.18), transparent 45%),
            radial-gradient(circle at 85% 85%, rgba(255, 120, 60, 0.22), transparent 45%),
            linear-gradient(135deg, #5c0d06 0%, #8b0000 45%, #3a0a05 100%);
        }
        body .lg-root .lg-deco {
          position: absolute;
          font-size: 64px;
          opacity: 0.12;
          user-select: none;
          pointer-events: none;
          animation: lgFloat 6s ease-in-out infinite;
        }
        body .lg-root .lg-deco.d1 { top: 10%; left: 8%; }
        body .lg-root .lg-deco.d2 { bottom: 12%; left: 14%; animation-delay: 1.5s; font-size: 52px; }
        body .lg-root .lg-deco.d3 { top: 16%; right: 10%; animation-delay: 3s; font-size: 56px; }
        body .lg-root .lg-deco.d4 { bottom: 10%; right: 8%; animation-delay: 2s; }

        body .lg-root .lg-card {
          position: relative;
          width: 100%;
          max-width: 410px;
          box-sizing: border-box;
          padding: 40px 34px 34px;
          border-radius: 26px;
          background: #fffaf3;
          box-shadow: 0 30px 80px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.08);
          animation: lgIn 0.5s ease;
        }
        body .lg-root .lg-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 6px;
          border-radius: 26px 26px 0 0;
          background: linear-gradient(90deg, #ffc93c, #e8590c, #b8380e);
        }

        body .lg-root .lg-logo {
          position: relative;
          z-index: 2; /* ໃຫ້ຢູ່ເທິງແຖບສີ ບໍ່ໃຫ້ແຖບຂີດທັບຮູບຈານ */
          width: 78px;
          height: 78px;
          margin: -76px auto 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: linear-gradient(145deg, #ffd45e, #e8590c);
          border: 5px solid #fffaf3;
          font-size: 38px;
          box-shadow: 0 10px 26px rgba(184, 56, 14, 0.45);
        }
        body .lg-root .lg-brand {
          margin: 0;
          text-align: center;
          font-size: 26px;
          font-weight: 900;
          letter-spacing: 2px;
          color: #7a1f0f;
        }
        body .lg-root .lg-title {
          margin: 4px 0 26px;
          text-align: center;
          font-size: 15px;
          font-weight: 600;
          color: #7d6e60;
        }

        body .lg-root .lg-field { position: relative; margin-bottom: 14px; }
        body .lg-root .lg-ico {
          position: absolute;
          left: 15px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 18px;
          pointer-events: none;
          opacity: 0.85;
        }
        body .lg-root .lg-input {
          display: block;
          width: 100%;
          height: 52px;
          margin: 0;
          padding: 0 50px 0 46px;
          box-sizing: border-box;
          border: 2px solid #ecdccb;
          border-radius: 14px;
          background: #fff;
          color: #2b1b0e;
          font-size: 16px;
          font-family: inherit;
          outline: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        body .lg-root .lg-input::placeholder { color: #a8998a; }
        body .lg-root .lg-input:focus {
          border-color: #e8590c;
          box-shadow: 0 0 0 4px rgba(232, 89, 12, 0.15);
        }
        body .lg-root .lg-eye {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          width: 38px;
          height: 38px;
          margin: 0;
          padding: 0;
          border: none;
          border-radius: 10px;
          background: transparent;
          font-size: 18px;
          cursor: pointer;
          transition: background 0.15s ease;
        }
        body .lg-root .lg-eye:hover { background: #f3e4d6; }

        body .lg-root .lg-error {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 4px 0 14px;
          padding: 11px 14px;
          border-radius: 12px;
          background: #fdecea;
          border: 1px solid #f5c2bd;
          color: #b3261e;
          font-size: 14px;
          font-weight: 700;
          line-height: 1.4;
          animation: lgShake 0.35s ease;
        }

        body .lg-root .lg-submit {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          height: 54px;
          margin: 6px 0 0;
          padding: 0;
          border: none;
          border-radius: 14px;
          background: linear-gradient(135deg, #e8590c, #b8380e);
          color: #fff;
          font-size: 17px;
          font-weight: 800;
          font-family: inherit;
          cursor: pointer;
          box-shadow: 0 10px 22px rgba(184, 56, 14, 0.4);
          transition: transform 0.12s ease, filter 0.15s ease, box-shadow 0.15s ease;
        }
        body .lg-root .lg-submit:hover:not(:disabled) {
          filter: brightness(1.08);
          box-shadow: 0 14px 28px rgba(184, 56, 14, 0.5);
        }
        body .lg-root .lg-submit:active:not(:disabled) { transform: scale(0.98); }
        body .lg-root .lg-submit:disabled { opacity: 0.75; cursor: default; }
        body .lg-root .lg-spinner {
          width: 18px;
          height: 18px;
          border: 3px solid rgba(255, 255, 255, 0.4);
          border-top-color: #fff;
          border-radius: 50%;
          animation: lgSpin 0.7s linear infinite;
        }

        body .lg-root .lg-foot {
          margin: 22px 0 0;
          text-align: center;
          font-size: 12px;
          color: #a8998a;
        }

        @media (max-width: 480px) {
          body .lg-root .lg-card { padding: 38px 22px 28px; }
        }
      `}</style>

      <span className="lg-deco d1">🍜</span>
      <span className="lg-deco d2">🥘</span>
      <span className="lg-deco d3">🍤</span>
      <span className="lg-deco d4">🍛</span>

      <div className="lg-card">
        <div className="lg-logo">🍽️</div>
        <h1 className="lg-brand">AOUTHIN</h1>
        <p className="lg-title">ເຂົ້າສູ່ລະບົບຮ້ານອາຫານ</p>

        <form onSubmit={handleSubmit}>
          <div className="lg-field">
            <span className="lg-ico">👤</span>
            <input
              className="lg-input"
              placeholder="ຊື່ຜູ້ໃຊ້"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
            />
          </div>

          <div className="lg-field">
            <span className="lg-ico">🔒</span>
            <input
              className="lg-input"
              type={showPw ? 'text' : 'password'}
              placeholder="ລະຫັດຜ່ານ"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <button
              type="button"
              className="lg-eye"
              onClick={() => setShowPw((v) => !v)}
              aria-label={showPw ? 'ເຊື່ອງລະຫັດຜ່ານ' : 'ສະແດງລະຫັດຜ່ານ'}
              title={showPw ? 'ເຊື່ອງລະຫັດຜ່ານ' : 'ສະແດງລະຫັດຜ່ານ'}
            >
              {showPw ? '🙈' : '👁️'}
            </button>
          </div>

          {error && <div className="lg-error">⚠️ {error}</div>}

          <button type="submit" className="lg-submit" disabled={loading}>
            {loading ? (<><span className="lg-spinner" /> ກຳລັງເຂົ້າສູ່ລະບົບ...</>) : 'ເຂົ້າສູ່ລະບົບ'}
          </button>
        </form>

        <p className="lg-foot">ຮ້ານອາຫານຕາມສັ່ງ AOUTHIN</p>
      </div>
    </div>
  );
}