async function checkAuth() {
  const res = await fetch('/api/auth/check');
  const data = await res.json();
  if (!data.loggedIn) {
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

let knownItemIds = new Set();
let firstLoad = true;

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

async function loadKitchen() {
  const res = await fetch('/api/orders/bills');
  const bills = await res.json();

  // ເອົາສະເພາະລາຍການທີ່ຍັງບໍ່ພ້ອມ (pending, cooking)
  const activeBills = bills
    .map(bill => ({
      ...bill,
      items: bill.items.filter(i => i.status !== 'completed')
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
      return `
        <div class="kitchen-card ${hasCooking ? 'cooking' : ''}">
          <h2>ໂຕະ ${bill.table_number}</h2>
          ${bill.items.map(item => `
            <div class="kitchen-item">
              <div>
                <span class="kitchen-item-name">${item.product_name}</span>
                <span class="kitchen-item-qty">x${item.quantity}</span>
              </div>
              <button class="${item.status === 'pending' ? 'btn-start' : 'btn-done'}"
                onclick="updateStatus(${item.id}, '${nextStatus(item.status)}')">
                ${nextLabel(item.status)}
              </button>
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

async function init() {
  await loadKitchen();
  firstLoad = false;
}
init();
setInterval(loadKitchen, 5000);