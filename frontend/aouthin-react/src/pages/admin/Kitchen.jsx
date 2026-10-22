import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getBills, updateOrderStatus, cancelOrder } from '../../api.js';
import '../../styles/admin-kitchen.css';
import '../../styles/admin-kitchen-extra.css';
import '../../styles/kitchen-upgrade.css';

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
const billKey = (bill) => bill.id ?? bill.table_number;

// ລວມເມນູດຽວກັນ (ສະຖານະດຽວກັນ) ໃນບິນດຽວກັນ ເປັນແຖວດຽວ
const groupItems = (items) => {
  const map = new Map();
  items.forEach((i) => {
    const key = `${i.product_id ?? i.product_name}|${i.status}`;
    if (!map.has(key)) {
      map.set(key, { key, product_name: i.product_name, status: i.status, quantity: 0, ids: [] });
    }
    const g = map.get(key);
    g.quantity += Number(i.quantity) || 0;
    g.ids.push(i.id);
  });
  return [...map.values()];
};

/* ===== ເວລາລໍຖ້າ ===== */
const parseTime = (v) => {
  if (!v) return null;
  let s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2} \d/.test(s)) s = s.replace(' ', 'T');
  const t = new Date(s).getTime();
  return Number.isNaN(t) ? null : t;
};
// ເວລາເລີ່ມຂອງບິນ = ເວລາສັ່ງລາຍການທຳອິດ (ຖ້າບໍ່ມີ ໃຊ້ເວລາເປີດບິນ)
const billStart = (bill) => {
  const itemTimes = (bill.items || []).map((i) => parseTime(i.created_at)).filter((t) => t !== null);
  if (itemTimes.length) return Math.min(...itemTimes);
  return parseTime(bill.created_at);
};
const minutesSince = (start, now) => {
  if (start === null) return null;
  const m = Math.floor((now - start) / 60000);
  if (m < -5 || m > 720) return null; // ເວລາຜິດປົກກະຕິ ບໍ່ສະແດງ
  return Math.max(0, m);
};
const fmtElapsed = (m) => {
  if (m < 1) return 'ຫາກໍສັ່ງ';
  if (m < 60) return `${m} ນາທີ`;
  return `${Math.floor(m / 60)} ຊມ ${m % 60} ນ`;
};
const urgencyOf = (m) => (m === null ? 'ok' : m >= 20 ? 'late' : m >= 10 ? 'warn' : 'ok');

export default function Kitchen() {
  const [bills, setBills] = useState(null); // null = ກຳລັງໂຫລດ
  const [toast, setToast] = useState(null); // { msg, key }
   const [readyPop, setReadyPop] = useState(null);
  const [cancelPop, setCancelPop] = useState(null); // ກ່ອງຜົນການຍົກເລີກ ກາງຈໍ
  const [cancelGroup, setCancelGroup] = useState(null);
  const [tab, setTab] = useState('dine_in');
  const [now, setNow] = useState(Date.now());
  const [flash, setFlash] = useState(new Set()); // ບິນທີ່ມີລາຍການໃໝ່
  const [showSummary, setShowSummary] = useState(true);
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem('kitchenMuted') === '1'; } catch (e) { return false; }
  });
  const [isFull, setIsFull] = useState(false);

  const audioRef = useRef(null);
  const mutedRef = useRef(muted);
  const knownIds = useRef(new Set());
  const firstLoad = useRef(true);
  const toastTimer = useRef(null);
    const readyTimer = useRef(null);
  const cancelPopTimer = useRef(null);
  const flashTimer = useRef(null);

  useEffect(() => { mutedRef.current = muted; }, [muted]);

  const getCtx = () => {
    if (!audioRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioRef.current = new AC();
    }
    return audioRef.current;
  };

  const playBeep = () => {
    if (mutedRef.current) return;
    try {
      const ctx = getCtx();
      if (!ctx) return;
      const t0 = ctx.currentTime;
      [0, 0.18].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.001, t0 + offset);
        gain.gain.exponentialRampToValueAtTime(0.9, t0 + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + offset + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t0 + offset);
        osc.stop(t0 + offset + 0.16);
      });
    } catch (e) { /* ignore */ }
  };

  const toggleMute = () => {
    setMuted((m) => {
      const v = !m;
      try { localStorage.setItem('kitchenMuted', v ? '1' : '0'); } catch (e) { /* ignore */ }
      return v;
    });
  };

  const toggleFull = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      document.documentElement.requestFullscreen?.();
    }
  };

  const showToast = (msg) => {
    clearTimeout(toastTimer.current);
    setToast({ msg, key: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  };

  // ກ່ອງ "ອໍເດີ້ພ້ອມເສີບແລ້ວ" ກາງຈໍ (ປິດເອງຫຼັງ 4 ວິນາທີ)
  const showReady = (sub, detail) => {
    clearTimeout(readyTimer.current);
    setReadyPop({ key: Date.now(), sub: sub || '', detail: detail || '' });
    readyTimer.current = setTimeout(() => setReadyPop(null), 4000);
  };

  const closeReady = () => {
    clearTimeout(readyTimer.current);
    setReadyPop(null);
  };
  // ກ່ອງຜົນການຍົກເລີກ ກາງຈໍ (ປິດເອງຫຼັງ 3 ວິນາທີ)
  const showCancelPop = (kind, detail) => {
    clearTimeout(cancelPopTimer.current);
    setCancelPop({ key: Date.now(), kind, detail: detail || '' });
    cancelPopTimer.current = setTimeout(() => setCancelPop(null), 3000);
  };

  const closeCancelPop = () => {
    clearTimeout(cancelPopTimer.current);
    setCancelPop(null);
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
        const newItemIds = new Set();
        current.forEach((id) => { if (!knownIds.current.has(id)) newItemIds.add(id); });
        if (newItemIds.size > 0) {
          playBeep();
          const fresh = active
            .filter((b) => b.items.some((i) => newItemIds.has(i.id)))
            .map(billKey);
          setFlash(new Set(fresh));
          clearTimeout(flashTimer.current);
          flashTimer.current = setTimeout(() => setFlash(new Set()), 8000);
        }
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
    const clock = setInterval(() => setNow(Date.now()), 15000);
    const unlock = () => getCtx();
    document.addEventListener('click', unlock, { once: true });
    const onFs = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      clearInterval(timer);
      clearInterval(clock);
      clearTimeout(toastTimer.current);
      clearTimeout(readyTimer.current);
      clearTimeout(flashTimer.current);
      document.removeEventListener('click', unlock);
      document.removeEventListener('fullscreenchange', onFs);
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

  const bulkUpdate = async (ids, status, bill, detail) => {
    try {
      await Promise.all(ids.map((id) => updateOrderStatus(id, status)));
      if (status === 'ready') {
        showReady(bill ? billTitle(bill) : '', detail || `${ids.length} ລາຍການ`);
      }
    } catch (e) {
      showToast('❌ ' + (e?.error || 'ອັບເດດບໍ່ໄດ້'));
    }
    load();
  };

   const confirmCancel = async () => {
    const group = cancelGroup;
    setCancelGroup(null);
    if (!group) return;
    const results = await Promise.allSettled(group.ids.map((id) => cancelOrder(id)));
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const label = `${group.name} x${group.quantity}`;
    if (ok === results.length) {
      showCancelPop('success', label);
    } else if (ok > 0) {
      showCancelPop('partial', `ຍົກເລີກໄດ້ ${ok} ຈາກ ${results.length} ລາຍການ`);
    } else {
      const firstErr = results.find((r) => r.status === 'rejected');
      showCancelPop('error', firstErr?.reason?.error || 'ຍົກເລີກບໍ່ໄດ້');
    }
    load();
  };

  const allBills = bills || [];
  const countOf = (key) => allBills.filter((b) => typeOf(b) === key).length;

  // ບິນເກົ່າສຸດຂຶ້ນກ່ອນ
  const list = allBills
    .filter((b) => typeOf(b) === tab)
    .sort((a, b) => {
      const sa = billStart(a);
      const sb = billStart(b);
      if (sa === null && sb === null) return 0;
      if (sa === null) return 1;
      if (sb === null) return -1;
      return sa - sb;
    });

  // ຕົວເລກສະຫຼຸບທັງໝົດ
  let totalCooking = 0;
  let totalPending = 0;
  let lateBills = 0;
  const dishMap = new Map();
  allBills.forEach((b) => {
    const m = minutesSince(billStart(b), now);
    if (m !== null && m >= 20) lateBills += 1;
    b.items.forEach((i) => {
      const q = Number(i.quantity) || 0;
      if (i.status === 'cooking') totalCooking += q;
      else totalPending += q;
      if (!dishMap.has(i.product_name)) dishMap.set(i.product_name, { name: i.product_name, pending: 0, cooking: 0 });
      const d = dishMap.get(i.product_name);
      if (i.status === 'cooking') d.cooking += q;
      else d.pending += q;
    });
  });
  const dishes = [...dishMap.values()].sort((a, b) => (b.pending + b.cooking) - (a.pending + a.cooking));
  const clockText = new Date(now).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="kitchen-page">
      {/* ສະໄຕລ໌ກ່ອງ "ອໍເດີ້ພ້ອມເສີບແລ້ວ" */}
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

      {/* ===== ແຖບເຄື່ອງມື: ເວລາ, ສະຫຼຸບ, ປິດສຽງ, ເຕັມຈໍ ===== */}
      <div className="kx-toolbar">
        <span className="kx-pill">🕒 {clockText}</span>
        <span className="kx-pill cook">🔥 ກຳລັງເຮັດ {totalCooking}</span>
        <span className="kx-pill wait">⏳ ລໍຖ້າ {totalPending}</span>
        {lateBills > 0 && <span className="kx-pill late">🚨 ບິນຊ້າ {lateBills}</span>}
        <span className="kx-spacer" />
        <button type="button" className={`kx-btn${showSummary ? ' on' : ''}`} onClick={() => setShowSummary((v) => !v)}>
          📋 ສະຫຼຸບ
        </button>
        <button type="button" className={`kx-btn${muted ? ' on' : ''}`} onClick={toggleMute}>
          {muted ? '🔇 ປິດສຽງຢູ່' : '🔔 ເປີດສຽງ'}
        </button>
        <button type="button" className={`kx-btn${isFull ? ' on' : ''}`} onClick={toggleFull}>
          {isFull ? '🗗 ອອກຈາກເຕັມຈໍ' : '⛶ ເຕັມຈໍ'}
        </button>
      </div>

      {/* ===== ສະຫຼຸບອາຫານທີ່ຕ້ອງເຮັດ (ລວມທຸກບິນ ທຸກປະເພດ) ===== */}
      {showSummary && dishes.length > 0 && (
        <div className="kx-summary">
          <p className="kx-summary-title">📋 ສະຫຼຸບອາຫານທີ່ຕ້ອງເຮັດ (ລວມທຸກບິນ)</p>
          <div className="kx-summary-list">
            {dishes.map((d) => (
              <span className="kx-chip" key={d.name}>
                {d.name}
                <b>{d.pending + d.cooking}</b>
                {d.cooking > 0 && <small>🔥 {d.cooking}</small>}
              </span>
            ))}
          </div>
        </div>
      )}

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
            const groups = groupItems(bill.items);
            const hasCooking = groups.some((g) => g.status === 'cooking');
            const pendingGroups = groups.filter((g) => g.status === 'pending');
            const cookingGroups = groups.filter((g) => g.status === 'cooking');
            const pendingIds = pendingGroups.flatMap((g) => g.ids);
            const cookingIds = cookingGroups.flatMap((g) => g.ids);
            const pendingQty = pendingGroups.reduce((s, g) => s + g.quantity, 0);
            const cookingQty = cookingGroups.reduce((s, g) => s + g.quantity, 0);
            const mins = minutesSince(billStart(bill), now);
            const urg = urgencyOf(mins);
            const isFresh = flash.has(billKey(bill));
            return (
              <div
                className={`kitchen-card${hasCooking ? ' cooking' : ''}${online ? ' online-' + typeOf(bill) : ''} kx-${urg}${isFresh ? ' kx-flash' : ''}`}
                key={billKey(bill)}
              >
                <div className="kx-head">
                  <h2>{billTitle(bill)}</h2>
                  {isFresh && <span className="kx-new">ໃໝ່!</span>}
                  {mins !== null && <span className={`kx-time ${urg}`}>⏱ {fmtElapsed(mins)}</span>}
                </div>
                {online && bill.customer_name && (
                  <p className="kitchen-cust">
                    👤 {bill.customer_name}
                    {bill.customer_phone && <> &nbsp;📞 {bill.customer_phone}</>}
                  </p>
                )}

                <div className="kx-counts">
                  <span className="c">🔥 ກຳລັງເຮັດ {cookingQty}</span>
                  <span className="w">⏳ ລໍຖ້າ {pendingQty}</span>
                </div>

                <div className="kitchen-bulk-actions">
                  {pendingIds.length > 0 && (
                    <button className="btn-start-all" onClick={() => bulkUpdate(pendingIds, 'cooking', bill)}>
                      🔥 ເລີ່ມເຮັດທັງໝົດ ({pendingQty})
                    </button>
                  )}
                  {cookingIds.length > 0 && (
                    <button
                      className="btn-done-all"
                      onClick={() => bulkUpdate(cookingIds, 'ready', bill, `${cookingQty} ລາຍການ`)}
                    >
                      ✅ ເຮັດແລ້ວທັງໝົດ ({cookingQty})
                    </button>
                  )}
                </div>

                <div className="kx-items">
                  {groups.map((g) => (
                    <div className={`kitchen-item${g.status === 'cooking' ? ' is-cooking' : ''}`} key={g.key}>
                      <div className="kitchen-item-info">
                        <span className="kitchen-item-name">{g.product_name}</span>{' '}
                        <span className="kitchen-item-qty">x{g.quantity}</span>
                        {hasCooking && (
                          <span
                            style={{
                              marginLeft: 8,
                              fontSize: 12,
                              fontWeight: 700,
                              color: g.status === 'cooking' ? '#2e7d32' : '#b8380e',
                            }}
                          >
                            {g.status === 'cooking' ? '🔥 ກຳລັງເຮັດ' : '⏳ ລໍຖ້າ'}
                          </span>
                        )}
                      </div>
                      <div className="kitchen-item-actions">
                        <button
                          className={g.status === 'pending' ? 'btn-start' : 'btn-done'}
                          onClick={() =>
                            bulkUpdate(g.ids, nextStatus(g.status), bill, `${g.product_name} x${g.quantity}`)
                          }
                        >
                          {nextLabel(g.status)}
                        </button>
                        <button
                          className="btn-cancel"
                          onClick={() => setCancelGroup({ ids: g.ids, name: g.product_name, quantity: g.quantity })}
                        >
                          ຍົກເລີກ
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {cancelGroup && (
        <div
          className="kc-overlay"
          onClick={(e) => e.target === e.currentTarget && setCancelGroup(null)}
        >
          <div className="kc-box">
            <div className="kc-icon">🗑️</div>
            <h3>ຍົກເລີກລາຍການ</h3>
            <p>
              ຢືນຢັນວ່າຈະຍົກເລີກ <b>{cancelGroup.name} x{cancelGroup.quantity}</b>?
              (ວັດຖຸດິບໝົດ ຫຼື ເຫດຜົນອື່ນ)
            </p>
            <div className="kc-actions">
              <button className="kc-no" onClick={() => setCancelGroup(null)}>ຍົກເລີກ</button>
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
      {/* ກ່ອງຜົນການຍົກເລີກອໍເດີ້ ກາງຈໍ */}
      {cancelPop && (
        <div
          className="kr-overlay"
          key={cancelPop.key}
          onClick={(e) => e.target === e.currentTarget && closeCancelPop()}
        >
          <div className="kr-card">
            <div className="kr-icon">
              {cancelPop.kind === 'success' ? '✅' : cancelPop.kind === 'partial' ? '⚠️' : '❌'}
            </div>
            <h2
              className="kr-title"
              style={{ color: cancelPop.kind === 'success' ? '#2e6b1f' : cancelPop.kind === 'partial' ? '#b8780e' : '#c0392b' }}
            >
              {cancelPop.kind === 'success'
                ? 'ຍົກເລີກອໍເດີ້ສຳເລັດ!'
                : cancelPop.kind === 'partial'
                  ? 'ຍົກເລີກໄດ້ບາງສ່ວນ'
                  : 'ຍົກເລີກບໍ່ສຳເລັດ'}
            </h2>
            {cancelPop.detail && <p className="kr-sub">{cancelPop.detail}</p>}
            <button
              type="button"
              className="kr-ok"
              style={cancelPop.kind === 'error' ? { background: '#c0392b' } : undefined}
              onClick={closeCancelPop}
              autoFocus
            >
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