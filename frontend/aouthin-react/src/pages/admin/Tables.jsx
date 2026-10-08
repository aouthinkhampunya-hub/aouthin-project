import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { API_BASE, getBills, updateOrderStatus, closeBill, getPaymentQR, getStaffCalls, ackStaffCall, getTableCount } from '../../api.js';
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

const billTotal = (bill) => bill.items.reduce((s, i) => s + i.price * i.quantity, 0);

// ອໍເດີ້ອອນລາຍ (ແກັບ / ສົ່ງເຖິງບ້ານ) ບໍ່ແມ່ນໂຕະ
const isOnline = (bill) => !!bill.order_type && bill.order_type !== 'dine_in';
const onlineLabel = (bill) =>
  bill.order_type === 'delivery' ? '🛵 ສົ່ງເຖິງບ້ານ' : '🥡 ແກັບ (ມາຮັບເອງ)';
const sectionId = (bill) =>
  isOnline(bill) ? `table-section-online-${bill.id}` : `table-section-${bill.table_number}`;

const isTransfer = (bill) => bill.payment_method === 'transfer';
const slipUrl = (bill) =>
  !bill.slip_image
    ? ''
    : bill.slip_image.startsWith('http') ? bill.slip_image : API_BASE + bill.slip_image;
export default function Tables() {
  const [bills, setBills] = useState([]);
  const [calls, setCalls] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [totalTables, setTotalTables] = useState(20);
  const [popup, setPopup] = useState(null);       // { bill, qrImage, now }
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
        showToast(`🛵 ມີອໍເດີ້ອອນລາຍໃໝ່ ${fresh.length} ລາຍການ`, 6000);
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

  // Esc ປິດ popup
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (askPaid) setAskPaid(false);
      else if (popup) closePopup();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const updateItem = async (id, status) => {
    await updateOrderStatus(id, status);
    load();
  };
  const markAllServed = async (ids) => {
    await Promise.all(ids.map((id) => updateOrderStatus(id, 'completed')));
    load();
  };
  const handleAck = async (id) => { await ackStaffCall(id); loadCalls(); };

  const scrollToId = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const scrollToTable = (n) => scrollToId(`table-section-${n}`);

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

  // ແຍກບິນໂຕະ ກັບ ບິນອອນລາຍ
  const dineInBills = bills.filter((b) => !isOnline(b));
  const onlineBills = bills.filter(isOnline);

  const byTable = {};
  dineInBills.forEach((b) => { byTable[b.table_number] = b; });

  const maxBillTable = dineInBills.reduce((m, b) => Math.max(m, Number(b.table_number) || 0), 0);
  const boardSize = Math.max(totalTables, maxBillTable);

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

      {/* ແຖບສະຫຼຸບອໍເດີ້ອອນລາຍ */}
      {onlineBills.length > 0 && (
        <div
          onClick={() => scrollToId(sectionId(onlineBills[0]))}
          style={{
            background: '#fff3cd', border: '2px solid #d9a520', color: '#7a1f10',
            borderRadius: 12, padding: '12px 16px', margin: '0 0 14px',
            fontWeight: 800, cursor: 'pointer', textAlign: 'center',
          }}
        >
          🛵 ມີອໍເດີ້ອອນລາຍ {onlineBills.length} ລາຍການ (ກົດເພື່ອເບິ່ງ)
        </div>
      )}

      {/* ກະດານໂຕະທັງໝົດ */}
      <div id="table-board" className="table-board">
        {Array.from({ length: boardSize }, (_, i) => i + 1).map((n) => {
          const bill = byTable[n];
          return bill ? (
            <div key={n} className="board-cell occupied" onClick={() => scrollToTable(n)}>
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

      <section id="tables-dashboard">
        {!loaded ? <p>ກຳລັງໂຫລດ...</p> : bills.length === 0 ? <p>ຍັງບໍ່ມີໂຕະທີ່ເປີດຢູ່</p> : bills.map((bill) => {
          const total = billTotal(bill);
          const online = isOnline(bill);
          const allServed = bill.items.every((i) => i.status === 'completed');
          const readyIds = bill.items.filter((i) => i.status === 'ready').map((i) => i.id);
          return (
            <div className="table-card" id={sectionId(bill)} key={bill.id}>
              {online ? (
                <>
                  <h2>{onlineLabel(bill)} #{bill.id}</h2>
                                    <p style={{ margin: '0 0 12px', fontWeight: 700, lineHeight: 1.7 }}>
                    👤 {bill.customer_name} &nbsp;📞 {bill.customer_phone}
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
                                        <br />
                    {isTransfer(bill)
                      ? (bill.slip_image ? '🏦 ຈ່າຍເງິນໂອນ ✅ ສົ່ງສະລິບແລ້ວ' : '🏦 ຈ່າຍເງິນໂອນ ⏳ ລໍຖ້າສະລິບ')
                      : '💵 ຈ່າຍເງິນສົດ'}
                  </p>
                  {isTransfer(bill) && bill.slip_image && (
                    <div style={{ margin: '0 0 12px' }}>
                      <a href={slipUrl(bill)} target="_blank" rel="noreferrer">
                        <img
                          src={slipUrl(bill)}
                          alt="ສະລິບ"
                          style={{ maxWidth: 200, maxHeight: 260, borderRadius: 10, border: '1px solid #eadfd3' }}
                        />
                      </a>
                      <div style={{ fontSize: 12 }}>ກົດຮູບເພື່ອເບິ່ງໃຫຍ່</div>
                    </div>
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
              <p className="cart-total">ລວມ: {total} ກີບ</p>
              {readyIds.length > 0 && (
                <button className="confirm-btn" onClick={() => markAllServed(readyIds)}>🍽️ ເສີບທັງໝົດ</button>
              )}
              <button className="confirm-btn" disabled={!allServed} onClick={() => goToBill(bill.id)}>
                {allServed
                  ? (online ? 'ອອກບິນ / ຮັບເງິນສົດແລ້ວ' : 'ອອກບິນ / ຈ່າຍແລ້ວ')
                  : 'ລໍຖ້າເສີບອາຫານກ່ອນ'}
              </button>
            </div>
          );
        })}
      </section>

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
                <div className="bp-total">
                  <span>ຍອດລວມທັງໝົດ</span>
                  <span>{billTotal(popup.bill)} ກີບ</span>
                </div>
                                <div className="bp-qr">
                  {isOnline(popup.bill)
                    ? (isTransfer(popup.bill)
                        ? (popup.bill.slip_image
                            ? <><p>🏦 ສະລິບໂອນເງິນຈາກລູກຄ້າ</p><img src={slipUrl(popup.bill)} alt="ສະລິບ" style={{ width: 'auto', maxWidth: '100%', height: 'auto', maxHeight: 320 }} /></>
                            : <p>🏦 ຈ່າຍເງິນໂອນ (ຍັງບໍ່ໄດ້ຮັບສະລິບ)</p>)
                        : <p>💵 ຊຳລະດ້ວຍເງິນສົດ</p>)
                    : popup.qrImage
                      ? <><p>ສະແກນ QR ນີ້ເພື່ອຊຳລະເງິນ</p><img src={popup.qrImage} alt="QR ຮັບເງິນ" /></>
                      : <p>ຍັງບໍ່ໄດ້ຕັ້ງຄ່າ QR ຮັບເງິນ (ໄປທີ່ໜ້າ QR Code)</p>}
                </div>
              </div>
              <div className="bp-actions">
                <button className="bp-print" onClick={() => window.print()}>🖨️ ພິມບິນ</button>
                                <button
                  className="bp-confirm"
                  disabled={isTransfer(popup.bill) && !popup.bill.slip_image}
                  onClick={() => setAskPaid(true)}
                >
                  {isOnline(popup.bill)
                    ? (isTransfer(popup.bill) ? 'ກວດສະລິບແລ້ວ ຮັບເງິນໂອນແລ້ວ' : 'ຮັບເງິນສົດແລ້ວ')
                    : 'ຈ່າຍແລ້ວ'}
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
                                   {isOnline(popup.bill)
                    ? (isTransfer(popup.bill) ? 'ກວດສະລິບ ແລະ ເງິນເຂົ້າບັນຊີຄົບຖ້ວນແລ້ວແທ້ບໍ?' : 'ຮັບເງິນສົດຄົບຖ້ວນແລ້ວແທ້ບໍ?')
                    : 'ໂຕະນີ້ຈ່າຍເງິນຄົບຖ້ວນແລ້ວແທ້ບໍ?'}
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