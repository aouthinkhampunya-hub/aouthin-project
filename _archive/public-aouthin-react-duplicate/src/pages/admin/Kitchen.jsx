import React, { useEffect, useRef, useState } from 'react';
import { getBills, updateOrderStatus } from '../../api.js';

function nextStatus(status) {
  if (status === 'pending') return 'cooking';
  if (status === 'cooking') return 'completed';
  return null;
}
function nextLabel(status) {
  if (status === 'pending') return '🔥 ເລີ່ມເຮັດ';
  if (status === 'cooking') return '✅ ພ້ອມແລ້ວ';
  return '';
}

function playBeep(audioCtxRef) {
  try {
    if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
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

export default function Kitchen() {
  const [activeBills, setActiveBills] = useState([]);
  const audioCtxRef = useRef(null);
  const knownIds = useRef(new Set());
  const firstLoad = useRef(true);

  useEffect(() => {
    const unlock = () => { if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)(); };
    document.addEventListener('click', unlock, { once: true });

    (async () => { await load(); firstLoad.current = false; })();
    const t = setInterval(load, 5000);
    return () => { clearInterval(t); document.removeEventListener('click', unlock); };
  }, []);

  async function load() {
    const bills = await getBills();
    const active = bills
      .map(b => ({ ...b, items: b.items.filter(i => i.status !== 'completed') }))
      .filter(b => b.items.length > 0);

    const ids = new Set();
    active.forEach(b => b.items.forEach(i => ids.add(i.id)));
    if (!firstLoad.current) {
      let hasNew = false;
      ids.forEach(id => { if (!knownIds.current.has(id)) hasNew = true; });
      if (hasNew) playBeep(audioCtxRef);
    }
    knownIds.current = ids;
    setActiveBills(active);
  }

  async function handleUpdate(orderId, status) {
    await updateOrderStatus(orderId, status);
    load();
  }

  return (
    <main className="kitchen-page">
      {activeBills.length === 0 ? (
        <div className="kitchen-empty">✅ ບໍ່ມີອາຫານທີ່ຕ້ອງເຮັດຕອນນີ້</div>
      ) : (
        <div className="kitchen-grid">
          {activeBills.map(bill => {
            const hasCooking = bill.items.some(i => i.status === 'cooking');
            return (
              <div className={`kitchen-card ${hasCooking ? 'cooking' : ''}`} key={bill.id}>
                <h2>ໂຕະ {bill.table_number}</h2>
                {bill.items.map(item => (
                  <div className="kitchen-item" key={item.id}>
                    <div>
                      <span className="kitchen-item-name">{item.product_name}</span>
                      <span className="kitchen-item-qty">x{item.quantity}</span>
                    </div>
                    <button className={item.status === 'pending' ? 'btn-start' : 'btn-done'}
                      onClick={() => handleUpdate(item.id, nextStatus(item.status))}>
                      {nextLabel(item.status)}
                    </button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
