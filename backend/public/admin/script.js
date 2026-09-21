let categoryList = [];
let spiceList = [];

// ✅ ถ้าพิมพ์แล้วเกินขีดจำกัด ให้ดีดกลับไปค่าล่าสุดที่ถูกต้อง
function restrictMaxValue(input, max) {
  if (input.dataset.lastValid === undefined) {
    input.dataset.lastValid = input.value === '' ? '' : Math.min(Number(input.value), max);
  }
  if (input.value === '') {
    input.dataset.lastValid = '';
    return;
  }
  const value = Number(input.value);
  if (value > max || value < 0 || isNaN(value)) {
    input.value = input.dataset.lastValid;
  } else {
    input.dataset.lastValid = input.value;
  }
}

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

async function loadOptions() {
  const res = await fetch('/api/settings/options');
  const data = await res.json();
  categoryList = data.categories;
  spiceList = data.spiceLevels;
}

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
          <td>
            ${p.image
              ? `<img id="img-${p.id}" src="${p.image}" width="50" height="50" style="object-fit:cover; border-radius:6px; cursor:pointer;" onclick="document.getElementById('file-${p.id}').click()">`
              : `<span style="cursor:pointer; color:#b8380e; text-decoration:underline;" onclick="document.getElementById('file-${p.id}').click()">ເພີ່ມຮູບ</span>`}
            <input type="file" id="file-${p.id}" accept="image/*" style="display:none;" onchange="updateImage(${p.id}, this.files[0])">
          </td>
          <td>
            <input type="text" class="edit-input" value="${p.name}" onchange="updateField(${p.id}, 'name', this.value)" style="width:110px;">
          </td>
          <td>
            <input type="number" class="edit-input" value="${p.price}" max="1000000" min="0" oninput="restrictMaxValue(this, 1000000)" onchange="updateField(${p.id}, 'price', this.value)" style="width:80px;"> ກີບ
          </td>
          <td>
            <select onchange="updateField(${p.id}, 'size', this.value)">
              ${categoryList.map(opt => `<option value="${opt}" ${p.size === opt ? 'selected' : ''}>${opt}</option>`).join('')}
            </select>
          </td>
          <td>
            <select onchange="updateField(${p.id}, 'color', this.value)">
              ${spiceList.map(opt => `<option value="${opt}" ${p.color === opt ? 'selected' : ''}>${opt}</option>`).join('')}
            </select>
          </td>
          <td>
            <input type="number" class="edit-input" value="${p.stock}" max="100" min="0" oninput="restrictMaxValue(this, 100)" onchange="updateField(${p.id}, 'stock', this.value)" style="width:60px;"> ຈານ
          </td>
          <td><button class="delete-btn" onclick="deleteProduct(${p.id})">ລຶບ</button></td>
        </tr>
      `).join('')}
    </table>
  `;
}

async function updateField(id, field, value) {
  await fetch(`/api/products/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ [field]: value })
  });
}

async function updateImage(id, file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    alert('ອະນຸຍາດແຕ່ໄຟລ໌ຮູບພາບເທົ່ານັ້ນ (jpg, png, gif, ...)');
    return;
  }
  const formData = new FormData();
  formData.append('image', file);
  const res = await fetch(`/api/products/${id}/image`, {
    method: 'PUT',
    body: formData
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    alert(errorData.error || 'ອັບໂຫລດຮູບບໍ່ສຳເລັດ');
    return;
  }
  loadProducts();
}

async function deleteProduct(id) {
  if (!confirm('ຕ້ອງການລຶບເມນູນີ້ບໍ?')) return;
  await fetch(`/api/products/${id}`, { method: 'DELETE' });
  loadProducts();
}

async function init() {
  await loadOptions();
  await loadProducts();
}
init();