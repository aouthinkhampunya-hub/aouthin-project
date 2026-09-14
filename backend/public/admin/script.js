async function checkAuth() {
    const res = await fetch('/api/auth/check');
    const data = await res.json();
    if (!data.loggedIn) {
      window.location.href = 'login.html';
    }
  }
  checkAuth();
  
  async function loadProducts() {
    const res = await fetch('/api/products');
    const products = await res.json();
  
    const container = document.getElementById('product-list');
  
    if (products.length === 0) {
      container.innerHTML = '<p>ຍັງບໍ່ມີເມນູ</p>';
      return;
    }
  
    container.innerHTML = `
      <table>
        <tr>
          <th>ຮູບ</th><th>ຊື່ເມນູ</th><th>ລາຄາ</th><th>ປະເພດ</th><th>ຄວາມເຜັດ</th><th>ຈຳນວນ</th><th></th>
        </tr>
        ${products.map(p => `
          <tr>
            <td>${p.image ? `<img src="${p.image}" width="50" height="50" style="object-fit:cover; border-radius:6px;">` : '-'}</td>
            <td>${p.name}</td>
            <td>${p.price} ກີບ</td>
            <td>${p.size}</td>
            <td>${p.color}</td>
            <td>${p.stock} ຈານ</td>
            <td><button class="delete-btn" onclick="deleteProduct(${p.id})">ລຶບ</button></td>
          </tr>
        `).join('')}
      </table>
    `;
  }
  
  async function addProduct() {
    const name = document.getElementById('name').value;
    const price = document.getElementById('price').value;
    const size = document.getElementById('size').value;
    const color = document.getElementById('color').value;
    const stock = document.getElementById('stock').value;
    const imageFile = document.getElementById('image').files[0];
  
    if (!name || !price) {
      alert('ກະລຸນາໃສ່ຊື່ເມນູ ແລະ ລາຄາ');
      return;
    }
  
    const formData = new FormData();
    formData.append('name', name);
    formData.append('price', price);
    formData.append('size', size);
    formData.append('color', color);
    formData.append('stock', stock || 0);
    if (imageFile) {
      formData.append('image', imageFile);
    }
  
    await fetch('/api/products', {
      method: 'POST',
      body: formData
    });
  
    document.getElementById('name').value = '';
    document.getElementById('price').value = '';
    document.getElementById('size').value = '';
    document.getElementById('color').value = '';
    document.getElementById('stock').value = '';
    document.getElementById('image').value = '';
  
    loadProducts();
  }
  
  async function deleteProduct(id) {
    if (!confirm('ຕ້ອງການລຶບເມນູນີ້ບໍ?')) return;
    await fetch(`/api/products/${id}`, { method: 'DELETE' });
    loadProducts();
  }
  
  loadProducts();