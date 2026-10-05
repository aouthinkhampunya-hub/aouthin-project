import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getBills, updateOrderStatus, closeBill, getPaymentQR, getStaffCalls, ackStaffCall } from '../../api.js';
import '../../styles/admin-tables.css';

const TOTAL_TABLES = 20;

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

export default function Tables() {
  const [bills, setBills] = useState([]);
  const [calls, setCalls] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [popup, setPopup] = useState(null);       // { bill, qrImage, now }
  const [askPaid, setAskPaid] = useState(false);
  const [paying, setPaying] = useState(false);
  const [toast, setToast] = useState('');

  const audioCtxRef = useRef(null);
  const knownOrderIds = useRef(new Set());
  const knownReadyIds = useRef(new Set());
  const knownCallIds = useRef(new Set());
  const firstLoad = useRef(true);
  const toastTimer = useRef();

  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2200);
  };

  async function load() {
    const data = await getBills();
    const orderIds = new Set();
    const readyIds = new Set();
    data.forEach((b) => b.items.forEach((i) => {
      orderIds.add(i.id);
      if (i.status === 'ready') readyIds.add(i.id);
    }));
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
      try { await load(); await loadCalls(); } catch (e) { console.error(e); }
      firstLoad.current = false;
    })();
    const t = setInterval(() => { load().catch(() => {}); loadCalls().catch(() => {}); }, 5000);
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

  const scrollToTable = (n) => {
    const el = document.getElementById(`table-section-${n}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /* ===== popup ໃບບິນ ===== */
  const goToBill = async (billId) => {
    const bill = bills.find((b) => String(b.id) === String(billId));
    if (!bill) return showToast('❌ ບໍ່ພົບໃບບິນນີ້ (ອາດຈະຈ່າຍໄປແລ້ວ)');
    let qrImage = null;
    try { qrImage = (await getPaymentQR()).qrImage; } catch (e) {}
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

  const byTable = {};
  bills.forEach((b) => { byTable[b.table_number] = b; });

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

      {/* ກະດານໂຕະ 1-20 */}
      <div id="table-board" className="table-board">
        {Array.from({ length: TOTAL_TABLES }, (_, i) => i + 1).map((n) => {
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
          const allServed = bill.items.every((i) => i.status === 'completed');
          const readyIds = bill.items.filter((i) => i.status === 'ready').map((i) => i.id);
          return (
            <div className="table-card" id={`table-section-${bill.table_number}`} key={bill.id}>
              <h2>ໂຕະ {bill.table_number}</h2>
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
                {allServed ? 'ອອກບິນ / ຈ່າຍແລ້ວ' : 'ລໍຖ້າເສີບອາຫານກ່ອນ'}
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
                  <p>ໂຕະ {popup.bill.table_number} &nbsp;•&nbsp; {popup.now}</p>
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
                  {popup.qrImage
                    ? <><p>ສະແກນ QR ນີ້ເພື່ອຊຳລະເງິນ</p><img src={popup.qrImage} alt="QR ຮັບເງິນ" /></>
                    : <p>ຍັງບໍ່ໄດ້ຕັ້ງຄ່າ QR ຮັບເງິນ (ໄປທີ່ໜ້າ QR Code)</p>}
                </div>
              </div>
              <div className="bp-actions">
                <button className="bp-print" onClick={() => window.print()}>🖨️ ພິມບິນ</button>
                <button className="bp-confirm" onClick={() => setAskPaid(true)}>🧾 ກວດສອບບິນ</button>
              </div>
            </div>
          </div>

          {askPaid && (
            <div id="bill-confirm-modal" className="bp-overlay top" onClick={(e) => e.target === e.currentTarget && setAskPaid(false)}>
              <div className="bp-sub-box">
                <div className="bp-sub-icon">💰</div>
                <h3>ຢືນຢັນຮັບເງິນ</h3>
                <p>ໂຕະນີ້ຈ່າຍເງິນຄົບຖ້ວນແລ້ວແທ້ບໍ່?<br />ການດຳເນີນການນີ້ຈະປິດບິນ</p>
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