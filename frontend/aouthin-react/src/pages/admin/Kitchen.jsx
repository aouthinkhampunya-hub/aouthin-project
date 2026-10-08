import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getBills, updateOrderStatus, cancelOrder } from '../../api.js';
import '../../styles/admin-kitchen.css';

// ຄົວເຮັດແຕ່ 2 ຂັ້ນ: pending -> cooking -> ready
const nextStatus = (s) => (s === 'pending' ? 'cooking' : s === 'cooking' ? 'ready' : null);
const nextLabel = (s) => (s === 'pending' ? '🔥 ເລີ່ມເຮັດ' : s === 'cooking' ? '✅ ເຮັດແລ້ວ' : '');

// ອໍເດີ້ອອນລາຍ (ແກັບ / ສົ່ງເຖິງບ້ານ) ບໍ່ແມ່ນໂຕະ
const isOnline = (bill) => !!bill.order_type && bill.order_type !== 'dine_in';
const billTitle = (bill) => {
  if (!isOnline(bill)) return `ໂຕະ ${bill.table_number}`;
  const type = bill.order_type === 'delivery' ? '🛵 ສົ່ງເຖິງບ້ານ' : '🥡 ແກັບ';
  return `${type} #${bill.id}`;
};

export default function Kitchen() {
  const [bills, setBills] = useState(null); // null = ກຳລັງໂຫລດ
  const [toast, setToast] = useState(null); // { msg, key }
  const [cancelId, setCancelId] = useState(null);

  const audioRef = useRef(null);
  const knownIds = useRef(new Set());
  const firstLoad = useRef(true);
  const toastTimer = useRef(null);

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
      document.removeEventListener('click', unlock);
    };
  }, [load]);

  const updateStatus = async (id, status) => {
    try {
      await updateOrderStatus(id, status);
      if (status === 'ready') showToast('🍽️ ອໍເດີ້ພ້ອມເສີບແລ້ວ');
    } catch (e) {
      showToast('❌ ' + (e?.error || 'ອັບເດດບໍ່ໄດ້'));
    }
    load();
  };

  const bulkUpdate = async (ids, status) => {
    try {
      await Promise.all(ids.map((id) => updateOrderStatus(id, status)));
      if (status === 'ready') showToast('🍽️ ອໍເດີ້ພ້ອມເສີບແລ້ວ');
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

  return (
    <div className="kitchen-page">
      {bills !== null && bills.length === 0 && (
        <div className="kitchen-empty">✅ ບໍ່ມີອາຫານທີ່ຕ້ອງເຮັດຕອນນີ້</div>
      )}

      {bills !== null && bills.length > 0 && (
        <div className="kitchen-grid">
          {bills.map((bill) => {
            const online = isOnline(bill);
            const hasCooking = bill.items.some((i) => i.status === 'cooking');
            const pendingIds = bill.items.filter((i) => i.status === 'pending').map((i) => i.id);
            const cookingIds = bill.items.filter((i) => i.status === 'cooking').map((i) => i.id);
            return (
              <div
                className={`kitchen-card${hasCooking ? ' cooking' : ''}`}
                key={bill.id ?? bill.table_number}
                style={online ? { borderLeft: '6px solid #1a73e8' } : undefined}
              >
                <h2>{billTitle(bill)}</h2>
                {online && bill.customer_name && (
                  <p style={{ margin: '-4px 0 10px', fontWeight: 700, color: '#1a73e8' }}>
                    👤 {bill.customer_name}
                  </p>
                )}

                <div className="kitchen-bulk-actions">
                  {pendingIds.length > 0 && (
                    <button className="btn-start-all" onClick={() => bulkUpdate(pendingIds, 'cooking')}>
                      🔥 ເລີ່ມເຮັດທັງໝົດ ({pendingIds.length})
                    </button>
                  )}
                  {cookingIds.length > 0 && (
                    <button className="btn-done-all" onClick={() => bulkUpdate(cookingIds, 'ready')}>
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
                        onClick={() => updateStatus(item.id, nextStatus(item.status))}
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

      {toast && (
        <div className="kitchen-toast" key={toast.key}>{toast.msg}</div>
      )}
    </div>
  );
}