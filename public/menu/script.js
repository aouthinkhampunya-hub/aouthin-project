async function loadProducts() {
  const res = await fetch('/api/products');
  const products = await res.json();

  const container = document.getElementById('product-list');

  if (products.length === 0) {
    container.innerHTML = '<p>ຍັງບໍ່ມີອາຫານ</p>';
    return;
  }

  container.innerHTML = products.map(p => `
    <div class="product-card">
      ${p.image ? `<img src="${p.image}" class="product-img">` : ''}
      <h3>${p.name}</h3>
      <p>ປະເພດ: ${p.size} | ລົດຊາດ: ${p.color}</p>
      <p>ເຫຼືອ: ${p.stock} ຈານ</p>
      <p class="price">${p.price} ກີບ</p>
      <button onclick="orderProduct(${p.id})" ${p.stock <= 0 ? 'disabled' : ''}>
        ${p.stock <= 0 ? 'ອາຫານໝົດ' : 'ສັ່ງອາຫານ'}
      </button>
    </div>
  `).join('');
}

async function orderProduct(id) {
  const res = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ product_id: id, quantity: 1 })
  });

  const data = await res.json();

  if (res.ok) {
    alert('ສັ່ງອາຫານສຳເລັດ! 🍽️');
    loadProducts();
  } else {
    alert('ເກີດຂໍ້ຜິດພາດ: ' + data.error);
  }
}

loadProducts();