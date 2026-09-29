async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) {
      window.location.href = 'login.html';
    }
  } catch (err) {
    window.location.href = 'login.html';
  }
}
checkAuth();

// ===== ระบบเสียงแจ้งเตือน =====
let audioCtx = null;

function playBeep() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
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
  } catch (e) {
    console.log('ບໍ່ສາມາດຫຼິ້ນສຽງໄດ້:', e);
  }
}

let knownOrderIds = new Set();
let knownCallIds = new Set();
let knownReadyIds = new Set();
let firstLoad = true;

function statusLabel(status) {
  if (status === 'pending') return 'ລໍຖ້າ';
  if (status === 'cooking') return 'ກຳລັງເຮັດ';
  if (status === 'ready') return '🍽️ ເຮັດແລ້ວ ລໍເສີບ';
  if (status === 'completed') return '✅ ເສີບແລ້ວ';
  return status;
}

async function loadTables() {
  const res = await fetch('/api/orders/bills');
  const bills = await res.json();
  billsCache = bills;

  const currentOrderIds = new Set();
  const currentReadyIds = new Set();
  bills.forEach(bill => bill.items.forEach(item => {
    currentOrderIds.add(item.id);
    if (item.status === 'ready') currentReadyIds.add(item.id);
  }));

  if (!firstLoad) {
    let hasNew = false;
    currentOrderIds.forEach(id => {
      if (!knownOrderIds.has(id)) hasNew = true;
    });
    // ມີອາຫານທີ່ຄົວເຮັດແລ້ວ ລໍແອັດມິນເສີບ ກໍຫຼິ້ນສຽງແຈ້ງເຕືອນ
    currentReadyIds.forEach(id => {
      if (!knownReadyIds.has(id)) hasNew = true;
    });
    if (hasNew) playBeep();
  }
  knownOrderIds = currentOrderIds;
  knownReadyIds = currentReadyIds;

  const container = document.getElementById('tables-dashboard');

  if (bills.length === 0) {
    container.innerHTML = '<p>ຍັງບໍ່ມີໂຕະທີ່ເປີດຢູ່</p>';
    return;
  }

  container.innerHTML = bills.map(bill => {
    const total = bill.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const allServed = bill.items.every(i => i.status === 'completed');
    const readyIds = bill.items
      .filter(i => i.status === 'ready')
      .map(i => i.id);

    return `
      <div class="table-card">
        <h2>ໂຕະ ${bill.table_number}</h2>
        <table>
          <tr><th>ເມນູ</th><th>ຈຳນວນ</th><th>ສະຖານະ</th><th></th></tr>
          ${bill.items.map(item => `
            <tr>
              <td>${item.product_name}</td>
              <td>${item.quantity}</td>
              <td>${statusLabel(item.status)}</td>
              <td>
                ${item.status === 'ready'
                  ? `<button class="delete-btn" onclick="updateItemStatus(${item.id}, 'completed')">ເສີບແລ້ວ</button>`
                  : item.status === 'completed' ? '✅' : '⏳'}
              </td>
            </tr>
          `).join('')}
        </table>
        <p class="cart-total">ລວມ: ${total} ກີບ</p>
        ${readyIds.length > 0 ? `
          <button class="confirm-btn" onclick='markAllServed(${JSON.stringify(readyIds)})'>
            🍽️ ເສີບທັງໝົດ
          </button>
        ` : ''}
        <button class="confirm-btn" onclick="goToBill(${bill.id})" ${!allServed ? 'disabled' : ''}>
          ${allServed ? 'ອອກບິນ / ຈ່າຍແລ້ວ' : 'ລໍຖ້າເສີບອາຫານກ່ອນ'}
        </button>
      </div>
    `;
  }).join('');
}

async function updateItemStatus(orderId, status) {
  await fetch(`/api/orders/${orderId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  loadTables();
}

async function markAllServed(itemIds) {
  await Promise.all(
    itemIds.map(id =>
      fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' })
      })
    )
  );
  loadTables();
}

// ===== ປັອບອັບໃບບິນ (ອອກບິນ / ຈ່າຍແລ້ວ) =====
let billsCache = [];
let billPopupBillId = null;

function billEsc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

(function addBillPopupStyle() {
  const s = document.createElement('style');
  s.textContent = `
        .bp-overlay {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      width: 100vw; height: 100vh; background: rgba(20, 12, 6, 0.75);
      display: flex; align-items: center; justify-content: center;
      z-index: 9999; padding: 20px; animation: bpFadeIn 0.2s ease;
      scrollbar-width: none; -ms-overflow-style: none;
    }
    .bp-overlay::-webkit-scrollbar { display: none; }
    .bp-overlay.top { z-index: 10001; }
        .bp-box {
      position: relative; background: #fff; border-radius: 22px;
      width: 100%; max-width: 460px; max-height: 92vh; overflow-y: auto;
      padding: 26px 24px 22px; box-shadow: 0 24px 60px rgba(0,0,0,0.45);
      animation: bpPopIn 0.25s ease;
      scrollbar-width: none; -ms-overflow-style: none;
    }
    .bp-box::-webkit-scrollbar { display: none; }
    .bp-close {
      position: absolute; top: 12px; right: 14px; width: 32px; height: 32px;
      border: none; border-radius: 50%; background: #f3ece4; color: #7a1f10;
      font-size: 16px; font-weight: 700; cursor: pointer; padding: 0; margin: 0;
      display: flex; align-items: center; justify-content: center;
    }
    .bp-close:hover { background: #e8dccf; }
    .bp-head { text-align: center; border-bottom: 2px dashed #eadfd3; padding-bottom: 14px; margin-bottom: 14px; }
    .bp-head h2 { margin: 0 0 4px; color: #2B1B0E; font-size: 19px; }
    .bp-head p { margin: 0; color: #8a7a6a; font-size: 13px; }
    .bp-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
    .bp-table th {
      text-align: left; font-size: 12px; color: #fff; background: #7a1f10;
      padding: 8px 8px;
    }
    .bp-table th:first-child { border-radius: 10px 0 0 10px; }
    .bp-table th:last-child { border-radius: 0 10px 10px 0; }
    .bp-table td { padding: 8px; font-size: 14px; border-bottom: 1px solid #eadfd3; }
    .bp-total {
      display: flex; justify-content: space-between; align-items: center;
      padding-top: 12px; border-top: 2px dashed #eadfd3; margin-bottom: 16px;
    }
    .bp-total span:first-child { font-size: 15px; color: #8a7a6a; }
    .bp-total span:last-child { font-size: 24px; font-weight: 800; color: #2B1B0E; }
    .bp-qr { text-align: center; padding-top: 14px; border-top: 2px dashed #eadfd3; margin-bottom: 18px; }
    .bp-qr p { margin: 0 0 10px; font-size: 13px; color: #8a7a6a; }
    .bp-qr img { width: 180px; height: 180px; border-radius: 10px; border: 1px solid #eadfd3; }
    .bp-actions { display: flex; gap: 12px; }
    .bp-actions button {
      flex: 1; padding: 14px; border: none; border-radius: 14px; font-size: 15px;
      font-weight: 700; cursor: pointer; margin: 0; width: auto;
    }
    .bp-print { background: #2B1B0E; color: #FFC93C; box-shadow: 0 4px 12px rgba(43,27,14,0.25); }
    .bp-print:hover { background: #3D2A18; }
    .bp-confirm { background: #3C8031; color: #fff; box-shadow: 0 6px 16px rgba(60,128,49,0.35); }
    .bp-confirm:hover { background: #2C601E; }

    .bp-sub-box {
      background: #fff; border-radius: 22px; width: 100%; max-width: 340px;
      padding: 36px 28px 28px; text-align: center;
      box-shadow: 0 24px 60px rgba(0,0,0,0.45); animation: bpPopIn 0.25s ease;
    }
    .bp-sub-icon {
      width: 72px; height: 72px; margin: 0 auto 18px; border-radius: 50%; font-size: 34px;
      display: flex; align-items: center; justify-content: center;
      background: linear-gradient(150deg, #FFC93C, #F2760C);
      box-shadow: 0 8px 20px rgba(242,118,12,0.35);
    }
    .bp-sub-box h3 { margin: 0 0 8px; color: #2B1B0E; font-size: 19px; font-weight: 800; }
    .bp-sub-box p { margin: 0 0 26px; color: #6b5a4a; font-size: 14px; line-height: 1.5; }
    .bp-sub-actions { display: flex; gap: 10px; }
    .bp-sub-actions button {
      flex: 1; padding: 13px; border: none; border-radius: 12px; font-size: 15px;
      font-weight: 700; cursor: pointer; margin: 0; width: auto;
    }
    .bp-no { background: #c0392b; color: #fff; }
    .bp-no:hover { background: #a5301f; }
    .bp-yes { background: #3C8031; color: #fff; box-shadow: 0 6px 16px rgba(60,128,49,0.35); }
    .bp-yes:hover { background: #2C601E; }
    .bp-yes:disabled { opacity: 0.6; cursor: default; }

    .bp-toast {
      position: fixed; left: 50%; bottom: 30px; transform: translateX(-50%);
      background: #2B1B0E; color: #FFC93C; padding: 12px 22px; border-radius: 999px;
      font-weight: 700; font-size: 15px; z-index: 10002;
      box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    }
    @keyframes bpFadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes bpPopIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }

    /* ພິມ: ສະແດງສະເພາະໃບບິນໃນປັອບອັບ ແລະຂະຫຍາຍໃຫ້ເຕັມກະດາດ */
    @media print {
      @page { margin: 12mm; }
      body:has(#bill-popup-modal) > *:not(#bill-popup-modal) { display: none !important; }
      #bill-popup-modal {
        position: static !important; width: auto !important; height: auto !important;
        background: #fff !important; padding: 0 !important; display: block !important;
        animation: none !important;
      }
      #bill-popup-modal .bp-box {
        max-width: 100%; max-height: none; overflow: visible; box-shadow: none;
        border-radius: 0; padding: 0; animation: none;
      }
      #bill-popup-modal .bp-close, #bill-popup-modal .bp-actions, #bill-confirm-modal { display: none !important; }
      #bill-popup-modal .bp-receipt { border: 1px solid #e5d9cc; border-radius: 16px; padding: 32px; }
      #bill-popup-modal .bp-head h2 { font-size: 30px; margin-bottom: 8px; }
      #bill-popup-modal .bp-head p { font-size: 17px; }
      #bill-popup-modal .bp-table th { font-size: 16px; padding: 10px 8px; }
      #bill-popup-modal .bp-table td { font-size: 20px; padding: 14px 8px; }
      #bill-popup-modal .bp-total span:first-child { font-size: 22px; }
      #bill-popup-modal .bp-total span:last-child { font-size: 38px; }
      #bill-popup-modal .bp-qr p { font-size: 18px; }
      #bill-popup-modal .bp-qr img { width: 340px; height: 340px; }
      #bill-popup-modal .bp-total, #bill-popup-modal .bp-qr { break-inside: avoid; }
      #bill-popup-modal, #bill-popup-modal * {
        -webkit-print-color-adjust: exact; print-color-adjust: exact;
      }
    }
  `;
  document.head.appendChild(s);
})();

function showBillToast(message) {
  const old = document.getElementById('bill-toast');
  if (old) old.remove();
  const t = document.createElement('div');
  t.id = 'bill-toast';
  t.className = 'bp-toast';
  t.textContent = message;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

async function goToBill(billId) {
  const bill = billsCache.find(b => String(b.id) === String(billId));
  if (!bill) {
    showBillToast('❌ ບໍ່ພົບໃບບິນນີ້ (ອາດຈະຈ່າຍໄປແລ້ວ)');
    return;
  }
  billPopupBillId = bill.id;

  let qrImage = null;
  try {
    const qrRes = await fetch('/api/settings/qr');
    const qrData = await qrRes.json();
    qrImage = qrData.qrImage;
  } catch (err) {}

  const total = bill.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const now = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Vientiane' });

  let overlay = document.getElementById('bill-popup-modal');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'bill-popup-modal';
    overlay.className = 'bp-overlay';
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeBillPopup();
    });
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="bp-box">
      <button class="bp-close" onclick="closeBillPopup()">✕</button>
      <div class="bp-receipt">
        <div class="bp-head">
          <h2>ຮ້ານອາຫານຕາມສັ່ງ AOUTHIN</h2>
          <p>ໂຕະ ${billEsc(bill.table_number)} &nbsp;•&nbsp; ${now}</p>
        </div>
        <table class="bp-table">
          <tr><th>ເມນູ</th><th>ຈຳນວນ</th><th>ລາຄາ</th></tr>
          ${bill.items.map(i => `
            <tr>
              <td>${billEsc(i.product_name)}</td>
              <td>${i.quantity}</td>
              <td>${i.price * i.quantity} ກີບ</td>
            </tr>
          `).join('')}
        </table>
        <div class="bp-total">
          <span>ຍອດລວມທັງໝົດ</span>
          <span>${total} ກີບ</span>
        </div>
        <div class="bp-qr">
          ${qrImage
            ? `<p>ສະແກນ QR ນີ້ເພື່ອຊຳລະເງິນ</p><img src="${qrImage}" alt="QR ຮັບເງິນ">`
            : `<p>ຍັງບໍ່ໄດ້ຕັ້ງຄ່າ QR ຮັບເງິນ (ໄປທີ່ໜ້າ QR Code)</p>`}
        </div>
      </div>
      <div class="bp-actions">
        <button class="bp-print" onclick="window.print()">🖨️ ພິມບິນ</button>
        <button class="bp-confirm" onclick="askConfirmPaid()">🧾 ກວດສອບບິນ</button>
      </div>
    </div>
  `;
}

function closeBillPopup() {
  const overlay = document.getElementById('bill-popup-modal');
  if (overlay) overlay.remove();
  closeConfirmPaid();
  billPopupBillId = null;
}

function askConfirmPaid() {
  let overlay = document.getElementById('bill-confirm-modal');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'bill-confirm-modal';
    overlay.className = 'bp-overlay top';
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeConfirmPaid();
    });
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `
    <div class="bp-sub-box">
      <div class="bp-sub-icon">💰</div>
      <h3>ຢືນຢັນຮັບເງິນ</h3>
      <p>ໂຕະນີ້ຈ່າຍເງິນຄົບຖ້ວນແລ້ວແທ້ບໍ່?<br>ການດຳເນີນການນີ້ຈະປິດບິນ</p>
      <div class="bp-sub-actions">
        <button class="bp-no" onclick="closeConfirmPaid()">ຍົກເລີກ</button>
        <button class="bp-yes" id="bill-paid-yes" onclick="doConfirmPaid()">✓ ຢືນຢັນ</button>
      </div>
    </div>
  `;
}

function closeConfirmPaid() {
  const overlay = document.getElementById('bill-confirm-modal');
  if (overlay) overlay.remove();
}

async function doConfirmPaid() {
  if (billPopupBillId === null) return;
  const id = billPopupBillId;

  const btn = document.getElementById('bill-paid-yes');
  btn.disabled = true;

  try {
    const res = await fetch(`/api/orders/bills/${id}/close`, { method: 'PUT' });
    if (!res.ok) {
      btn.disabled = false;
      showBillToast('❌ ປິດບິນບໍ່ສຳເລັດ');
      return;
    }
  } catch (err) {
    btn.disabled = false;
    showBillToast('❌ ປິດບິນບໍ່ສຳເລັດ');
    return;
  }

  closeBillPopup();
  await loadTables();
  showBillToast('✅ ປິດບິນແລ້ວ');
}

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (document.getElementById('bill-confirm-modal')) closeConfirmPaid();
  else if (document.getElementById('bill-popup-modal')) closeBillPopup();
});

// ===== ປຸ່ມກະດິ່ງແຈ້ງເຕືອນເອີ້ນພະນັກງານ + ປັອບອັບ (ຊ້ອນຢູ່ເທິງໜ້າ) =====
let staffCallsOpen = false;
let staffCallsData = [];

// ===== ຍ້າຍປຸ່ມ 🔔 ເອີ້ນພະນັກງານ ໄປຢູ່ແຖບເມນູເທິງ (ຂວາສຸດ) =====
(function relocateStaffCallBar() {
  function moveBar() {
    const bar = document.getElementById('staff-calls-bar');
    const nav = document.querySelector('header nav') || document.querySelector('header');
    if (!bar || !nav || bar.parentElement === nav) return;

    nav.style.display = 'flex';
    nav.style.alignItems = 'center';
    nav.style.flexWrap = 'wrap';

    bar.style.marginLeft = 'auto';
    bar.style.display = 'inline-flex';
    bar.style.alignItems = 'center';

    nav.appendChild(bar);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', moveBar);
  } else {
    moveBar();
  }
})();

(function addStaffBellStyle() {
  const s = document.createElement('style');
  s.textContent = `
    .staff-bell-btn {
      display: inline-flex; align-items: center; gap: 6px;
      width: fit-content !important; max-width: max-content; flex: 0 0 auto;
      align-self: flex-start; justify-self: start; margin: 0;
      background: #d9a520; border: none; color: #fff;
      font-weight: 700; font-size: 13px; line-height: 1.2; padding: 5px 12px;
      border-radius: 999px; cursor: pointer;
    }
    .staff-bell-btn .bell-icon { display: inline-block; transform-origin: 50% 10%; }
    .staff-bell-btn.ringing .bell-icon { animation: staffBellShake 1.4s ease-in-out infinite; }
    .staff-bell-btn .badge {
      background: #d32f2f; color: #fff; min-width: 18px; height: 18px;
      border-radius: 999px; display: inline-flex; align-items: center;
      justify-content: center; font-size: 12px; padding: 0 5px;
    }
    @keyframes staffBellShake {
      0%, 50%, 100% { transform: rotate(0); }
      10%, 30% { transform: rotate(-18deg); }
      20%, 40% { transform: rotate(18deg); }
    }

    /* ປັອບອັບລາຍການເອີ້ນພະນັກງານ */
    .staff-modal-overlay {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      width: 100vw; height: 100vh;
      background: rgba(20, 12, 6, 0.75);
      display: flex; align-items: center; justify-content: center;
      z-index: 9999; padding: 20px;
      animation: staffFadeIn 0.2s ease;
    }
    .staff-modal-box {
      background: #fff; border-radius: 22px;
      width: 100%; max-width: 420px; max-height: 80vh;
      display: flex; flex-direction: column;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
      animation: staffPopIn 0.25s ease;
      overflow: hidden;
    }
    .staff-modal-head {
      position: relative; text-align: center;
      padding: 26px 20px 14px;
    }
    .staff-modal-icon {
      width: 60px; height: 60px; margin: 0 auto 10px;
      border-radius: 50%; font-size: 28px;
      display: flex; align-items: center; justify-content: center;
      background: linear-gradient(150deg, #FFC93C, #F2760C);
      box-shadow: 0 8px 20px rgba(242, 118, 12, 0.35);
    }
    .staff-modal-head h3 {
      margin: 0; color: #2B1B0E; font-size: 18px; font-weight: 800;
    }
    .staff-modal-close {
      position: absolute; top: 12px; right: 14px;
      width: 32px; height: 32px; border: none; border-radius: 50%;
      background: #f3ece4; color: #7a1f10; font-size: 16px; font-weight: 700;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      padding: 0; margin: 0;
    }
    .staff-modal-close:hover { background: #e8dccf; }
    .staff-modal-list {
      padding: 6px 18px 22px; overflow-y: auto;
      display: flex; flex-direction: column; gap: 10px;
    }
    .staff-modal-item {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      background: #fff3cd; border: 2px solid #d9a520; border-radius: 14px;
      padding: 12px 14px; color: #7a1f10; font-weight: 700;
    }
    .staff-modal-item button {
      background: #3C8031; color: #fff; border: none; border-radius: 10px;
      padding: 8px 14px; font-size: 14px; font-weight: 700; cursor: pointer;
      width: auto; margin: 0; flex: 0 0 auto;
    }
    .staff-modal-item button:hover { background: #2C601E; }
    @keyframes staffFadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes staffPopIn {
      from { transform: scale(0.9); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
  `;
  document.head.appendChild(s);
})();

function renderStaffModal() {
  let overlay = document.getElementById('staff-call-modal');

  // ບໍ່ມີລາຍການແລ້ວ ຫຼືປິດຢູ່ -> ລຶບປັອບອັບ
  if (staffCallsData.length === 0) staffCallsOpen = false;
  if (!staffCallsOpen) {
    if (overlay) overlay.remove();
    return;
  }

  const key = staffCallsData.map(c => c.id).join(',');

  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'staff-call-modal';
    overlay.className = 'staff-modal-overlay';
    // ກົດພື້ນມືດນອກກ່ອງເພື່ອປິດ
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) toggleStaffCalls();
    });
    document.body.appendChild(overlay);
  } else if (overlay.dataset.key === key) {
    return; // ລາຍການບໍ່ປ່ຽນ ບໍ່ຕ້ອງວາດໃໝ່
  }

  overlay.dataset.key = key;
  overlay.innerHTML = `
    <div class="staff-modal-box">
      <div class="staff-modal-head">
        <div class="staff-modal-icon">🔔</div>
        <h3>ລູກຄ້າເອີ້ນພະນັກງານ</h3>
        <button class="staff-modal-close" onclick="toggleStaffCalls()">✕</button>
      </div>
      <div class="staff-modal-list">
        ${staffCallsData.map(c => `
          <div class="staff-modal-item">
            <span>🔔 ໂຕະ ${c.table_number}</span>
            <button onclick="ackStaffCall(${c.id})">ຮັບຮູ້ແລ້ວ</button>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function toggleStaffCalls() {
  staffCallsOpen = !staffCallsOpen;
  renderStaffModal();
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && staffCallsOpen) toggleStaffCalls();
});

async function loadStaffCalls() {
  const res = await fetch('/api/staffcall');
  const calls = await res.json();

  const currentCallIds = new Set(calls.map(c => c.id));

  if (!firstLoad) {
    let hasNew = false;
    currentCallIds.forEach(id => {
      if (!knownCallIds.has(id)) hasNew = true;
    });
    if (hasNew) playBeep();
  }
  knownCallIds = currentCallIds;

  staffCallsData = calls;

  const bar = document.getElementById('staff-calls-bar');

  if (calls.length === 0) {
    bar.innerHTML = '';
    renderStaffModal();
    return;
  }

  bar.innerHTML = `
    <button class="staff-bell-btn ringing" onclick="toggleStaffCalls()">
      <span class="bell-icon">🔔</span> <span>ເອີ້ນພະນັກງານ</span> <span class="badge">${calls.length}</span>
    </button>
  `;

  renderStaffModal();
}

async function ackStaffCall(id) {
  await fetch(`/api/staffcall/${id}/ack`, { method: 'PUT' });
  loadStaffCalls();
}

document.addEventListener('click', () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}, { once: true });

async function initTables() {
  await loadTables();
  await loadStaffCalls();
  firstLoad = false;
}

initTables();
setInterval(() => {
  loadTables();
  loadStaffCalls();
}, 5000);