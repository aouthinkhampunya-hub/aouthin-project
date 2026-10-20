import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getBills, updateOrderStatus, cancelOrder } from '../../api.js';
import '../../styles/admin-kitchen.css';
import '../../styles/admin-kitchen-extra.css';

// ຄົວເຮັດແຕ່ 2 ຂັ້ນ: pending -> cooking -> ready
const nextStatus = (s) => (s === 'pending' ? 'cooking' : s === 'cooking' ? 'ready' : null);
const nextLabel = (s) => (s === 'pending' ? '🔥 ເລີ່ມເຮັດ' : s === 'cooking' ? '✅ ເຮັດແລ້ວ' : '');

// 3 ປະເພດອໍເດີ້
const TABS = [
  { key: 'dine_in', icon: '🍽️', label: 'ອໍເດີ້ໜ້າຮ້ານ' },
  { key: 'pickup', icon: '🥡', label: 'ມາຮັບເຄື່ອງເອງ' },
  { key: 'delivery', icon: '🛵', label: 'ສົ່ງເຖິງບ້ານ' },
];

const typeOf = (bill) => bill.order_type || 'dine_in';
const isOnline = (bill) => typeOf(bill) !== 'dine_in';
const billTitle = (bill) => {
  if (!isOnline(bill)) return `ໂຕະ ${bill.table_number}`;
  const type = typeOf(bill) === 'delivery' ? '🛵 ສົ່ງເຖິງບ້ານ' : '🥡 ມາຮັບເອງ';
  return `${type} #${bill.bill_no || bill.id}`;
};

export default function Kitchen() {
  const [bills, setBills] = useState(null); // null = ກຳລັງໂຫລດ
  const [toast, setToast] = useState(null); // { msg, key }
  const [readyPop, setReadyPop] = useState(null); // { key, sub, detail } ກ່ອງ "ອໍເດີ້ພ້ອມເສີບແລ້ວ" ກາງຈໍ
  const [cancelId, setCancelId] = useState(null);
  const [tab, setTab] = useState('dine_in');

  const audioRef = useRef(null);
  const knownIds = useRef(new Set());
  const firstLoad = useRef(true);
  const toastTimer = useRef(null);
  const readyTimer = useRef(null);

  const getCtx = () => {
    if (!audioRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioRef.current = new AC();
    }
    return audioRef.current;
  };

  const playBeep = () => {
    try {
      const ctx = getCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      [0, 0.18].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.001, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.9, now + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.16);
      });
    } catch (e) { /* ignore */ }
  };

  const showToast = (msg) => {
    clearTimeout(toastTimer.current);
    setToast({ msg, key: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  };

  // ກ່ອງ "ອໍເດີ້ພ້ອມເສີບແລ້ວ" ກາງຈໍ (ປິດເອງຫຼັງ 4 ວິນາທີ ຖ້າບໍ່ກົດ ຕົກລົງ)
  const showReady = (sub, detail) => {
    clearTimeout(readyTimer.current);
    setReadyPop({ key: Date.now(), sub: sub || '', detail: detail || '' });
    readyTimer.current = setTimeout(() => setReadyPop(null), 4000);
  };

  const closeReady = () => {
    clearTimeout(readyTimer.current);
    setReadyPop(null);
  };

  const load = useCallback(async () => {
    try {
      const data = await getBills();
      // ຄົວເຫັນສະເພາະລາຍການທີ່ຍັງຕ້ອງເຮັດ (pending, cooking)
      const active = (Array.isArray(data) ? data : [])
        .map((b) => ({
          ...b,
          items: (b.items || []).filter((i) => i.status === 'pending' || i.status === 'cooking'),
        }))
        .filter((b) => b.items.length > 0);

      const current = new Set();
      active.forEach((b) => b.items.forEach((i) => current.add(i.id)));

      if (!firstLoad.current) {
        let hasNew = false;
        current.forEach((id) => { if (!knownIds.current.has(id)) hasNew = true; });
        if (hasNew) playBeep();
      }
      knownIds.current = current;
      firstLoad.current = false;
      setBills(active);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    // ເປີດ audio ຫຼັງຜູ້ໃຊ້ກົດຄັ້ງທຳອິດ (browser ບັງຄັບ)
    const unlock = () => getCtx();
    document.addEventListener('click', unlock, { once: true });
    return () => {
      clearInterval(timer);
      clearTimeout(toastTimer.current);
      clearTimeout(readyTimer.current);
      document.removeEventListener('click', unlock);
    };
  }, [load]);

  // ກົດ Esc / Enter ເພື່ອປິດກ່ອງ "ພ້ອມເສີບ"
  useEffect(() => {
    if (!readyPop) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        clearTimeout(readyTimer.current);
        setReadyPop(null);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [readyPop]);

  // ອັບເດດ 1 ລາຍການ (bill, item ໃຊ້ສະແດງໃນກ່ອງ "ພ້ອມເສີບ")
  const updateStatus = async (id, status, bill, item) => {
    try {
      await updateOrderStatus(id, status);
      if (status === 'ready') {
        showReady(
          bill ? billTitle(bill) : '',
          item ? `${item.product_name} x${item.quantity}` : ''
        );
      }
    } catch (e) {
      showToast('❌ ' + (e?.error || 'ອັບເດດບໍ່ໄດ້'));
    }
    load();
  };

  // ອັບເດດທັງໝົດຂອງບິນ
  const bulkUpdate = async (ids, status, bill) => {
    try {
      await Promise.all(ids.map((id) => updateOrderStatus(id, status)));
      if (status === 'ready') {
        showReady(bill ? billTitle(bill) : '', `${ids.length} ລາຍການ`);
      }
    } catch (e) {
      showToast('❌ ' + (e?.error || 'ອັບເດດບໍ່ໄດ້'));
    }
    load();
  };

  const confirmCancel = async () => {
    const id = cancelId;
    setCancelId(null);
    try {
      await cancelOrder(id);
      showToast('✅ ຍົກເລີກອໍເດີ້ສຳເລັດ');
    } catch (e) {
      showToast('❌ ' + (e?.error || 'ຍົກເລີກບໍ່ໄດ້'));
    }
    load();
  };

  const countOf = (key) => (bills || []).filter((b) => typeOf(b) === key).length;
  const list = (bills || []).filter((b) => typeOf(b) === tab);

  return (
    <div className="kitchen-page">
      {/* ສະໄຕລ໌ກ່ອງ "ອໍເດີ້ພ້ອມເສີບແລ້ວ" (ແບບດຽວກັບກ່ອງ "ສັ່ງອາຫານສຳເລັດ!" ຂອງລູກຄ້າ) */}
      <style>{`
        @keyframes krFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes krPop {
          0% { opacity: 0; transform: scale(0.88) translateY(10px); }
          60% { opacity: 1; transform: scale(1.03) translateY(0); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes krIcon {
          0% { transform: scale(0.6); }
          60% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }

        body.is-admin .kr-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          z-index: 10050;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          background: rgba(30, 20, 10, 0.6);
          animation: krFade 0.18s ease;
        }
        body.is-admin .kr-card {
          width: 100%;
          max-width: 340px;
          box-sizing: border-box;
          padding: 30px 28px 28px;
          border-radius: 22px;
          background: #fff8e8;
          text-align: center;
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
          animation: krPop 0.3s ease;
        }
        body.is-admin .kr-icon {
          margin: 0 auto 8px;
          font-size: 54px;
          line-height: 1.1;
          animation: krIcon 0.45s ease;
        }
        body.is-admin .kr-title {
          margin: 0 0 8px;
          font-size: 22px;
          font-weight: 900;
          color: #2e6b1f;
        }
        body.is-admin .kr-sub {
          margin: 0;
          font-size: 17px;
          font-weight: 800;
          color: #2b1b0e;
        }
        body.is-admin .kr-detail {
          margin: 4px 0 0;
          font-size: 14px;
          font-weight: 700;
          color: #6b5a4c;
        }
        body.is-admin .kr-hint {
          margin: 8px 0 18px;
          font-size: 13px;
          font-weight: 600;
          line-height: 1.5;
          color: #7d6e60;
        }
        body.is-admin .kr-ok {
          display: block;
          width: 100%;
          padding: 14px 16px;
          border: none;
          border-radius: 12px;
          background: #3a7d34;
          color: #fff;
          font-size: 16px;
          font-weight: 800;
          font-family: inherit;
          cursor: pointer;
          transition: filter 0.15s ease, transform 0.1s ease;
        }
        body.is-admin .kr-ok:hover { filter: brightness(1.1); }
        body.is-admin .kr-ok:active { transform: scale(0.98); }
      `}</style>

      <div className="kitchen-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`kitchen-tab${tab === t.key ? ' active' : ''}${countOf(t.key) > 0 ? ' has' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.icon} {t.label}
            <span className="kitchen-tab-count">{countOf(t.key)}</span>
          </button>
        ))}
      </div>

      {bills !== null && list.length === 0 && (
        <div className="kitchen-empty">✅ ບໍ່ມີອາຫານທີ່ຕ້ອງເຮັດໃນປະເພດນີ້</div>
      )}

      {bills !== null && list.length > 0 && (
        <div className="kitchen-grid">
          {list.map((bill) => {
            const online = isOnline(bill);
            const hasCooking = bill.items.some((i) => i.status === 'cooking');
            const pendingIds = bill.items.filter((i) => i.status === 'pending').map((i) => i.id);
            const cookingIds = bill.items.filter((i) => i.status === 'cooking').map((i) => i.id);
            return (
              <div
                className={`kitchen-card${hasCooking ? ' cooking' : ''}${online ? ' online-' + typeOf(bill) : ''}`}
                key={bill.id ?? bill.table_number}
              >
                <h2>{billTitle(bill)}</h2>
                {online && bill.customer_name && (
                  <p className="kitchen-cust">
                    👤 {bill.customer_name}
                    {bill.customer_phone && <> &nbsp;📞 {bill.customer_phone}</>}
                  </p>
                )}

                <div className="kitchen-bulk-actions">
                  {pendingIds.length > 0 && (
                    <button className="btn-start-all" onClick={() => bulkUpdate(pendingIds, 'cooking', bill)}>
                      🔥 ເລີ່ມເຮັດທັງໝົດ ({pendingIds.length})
                    </button>
                  )}
                  {cookingIds.length > 0 && (
                    <button className="btn-done-all" onClick={() => bulkUpdate(cookingIds, 'ready', bill)}>
                      ✅ ເຮັດແລ້ວທັງໝົດ ({cookingIds.length})
                    </button>
                  )}
                </div>

                {bill.items.map((item) => (
                  <div className="kitchen-item" key={item.id}>
                    <div className="kitchen-item-info">
                      <span className="kitchen-item-name">{item.product_name}</span>{' '}
                      <span className="kitchen-item-qty">x{item.quantity}</span>
                    </div>
                    <div className="kitchen-item-actions">
                      <button
                        className={item.status === 'pending' ? 'btn-start' : 'btn-done'}
                        onClick={() => updateStatus(item.id, nextStatus(item.status), bill, item)}
                      >
                        {nextLabel(item.status)}
                      </button>
                      <button className="btn-cancel" onClick={() => setCancelId(item.id)}>
                        ຍົກເລີກ
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {cancelId !== null && (
        <div
          className="kc-overlay"
          onClick={(e) => e.target === e.currentTarget && setCancelId(null)}
        >
          <div className="kc-box">
            <div className="kc-icon">🗑️</div>
            <h3>ຍົກເລີກລາຍການ</h3>
            <p>ຢືນຢັນວ່າຈະຍົກເລີກລາຍການນີ້? (ວັດຖຸດິບໝົດ ຫຼື ເຫດຜົນອື່ນ)</p>
            <div className="kc-actions">
              <button className="kc-no" onClick={() => setCancelId(null)}>ຍົກເລີກ</button>
              <button className="kc-yes" onClick={confirmCancel}>ຢືນຢັນ</button>
            </div>
          </div>
        </div>
      )}

      {/* ກ່ອງ "ອໍເດີ້ພ້ອມເສີບແລ້ວ" ກາງຈໍ */}
      {readyPop && (
        <div
          className="kr-overlay"
          key={readyPop.key}
          onClick={(e) => e.target === e.currentTarget && closeReady()}
        >
          <div className="kr-card">
            <div className="kr-icon">🍽️</div>
            <h2 className="kr-title">ອໍເດີ້ພ້ອມເສີບແລ້ວ!</h2>
            {readyPop.sub && <p className="kr-sub">{readyPop.sub}</p>}
            {readyPop.detail && <p className="kr-detail">{readyPop.detail}</p>}
            <p className="kr-hint">ກະລຸນາເອົາອາຫານໄປເສີບໄດ້ເລີຍ</p>
            <button type="button" className="kr-ok" onClick={closeReady} autoFocus>
              ຕົກລົງ
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div className="kitchen-toast" key={toast.key}>{toast.msg}</div>
      )}
    </div>
  );
}