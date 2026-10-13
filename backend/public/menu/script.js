let cart = [];
let allProducts = [];
let tableNumber = null;

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

// ໂຕະທີ່ລູກຄ້າສະແກນ QR ມາ (ຖ້າມີ) ໄວ້ໃຫ້ສະຫຼັບກັບມາສັ່ງຢູ່ໂຕະໄດ້
function getDineTable() {
  return sessionStorage.getItem('dineTable') || '';
}

// ===== ເລີ່ມແອັບ =====
// ມີ ?table=N → ສັ່ງຢູ່ໂຕະ N | ບໍ່ມີ → ສັ່ງອອນລາຍທັນທີ (ບໍ່ຖາມເລກໂຕະ)
function initApp() {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get('table');

  if (fromUrl && /^\d{1,3}$/.test(fromUrl)) {
    sessionStorage.setItem('dineTable', fromUrl);
    setTableNumber(fromUrl);
  } else {
    setTableNumber(sessionStorage.getItem('tableNumber') || 'online');
  }
}

function setTableNumber(table) {
  tableNumber = table;
  sessionStorage.setItem('tableNumber', table);
  document.getElementById('table-label').textContent =
    table === 'online' ? '🛵 ສັ່ງອອນລາຍ' : `ໂຕະ ${table}`;
  updateModeButton();
  updateStaffButton();
  loadSavedCart();
  renderCart();
  loadProducts();
  restoreStaffCooldown();
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
      <div style="display:flex; align-items:center; justify-content:space-between;">
        <p class="price">${p.price} ກີບ</p>
        <span class="cart-badge" data-badge-id="${p.id}" style="display:none; min-width:28px; height:28px; padding:0 8px; box-sizing:border-box; border-radius:999px; background:#e53935; color:#fff; font-size:14px; font-weight:800; align-items:center; justify-content:center; box-shadow:0 2px 6px rgba(229,57,53,0.45);"></span>
      </div>
      <button onclick="addToCart(${p.id})" ${p.stock <= 0 ? 'disabled' : ''}>
        ${p.stock <= 0 ? 'ອາຫານໝົດ' : 'ເພີ່ມໃສ່ກະຕ່າ'}
      </button>
    </div>
  `).join('');

  updateCartBadges();
}

// ອັບເດດວົງແດງ (ຈຳນວນໃນກະຕ່າ) ຂອງແຕ່ລະເມນູ ໂດຍບໍ່ວາດລາຍການໃໝ່
function updateCartBadges() {
  document.querySelectorAll('[data-badge-id]').forEach(el => {
    const id = Number(el.getAttribute('data-badge-id'));
    const item = cart.find(i => i.product_id === id);
    const qty = item ? item.quantity : 0;

    if (qty > 0) {
      el.textContent = qty;
      el.title = `ໃນກະຕ່າ ${qty} ຈານ`;
      el.style.display = 'flex';
    } else {
      el.style.display = 'none';
    }
  });
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
  updateCartBadges();
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

  // ສັ່ງອອນລາຍ: ເປີດຟອມຂໍ້ມູນກ່ອນ
  if (tableNumber === 'online') {
    openOnlineForm();
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

// ===== ສັ່ງອອນລາຍ (ແກັບ / ສົ່ງເຖິງບ້ານ, ເງິນສົດ ຫຼື ໂອນເງິນພ້ອມສະລິບ) =====
function startOnlineMode() {
  setTableNumber('online');
}

function updateModeButton() {
  const b = document.getElementById('mode-switch');
  if (!b) return;
  const dine = getDineTable();

  if (tableNumber === 'online') {
    // ໂໝດອອນລາຍ: ສະແດງປຸ່ມກັບໂຕະ ສະເພາະຄົນທີ່ມາຈາກ QR ຂອງໂຕະ
    b.style.display = dine ? '' : 'none';
    b.textContent = `🍽️ ສັ່ງຢູ່ໂຕະ (ໂຕະ ${dine})`;
  } else {
    b.style.display = '';
    b.textContent = '🛵 ສັ່ງອອນລາຍ';
  }
}

function toggleOnlineMode() {
  if (tableNumber === 'online') {
    const dine = getDineTable();
    if (!dine) return;
    setTableNumber(dine);
  } else {
    startOnlineMode();
  }
}

// ປຸ່ມເອີ້ນພະນັກງານ: ສະແດງສະເພາະໂໝດສັ່ງຢູ່ໂຕະ
function updateStaffButton() {
  const btn = document.getElementById('call-staff-button');
  if (!btn) return;

  btn.style.display = tableNumber === 'online' ? 'none' : '';

  if (staffCooldownTimer) {
    clearInterval(staffCooldownTimer);
    staffCooldownTimer = null;
  }
  btn.disabled = false;
  btn.textContent = STAFF_CALL_LABEL;
}

// ===== ແຜນທີ່ເລືອກຈຸດສົ່ງ (OpenStreetMap) =====
// ປ່ຽນເປັນພິກັດຮ້ານຂອງເຈົ້າ (ເປີດ Google Maps ກົດຂວາທີ່ຮ້ານ ຈະເຫັນເລກ lat, lng)
const OL_DEFAULT_CENTER = [17.9757, 102.6331];

let olMap = null;
let olMarker = null;
let olLat = null;
let olLng = null;

// ຄ່າສົ່ງ: status = idle | loading | ok | far | error
let olFee = { status: 'idle' };
let olFeeReq = 0;
let olSubmitting = false;

// ໂອນເງິນ: ສະລິບ (data URL) ແລະ QR ຮັບເງິນຂອງຮ້ານ
let olSlip = '';
let olQrSrc = '';
let olQrLoaded = false;

function setMapHint(text) {
  const el = document.getElementById('ol-map-hint');
  if (el) el.textContent = text;
}

function currentOnlineType() {
  const checked = document.querySelector('input[name="ol-type"]:checked');
  return checked ? checked.value : 'pickup';
}

function currentPay() {
  const checked = document.querySelector('input[name="ol-pay"]:checked');
  return checked ? checked.value : 'cash';
}

// ຖາມ server ວ່າຄ່າສົ່ງເທົ່າໃດ
async function fetchOnlineFee(lat, lng) {
  const id = ++olFeeReq;
  olFee = { status: 'loading' };
  renderOnlineTotals();

  try {
    const res = await fetch(`/api/orders/delivery-fee?lat=${lat}&lng=${lng}`);
    const d = await res.json().catch(() => ({}));
    if (id !== olFeeReq) return; // ມີຄຳຂໍໃໝ່ກວ່າ ຂ້າມອັນເກົ່າ

    if (!res.ok) {
      olFee = { status: 'error', msg: d.error || 'ຄິດຄ່າສົ່ງບໍ່ໄດ້ ກະລຸນາລອງໃໝ່' };
    } else if (d.tooFar) {
      olFee = { status: 'far', km: d.km, max: d.max_km };
    } else {
      olFee = { status: 'ok', km: d.km, fee: d.fee };
    }
  } catch (e) {
    if (id !== olFeeReq) return;
    olFee = { status: 'error', msg: 'ຄິດຄ່າສົ່ງບໍ່ໄດ້ ກະລຸນາລອງໃໝ່' };
  }
  renderOnlineTotals();
}

// ສະແດງ ຄ່າອາຫານ / ຄ່າສົ່ງ / ຍອດລວມ ໃນຟອມອອນລາຍ
function renderOnlineTotals() {
  const food = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const isDelivery = currentOnlineType() === 'delivery';

  const feeRow = document.getElementById('ol-fee-row');
  const feeLabel = document.getElementById('ol-fee-label');
  const feeValue = document.getElementById('ol-fee-value');

  let fee = 0;
  let blocked = false;

  if (isDelivery) {
    feeRow.classList.remove('hidden');
    feeRow.classList.remove('muted');
    feeRow.classList.remove('bad');

    if (olFee.status === 'idle') {
      feeRow.classList.add('muted');
      feeLabel.textContent = '🛵 ຄ່າສົ່ງ';
      feeValue.textContent = 'ປັກໝຸດເພື່ອຄິດຄ່າສົ່ງ';
    } else if (olFee.status === 'loading') {
      feeRow.classList.add('muted');
      feeLabel.textContent = '🛵 ຄ່າສົ່ງ';
      feeValue.textContent = '⏳ ກຳລັງຄິດ...';
      blocked = true;
    } else if (olFee.status === 'far') {
      feeRow.classList.add('bad');
      feeLabel.textContent = `🛵 ໄລຍະທາງ ${olFee.km} ກມ`;
      feeValue.textContent = `ໄກເກີນ ${olFee.max} ກມ ບໍ່ຮັບສົ່ງ`;
      blocked = true;
    } else if (olFee.status === 'error') {
      feeRow.classList.add('bad');
      feeLabel.textContent = '🛵 ຄ່າສົ່ງ';
      feeValue.textContent = olFee.msg;
      blocked = true;
    } else {
      fee = olFee.fee;
      feeLabel.textContent = `🛵 ຄ່າສົ່ງ (${olFee.km} ກມ)`;
      feeValue.textContent = `${fee.toLocaleString()} ກີບ`;
    }
  } else {
    feeRow.classList.add('hidden');
  }

  document.getElementById('ol-food').textContent = food.toLocaleString();
  document.getElementById('ol-total').textContent = (food + fee).toLocaleString();
  document.getElementById('ol-submit').disabled = blocked || olSubmitting;

  updateTransferNote(food + fee);
}

// ===== ວິທີຊຳລະເງິນ: ເງິນສົດ / ໂອນເງິນ =====
function onPayChange() {
  const pay = currentPay();
  document.getElementById('ol-pay-cash-label').classList.toggle('active', pay === 'cash');
  document.getElementById('ol-pay-transfer-label').classList.toggle('active', pay === 'transfer');
  document.getElementById('ol-transfer').classList.toggle('hidden', pay !== 'transfer');

  if (pay === 'transfer') loadPayQr();
  renderOnlineTotals();
}

// ຂໍ້ຄວາມ "ສະແກນ QR ເພື່ອໂອນເງິນ ... ກີບ"
function updateTransferNote(grand) {
  const el = document.getElementById('ol-transfer-note1');
  if (!el) return;

  if (olQrSrc) {
    let text = `1) ສະແກນ QR ເພື່ອໂອນເງິນ ${grand.toLocaleString()} ກີບ`;
    if (currentOnlineType() === 'delivery' && olFee.status !== 'ok') {
      text += ' (ຍອດຈະລວມຄ່າສົ່ງຫຼັງປັກໝຸດ)';
    }
    el.textContent = text;
  } else {
    el.textContent = 'ຮ້ານຍັງບໍ່ໄດ້ຕັ້ງ QR ຮັບເງິນ ກະລຸນາໂອນຕາມທີ່ຮ້ານແຈ້ງ';
  }
}

// ໂຫລດ QR ຮັບເງິນຂອງຮ້ານ (ໂຫລດຄັ້ງດຽວ)
async function loadPayQr() {
  if (olQrLoaded) return;
  olQrLoaded = true;
  try {
    const res = await fetch('/api/settings/qr');
    const data = await res.json();
    if (data.qrImage) {
      olQrSrc = data.qrImage;
      const img = document.getElementById('ol-qr');
      img.src = olQrSrc;
      img.classList.remove('hidden');
    }
  } catch (e) {
    olQrLoaded = false; // ລອງໃໝ່ໄດ້ຄັ້ງຕໍ່ໄປ
  }
  renderOnlineTotals();
}

// ຫຍໍ້ຮູບສະລິບໃຫ້ນ້ອຍລົງກ່ອນສົ່ງ (ປະຢັດເນັດ ແລະ ພື້ນທີ່)
function compressImage(file, maxSide = 1280, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('image'));
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function pickSlip(input) {
  const errEl = document.getElementById('ol-error');
  const file = input.files && input.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    errEl.textContent = '⚠️ ກະລຸນາເລືອກໄຟລ໌ຮູບພາບ';
    errEl.classList.remove('hidden');
    input.value = '';
    return;
  }

  try {
    olSlip = await compressImage(file);
    document.getElementById('ol-slip-img').src = olSlip;
        document.getElementById('ol-slip-preview').classList.remove('hidden');
    document.getElementById('ol-slip-btn').textContent = '🔄 ປ່ຽນສະລິບ';
    errEl.classList.add('hidden');
  } catch (e) {
    olSlip = '';
    errEl.textContent = '⚠️ ອ່ານຮູບບໍ່ໄດ້ ກະລຸນາລອງຮູບອື່ນ';
    errEl.classList.remove('hidden');
  }
}

function removeSlip() {
  olSlip = '';
  const input = document.getElementById('ol-slip-input');
  if (input) input.value = '';
    document.getElementById('ol-slip-preview').classList.add('hidden');
  document.getElementById('ol-slip-btn').textContent = '+ ສະລິບການໂອນ';
}

function setOnlinePin(lat, lng, pan = true) {
  olLat = lat;
  olLng = lng;
  if (!olMarker) {
    olMarker = L.marker([lat, lng], { draggable: true }).addTo(olMap);
    olMarker.on('dragend', () => {
      const p = olMarker.getLatLng();
      setOnlinePin(p.lat, p.lng, false);
    });
  } else {
    olMarker.setLatLng([lat, lng]);
  }
  if (pan) olMap.setView([lat, lng], 17);
  setMapHint(`📍 ປັກໝຸດແລ້ວ (${lat.toFixed(5)}, ${lng.toFixed(5)})`);
  fetchOnlineFee(lat, lng);
}

function initOnlineMap() {
  if (olMap) {
    setTimeout(() => olMap.invalidateSize(), 80);
    return true;
  }
  if (typeof L === 'undefined') {
    setMapHint('⚠️ ໂຫລດແຜນທີ່ບໍ່ໄດ້ (ກວດອິນເຕີເນັດ)');
    return false;
  }
  olMap = L.map('ol-map').setView(OL_DEFAULT_CENTER, 13);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(olMap);
  olMap.on('click', (e) => setOnlinePin(e.latlng.lat, e.latlng.lng, false));
  setTimeout(() => olMap.invalidateSize(), 80);
  return true;
}

function useMyLocation() {
  if (!navigator.geolocation) {
    setMapHint('⚠️ ເບຣາວເຊີນີ້ບໍ່ຮອງຮັບຕຳແໜ່ງ ກະລຸນາກົດເລືອກເທິງແຜນທີ່');
    return;
  }
  if (!initOnlineMap()) return;
  setMapHint('⏳ ກຳລັງຫາຕຳແໜ່ງຂອງທ່ານ...');
  navigator.geolocation.getCurrentPosition(
    (pos) => setOnlinePin(pos.coords.latitude, pos.coords.longitude),
    () => setMapHint('⚠️ ຫາຕຳແໜ່ງບໍ່ໄດ້ ກະລຸນາກົດເລືອກເທິງແຜນທີ່'),
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function openOnlineForm() {
  document.getElementById('ol-error').classList.add('hidden');

  const saved = JSON.parse(sessionStorage.getItem('onlineBill') || 'null');
  if (saved) {
    document.getElementById('ol-phone').value = saved.phone || '';
    document.getElementById('ol-name').value = saved.name || '';
  }
  document.getElementById('online-modal').classList.remove('hidden');
  onOnlineTypeChange();
}

function closeOnlineForm() {
  document.getElementById('online-modal').classList.add('hidden');
}

function onOnlineTypeChange() {
  const type = currentOnlineType();
  document.getElementById('ol-type-pickup').classList.toggle('active', type === 'pickup');
  document.getElementById('ol-type-delivery').classList.toggle('active', type === 'delivery');

  const extra = document.getElementById('ol-delivery-extra');
  if (extra) extra.classList.toggle('hidden', type !== 'delivery');

  document.getElementById('ol-pay-note').textContent =
    type === 'delivery' ? 'ຈ່າຍຕອນຮັບທີ່ບ້ານ' : 'ຈ່າຍຕອນມາຮັບ';

  if (type === 'delivery') {
    initOnlineMap();
    // ຖ້າເຄີຍປັກໝຸດໄວ້ແລ້ວ ແຕ່ຍັງບໍ່ໄດ້ຄິດຄ່າສົ່ງ ໃຫ້ຄິດໃໝ່
    if (olLat !== null && olLng !== null && olFee.status === 'idle') {
      fetchOnlineFee(olLat, olLng);
    }
  }
  onPayChange();
}

async function submitOnlineOrder() {
  const errEl = document.getElementById('ol-error');
  const type = currentOnlineType();
  const pay = currentPay();
  const name = document.getElementById('ol-name').value.trim();
  const phone = document.getElementById('ol-phone').value.trim();
  const address = document.getElementById('ol-address').value.trim();

  const fail = (msg) => {
    errEl.textContent = '⚠️ ' + msg;
    errEl.classList.remove('hidden');
  };

  if (!name) return fail('ກະລຸນາໃສ່ຊື່');
  if (!/^[0-9+\s-]{8,15}$/.test(phone)) return fail('ເບີໂທບໍ່ຖືກຕ້ອງ');
  if (type === 'delivery' && !address) return fail('ກະລຸນາໃສ່ທີ່ຢູ່ສົ່ງ');
  if (type === 'delivery' && (olLat === null || olLng === null)) {
    return fail('ກະລຸນາປັກໝຸດຈຸດສົ່ງເທິງແຜນທີ່');
  }
  if (type === 'delivery' && olFee.status !== 'ok') {
    return fail('ຍັງຄິດຄ່າສົ່ງບໍ່ໄດ້ ກະລຸນາລໍຖ້າ ຫຼື ປັກໝຸດໃໝ່');
  }
  if (pay === 'transfer' && !olSlip) return fail('ກະລຸນາແນບສະລິບການໂອນເງິນ');
  errEl.classList.add('hidden');

  const items = cart.map(i => ({ product_id: i.product_id, quantity: i.quantity }));
  olSubmitting = true;
  renderOnlineTotals();

  try {
    const res = await fetch('/api/orders/online', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_type: type,
        customer_name: name,
        customer_phone: phone,
        address,
        payment_method: pay,
        slip_image: pay === 'transfer' ? olSlip : null,
        latitude: type === 'delivery' ? olLat : null,
        longitude: type === 'delivery' ? olLng : null,
        items
      })
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      fail(data.error || 'ສັ່ງອາຫານບໍ່ສຳເລັດ');
      return;
    }

    sessionStorage.setItem('onlineBill', JSON.stringify({ id: data.bill_id, phone, name }));
    cart = [];
    renderCart();
    closeCart();
    closeOnlineForm();
    loadProducts();
    olFee = { status: 'idle' };
    removeSlip();
    document.getElementById('success-overlay').classList.remove('hidden');
  } catch (e) {
    fail('ເຊື່ອມຕໍ່ບໍ່ໄດ້ ກະລຸນາລອງໃໝ່');
  } finally {
    olSubmitting = false;
    renderOnlineTotals();
  }
}

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
  metaEl.textContent = `${tableNumber === 'online' ? 'ອອນລາຍ' : 'ໂຕະ ' + tableNumber} • ${new Date().toLocaleString('en-GB')}`;

  try {
    let myBill = null;

    if (tableNumber === 'online') {
      const saved = JSON.parse(sessionStorage.getItem('onlineBill') || 'null');
      if (saved) {
        const r = await fetch(`/api/orders/online/${saved.id}?phone=${encodeURIComponent(saved.phone)}`);
        if (r.ok) myBill = await r.json();
      }
    } else {
      const res = await fetch('/api/orders/bills');
      if (!res.ok) throw new Error('bill api failed');
      const bills = await res.json();
      myBill = bills.find(b => String(b.table_number) === String(tableNumber));
    }

    if (!myBill || myBill.items.length === 0) {
      itemsEl.innerHTML = '<tr><td colspan="3">ຍັງບໍ່ມີການສັ່ງອາຫານ</td></tr>';
      return;
    }

    // ຄ່າສົ່ງ (ມີສະເພາະບິນອອນລາຍແບບສົ່ງເຖິງບ້ານ)
    const deliveryFee = tableNumber === 'online' ? Number(myBill.delivery_fee || 0) : 0;
    const total =
      myBill.items.reduce((sum, i) => sum + i.price * i.quantity, 0) + deliveryFee;

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
    `).join('') + (deliveryFee > 0
      ? `<tr>
           <td colspan="2">🛵 ຄ່າສົ່ງ${myBill.delivery_distance ? ` (${escapeHtml(myBill.delivery_distance)} ກມ)` : ''}</td>
           <td>${deliveryFee.toLocaleString()} ກີບ</td>
         </tr>`
      : '');
    totalEl.textContent = `${total} ກີບ`;

    // ອອນລາຍ: ບອກວິທີຊຳລະ ບໍ່ຕ້ອງສະແດງ QR ຂອງໂຕະ
    if (tableNumber === 'online') {
      qrEl.innerHTML = myBill.payment_method === 'transfer'
        ? '<p>🏦 ໂອນເງິນແລ້ວ ລໍຮ້ານກວດສອບສະລິບ</p>'
        : '<p>💵 ຈ່າຍເງິນສົດຕອນຮັບອາຫານ</p>';
      return;
    }
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
  if (!tableNumber || tableNumber === 'online') return;
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

// ເລີ່ມແອັບ (ຕ້ອງຢູ່ທ້າຍໄຟລ໌ເພື່ອໃຫ້ຕົວປ່ຽນທັງໝົດຖືກປະກາດກ່ອນ)
initApp();