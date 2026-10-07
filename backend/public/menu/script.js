let cart = [];

function cartStorageKey() {
  return `cart_table_${tableNumber}`;
}

function saveCart() {
  try {
    sessionStorage.setItem(cartStorageKey(), JSON.stringify(cart));
  } catch (e) {}
}

function loadSavedCart() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(cartStorageKey()));
    cart = Array.isArray(saved) ? saved : [];
  } catch (e) {
    cart = [];
  }
}
let allProducts = [];
let tableNumber = null;

function initApp() {
  const params = new URLSearchParams(window.location.search);
  let table = params.get('table') || sessionStorage.getItem('tableNumber');

  if (table) {
    setTableNumber(table);
  } else {
    document.getElementById('table-modal').classList.remove('hidden');
  }
}

function setTableNumber(table) {
  tableNumber = table;
  sessionStorage.setItem('tableNumber', table);
  document.getElementById('table-label').textContent = `ໂຕະ ${table}`;
  document.getElementById('table-modal').classList.add('hidden');
  loadSavedCart();
  renderCart();
  loadProducts();
  restoreStaffCooldown();
}

async function submitTableNumber() {
  const input = document.getElementById('table-input');
  const errorEl = document.getElementById('table-error');
  const value = input.value.trim();

  if (!value || !/^[0-9]+$/.test(value)) {
    errorEl.textContent = '⚠️ ກະລຸນາໃສ່ຕົວເລກໂຕະເທົ່ານັ້ນ';
    errorEl.classList.remove('hidden');
    input.focus();
    return;
  }

  // ດຶງຈຳນວນໂຕະຈິງຈາກ server
  let maxTable = 20;
  try {
    const cres = await fetch('/api/tables/count');
    const cdata = await cres.json();
    if (cdata.count) maxTable = cdata.count;
  } catch (e) {}

  const tableNum = Number(value);
  if (tableNum < 1 || tableNum > maxTable) {
    errorEl.textContent = `⚠️ ເລກໂຕະຕ້ອງຢູ່ລະຫວ່າງ 1-${maxTable}`;
    errorEl.classList.remove('hidden');
    input.focus();
    return;
  }

  errorEl.classList.add('hidden');

  // ກວດວ່າໂຕະນີ້ມີຄົນນັ່ງ/ມີອໍເດີ້ຄ້າງຢູ່ແລ້ວບໍ່
  try {
    const res = await fetch('/api/orders/bills');
    const bills = await res.json();
    const taken = bills.some(b => String(b.table_number) === value);
    if (taken) {
      errorEl.textContent = `⚠️ ໂຕະ ${value} ມີຄົນນັ່ງຢູ່ແລ້ວ ກະລຸນາເລືອກເລກໂຕະອື່ນ ຫຼືສອບຖາມພະນັກງານ`;
      errorEl.classList.remove('hidden');
      input.focus();
      return;
    }
  } catch (e) {}

  setTableNumber(value);
}

async function loadProducts() {
  const res = await fetch('/api/products');
  allProducts = await res.json();

  populateCategoryFilter();
  filterProducts();
}

function populateCategoryFilter() {
  const select = document.getElementById('category-filter');
  const categories = [...new Set(allProducts.map(p => p.size).filter(Boolean))];

  select.innerHTML = '<option value="">ທຸກປະເພດ</option>' +
    categories.map(c => `<option value="${c}">${c}</option>`).join('');
}

function filterProducts() {
  const selected = document.getElementById('category-filter').value;
  const keyword = document.getElementById('search-input').value.trim().toLowerCase();

  const filtered = allProducts.filter(p => {
    const matchCategory = !selected || p.size === selected;
    const matchName = String(p.name ?? '').toLowerCase().includes(keyword);
    return matchCategory && matchName;
  });

  renderProducts(filtered);
}

function renderProducts(products) {
  const container = document.getElementById('product-list');

  if (products.length === 0) {
    container.innerHTML = '<p>ບໍ່ພົບເມນູທີ່ຄົ້ນຫາ</p>';
    return;
  }

  container.innerHTML = products.map(p => `
    <div class="product-card">
      ${p.image ? `<img src="${p.image}" class="product-img">` : ''}
      <h3>${p.name}</h3>
      <p>ປະເພດ: ${p.size} | ລົດຊາດ: ${p.color}</p>
      <p>ເຫຼືອ: ${p.stock} ຈານ</p>
      <p class="price">${p.price} ກີບ</p>
      <button onclick="addToCart(${p.id})" ${p.stock <= 0 ? 'disabled' : ''}>
        ${p.stock <= 0 ? 'ອາຫານໝົດ' : 'ເພີ່ມໃສ່ກະຕ່າ'}
      </button>
    </div>
  `).join('');
}

function addToCart(id) {
  const product = allProducts.find(p => p.id === id);
  const existing = cart.find(item => item.product_id === id);

  const currentQtyInCart = existing ? existing.quantity : 0;
  if (currentQtyInCart + 1 > product.stock) {
    alert('ອາຫານໃນສະຕອກບໍ່ພໍ');
    return;
  }

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ product_id: id, name: product.name, price: product.price, quantity: 1, stock: product.stock });
  }
  renderCart();
  showToast(`✅ ເພີ່ມ "${product.name}" ແລ້ວ`);
}

let toastTimeout = null;

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 1800);
}

function changeCartQty(id, delta) {
  const item = cart.find(i => i.product_id === id);
  if (!item) return;

  const newQty = item.quantity + delta;
  if (newQty < 1) {
    cart = cart.filter(i => i.product_id !== id);
  } else if (newQty > item.stock) {
    alert('ອາຫານໃນສະຕັອກບໍ່ພໍ');
    return;
  } else {
    item.quantity = newQty;
  }
  renderCart();
}

function setCartQty(id, value) {
  const item = cart.find(i => i.product_id === id);
  if (!item) return;

  let newQty = parseInt(value, 10);

  if (isNaN(newQty) || newQty < 1) {
    newQty = 1;
  } else if (newQty > item.stock) {
    alert('ອາຫານໃນສະຕັອກບໍ່ພໍ (ເຫຼືອ ' + item.stock + ' ຈານ)');
    newQty = item.stock;
  }

  item.quantity = newQty;
  renderCart();
}

function renderCart() {
  saveCart();
  document.getElementById('cart-error').classList.add('hidden');
  document.getElementById('cart-count').textContent = cart.reduce((sum, i) => sum + i.quantity, 0);

  const container = document.getElementById('cart-items');
  if (cart.length === 0) {
    container.innerHTML = '<p>ຍັງບໍ່ໄດ້ເລືອກອາຫານ</p>';
  } else {
    container.innerHTML = cart.map(item => `
      <div class="cart-item">
        <span>${item.name}</span>
        <div class="qty-control">
          <button onclick="changeCartQty(${item.product_id}, -1)">-</button>
          <input
            type="number"
            class="qty-input"
            value="${item.quantity}"
            min="1"
            max="${item.stock}"
            onchange="setCartQty(${item.product_id}, this.value)"
          >
          <button onclick="changeCartQty(${item.product_id}, 1)">+</button>
        </div>
        <span>${item.price * item.quantity} ກີບ</span>
      </div>
    `).join('');
  }

  const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  document.getElementById('cart-total').textContent = total;
}

function openCart() {
  document.getElementById('cart-error').classList.add('hidden');
  document.getElementById('cart-overlay').classList.remove('hidden');
}

function closeCart() {
  document.getElementById('cart-overlay').classList.add('hidden');
}

function closeSuccess() {
  document.getElementById('success-overlay').classList.add('hidden');
}

async function confirmCartOrder() {
  if (cart.length === 0) {
    document.getElementById('cart-error').classList.remove('hidden');
    return;
  }

  const items = cart.map(i => ({ product_id: i.product_id, quantity: i.quantity }));

  const res = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ table_number: tableNumber, items })
  });

  const data = await res.json();

  if (res.ok) {
    cart = [];
    renderCart();
    closeCart();
    loadProducts();
    document.getElementById('success-overlay').classList.remove('hidden');
  } else {
    alert('ເກີດຂໍ້ຜິດພາດ: ' + data.error);
  }
}
initApp();

// ===== ເບິ່ງບິນ: ເດັ້ງເປັນ popup =====

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function billStatusLabel(status) {
  if (status === 'pending') return '⏳ ລໍຖ້າ';
  if (status === 'cooking') return '🔥 ກຳລັງເຮັດ';
  if (status === 'ready') return '⏳ ລໍຖ້າ';
  if (status === 'completed') return '✅ ພ້ອມແລ້ວ';
  return status;
}

function goToBill() {
  openBillModal();
}

async function openBillModal() {
  const modal = document.getElementById('billModal');
  const itemsEl = document.getElementById('billItems');
  const totalEl = document.getElementById('billTotal');
  const metaEl = document.getElementById('billMeta');
  const qrEl = document.getElementById('billQrArea');

  modal.style.display = 'flex';
  itemsEl.innerHTML = '<tr><td colspan="3">ກຳລັງໂຫລດ...</td></tr>';
  totalEl.textContent = '0 ກີບ';
  qrEl.innerHTML = '';
  metaEl.textContent = `ໂຕະ ${tableNumber} • ${new Date().toLocaleString('en-GB')}`;

  try {
    const res = await fetch('/api/orders/bills');
    if (!res.ok) throw new Error('bill api failed');
    const bills = await res.json();

    const myBill = bills.find(b => String(b.table_number) === String(tableNumber));

    if (!myBill || myBill.items.length === 0) {
      itemsEl.innerHTML = '<tr><td colspan="3">ຍັງບໍ່ມີການສັ່ງອາຫານ</td></tr>';
      return;
    }

    const total = myBill.items.reduce((sum, i) => sum + i.price * i.quantity, 0);

    itemsEl.innerHTML = myBill.items.map(i => `
      <tr>
        <td>
          ${escapeHtml(i.product_name)}
          <div class="bill-item-status">
            <span>${billStatusLabel(i.status)}</span>
            ${i.status === 'pending'
              ? `<button type="button" class="bill-cancel-link" onclick="askCancelOrder(${i.id})">ຍົກເລີກ</button>`
              : ''}
          </div>
        </td>
        <td>${i.quantity}</td>
        <td>${i.price * i.quantity} ກີບ</td>
      </tr>
    `).join('');
    totalEl.textContent = `${total} ກີບ`;
  } catch (err) {
    itemsEl.innerHTML = '<tr><td colspan="3">ໂຫລດບິນບໍ່ສຳເລັດ ກະລຸນາລອງໃໝ່</td></tr>';
    return;
  }

  try {
    const qres = await fetch('/api/settings/qr');
    const qdata = await qres.json();
    if (qdata.qrImage) {
      qrEl.innerHTML = `<p>ສະແກນ QR ນີ້ເພື່ອຈ່າຍເງິນ</p><img src="${qdata.qrImage}" alt="QR ຊຳລະເງິນ">`;
    }
  } catch (e) {}
}

function closeBillModal() {
  document.getElementById('billModal').style.display = 'none';
}

// ----- ປັອບອັບຢືນຢັນຍົກເລີກລາຍການ -----
(function addBillCancelStyle() {
  const s = document.createElement('style');
  s.textContent = `
    .bill-item-status {
      display: flex; align-items: center; gap: 8px;
      margin-top: 4px; font-size: 12px; color: #8a7c6a;
    }
    .bill-cancel-link {
      background: none; border: none; color: #b3261e; font-weight: 700;
      font-size: 12px; text-decoration: underline; cursor: pointer;
      padding: 0; margin: 0; width: auto;
    }
    .bc-overlay {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      width: 100vw; height: 100vh; background: rgba(20, 12, 6, 0.75);
      display: flex; align-items: center; justify-content: center;
      z-index: 10001; padding: 20px; animation: bcFadeIn 0.2s ease;
    }
    .bc-box {
      background: #fff; border-radius: 22px; width: 100%; max-width: 340px;
      padding: 36px 28px 28px; text-align: center;
      box-shadow: 0 24px 60px rgba(0,0,0,0.45); animation: bcPopIn 0.25s ease;
    }
    .bc-icon {
      width: 72px; height: 72px; margin: 0 auto 18px; border-radius: 50%; font-size: 34px;
      display: flex; align-items: center; justify-content: center;
      background: linear-gradient(150deg, #FFC93C, #F2760C);
      box-shadow: 0 8px 20px rgba(242,118,12,0.35);
    }
    .bc-box h3 { margin: 0 0 8px; color: #2B1B0E; font-size: 19px; font-weight: 800; }
    .bc-box p { margin: 0 0 24px; color: #6b5a4a; font-size: 14px; line-height: 1.5; }
    .bc-actions { display: flex; gap: 10px; }
    .bc-actions button {
      flex: 1; padding: 13px; border: none; border-radius: 12px; font-size: 15px;
      font-weight: 700; cursor: pointer; margin: 0; width: auto;
    }
    .bc-no { background: #8a7c6a; color: #fff; }
    .bc-no:hover { background: #6f6355; }
    .bc-yes { background: #c0392b; color: #fff; box-shadow: 0 6px 16px rgba(192,57,43,0.35); }
    .bc-yes:hover { background: #a5301f; }
    .bc-yes:disabled { opacity: 0.6; cursor: default; }
    .bc-toast {
      position: fixed; left: 50%; bottom: 30px; transform: translateX(-50%);
      background: #2B1B0E; color: #FFC93C; padding: 12px 22px; border-radius: 999px;
      font-weight: 700; font-size: 15px; z-index: 10002;
      box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    }
    @keyframes bcFadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes bcPopIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  `;
  document.head.appendChild(s);
})();

let cancelOrderId = null;

function showBillCancelToast(message) {
  const old = document.getElementById('bc-toast');
  if (old) old.remove();
  const t = document.createElement('div');
  t.id = 'bc-toast';
  t.className = 'bc-toast';
  t.textContent = message;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

function askCancelOrder(orderId) {
  cancelOrderId = orderId;

  let overlay = document.getElementById('bill-cancel-modal');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'bill-cancel-modal';
    overlay.className = 'bc-overlay';
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeCancelOrder();
    });
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="bc-box">
      <div class="bc-icon">🗑️</div>
      <h3>ຍົກເລີກອໍເດີ້</h3>
      <p>ຢືນຢັນວ່າຈະຍົກເລີກລາຍການອາຫານນີ້?</p>
      <div class="bc-actions">
        <button class="bc-no" onclick="closeCancelOrder()">ຍົກເລີກ</button>
        <button class="bc-yes" id="bill-cancel-yes" onclick="doCancelOrder()">ຢືນຢັນ</button>
      </div>
    </div>
  `;
}

function closeCancelOrder() {
  const overlay = document.getElementById('bill-cancel-modal');
  if (overlay) overlay.remove();
  cancelOrderId = null;
}

async function doCancelOrder() {
  if (cancelOrderId === null) return;
  const id = cancelOrderId;

  const btn = document.getElementById('bill-cancel-yes');
  btn.disabled = true;

  try {
    const res = await fetch(`/api/orders/${id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      closeCancelOrder();
      showBillCancelToast('❌ ' + (data.error || 'ຍົກເລີກບໍ່ໄດ້'));
      return;
    }
  } catch (err) {
    closeCancelOrder();
    showBillCancelToast('❌ ຍົກເລີກບໍ່ໄດ້');
    return;
  }

  closeCancelOrder();
  await openBillModal();
  showBillCancelToast('✅ ຍົກເລີກລາຍການແລ້ວ');
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.getElementById('bill-cancel-modal')) closeCancelOrder();
});

// ===== ເອີ້ນພະນັກງານ: ລັອກປຸ່ມ 60 ວິນາທີ =====
const STAFF_CALL_COOLDOWN_MS = 60000;
const STAFF_CALL_LABEL = '🔔 ເອີ້ນພະນັກງານ';
let staffCooldownTimer = null;

function staffCallKey() {
  return `staffCallUntil_${tableNumber}`;
}

function getStaffCooldownUntil() {
  try {
    return Number(localStorage.getItem(staffCallKey())) || 0;
  } catch (e) {
    return 0;
  }
}

function setStaffCooldownUntil(until) {
  try {
    localStorage.setItem(staffCallKey(), String(until));
  } catch (e) {}
}

function clearStaffCooldown() {
  try {
    localStorage.removeItem(staffCallKey());
  } catch (e) {}
}

function startStaffCooldown(until) {
  const btn = document.getElementById('call-staff-button');
  if (!btn) return;

  if (staffCooldownTimer) clearInterval(staffCooldownTimer);
  btn.disabled = true;

  const tick = () => {
    const left = Math.ceil((until - Date.now()) / 1000);
    if (left <= 0) {
      clearInterval(staffCooldownTimer);
      staffCooldownTimer = null;
      clearStaffCooldown();
      btn.disabled = false;
      btn.textContent = STAFF_CALL_LABEL;
      return;
    }
    btn.textContent = `✅ ແຈ້ງແລ້ວ ລໍຖ້າ ${left} ວິ`;
  };

  tick();
  staffCooldownTimer = setInterval(tick, 1000);
}

function restoreStaffCooldown() {
  if (!tableNumber) return;
  const until = getStaffCooldownUntil();
  if (until > Date.now()) startStaffCooldown(until);
}

async function callStaff() {
  const btn = document.getElementById('call-staff-button');

  const existing = getStaffCooldownUntil();
  if (existing > Date.now()) {
    startStaffCooldown(existing);
    return;
  }

  btn.disabled = true;
  btn.textContent = '📞 ກຳລັງແຈ້ງ...';

  let until = Date.now() + STAFF_CALL_COOLDOWN_MS;

  try {
    const res = await fetch('/api/staffcall', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table_number: tableNumber })
    });

    if (res.status === 429) {
      const data = await res.json().catch(() => ({}));
      const waitSec = Number(data.retryAfter) || 60;
      until = Date.now() + waitSec * 1000;
    } else if (!res.ok) {
      throw new Error('staffcall failed');
    }
  } catch (err) {
    btn.disabled = false;
    btn.textContent = STAFF_CALL_LABEL;
    alert('ແຈ້ງພະນັກງານບໍ່ສຳເລັດ ກະລຸນາລອງໃໝ່ອີກຄັ້ງ');
    return;
  }

  setStaffCooldownUntil(until);
  startStaffCooldown(until);
}