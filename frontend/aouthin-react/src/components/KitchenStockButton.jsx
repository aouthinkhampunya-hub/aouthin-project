import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { API_BASE } from '../api.js';

// ===== ປຸ່ມ "ສະຕ໊ອກສິນຄ້າ" ຂອງໜ້າຄົວ =====
// ກົດ → ເຫັນລາຍການເມນູ (ຮູບ + ຊື່ + ສະຕ໊ອກ) → ກົດເມນູ → ແຈ້ງແອັດມິນ
// ລະບົບຈະສົ່ງ ເມນູ + ຊື່ + ເບີ ຂອງລູກຄ້າທີ່ສັ່ງເມນູນັ້ນ ໄປທີ່ໜ້າແອັດມິນ (ປຸ່ມ "ຕິດຕໍ່ລູກຄ້າ")

async function api(path, options = {}) {
  const res = await fetch(API_BASE + '/api' + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, ...data };
  return data;
}

const imgSrc = (p) => {
  if (!p) return '';
  if (/^(https?:|data:)/.test(p)) return p;
  return API_BASE + (p.startsWith('/') ? p : '/' + p);
};

export default function KitchenStockButton() {
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState(null); // null = ກຳລັງໂຫຼດ
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState(null);     // ເມນູທີ່ເລືອກ (ໜ້າຢືນຢັນ)
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(null);         // { name, count } ຫຼັງສົ່ງສຳເລັດ

  const load = async () => {
    try {
      const data = await api('/products');
      setProducts(Array.isArray(data) ? data : []);
      setError('');
    } catch (e) {
      setProducts([]);
      setError(e?.error || 'ໂຫຼດລາຍການສະຕ໊ອກບໍ່ໄດ້');
    }
  };

  const openModal = () => {
    setOpen(true);
    setPicked(null);
    setSent(null);
    setNote('');
    setQ('');
    setError('');
    setProducts(null);
    load();
  };

  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (picked && !sent) setPicked(null);
      else setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, picked, sent]);

  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase();
    return (products || []).filter((p) => !k || String(p.name || '').toLowerCase().includes(k));
  }, [products, q]);

  const send = async () => {
    if (!picked) return;
    setBusy(true);
    setError('');
    try {
      const r = await api('/kitchen-alerts', {
        method: 'POST',
        body: JSON.stringify({ product_id: picked.id, note: note.trim() }),
      });
      setSent({ name: picked.name, count: r.customers_count || 0 });
      setPicked(null);
      setNote('');
    } catch (e) {
      setError(e?.error || 'ສົ່ງບໍ່ສຳເລັດ ກະລຸນາລອງໃໝ່');
    }
    setBusy(false);
  };

  const stockLabel = (p) => {
    const n = Number(p.stock);
    if (!Number.isFinite(n)) return { text: '-', cls: '' };
    if (n <= 0) return { text: 'ໝົດ', cls: 'out' };
    if (n <= 5) return { text: `${n} ຈານ`, cls: 'low' };
    return { text: `${n} ຈານ`, cls: 'ok' };
  };

  return (
    <>
      <style>{`
        body.is-admin .ksk-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 9px 16px;
          border: 1px solid #ecd9c8;
          border-radius: 12px;
          background: #fff;
          color: #7a1f0f;
          font-size: 14px;
          font-weight: 800;
          font-family: inherit;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(122, 31, 15, 0.08);
          transition: transform 0.12s ease, border-color 0.12s ease;
        }
        body.is-admin .ksk-btn:hover { border-color: #b8380e; transform: translateY(-1px); }

        body.is-admin .ksk-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          z-index: 10100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          background: rgba(30, 20, 10, 0.6);
        }
        body.is-admin .ksk-box {
          position: relative;
          width: 100%;
          max-width: 600px;
          max-height: 92vh;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
          padding: 22px 20px 18px;
          border-radius: 22px;
          background: #fff;
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
        }
        body.is-admin .ksk-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
        body.is-admin .ksk-title { margin: 0; font-size: 20px; font-weight: 900; color: #7a1f0f; }
        body.is-admin .ksk-close {
          width: 38px; height: 38px;
          border: none; border-radius: 50%;
          background: #f3e4de; color: #7a1f0f;
          font-size: 17px; font-weight: 800; cursor: pointer;
        }
        body.is-admin .ksk-close:hover { background: #7a1f0f; color: #fff; }
        body.is-admin .ksk-hint { margin: 0 0 10px; font-size: 13px; color: #6b5a4c; line-height: 1.5; }
        body.is-admin .ksk-search {
          width: 100%; box-sizing: border-box;
          padding: 11px 14px; margin-bottom: 10px;
          border: 2px solid #ecd9c8; border-radius: 12px;
          font-size: 15px; font-family: inherit; outline: none;
        }
        body.is-admin .ksk-search:focus { border-color: #b8380e; }
        body.is-admin .ksk-list { overflow-y: auto; margin: 0 -6px; padding: 0 6px; }
        body.is-admin .ksk-row {
          display: flex; align-items: center; gap: 14px;
          width: 100%; box-sizing: border-box;
          padding: 10px 10px;
          border: none; border-bottom: 1px solid #f3e6da;
          background: none; text-align: left;
          font-family: inherit; cursor: pointer;
          border-radius: 12px;
        }
        body.is-admin .ksk-row:hover { background: #fff6ee; }
        body.is-admin .ksk-img {
          width: 54px; height: 54px; flex-shrink: 0;
          object-fit: cover; border-radius: 12px; background: #f3ece4;
        }
        body.is-admin .ksk-img.empty {
          display: flex; align-items: center; justify-content: center; font-size: 24px;
        }
        body.is-admin .ksk-name { flex: 1; min-width: 0; font-size: 17px; font-weight: 700; color: #2b1b0e; }
        body.is-admin .ksk-stock {
          flex-shrink: 0; padding: 5px 12px; border-radius: 999px;
          font-size: 13px; font-weight: 800;
        }
        body.is-admin .ksk-stock.ok { background: #e8f5e9; color: #2e6b1f; }
        body.is-admin .ksk-stock.low { background: #fff3cd; color: #7a5b00; }
        body.is-admin .ksk-stock.out { background: #fdecea; color: #b3261e; }
        body.is-admin .ksk-empty { padding: 30px 10px; text-align: center; color: #6b5a4c; }
        body.is-admin .ksk-error {
          margin: 10px 0 0; padding: 9px 12px; border-radius: 10px;
          background: #fdecea; color: #b3261e; font-size: 14px; font-weight: 700;
        }

        body.is-admin .ksk-confirm { text-align: center; }
        body.is-admin .ksk-confirm .ksk-img { width: 96px; height: 96px; margin: 4px auto 10px; display: block; }
        body.is-admin .ksk-confirm h3 { margin: 0 0 6px; font-size: 21px; color: #2b1b0e; }
        body.is-admin .ksk-confirm p { margin: 0 0 12px; font-size: 14px; color: #4a3a2c; line-height: 1.6; }
        body.is-admin .ksk-note {
          width: 100%; box-sizing: border-box;
          padding: 11px 14px; margin-bottom: 14px;
          border: 2px solid #ecd9c8; border-radius: 12px;
          font-size: 15px; font-family: inherit; outline: none;
        }
        body.is-admin .ksk-actions { display: flex; gap: 10px; }
        body.is-admin .ksk-actions button {
          flex: 1; min-height: 48px;
          border: none; border-radius: 12px;
          font-size: 15px; font-weight: 800; font-family: inherit; cursor: pointer;
        }
        body.is-admin .ksk-actions .no { background: #f3e4de; color: #7a1f0f; }
        body.is-admin .ksk-actions .yes { background: #c0392b; color: #fff; }
        body.is-admin .ksk-actions .yes:disabled { opacity: 0.6; cursor: default; }
        body.is-admin .ksk-done-icon { font-size: 54px; line-height: 1.1; }
      `}</style>

      <button type="button" className="ksk-btn" onClick={openModal}>
        📦 ສະຕ໊ອກສິນຄ້າ
      </button>

      {open && createPortal(
        <div className="ksk-overlay" onClick={(e) => e.target === e.currentTarget && close()}>
          <div className="ksk-box">
            <div className="ksk-head">
              <h2 className="ksk-title">📦 ສະຕ໊ອກສິນຄ້າ</h2>
              <button type="button" className="ksk-close" onClick={close} aria-label="ປິດ">✕</button>
            </div>

            {/* ຫຼັງສົ່ງສຳເລັດ */}
            {sent && (
              <div className="ksk-confirm">
                <div className="ksk-done-icon">✅</div>
                <h3>ສົ່ງໃຫ້ແອັດມິນແລ້ວ</h3>
                <p>
                  ເມນູ <b>{sent.name}</b><br />
                  {sent.count > 0
                    ? `ແອັດມິນຈະເຫັນຊື່ ແລະ ເບີ ຂອງລູກຄ້າທີ່ສັ່ງເມນູນີ້ (${sent.count} ບິນ)`
                    : 'ຕອນນີ້ບໍ່ມີບິນຄ້າງທີ່ສັ່ງເມນູນີ້'}
                </p>
                <div className="ksk-actions">
                  <button type="button" className="no" onClick={() => setSent(null)}>ແຈ້ງເມນູອື່ນ</button>
                  <button type="button" className="yes" style={{ background: '#2e7d32' }} onClick={close}>ປິດ</button>
                </div>
              </div>
            )}

            {/* ໜ້າຢືນຢັນແຈ້ງແອັດມິນ */}
            {!sent && picked && (
              <div className="ksk-confirm">
                {picked.image
                  ? <img className="ksk-img" src={imgSrc(picked.image)} alt={picked.name} />
                  : <div className="ksk-img empty">🍽️</div>}
                <h3>{picked.name}</h3>
                <p>
                  ແຈ້ງແອັດມິນ ເພື່ອໃຫ້ຕິດຕໍ່ລູກຄ້າທີ່ສັ່ງເມນູນີ້?<br />
                  ລະບົບຈະສົ່ງ <b>ຊື່ ແລະ ເບີໂທ</b> ຂອງລູກຄ້າທີ່ສັ່ງເມນູນີ້ໄປໃຫ້ແອັດມິນ
                </p>
                <input
                  className="ksk-note"
                  type="text"
                  maxLength={200}
                  placeholder="ໝາຍເຫດ (ບໍ່ບັງຄັບ) ເຊັ່ນ ວັດຖຸດິບໝົດ"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                {error && <div className="ksk-error" style={{ marginBottom: 12 }}>⚠️ {error}</div>}
                <div className="ksk-actions">
                  <button type="button" className="no" onClick={() => setPicked(null)}>ກັບຄືນ</button>
                  <button type="button" className="yes" disabled={busy} onClick={send}>
                    {busy ? 'ກຳລັງສົ່ງ...' : '📨 ແຈ້ງແອັດມິນ'}
                  </button>
                </div>
              </div>
            )}

            {/* ລາຍການເມນູ */}
            {!sent && !picked && (
              <>
                <p className="ksk-hint">ກົດເມນູທີ່ມີບັນຫາ (ເຊັ່ນ ວັດຖຸດິບໝົດ) ເພື່ອແຈ້ງແອັດມິນ ໃຫ້ຕິດຕໍ່ລູກຄ້າ</p>
                <input
                  className="ksk-search"
                  type="text"
                  placeholder="🔍 ຄົ້ນຫາເມນູ..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                <div className="ksk-list">
                  {products === null && <div className="ksk-empty">ກຳລັງໂຫຼດ...</div>}
                  {products !== null && filtered.length === 0 && (
                    <div className="ksk-empty">{error || 'ບໍ່ພົບເມນູ'}</div>
                  )}
                  {filtered.map((p) => {
                    const st = stockLabel(p);
                    return (
                      <button type="button" className="ksk-row" key={p.id} onClick={() => { setPicked(p); setError(''); }}>
                        {p.image
                          ? <img className="ksk-img" src={imgSrc(p.image)} alt="" />
                          : <div className="ksk-img empty">🍽️</div>}
                        <span className="ksk-name">{p.name}</span>
                        <span className={`ksk-stock ${st.cls}`}>{st.text}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}