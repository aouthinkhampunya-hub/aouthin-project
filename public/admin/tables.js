async function checkAuth() {
  const res = await fetch('/api/auth/check');
  const data = await res.json();
  if (!data.loggedIn) {
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
let firstLoad = true;

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

function nextStatusLabel(status) {
  if (status === 'pending') return 'ເລີ່ມເຮັດ';
  if (status === 'cooking') return 'ພ້ອມແລ້ວ';
  return '';
}

async function loadTables() {
  const res = await fetch('/api/orders/bills');
  const bills = await res.json();

  // ກວດອໍເດີ້ໃໝ່
  const currentOrderIds = new Set();
  bills.forEach(bill => bill.items.forEach(item => currentOrderIds.add(item.id)));

  if (!firstLoad) {
    let hasNew = false;
    currentOrderIds.forEach(id => {
      if (!knownOrderIds.has(id)) hasNew = true;
    });
    if (hasNew) playBeep();
  }
  knownOrderIds = currentOrderIds;

  const container = document.getElementById('tables-dashboard');

  if (bills.length === 0) {
    container.innerHTML = '<p>ຍັງບໍ່ມີໂຕະທີ່ເປີດຢູ່</p>';
    return;
  }

  container.innerHTML = bills.map(bill => {
    const total = bill.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const allServed = bill.items.every(i => i.status === 'completed');

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
                ${nextStatus(item.status) ? `
                  <button class="delete-btn" onclick="updateItemStatus(${item.id}, '${nextStatus(item.status)}')">
                    ${nextStatusLabel(item.status)}
                  </button>
                ` : '✅'}
              </td>
            </tr>
          `).join('')}
        </table>
        <p class="cart-total">ລວມ: ${total} ກີບ</p>
        <button class="confirm-btn" onclick="goToBill(${bill.id})" ${!allServed ? 'disabled' : ''}>
          ${allServed ? 'ອອກບິນ / ຈ່າຍແລ້ວ' : 'ລໍຖ້າອາຫານໃຫ້ພ້ອມກ່ອນ'}
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

function goToBill(billId) {
  window.location.href = `bill.html?bill=${billId}`;
}

async function loadStaffCalls() {
  const res = await fetch('/api/staffcall');
  const calls = await res.json();

  // ກວດການເອີ້ນພະນັກງານໃໝ່
  const currentCallIds = new Set(calls.map(c => c.id));

  if (!firstLoad) {
    let hasNew = false;
    currentCallIds.forEach(id => {
      if (!knownCallIds.has(id)) hasNew = true;
    });
    if (hasNew) playBeep();
  }
  knownCallIds = currentCallIds;

  const bar = document.getElementById('staff-calls-bar');

  if (calls.length === 0) {
    bar.innerHTML = '';
    return;
  }

  bar.innerHTML = calls.map(c => `
    <div class="staff-call-alert">
      <span>🔔 ໂຕະ ${c.table_number} ເອີ້ນພະນັກງານ</span>
      <button onclick="ackStaffCall(${c.id})">ຮັບຮູ້ແລ້ວ</button>
    </div>
  `).join('');
}

async function ackStaffCall(id) {
  await fetch(`/api/staffcall/${id}/ack`, { method: 'PUT' });
  loadStaffCalls();
}

// ຕ້ອງລໍໃຫ້ browser ອະນຸຍາດສຽງກ່ອນ (ຕ້ອງມີການຄລິກຢ່າງໜ້ອຍ 1 ຄັ້ງ)
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