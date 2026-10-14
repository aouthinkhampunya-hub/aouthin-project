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

/* ===== ຕົວຊ່ວຍ ===== */
function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function statusLabel(status) {
  if (status === 'pending') return 'ລໍຖ້າ';
  if (status === 'cooking') return 'ກຳລັງເຮັດ';
  if (status === 'ready') return '🍽️ ເຮັດແລ້ວ ລໍເສີບ';
  if (status === 'completed') return '✅ ເສີບແລ້ວ';
  return status;
}

function billTotal(bill) {
  return (bill.items || []).reduce((s, i) => s + i.price * i.quantity, 0) + Number(bill.delivery_fee || 0);
}

// ປະເພດອໍເດີ້: dine_in | pickup | delivery
function typeOf(bill) { return bill.order_type || 'dine_in'; }
function isOnline(bill) { return typeOf(bill) !== 'dine_in'; }
function onlineLabel(bill) {
  return typeOf(bill) === 'delivery' ? '🛵 ສົ່ງເຖິງບ້ານ' : '🥡 ມາຮັບເຄື່ອງເອງ';
}
function billNo(bill) { return bill.bill_no ? bill.bill_no : bill.id; }

function slipUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return path.startsWith('/') ? path : '/' + path;
}

/* ===== ສຽງແຈ້ງເຕືອນ ===== */
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

document.addEventListener('click', () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}, { once: true });

/* ===== ຂໍ້ມູນຂອງໜ້າ ===== */
let bills = [];
let tableList = Array.from({ length: 20 }, (_, i) => i + 1);
let listOpen = null;      // null | 'dinein' | 'pickup' | 'delivery'
let popup = null;         // { bill, qrImage, now }
let askPaid = false;
let paying = false;
let zoomSrc = null;
let loaded = false;
let firstLoad = true;
let knownOrderIds = new Set();
let knownReadyIds = new Set();
let knownOnlineIds = new Set();
let toastTimer = null;

/* ===== Toast ===== */
function showToast(msg, ms = 2200) {
  const old = document.getElementById('bill-toast');
  if (old) old.remove();
  const t = document.createElement('div');
  t.id = 'bill-toast';
  t.className = 'bp-toast';
  t.textContent = msg;
  document.body.appendChild(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), ms);
}

/* ===== ໂຫລດຂໍ້ມູນ ===== */
async function loadTableCount() {
  try {
    const res = await fetch('/api/tables/count');
    const data = await res.json();
    if (Array.isArray(data.tables)) {
      tableList = data.tables.map(Number);
    } else if (data.count) {
      tableList = Array.from({ length: Number(data.count) }, (_, i) => i + 1);
    }
  } catch (e) {}
}

async function load() {
  const res = await fetch('/api/orders/bills');
  if (!res.ok) throw new Error('load bills failed');
  const data = await res.json();

  const orderIds = new Set();
  const readyIds = new Set();
  data.forEach(b => b.items.forEach(i => {
    orderIds.add(i.id);
    if (i.status === 'ready') readyIds.add(i.id);
  }));

  const onlineIds = new Set(data.filter(isOnline).map(b => b.id));

  if (!firstLoad) {
    const fresh = [...onlineIds].filter(id => !knownOnlineIds.has(id));
    if (fresh.length > 0) {
      const freshBills = data.filter(b => fresh.includes(b.id));
      const p = freshBills.filter(b => typeOf(b) === 'pickup').length;
      const d = freshBills.filter(b => typeOf(b) === 'delivery').length;
      const parts = [];
      if (p) parts.push(`🥡 ມາຮັບເອງ ${p}`);
      if (d) parts.push(`🛵 ສົ່ງເຖິງບ້ານ ${d}`);
      showToast(`ມີອໍເດີ້ໃໝ່: ${parts.join(' • ')}`, 6000);
    }

    let hasNew = false;
    orderIds.forEach(id => { if (!knownOrderIds.has(id)) hasNew = true; });
    readyIds.forEach(id => { if (!knownReadyIds.has(id)) hasNew = true; });
    if (hasNew) playBeep();
  }

  knownOnlineIds = onlineIds;
  knownOrderIds = orderIds;
  knownReadyIds = readyIds;
  bills = data;
  loaded = true;
  renderAll();
}

/* ===== ແຍກບິນ 3 ປະເພດ ===== */
function getGroups() {
  return {
    dineIn: bills.filter(b => typeOf(b) === 'dine_in'),
    pickup: bills.filter(b => typeOf(b) === 'pickup').sort((a, b) => b.id - a.id),
    delivery: bills.filter(b => typeOf(b) === 'delivery').sort((a, b) => b.id - a.id)
  };
}

function getLists() {
  const g = getGroups();
  return {
    dinein: { bills: g.dineIn, title: '🍽️ ອໍເດີ້ໜ້າຮ້ານ', empty: 'ຍັງບໍ່ມີໂຕະທີ່ເປີດຢູ່' },
    pickup: { bills: g.pickup, title: '🥡 ມາຮັບເຄື່ອງເອງ', empty: 'ຍັງບໍ່ມີອໍເດີ້ມາຮັບເຄື່ອງເອງ' },
    delivery: { bills: g.delivery, title: '🛵 ສົ່ງເຖິງບ້ານ', empty: 'ຍັງບໍ່ມີອໍເດີ້ສົ່ງເຖິງບ້ານ' }
  };
}

/* ===== ສະແດງຜົນ: tab + ກະດານໂຕະ ===== */
function renderAll() {
  const loading = document.getElementById('loading-text');
  if (loading) loading.style.display = loaded ? 'none' : 'block';
  renderTabs();
  renderBoard();
  renderListPopup();
}

function renderTabs() {
  const el = document.getElementById('ord-tabs');
  if (!el) return;
  const g = getGroups();
  const tabs = [
    { key: 'dinein', icon: '🍽️', label: 'ອໍເດີ້ໜ້າຮ້ານ', count: g.dineIn.length },
    { key: 'pickup', icon: '🥡', label: 'ມາຮັບເຄື່ອງເອງ', count: g.pickup.length },
    { key: 'delivery', icon: '🛵', label: 'ສົ່ງເຖິງບ້ານ', count: g.delivery.length }
  ];
  el.innerHTML = tabs.map(t => `
    <button type="button" class="ord-tab${t.key !== 'dinein' ? ' online' : ''}${t.count > 0 ? ' has-orders' : ''}" onclick="setListOpen('${t.key}')">
      ${t.icon} ${t.label}
      <span class="ord-count">${t.count}</span>
    </button>
  `).join('');
}

function renderBoard() {
  const el = document.getElementById('table-board');
  if (!el) return;
  const g = getGroups();
  const byTable = {};
  g.dineIn.forEach(b => { byTable[b.table_number] = b; });

  const numbers = Array.from(new Set([
    ...tableList,
    ...g.dineIn.map(b => Number(b.table_number)).filter(n => n > 0)
  ])).sort((a, b) => a - b);

  el.innerHTML = numbers.map(n => {
    const bill = byTable[n];
    if (bill) {
      return `
        <div class="board-cell occupied" onclick="openTable(${n})">
          <div class="board-num">${n}</div>
          <div class="board-sub">${billTotal(bill).toLocaleString()} ກີບ</div>
        </div>`;
    }
    return `
      <div class="board-cell empty">
        <div class="board-num">${n}</div>
        <div class="board-sub">ວ່າງ</div>
      </div>`;
  }).join('');
}

/* ===== ປັອບອັບລາຍການບິນ ===== */
function setListOpen(key) {
  listOpen = key;
  renderListPopup();
}

function openTable(n) {
  setListOpen('dinein');
  setTimeout(() => {
    const el = document.getElementById(`table-section-${n}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 80);
}

function renderBillCard(bill) {
  const total = billTotal(bill);
  const online = isOnline(bill);
  const allServed = bill.items.every(i => i.status === 'completed');
  const readyIds = bill.items.filter(i => i.status === 'ready').map(i => i.id);
  const cardId = online ? `table-section-online-${bill.id}` : `table-section-${bill.table_number}`;

  let head = '';
  if (online) {
    const hasMap = bill.latitude && bill.longitude;
    let slipHtml = '';
    if (bill.payment_method === 'transfer') {
      slipHtml = bill.slip_image
        ? `<div class="olx-slip-wrap">
             <div class="olx-slip-label">🧾 ສະລິບການໂອນເງິນ (ກົດເພື່ອຂະຫຍາຍ)</div>
             <button type="button" class="tb-slip-trigger" onclick="openZoom(${bill.id})">
               <img class="olx-slip" src="${esc(slipUrl(bill.slip_image))}" alt="ສະລິບໂອນເງິນ">
             </button>
           </div>`
        : `<p class="olx-slip-missing">⚠️ ບໍ່ພົບຮູບສະລິບ</p>`;
    }
    head = `
      <h2>${onlineLabel(bill)} #${esc(billNo(bill))}</h2>
      <p style="margin: 0 0 12px; font-weight: 700; line-height: 1.7;">
        👤 ${esc(bill.customer_name)} &nbsp;📞 <a href="tel:${esc(bill.customer_phone)}">${esc(bill.customer_phone)}</a>
        ${bill.address ? `<br>📍 ${esc(bill.address)}` : ''}
        ${hasMap ? `<br><a href="https://www.google.com/maps/dir/?api=1&destination=${esc(bill.latitude)},${esc(bill.longitude)}" target="_blank" rel="noreferrer">🗺️ ເປີດນຳທາງໃນ Google Maps</a>` : ''}
        <br>${bill.payment_method === 'transfer' ? '🏦 ໂອນເງິນ' : '💵 ຈ່າຍເງິນສົດ'}
      </p>
      ${slipHtml}`;
  } else {
    head = `<h2>ໂຕະ ${esc(bill.table_number)}</h2>`;
  }

  const billBtnText = allServed
    ? (online ? 'ອອກບິນ / ຮັບເງິນແລ້ວ' : 'ອອກບິນ / ຈ່າຍແລ້ວ')
    : 'ລໍຖ້າເສີບອາຫານກ່ອນ';

  return `
    <div class="table-card" id="${cardId}">
      ${head}
      <table>
        <tbody>
          <tr><th>ເມນູ</th><th>ຈຳນວນ</th><th>ສະຖານະ</th><th></th></tr>
          ${bill.items.map(item => `
            <tr>
              <td>${esc(item.product_name)}</td>
              <td>${item.quantity}</td>
              <td>${statusLabel(item.status)}</td>
              <td>
                ${item.status === 'ready'
                  ? `<button class="delete-btn" onclick="updateItem(${item.id}, 'completed')">ເສີບແລ້ວ</button>`
                  : item.status === 'completed' ? '✅' : '⏳'}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${Number(bill.delivery_fee) > 0 ? `
        <p style="margin: 0 0 6px; font-weight: 700;">
          🛵 ຄ່າສົ່ງ (${esc(bill.delivery_distance)} ກມ): ${Number(bill.delivery_fee).toLocaleString()} ກີບ
        </p>` : ''}
      <p class="cart-total">ລວມ: ${total} ກີບ</p>
      ${readyIds.length > 0 ? `
        <button class="confirm-btn" onclick="markAllServed([${readyIds.join(',')}])">
          ${online ? '📦 ອໍເດີ້ພ້ອມສົ່ງແລ້ວ' : '🍽️ ເສີບທັງໝົດ'}
        </button>` : ''}
      <button class="confirm-btn" ${!allServed ? 'disabled' : ''} onclick="goToBill(${bill.id})">
        ${billBtnText}
      </button>
    </div>`;
}

function renderListPopup() {
  let overlay = document.getElementById('olx-overlay');
  if (!listOpen) {
    if (overlay) overlay.remove();
    return;
  }
  const current = getLists()[listOpen];

  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'olx-overlay';
    overlay.className = 'olx-overlay';
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) setListOpen(null);
    });
    document.body.appendChild(overlay);
  }

  const oldBox = overlay.querySelector('.olx-box');
  const scrollTop = oldBox ? oldBox.scrollTop : 0;

  overlay.innerHTML = `
    <div class="olx-box">
      <button class="olx-close" onclick="setListOpen(null)">✕</button>
      <h2 class="olx-title">${current.title} (${current.bills.length})</h2>
      ${current.bills.length === 0
        ? `<p class="olx-empty">${current.empty}</p>`
        : current.bills.map(renderBillCard).join('')}
    </div>`;

  const newBox = overlay.querySelector('.olx-box');
  if (newBox) newBox.scrollTop = scrollTop;
}

/* ===== ປ່ຽນສະຖານະອາຫານ ===== */
async function updateItem(id, status) {
  await fetch(`/api/orders/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  load();
}

async function markAllServed(ids) {
  await Promise.all(ids.map(id =>
    fetch(`/api/orders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' })
    })
  ));
  load();
}

/* ===== ປັອບອັບໃບບິນ ===== */
async function goToBill(billId) {
  const bill = bills.find(b => String(b.id) === String(billId));
  if (!bill) {
    showToast('❌ ບໍ່ພົບໃບບິນນີ້ (ອາດຈະຈ່າຍໄປແລ້ວ)');
    return;
  }
  let qrImage = null;
  if (!isOnline(bill)) {
    try {
      const qrRes = await fetch('/api/settings/qr');
      const qrData = await qrRes.json();
      qrImage = qrData.qrImage;
    } catch (e) {}
  }
  const now = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Vientiane' });
  popup = { bill, qrImage, now };
  askPaid = false;
  paying = false;
  renderBillPopup();
}

function renderBillPopup() {
  let pop = document.getElementById('bill-popup-modal');
  if (!popup) {
    if (pop) pop.remove();
    renderConfirm();
    return;
  }
  if (!pop) {
    pop = document.createElement('div');
    pop.id = 'bill-popup-modal';
    pop.className = 'bp-overlay';
    pop.addEventListener('click', (e) => {
      if (e.target === pop) closePopup();
    });
    document.body.appendChild(pop);
  }

  const bill = popup.bill;
  const online = isOnline(bill);

  const titleLine = online
    ? `${onlineLabel(bill)} #${esc(billNo(bill))}`
    : `ໂຕະ ${esc(bill.table_number)}`;

  const customerLine = online
    ? `<p>👤 ${esc(bill.customer_name)} &nbsp;📞 ${esc(bill.customer_phone)}${bill.address ? `<br>📍 ${esc(bill.address)}` : ''}</p>`
    : '';

  let payArea = '';
  if (online) {
    payArea = `<p>${bill.payment_method === 'transfer' ? '🏦 ຊຳລະດ້ວຍການໂອນເງິນ' : '💵 ຊຳລະດ້ວຍເງິນສົດ'}</p>`;
  } else if (popup.qrImage) {
    payArea = `<p>ສະແກນ QR ນີ້ເພື່ອຊຳລະເງິນ</p><img src="${esc(popup.qrImage)}" alt="QR ຮັບເງິນ">`;
  } else {
    payArea = `<p>ຍັງບໍ່ໄດ້ຕັ້ງຄ່າ QR ຮັບເງິນ (ໄປທີ່ໜ້າ QR Code)</p>`;
  }

  pop.innerHTML = `
    <div class="bp-box">
      <button class="bp-close" onclick="closePopup()">✕</button>
      <div class="bp-receipt">
        <div class="bp-head">
          <h2>ຮ້ານອາຫານຕາມສັ່ງ AOUTHIN</h2>
          <p>${titleLine} &nbsp;•&nbsp; ${esc(popup.now)}</p>
          ${customerLine}
        </div>
        <table class="bp-table">
          <tbody>
            <tr><th>ເມນູ</th><th>ຈຳນວນ</th><th>ລາຄາ</th></tr>
            ${bill.items.map(i => `
              <tr>
                <td>${esc(i.product_name)}</td>
                <td>${i.quantity}</td>
                <td>${i.price * i.quantity} ກີບ</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ${Number(bill.delivery_fee) > 0 ? `
          <p style="text-align: right; margin: 0 0 8px;">
            🛵 ຄ່າສົ່ງ (${esc(bill.delivery_distance)} ກມ): ${Number(bill.delivery_fee).toLocaleString()} ກີບ
          </p>` : ''}
        <div class="bp-total">
          <span>ຍອດລວມທັງໝົດ</span>
          <span>${billTotal(bill)} ກີບ</span>
        </div>
        <div class="bp-qr">${payArea}</div>
      </div>
      <div class="bp-actions">
        <button class="bp-print" onclick="window.print()">🖨️ ພິມບິນ</button>
        <button class="bp-confirm" onclick="openConfirm()">${online ? 'ຮັບເງິນແລ້ວ' : 'ຈ່າຍແລ້ວ'}</button>
      </div>
    </div>`;
}

function closePopup() {
  popup = null;
  askPaid = false;
  paying = false;
  renderBillPopup();
}

function openConfirm() {
  askPaid = true;
  renderConfirm();
}

function closeConfirm() {
  askPaid = false;
  renderConfirm();
}

function renderConfirm() {
  let conf = document.getElementById('bill-confirm-modal');
  if (!askPaid || !popup) {
    if (conf) conf.remove();
    return;
  }
  if (!conf) {
    conf = document.createElement('div');
    conf.id = 'bill-confirm-modal';
    conf.className = 'bp-overlay top';
    conf.addEventListener('click', (e) => {
      if (e.target === conf) closeConfirm();
    });
    document.body.appendChild(conf);
  }
  const online = isOnline(popup.bill);
  conf.innerHTML = `
    <div class="bp-sub-box">
      <div class="bp-sub-icon">💰</div>
      <h3>ຢືນຢັນຮັບເງິນ</h3>
      <p>${online ? 'ຮັບເງິນຄົບຖ້ວນແລ້ວແທ້ບໍ?' : 'ໂຕະນີ້ຈ່າຍເງິນຄົບຖ້ວນແລ້ວແທ້ບໍ?'}<br>ການດຳເນີນການນີ້ຈະປິດບິນ</p>
      <div class="bp-sub-actions">
        <button class="bp-no" onclick="closeConfirm()">ຍົກເລີກ</button>
        <button class="bp-yes" ${paying ? 'disabled' : ''} onclick="doConfirmPaid()">✓ ຢືນຢັນ</button>
      </div>
    </div>`;
}

async function doConfirmPaid() {
  if (!popup) return;
  const id = popup.bill.id;
  paying = true;
  renderConfirm();

  try {
    const res = await fetch(`/api/orders/bills/${id}/close`, { method: 'PUT' });
    if (!res.ok) throw new Error('close failed');
  } catch (err) {
    paying = false;
    renderConfirm();
    showToast('❌ ປິດບິນບໍ່ສຳເລັດ');
    return;
  }

  closePopup();
  await load();
  showToast('✅ ປິດບິນແລ້ວ');
}

/* ===== ຮູບສະລິບຂະຫຍາຍ ===== */
function openZoom(billId) {
  const bill = bills.find(b => String(b.id) === String(billId));
  if (!bill || !bill.slip_image) return;
  zoomSrc = slipUrl(bill.slip_image);
  renderZoom();
}

function closeZoom() {
  zoomSrc = null;
  renderZoom();
}

function renderZoom() {
  let box = document.getElementById('tb-lightbox');
  if (!zoomSrc) {
    if (box) box.remove();
    return;
  }
  if (!box) {
    box = document.createElement('div');
    box.id = 'tb-lightbox';
    box.className = 'tb-lightbox';
    box.addEventListener('click', (e) => {
      if (e.target === box) closeZoom();
    });
    document.body.appendChild(box);
  }
  box.innerHTML = `
    <button type="button" class="tb-lightbox-close" aria-label="ປິດຮູບ" onclick="closeZoom()">✕</button>
    <img class="tb-lightbox-img" src="${esc(zoomSrc)}" alt="ສະລິບການໂອນເງິນ">
    <a class="tb-lightbox-open" href="${esc(zoomSrc)}" target="_blank" rel="noreferrer">ເປີດໃນແທັບໃໝ່</a>`;
}

/* ===== ປຸ່ມ Esc ປິດປັອບອັບ (ປິດອັນເທິງສຸດກ່ອນ) ===== */
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (zoomSrc) closeZoom();
  else if (askPaid) closeConfirm();
  else if (popup) closePopup();
  else if (listOpen) setListOpen(null);
});

/* ===== ເລີ່ມຕົ້ນ ===== */
(async function init() {
  try {
    await loadTableCount();
    await load();
  } catch (e) {
    console.error(e);
  }
  firstLoad = false;
})();

setInterval(() => {
  loadTableCount();
  load().catch(() => {});
}, 5000);