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

let allBills = [];
let currentTab = 'dine_in';   // dine_in | online
let currentSub = 'all';       // all | pickup | delivery
let applied = { from: '', to: '' };  // ຊ່ວງວັນທີທີ່ກົດ "ກວດສອບ" ແລ້ວ
let detail = null;            // ບິນທີ່ເປີດເບິ່ງຢູ່ (ປັອບອັບ)
let zoomSrc = null;           // ຮູບສະລິບທີ່ຂະຫຍາຍຢູ່

// ໂຫລດບິນທັງໝົດ (ພ້ອມລາຍການອາຫານ) ຈາກ /api/orders/history ຄືກັບໜ້າ React
async function loadOrders() {
  try {
    const res = await fetch('/api/orders/history');
    allBills = await res.json();
    allBills.sort((a, b) => b.id - a.id);
  } catch (err) {
    console.error(err);
    allBills = [];
  }
  renderOrders();
}

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ປະເພດບິນ: ບິນເກົ່າທີ່ບໍ່ມີ order_type ຖືວ່າເປັນ ໜ້າໂຕະ
function typeOf(b) {
  return b.order_type || 'dine_in';
}

function typeLabel(b) {
  if (typeOf(b) === 'pickup') return '🥡 ມາຮັບເອງ';
  if (typeOf(b) === 'delivery') return '🛵 ສົ່ງເຖິງບ້ານ';
  return '🍽️ ໂຕະ ' + esc(b.table_number);
}

// ເລກບິນທີ່ສະແດງ: ໃຊ້ bill_no (ແຍກຕາມແຖບ) ຖ້າບໍ່ມີ ໃຊ້ id ແທນ
function billNo(b) {
  return b.bill_no ? b.bill_no : b.id;
}

function billTotal(b) {
  const sum = (b.items || []).reduce((s, i) => s + Number(i.price) * Number(i.quantity), 0);
  return sum + Number(b.delivery_fee || 0);
}

function isPaid(b) {
  return b.status === 'paid';
}

function fmt(v) {
  return v ? new Date(v).toLocaleString('en-GB', { timeZone: 'Asia/Vientiane' }) : '-';
}

function statusLabel(status) {
  if (status === 'pending') return 'ລໍຖ້າ';
  if (status === 'cooking') return 'ກຳລັງເຮັດ';
  if (status === 'ready') return '🍽️ ລໍເສີບ';
  if (status === 'completed') return '✅ ເສີບແລ້ວ';
  return esc(status);
}

function inRange(b) {
  const from = applied.from ? new Date(applied.from + 'T00:00:00+07:00') : null;
  const to = applied.to ? new Date(applied.to + 'T23:59:59+07:00') : null;
  const created = new Date(b.ordered_at);
  if (from && created < from) return false;
  if (to && created > to) return false;
  return true;
}

function setTab(tab) {
  currentTab = tab;
  renderOrders();
}

function setSub(sub) {
  currentSub = sub;
  renderOrders();
}

function renderOrders() {
  const container = document.getElementById('order-list');

  const dated = allBills.filter(inRange);
  const dineList = dated.filter((b) => typeOf(b) === 'dine_in');
  const onlineAll = dated.filter((b) => typeOf(b) !== 'dine_in');
  const pickupList = onlineAll.filter((b) => typeOf(b) === 'pickup');
  const deliveryList = onlineAll.filter((b) => typeOf(b) === 'delivery');

  // ອັບເດດຕົວເລກເທິງແຖບ
  document.getElementById('count-dine').textContent = dineList.length;
  document.getElementById('count-online').textContent = onlineAll.length;
  document.getElementById('count-sub-all').textContent = onlineAll.length;
  document.getElementById('count-sub-pickup').textContent = pickupList.length;
  document.getElementById('count-sub-delivery').textContent = deliveryList.length;

  // ໄຮໄລ້ແຖບທີ່ເລືອກ
  const isOnlineTab = currentTab === 'online';
  document.getElementById('tab-dine').classList.toggle('active', !isOnlineTab);
  document.getElementById('tab-online').classList.toggle('active', isOnlineTab);
  document.getElementById('online-subtabs').classList.toggle('hidden', !isOnlineTab);
  document.getElementById('sub-all').classList.toggle('active', currentSub === 'all');
  document.getElementById('sub-pickup').classList.toggle('active', currentSub === 'pickup');
  document.getElementById('sub-delivery').classList.toggle('active', currentSub === 'delivery');

  // ເລືອກບິນຕາມແຖບ
  let bills = dineList;
  if (isOnlineTab) {
    bills =
      currentSub === 'pickup' ? pickupList :
      currentSub === 'delivery' ? deliveryList :
      onlineAll;
  }

  if (bills.length === 0) {
    container.innerHTML = '<p class="oh-empty">ບໍ່ພົບບິນໃນຊ່ວງນີ້</p>';
    return;
  }

  // ໃຊ້ div + CSS grid (ບໍ່ໃຊ້ <table>) ເພື່ອບໍ່ໃຫ້ style.css ເກົ່າມາທັບ
  // ກົດແຖວໃດກໍໄດ້ເພື່ອເປີດລາຍລະອຽດບິນ
  container.innerHTML = `
    <div class="ohx-wrap">
      <div class="ohx-inner">
        <div class="ohx-row ohx-head">
          <div class="ohx-cell">ເລກບິນ</div>
          <div class="ohx-cell">${isOnlineTab ? 'ປະເພດ' : 'ໂຕະ'}</div>
          <div class="ohx-cell">ລາຍການ</div>
          <div class="ohx-cell">ລາຄາລວມ</div>
          <div class="ohx-cell">ສະຖານະ</div>
          <div class="ohx-cell">ເວລາສັ່ງ</div>
          <div class="ohx-cell">ເວລາປິດບິນ</div>
        </div>
        ${bills.map((b) => `
          <div class="ohx-row ohx-click" onclick="openDetail(${Number(b.id)})">
            <div class="ohx-cell"><b>#${esc(billNo(b))}</b></div>
            <div class="ohx-cell">${typeLabel(b)}</div>
            <div class="ohx-cell">${(b.items || []).length}</div>
            <div class="ohx-cell">${billTotal(b).toLocaleString()} ກີບ</div>
            <div class="ohx-cell">
              <span class="oh-chip ${isPaid(b) ? 'paid' : 'open'}">
                ${isPaid(b) ? '✅ ປິດບິນແລ້ວ' : '🟡 ຍັງເປີດຢູ່'}
              </span>
            </div>
            <div class="ohx-cell">${fmt(b.ordered_at)}</div>
            <div class="ohx-cell">${isPaid(b) ? fmt(b.paid_at) : '-'}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ===== ປັອບອັບລາຍລະອຽດບິນ =====
function openDetail(id) {
  detail = allBills.find((b) => Number(b.id) === Number(id)) || null;
  renderDetail();
}

function closeDetail() {
  detail = null;
  renderDetail();
}

function renderDetail() {
  const root = document.getElementById('detail-root');
  if (!detail) {
    root.innerHTML = '';
    document.body.style.overflow = '';
    return;
  }
  document.body.style.overflow = 'hidden';

  const b = detail;
  const online = typeOf(b) !== 'dine_in';
  const fee = Number(b.delivery_fee || 0);

  let slipHtml = '';
  if (b.slip_image) {
    slipHtml = `
      <div class="ohd-slip-wrap">
        <p>🧾 ສະລິບການໂອນເງິນ (ກົດເພື່ອຂະຫຍາຍ)</p>
        <button type="button" class="ohd-slip-btn" onclick="openZoom()">
          <img class="ohd-slip-img" src="${esc(b.slip_image)}" alt="ສະລິບ">
        </button>
      </div>`;
  } else if (online && b.payment_method === 'transfer') {
    slipHtml = '<div class="ohd-slip-missing">⚠️ ບໍ່ພົບຮູບສະລິບ</div>';
  }

  root.innerHTML = `
    <div class="ohd-overlay" onclick="if (event.target === this) closeDetail()">
      <div class="ohd-box">
        <button type="button" class="ohd-close" onclick="closeDetail()">✕</button>

        <div class="ohd-head">
          <h2>ຮ້ານອາຫານຕາມສັ່ງ AOUTHIN</h2>
          <div class="ohd-billno">ບິນ #${esc(billNo(b))}</div>
          <div class="ohd-badges">
            <span class="ohd-badge">${typeLabel(b)}</span>
            <span class="oh-chip ${isPaid(b) ? 'paid' : 'open'}">
              ${isPaid(b) ? '✅ ປິດບິນແລ້ວ' : '🟡 ຍັງເປີດຢູ່'}
            </span>
          </div>
        </div>

        <div class="ohd-info">
          <div class="ohd-info-row"><span>🕒 ເວລາສັ່ງ</span><b>${fmt(b.ordered_at)}</b></div>
          <div class="ohd-info-row"><span>💰 ເວລາປິດບິນ</span><b>${isPaid(b) ? fmt(b.paid_at) : '-'}</b></div>
          ${online ? `
            <div class="ohd-info-row"><span>👤 ລູກຄ້າ</span><b>${esc(b.customer_name)}</b></div>
            <div class="ohd-info-row"><span>📞 ເບີໂທ</span><b>${esc(b.customer_phone)}</b></div>
            ${b.address ? `<div class="ohd-info-row"><span>📍 ທີ່ຢູ່</span><b>${esc(b.address)}</b></div>` : ''}
            <div class="ohd-info-row"><span>ການຊຳລະ</span><b>${b.payment_method === 'transfer' ? '🏦 ໂອນເງິນ' : '💵 ເງິນສົດ'}</b></div>
          ` : ''}
        </div>

        <div class="ohd-items">
          <div class="ohd-items-row ohd-items-head">
            <div class="ohd-items-cell">ເມນູ</div>
            <div class="ohd-items-cell">ຈຳນວນ</div>
            <div class="ohd-items-cell">ລາຄາ</div>
            <div class="ohd-items-cell">ສະຖານະ</div>
          </div>
          ${(b.items || []).map((i) => `
            <div class="ohd-items-row">
              <div class="ohd-items-cell">${esc(i.product_name)}</div>
              <div class="ohd-items-cell">${esc(i.quantity)}</div>
              <div class="ohd-items-cell">${(Number(i.price) * Number(i.quantity)).toLocaleString()} ກີບ</div>
              <div class="ohd-items-cell">${statusLabel(i.status)}</div>
            </div>
          `).join('')}
        </div>

        ${fee > 0 ? `
          <div class="ohd-fee">
            <span>🛵 ຄ່າສົ່ງ (${esc(b.delivery_distance)} ກມ)</span>
            <span>${fee.toLocaleString()} ກີບ</span>
          </div>
        ` : ''}

        <div class="ohd-total">
          <span>ຍອດລວມທັງໝົດ</span>
          <span>${billTotal(b).toLocaleString()} ກີບ</span>
        </div>

        ${slipHtml}
      </div>
    </div>
  `;
}

// ===== ຮູບສະລິບຂະຫຍາຍ =====
function openZoom() {
  if (!detail || !detail.slip_image) return;
  zoomSrc = detail.slip_image;
  renderZoom();
}

function closeZoom() {
  zoomSrc = null;
  renderZoom();
}

function renderZoom() {
  const root = document.getElementById('zoom-root');
  if (!zoomSrc) {
    root.innerHTML = '';
    return;
  }
  root.innerHTML = `
    <div class="ohd-lightbox" onclick="if (event.target === this) closeZoom()">
      <button type="button" class="ohd-lightbox-close" aria-label="ປິດຮູບ" onclick="closeZoom()">✕</button>
      <img class="ohd-lightbox-img" src="${esc(zoomSrc)}" alt="ສະລິບການໂອນເງິນ">
      <a class="ohd-lightbox-open" href="${esc(zoomSrc)}" target="_blank" rel="noreferrer">ເປີດໃນແທັບໃໝ່</a>
    </div>
  `;
}

// Esc: ປິດຮູບຂະຫຍາຍກ່ອນ ຖ້າບໍ່ມີຮູບຈຶ່ງປິດປັອບອັບບິນ
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (zoomSrc) closeZoom();
  else if (detail) closeDetail();
});

function applyDateFilter() {
  applied = {
    from: document.getElementById('date-from').value,
    to: document.getElementById('date-to').value
  };
  renderOrders();
}

function clearDateFilter() {
  document.getElementById('date-from').value = '';
  document.getElementById('date-to').value = '';
  applied = { from: '', to: '' };
  renderOrders();
}

async function completeOrder(id) {
  await fetch(`/api/orders/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'completed' })
  });
  loadOrders();
}

loadOrders();