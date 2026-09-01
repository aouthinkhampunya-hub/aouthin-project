let cart = [];
let allProducts = [];
let tableNumber = null;

function getTableNumber() {
  const params = new URLSearchParams(window.location.search);
  let table = params.get('table');

  if (!table) {
    table = sessionStorage.getItem('tableNumber');
  }
  if (!table) {
    table = prompt('ປ້ອນເລກໂຕະ (ສຳລັບທົດສອບ):');
  }

  sessionStorage.setItem('tableNumber', table);
  document.getElementById('table-label').textContent = `ໂຕະ ${table}`;
  return table;
}

async function loadProducts() {
  const res = await fetch('/api/products');
  allProducts = await res.json();

  populateCategoryFilter();
  renderProducts(allProducts);
}

function populateCategoryFilter() {
  const select = document.getElementById('category-filter');
  const categories = [...new Set(allProducts.map(p => p.size).filter(Boolean))];

  select.innerHTML = '<option value="">ທຸກປະເພດ</option>' +
    categories.map(c => `<option value="${c}">${c}</option>`).join('');
}

function filterProducts() {
  const selected = document.getElementById('category-filter').value;
  const filtered = selected ? allProducts.filter(p => p.size === selected) : allProducts;
  renderProducts(filtered);
}

function renderProducts(products) {
  const container = document.getElementById('product-list');

  if (products.length === 0) {
    container.innerHTML = '<p>ບໍ່ພົບອາຫານໃນປະເພດນີ້</p>';
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

function renderCart() {
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
          <span>${item.quantity}</span>
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
    alert('ຍັງບໍ່ໄດ້ເລືອກອາຫານ');
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
    closeCart();
    loadProducts();
    document.getElementById('success-overlay').classList.remove('hidden');
  } else {
    alert('ເກີດຂໍ້ຜິດພາດ: ' + data.error);
  }
}

tableNumber = getTableNumber();
loadProducts();
function goToBill() {
  window.location.href = `bill.html?table=${tableNumber}`;
}