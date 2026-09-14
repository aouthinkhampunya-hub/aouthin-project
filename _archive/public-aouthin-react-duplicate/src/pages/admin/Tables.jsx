import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBills, updateOrderStatus, getStaffCalls, ackStaffCall } from '../../api.js';

function statusLabel(status) {
  if (status === 'pending') return 'ລໍຖ້າ';
  if (status === 'cooking') return 'ກຳລັງເຮັດ';
  if (status === 'completed') return 'ພ້ອມແລ້ວ';
  return status;
}
function nextStatus(status) {
  if (status === 'pending') return 'cooking';
  if (status === 'cooking') return 'completed';
  return null;
}
function nextLabel(status) {
  if (status === 'pending') return 'ເລີ່ມເຮັດ';
  if (status === 'cooking') return 'ພ້ອມແລ້ວ';
  return '';
}

// ===== ระบบเสียงแจ้งเตือน (เหมือนไฟล์เดิม tables.js) =====
function playBeep(audioCtxRef) {
  try {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    const audioCtx = audioCtxRef.current;
    const now = audioCtx.currentTime;
    [0, 0.18].forEach(offset => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'square';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.9, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.16);
    });
  } catch (e) {}
}

export default function Tables() {
  const navigate = useNavigate();
  const [bills, setBills] = useState([]);
  const [calls, setCalls] = useState([]);
  const audioCtxRef = useRef(null);
  const knownOrderIds = useRef(new Set());
  const knownCallIds = useRef(new Set());
  const firstLoad = useRef(true);

  useEffect(() => {
    const unlock = () => { if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)(); };
    document.addEventListener('click', unlock, { once: true });

    (async () => {
      await load();
      await loadCalls();
      firstLoad.current = false;
    })();
    const t = setInterval(() => { load(); loadCalls(); }, 5000);
    return () => { clearInterval(t); document.removeEventListener('click', unlock); };
  }, []);

  async function load() {
    const data = await getBills();
    const ids = new Set();
    data.forEach(b => b.items.forEach(i => ids.add(i.id)));
    if (!firstLoad.current) {
      let hasNew = false;
      ids.forEach(id => { if (!knownOrderIds.current.has(id)) hasNew = true; });
      if (hasNew) playBeep(audioCtxRef);
    }
    knownOrderIds.current = ids;
    setBills(data);
  }

  async function loadCalls() {
    const data = await getStaffCalls();
    const ids = new Set(data.map(c => c.id));
    if (!firstLoad.current) {
      let hasNew = false;
      ids.forEach(id => { if (!knownCallIds.current.has(id)) hasNew = true; });
      if (hasNew) playBeep(audioCtxRef);
    }
    knownCallIds.current = ids;
    setCalls(data);
  }

  async function handleUpdate(orderId, status) {
    await updateOrderStatus(orderId, status);
    load();
  }

  async function handleAck(id) {
    await ackStaffCall(id);
    loadCalls();
  }

  return (
    <main>
      <div id="staff-calls-bar">
        {calls.map(c => (
          <div className="staff-call-alert" key={c.id}>
            <span>🔔 ໂຕະ {c.table_number} ເອີ້ນພະນັກງານ</span>
            <button onClick={() => handleAck(c.id)}>ຮັບຮູ້ແລ້ວ</button>
          </div>
        ))}
      </div>

      <div id="tables-dashboard">
        {bills.length === 0 ? <p>ຍັງບໍ່ມີໂຕະທີ່ເປີດຢູ່</p> : bills.map(bill => {
          const total = bill.items.reduce((s, i) => s + i.price * i.quantity, 0);
          const allServed = bill.items.every(i => i.status === 'completed');
          return (
            <div className="table-card" key={bill.id}>
              <h2>ໂຕະ {bill.table_number}</h2>
              <table>
                <tbody>
                  <tr><th>ເມນູ</th><th>ຈຳນວນ</th><th>ສະຖານະ</th><th></th></tr>
                  {bill.items.map(item => (
                    <tr key={item.id}>
                      <td>{item.product_name}</td>
                      <td>{item.quantity}</td>
                      <td>{statusLabel(item.status)}</td>
                      <td>
                        {nextStatus(item.status) ? (
                          <button className="delete-btn" onClick={() => handleUpdate(item.id, nextStatus(item.status))}>
                            {nextLabel(item.status)}
                          </button>
                        ) : '✅'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="cart-total">ລວມ: {total} ກີບ</p>
              <button className="confirm-btn" disabled={!allServed} onClick={() => navigate(`/admin/bill?bill=${bill.id}`)}>
                {allServed ? 'ອອກບິນ / ຈ່າຍແລ້ວ' : 'ລໍຖ້າອາຫານໃຫ້ພ້ອມກ່ອນ'}
              </button>
            </div>
          );
        })}
      </div>
    </main>
  );
}
