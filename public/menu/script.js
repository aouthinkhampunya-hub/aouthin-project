async function loadProducts() {
  const res = await fetch('/api/products');
  const products = await res.json();

  const container = document.getElementById('product-list');

  if (products.length === 0) {
    container.innerHTML = '<p>ยังไม่มีสินค้า</p>';
    return;
  }

  container.innerHTML = products.map(p => `
    <div class="product-card">
      <h3>${p.name}</h3>
      <p>ไซส์: ${p.size} | สี: ${p.color}</p>
      <p>คงเหลือ: ${p.stock} ชิ้น</p>
      <p class="price">${p.price} บาท</p>
      <button onclick="orderProduct(${p.id})" ${p.stock <= 0 ? 'disabled' : ''}>
        ${p.stock <= 0 ? 'สินค้าหมด' : 'สั่งซื้อ'}
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
    alert('สั่งซื้อสำเร็จ! ✅');
    loadProducts(); // โหลดสินค้าใหม่ (อัปเดตสต็อก)
  } else {
    alert('เกิดข้อผิดพลาด: ' + data.error);
  }
}

loadProducts();