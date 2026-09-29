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
  } catch (e) {}
}
document.addEventListener('click', () => {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}, { once: true });

// ===== ປັອບອັບຢືນຢັນ (ແທນ confirm() ຂອງ browser) =====
(function addKitchenConfirmStyle() {
  const s = document.createElement('style');
  s.textContent = `
    .kc-overlay {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      width: 100vw; height: 100vh;
      background: rgba(20, 12, 6, 0.75);
      display: flex; align-items: center; justify-content: center;
      z-index: 9999; padding: 20px;
    }
    .kc-box {
      background: #fff; border-radius: 22px;
      width: 100%; max-width: 340px;
      padding: 36px 28px 28px; text-align: center;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
    }
    .kc-icon {
      width: 72px; height: 72px; margin: 0 auto 18px;
      border-radius: 50%; font-size: 34px;
      display: flex; align-items: center; justify-content: center;
      background: linear-gradient(150deg, #FFC93C, #F2760C);
      box-shadow: 0 8px 20px rgba(242, 118, 12, 0.35);
    }
    .kc-box h3 { margin: 0 0 8px; color: #2B1B0E; font-size: 19px; font-weight: 800; }
    .kc-box p { margin: 0 0 24px; color: #6b5a4a; font-size: 14px; line-height: 1.5; }
    .kc-actions { display: flex; gap: 10px; }
    .kc-actions button {
      flex: 1; padding: 13px; border: none; border-radius: 12px;
      font-size: 15px; font-weight: 700; cursor: pointer;
    }
    .kc-no { background: #f3ece4; color: #7a1f10; }
    .kc-no:hover { background: #e8dccf; }
    .kc-yes { background: #c0392b; color: #fff; }
    .kc-yes:hover { background: #a5301f; }
  `;
  document.head.appendChild(s);
})();

function showKitchenConfirm(title, message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'kc-overlay';
    overlay.innerHTML = `
      <div class="kc-box">
        <div class="kc-icon">🗑️</div>
        <h3>${title}</h3>
        <p>${message}</p>
        <div class="kc-actions">
          <button class="kc-no" id="kc-no">ຍົກເລີກ</button>
          <button class="kc-yes" id="kc-yes">ຢືນຢັນ</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const close = (result) => {
      overlay.remove();
      resolve(result);
    };

    overlay.querySelector('#kc-yes').onclick = () => close(true);
    overlay.querySelector('#kc-no').onclick = () => close(false);
    overlay.onclick = (e) => { if (e.target === overlay) close(false); };
  });
}

let knownItemIds = new Set();
let firstLoad = true;

// ຄົວເຮັດແຕ່ 2 ຂັ້ນ: pending -> cooking -> ready (ແອັດມິນເປັນຄົນກົດເສີບ ຢູ່ໜ້າໂຕະ)
function nextStatus(status) {
  if (status === 'pending') return 'cooking';
  if (status === 'cooking') return 'ready';
  return null;
}

function nextLabel(status) {
  if (status === 'pending') return '🔥 ເລີ່ມເຮັດ';
  if (status === 'cooking') return '✅ ເຮັດແລ້ວ';
  return '';
}

async function loadKitchen() {
  const res = await fetch('/api/orders/bills');
  const bills = await res.json();

  // ຄົວເຫັນສະເພາະລາຍການທີ່ຍັງຕ້ອງເຮັດ (pending, cooking)
  const activeBills = bills
    .map(bill => ({
      ...bill,
      items: bill.items.filter(i => i.status === 'pending' || i.status === 'cooking')
    }))
    .filter(bill => bill.items.length > 0);

  // ກວດລາຍການໃໝ່ ເພື່ອຫຼິ້ນສຽງ
  const currentIds = new Set();
  activeBills.forEach(b => b.items.forEach(i => currentIds.add(i.id)));

  if (!firstLoad) {
    let hasNew = false;
    currentIds.forEach(id => { if (!knownItemIds.has(id)) hasNew = true; });
    if (hasNew) playBeep();
  }
  knownItemIds = currentIds;

  const container = document.getElementById('kitchen-content');

  if (activeBills.length === 0) {
    container.innerHTML = '<div class="kitchen-empty">✅ ບໍ່ມີອາຫານທີ່ຕ້ອງເຮັດຕອນນີ້</div>';
    return;
  }

  container.innerHTML = `<div class="kitchen-grid">
    ${activeBills.map(bill => {
      const hasCooking = bill.items.some(i => i.status === 'cooking');
      const pendingIds = bill.items.filter(i => i.status === 'pending').map(i => i.id);
      const cookingIds = bill.items.filter(i => i.status === 'cooking').map(i => i.id);
      return `
        <div class="kitchen-card ${hasCooking ? 'cooking' : ''}">
          <h2>ໂຕະ ${bill.table_number}</h2>

          <div class="kitchen-bulk-actions">
            ${pendingIds.length > 0 ? `
              <button class="btn-start-all" onclick='bulkUpdate(${JSON.stringify(pendingIds)}, "cooking")'>
                🔥 ເລີ່ມເຮັດທັງໝົດ (${pendingIds.length})
              </button>
            ` : ''}
            ${cookingIds.length > 0 ? `
              <button class="btn-done-all" onclick='bulkUpdate(${JSON.stringify(cookingIds)}, "ready")'>
                ✅ ເຮັດແລ້ວທັງໝົດ (${cookingIds.length})
              </button>
            ` : ''}
          </div>

          ${bill.items.map(item => `
            <div class="kitchen-item">
              <div>
                <span class="kitchen-item-name">${item.product_name}</span>
                <span class="kitchen-item-qty">x${item.quantity}</span>
              </div>
              <div class="kitchen-item-actions">
                <button class="${item.status === 'pending' ? 'btn-start' : 'btn-done'}"
                  onclick="updateStatus(${item.id}, '${nextStatus(item.status)}')">
                  ${nextLabel(item.status)}
                </button>
                <button class="btn-cancel" onclick="cancelItem(${item.id})">
                   ຍົກເລີກ
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }).join('')}
  </div>`;
}

async function updateStatus(orderId, status) {
  await fetch(`/api/orders/${orderId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  loadKitchen();
}

async function bulkUpdate(orderIds, status) {
  await Promise.all(
    orderIds.map(id =>
      fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
    )
  );
  loadKitchen();
}

async function cancelItem(orderId) {
  const confirmCancel = await showKitchenConfirm(
    'ຍົກເລີກລາຍການ',
    'ຢືນຢັນວ່າຈະຍົກເລີກລາຍການນີ້? (ວັດຖຸດິບໝົດ ຫຼື ເຫດຜົນອື່ນ)'
  );
  if (!confirmCancel) return;

  const res = await fetch(`/api/orders/${orderId}`, { method: 'DELETE' });
  const data = await res.json();

  if (res.ok) {
    loadKitchen();
  } else {
    showKitchenToast('❌ ' + (data.error || 'ຍົກເລີກບໍ່ໄດ້'));
  }
}

function showKitchenToast(message) {
  const old = document.getElementById('kitchen-toast');
  if (old) old.remove();
  const t = document.createElement('div');
  t.id = 'kitchen-toast';
  t.textContent = message;
  t.style.cssText = `
    position: fixed; left: 50%; bottom: 30px; transform: translateX(-50%);
    background: #2B1B0E; color: #FFC93C; padding: 12px 22px;
    border-radius: 999px; font-weight: 700; font-size: 15px;
    z-index: 10002; box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    max-width: 90vw; text-align: center;
  `;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

async function init() {
  await loadKitchen();
  firstLoad = false;
}
init();
setInterval(loadKitchen, 5000);