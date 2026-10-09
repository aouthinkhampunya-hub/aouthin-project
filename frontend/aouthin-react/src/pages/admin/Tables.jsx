import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getBills, updateOrderStatus, closeBill, getPaymentQR, getStaffCalls, ackStaffCall, getTableCount, API_BASE } from '../../api.js';
import '../../styles/admin-tables.css';

function statusLabel(status) {
  if (status === 'pending') return 'ລໍຖ້າ';
  if (status === 'cooking') return 'ກຳລັງເຮັດ';
  if (status === 'ready') return '🍽️ ເຮັດແລ້ວ ລໍເສີບ';
  if (status === 'completed') return '✅ ເສີບແລ້ວ';
  return status;
}

function playBeep(audioCtxRef) {
  try {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = audioCtxRef.current;
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
  } catch (e) {}
}

const billTotal = (bill) =>
  (bill.items || []).reduce((s, i) => s + i.price * i.quantity, 0) + Number(bill.delivery_fee || 0);

// ປະເພດອໍເດີ້: dine_in | pickup | delivery
const typeOf = (bill) => bill.order_type || 'dine_in';
const isOnline = (bill) => typeOf(bill) !== 'dine_in';
const onlineLabel = (bill) =>
  typeOf(bill) === 'delivery' ? '🛵 ສົ່ງເຖິງບ້ານ' : '🥡 ມາຮັບເຄື່ອງເອງ';

export default function Tables() {
  const [bills, setBills] = useState([]);
  const [calls, setCalls] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [totalTables, setTotalTables] = useState(20);
  const [listOpen, setListOpen] = useState(null);        // null | 'dinein' | 'pickup' | 'delivery'
  const [focusTable, setFocusTable] = useState(null);
  const [popup, setPopup] = useState(null);
  const [askPaid, setAskPaid] = useState(false);
  const [paying, setPaying] = useState(false);
  const [toast, setToast] = useState('');

  const audioCtxRef = useRef(null);
  const knownOrderIds = useRef(new Set());
  const knownReadyIds = useRef(new Set());
  const knownCallIds = useRef(new Set());
  const knownOnlineIds = useRef(new Set());
  const firstLoad = useRef(true);
  const toastTimer = useRef();

  const showToast = (msg, ms = 2200) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), ms);
  };

  async function loadTableCount() {
    try {
      const c = await getTableCount();
      if (c?.count) setTotalTables(c.count);
    } catch (e) {}
  }

  async function load() {
    const data = await getBills();
    const orderIds = new Set();
    const readyIds = new Set();
    data.forEach((b) => b.items.forEach((i) => {
      orderIds.add(i.id);
      if (i.status === 'ready') readyIds.add(i.id);
    }));

    // ອໍເດີ້ອອນລາຍໃໝ່
    const onlineIds = new Set(data.filter(isOnline).map((b) => b.id));
    if (!firstLoad.current) {
      const fresh = [...onlineIds].filter((id) => !knownOnlineIds.current.has(id));
      if (fresh.length > 0) {
        const freshBills = data.filter((b) => fresh.includes(b.id));
        const p = freshBills.filter((b) => typeOf(b) === 'pickup').length;
        const d = freshBills.filter((b) => typeOf(b) === 'delivery').length;
        const parts = [];
        if (p) parts.push(`🥡 ມາຮັບເອງ ${p}`);
        if (d) parts.push(`🛵 ສົ່ງເຖິງບ້ານ ${d}`);
        showToast(`ມີອໍເດີ້ໃໝ່: ${parts.join(' • ')}`, 6000);
      }
    }
    knownOnlineIds.current = onlineIds;

    if (!firstLoad.current) {
      let hasNew = false;
      orderIds.forEach((id) => { if (!knownOrderIds.current.has(id)) hasNew = true; });
      readyIds.forEach((id) => { if (!knownReadyIds.current.has(id)) hasNew = true; });
      if (hasNew) playBeep(audioCtxRef);
    }
    knownOrderIds.current = orderIds;
    knownReadyIds.current = readyIds;
    setBills(data);
    setLoaded(true);
  }

  async function loadCalls() {
    const data = await getStaffCalls();
    const ids = new Set(data.map((c) => c.id));
    if (!firstLoad.current) {
      let hasNew = false;
      ids.forEach((id) => { if (!knownCallIds.current.has(id)) hasNew = true; });
      if (hasNew) playBeep(audioCtxRef);
    }
    knownCallIds.current = ids;
    setCalls(data);
  }

  useEffect(() => {
    const unlock = () => {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    };
    document.addEventListener('click', unlock, { once: true });
    (async () => {
      try { await loadTableCount(); await load(); await loadCalls(); } catch (e) { console.error(e); }
      firstLoad.current = false;
    })();
    const t = setInterval(() => {
      loadTableCount();
      load().catch(() => {});
      loadCalls().catch(() => {});
    }, 5000);
    return () => { clearInterval(t); document.removeEventListener('click', unlock); };
  }, []);

  // Esc ປິດ popup (ປິດອັນເທິງສຸດກ່ອນ)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (askPaid) setAskPaid(false);
      else if (popup) closePopup();
      else if (listOpen) setListOpen(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  // ກົດໂຕະໃນກະດານ -> ເປີດປັອບອັບໜ້າໂຕະ ແລ້ວເລື່ອນໄປຫາໂຕະນັ້ນ
  useEffect(() => {
    if (listOpen !== 'dinein' || focusTable === null) return undefined;
    const t = setTimeout(() => {
      const el = document.getElementById(`table-section-${focusTable}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setFocusTable(null);
    }, 80);
    return () => clearTimeout(t);
  }, [listOpen, focusTable]);

  const updateItem = async (id, status) => {
    await updateOrderStatus(id, status);
    load();
  };
  const markAllServed = async (ids) => {
    await Promise.all(ids.map((id) => updateOrderStatus(id, 'completed')));
    load();
  };
  const handleAck = async (id) => { await ackStaffCall(id); loadCalls(); };

  const openTable = (n) => {
    setFocusTable(n);
    setListOpen('dinein');
  };

  /* ===== popup ໃບບິນ ===== */
  const goToBill = async (billId) => {
    const bill = bills.find((b) => String(b.id) === String(billId));
    if (!bill) return showToast('❌ ບໍ່ພົບໃບບິນນີ້ (ອາດຈະຈ່າຍໄປແລ້ວ)');
    let qrImage = null;
    if (!isOnline(bill)) {
      try { qrImage = (await getPaymentQR()).qrImage; } catch (e) {}
    }
    const now = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Vientiane' });
    setPopup({ bill, qrImage, now });
  };
  const closePopup = () => { setPopup(null); setAskPaid(false); setPaying(false); };

  const doConfirmPaid = async () => {
    setPaying(true);
    try {
      await closeBill(popup.bill.id);
    } catch (e) {
      setPaying(false);
      return showToast('❌ ປິດບິນບໍ່ສຳເລັດ');
    }
    closePopup();
    await load();
    showToast('✅ ປິດບິນແລ້ວ');
  };

  // ແຍກບິນ 3 ປະເພດ (ອອນລາຍ: ໃໝ່ສຸດຢູ່ເທິງ)
  const dineInBills = bills.filter((b) => typeOf(b) === 'dine_in');
  const pickupBills = bills.filter((b) => typeOf(b) === 'pickup').sort((a, b) => b.id - a.id);
  const deliveryBills = bills.filter((b) => typeOf(b) === 'delivery').sort((a, b) => b.id - a.id);

  const byTable = {};
  dineInBills.forEach((b) => { byTable[b.table_number] = b; });

  const maxBillTable = dineInBills.reduce((m, b) => Math.max(m, Number(b.table_number) || 0), 0);
  const boardSize = Math.max(totalTables, maxBillTable);

  const LISTS = {
    dinein: { bills: dineInBills, title: '🍽️ ອໍເດີ້ໜ້າໂຕະ', empty: 'ຍັງບໍ່ມີໂຕະທີ່ເປີດຢູ່' },
    pickup: { bills: pickupBills, title: '🥡 ມາຮັບເຄື່ອງເອງ', empty: 'ຍັງບໍ່ມີອໍເດີ້ມາຮັບເຄື່ອງເອງ' },
    delivery: { bills: deliveryBills, title: '🛵 ສົ່ງເຖິງບ້ານ', empty: 'ຍັງບໍ່ມີອໍເດີ້ສົ່ງເຖິງບ້ານ' },
  };
  const current = listOpen ? LISTS[listOpen] : null;
  const listBills = current ? current.bills : [];

  // ບັດບິນ (ໃຊ້ໃນປັອບອັບທັງໝົດ)
  const renderBillCard = (bill) => {
    const total = billTotal(bill);
    const online = isOnline(bill);
    const allServed = bill.items.every((i) => i.status === 'completed');
    const readyIds = bill.items.filter((i) => i.status === 'ready').map((i) => i.id);
    return (
      <div className="table-card" id={online ? `table-section-online-${bill.id}` : `table-section-${bill.table_number}`} key={bill.id}>
        {online ? (
          <>
            <h2>{onlineLabel(bill)} #{bill.id}</h2>
            <p style={{ margin: '0 0 12px', fontWeight: 700, lineHeight: 1.7 }}>
              👤 {bill.customer_name} &nbsp;📞{' '}
              <a href={`tel:${bill.customer_phone}`}>{bill.customer_phone}</a>
              {bill.address && <><br />📍 {bill.address}</>}
              {bill.latitude && bill.longitude && (
                <>
                  <br />
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${bill.latitude},${bill.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    🗺️ ເປີດນຳທາງໃນ Google Maps
                  </a>
                </>
              )}
              <br />{bill.payment_method === 'transfer' ? '🏦 ໂອນເງິນ' : '💵 ຈ່າຍເງິນສົດ'}
            </p>
            {bill.payment_method === 'transfer' && (
              bill.slip_image ? (
                <div className="olx-slip-wrap">
                  <div className="olx-slip-label">🧾 ສະລິບການໂອນເງິນ (ກົດເພື່ອເບິ່ງຂະໜາດເຕັມ)</div>
                  <a href={API_BASE + bill.slip_image} target="_blank" rel="noreferrer">
                    <img className="olx-slip" src={API_BASE + bill.slip_image} alt="ສະລິບໂອນເງິນ" />
                  </a>
                </div>
              ) : (
                <p className="olx-slip-missing">⚠️ ບໍ່ພົບຮູບສະລິບ</p>
              )
            )}
          </>
        ) : (
          <h2>ໂຕະ {bill.table_number}</h2>
        )}
        <table>
          <tbody>
            <tr><th>ເມນູ</th><th>ຈຳນວນ</th><th>ສະຖານະ</th><th></th></tr>
            {bill.items.map((item) => (
              <tr key={item.id}>
                <td>{item.product_name}</td>
                <td>{item.quantity}</td>
                <td>{statusLabel(item.status)}</td>
                <td>
                  {item.status === 'ready'
                    ? <button className="delete-btn" onClick={() => updateItem(item.id, 'completed')}>ເສີບແລ້ວ</button>
                    : item.status === 'completed' ? '✅' : '⏳'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
                {Number(bill.delivery_fee) > 0 && (
          <p style={{ margin: '0 0 6px', fontWeight: 700 }}>
            🛵 ຄ່າສົ່ງ ({bill.delivery_distance} ກມ): {Number(bill.delivery_fee).toLocaleString()} ກີບ
          </p>
        )}
        <p className="cart-total">ລວມ: {total} ກີບ</p>
        {readyIds.length > 0 && (
          <button className="confirm-btn" onClick={() => markAllServed(readyIds)}>🍽️ ເສີບທັງໝົດ</button>
        )}
        <button className="confirm-btn" disabled={!allServed} onClick={() => goToBill(bill.id)}>
          {allServed
            ? (online ? 'ອອກບິນ / ຮັບເງິນແລ້ວ' : 'ອອກບິນ / ຈ່າຍແລ້ວ')
            : 'ລໍຖ້າເສີບອາຫານກ່ອນ'}
        </button>
      </div>
    );
  };

  return (
    <main>
      <div id="staff-calls-bar">
        {calls.map((c) => (
          <div className="staff-call-alert" key={c.id}>
            <span>🔔 ໂຕະ {c.table_number} ເອີ້ນພະນັກງານ</span>
            <button onClick={() => handleAck(c.id)}>ຮັບຮູ້ແລ້ວ</button>
          </div>
        ))}
      </div>

      {/* 3 ປຸ່ມ: ໜ້າໂຕະ / ມາຮັບເຄື່ອງເອງ / ສົ່ງເຖິງບ້ານ */}
      <div className="ord-tabs">
        {[
          { key: 'dinein', icon: '🍽️', label: 'ອໍເດີ້ໜ້າໂຕະ', count: dineInBills.length },
          { key: 'pickup', icon: '🥡', label: 'ມາຮັບເຄື່ອງເອງ', count: pickupBills.length },
          { key: 'delivery', icon: '🛵', label: 'ສົ່ງເຖິງບ້ານ', count: deliveryBills.length },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            className={`ord-tab${t.key !== 'dinein' ? ' online' : ''}${t.count > 0 ? ' has-orders' : ''}`}
            onClick={() => setListOpen(t.key)}
          >
            {t.icon} {t.label}
            <span className="ord-count">{t.count}</span>
          </button>
        ))}
      </div>

      {/* ກະດານໂຕະໃນຮ້ານ (ກົດໂຕະທີ່ມີຄົນ ເພື່ອເປີດລາຍລະອຽດ) */}
      <div id="table-board" className="table-board">
        {Array.from({ length: boardSize }, (_, i) => i + 1).map((n) => {
          const bill = byTable[n];
          return bill ? (
            <div key={n} className="board-cell occupied" onClick={() => openTable(n)}>
              <div className="board-num">{n}</div>
              <div className="board-sub">{billTotal(bill).toLocaleString()} ກີບ</div>
            </div>
          ) : (
            <div key={n} className="board-cell empty">
              <div className="board-num">{n}</div>
              <div className="board-sub">ວ່າງ</div>
            </div>
          );
        })}
      </div>

      {!loaded && <p>ກຳລັງໂຫລດ...</p>}

      {/* ===== ປັອບອັບລາຍການ ===== */}
      {current && createPortal(
        <div className="olx-overlay" onClick={(e) => e.target === e.currentTarget && setListOpen(null)}>
          <div className="olx-box">
            <button className="olx-close" onClick={() => setListOpen(null)}>✕</button>
            <h2 className="olx-title">{current.title} ({current.bills.length})</h2>
            {listBills.length === 0
              ? <p className="olx-empty">{current.empty}</p>
              : listBills.map(renderBillCard)}
          </div>
        </div>,
        document.body
      )}

      {/* ===== popup ໃບບິນ ===== */}
      {popup && createPortal(
        <>
          <div id="bill-popup-modal" className="bp-overlay" onClick={(e) => e.target === e.currentTarget && closePopup()}>
            <div className="bp-box">
              <button className="bp-close" onClick={closePopup}>✕</button>
              <div className="bp-receipt">
                <div className="bp-head">
                  <h2>ຮ້ານອາຫານຕາມສັ່ງ AOUTHIN</h2>
                  <p>
                    {isOnline(popup.bill)
                      ? `${onlineLabel(popup.bill)} #${popup.bill.id}`
                      : `ໂຕະ ${popup.bill.table_number}`}
                    &nbsp;•&nbsp; {popup.now}
                  </p>
                  {isOnline(popup.bill) && (
                    <p>
                      👤 {popup.bill.customer_name} &nbsp;📞 {popup.bill.customer_phone}
                      {popup.bill.address && <><br />📍 {popup.bill.address}</>}
                    </p>
                  )}
                </div>
                <table className="bp-table">
                  <tbody>
                    <tr><th>ເມນູ</th><th>ຈຳນວນ</th><th>ລາຄາ</th></tr>
                    {popup.bill.items.map((i) => (
                      <tr key={i.id}>
                        <td>{i.product_name}</td>
                        <td>{i.quantity}</td>
                        <td>{i.price * i.quantity} ກີບ</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {Number(popup.bill.delivery_fee) > 0 && (
  <p style={{ textAlign: 'right', margin: '0 0 8px' }}>
    🛵 ຄ່າສົ່ງ ({popup.bill.delivery_distance} ກມ): {Number(popup.bill.delivery_fee).toLocaleString()} ກີບ
  </p>
)}
                <div className="bp-total">
                  <span>ຍອດລວມທັງໝົດ</span>
                  <span>{billTotal(popup.bill)} ກີບ</span>
                </div>
                <div className="bp-qr">
                  {isOnline(popup.bill)
                    ? <p>{popup.bill.payment_method === 'transfer' ? '🏦 ຊຳລະດ້ວຍການໂອນເງິນ' : '💵 ຊຳລະດ້ວຍເງິນສົດ'}</p>
                    : popup.qrImage
                      ? <><p>ສະແກນ QR ນີ້ເພື່ອຊຳລະເງິນ</p><img src={popup.qrImage} alt="QR ຮັບເງິນ" /></>
                      : <p>ຍັງບໍ່ໄດ້ຕັ້ງຄ່າ QR ຮັບເງິນ (ໄປທີ່ໜ້າ QR Code)</p>}
                </div>
              </div>
              <div className="bp-actions">
                <button className="bp-print" onClick={() => window.print()}>🖨️ ພິມບິນ</button>
                <button className="bp-confirm" onClick={() => setAskPaid(true)}>
                  {isOnline(popup.bill) ? 'ຮັບເງິນແລ້ວ' : 'ຈ່າຍແລ້ວ'}
                </button>
              </div>
            </div>
          </div>

          {askPaid && (
            <div id="bill-confirm-modal" className="bp-overlay top" onClick={(e) => e.target === e.currentTarget && setAskPaid(false)}>
              <div className="bp-sub-box">
                <div className="bp-sub-icon">💰</div>
                <h3>ຢືນຢັນຮັບເງິນ</h3>
                <p>
                  {isOnline(popup.bill) ? 'ຮັບເງິນຄົບຖ້ວນແລ້ວແທ້ບໍ?' : 'ໂຕະນີ້ຈ່າຍເງິນຄົບຖ້ວນແລ້ວແທ້ບໍ?'}
                  <br />ການດຳເນີນການນີ້ຈະປິດບິນ
                </p>
                <div className="bp-sub-actions">
                  <button className="bp-no" onClick={() => setAskPaid(false)}>ຍົກເລີກ</button>
                  <button className="bp-yes" disabled={paying} onClick={doConfirmPaid}>✓ ຢືນຢັນ</button>
                </div>
              </div>
            </div>
          )}
        </>,
        document.body
      )}

      {toast && createPortal(<div className="bp-toast">{toast}</div>, document.body)}
    </main>
  );
}