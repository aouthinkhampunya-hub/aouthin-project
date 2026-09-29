let categoryList = [];
let spiceList = [];
let productsCache = [];
let editingProductId = null;
let editingImageFile = null;
let editingPreviewUrl = null;

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

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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

// ===== ສະໄຕລ໌ຂອງປັອບອັບແກ້ໄຂເມນູ ແລະປຸ່ມແກ້ໄຂ (ໃສ່ຜ່ານ JS ບໍ່ຕ້ອງແກ້ style.css) =====
(function addEditProductStyle() {
  const s = document.createElement('style');
  s.textContent = `
    .action-cell { white-space: nowrap; }
    .action-cell button { margin-right: 6px; }
    .edit-btn {
      background: #d9a520; color: #fff; border: none; border-radius: 8px;
      padding: 8px 14px; font-size: 14px; font-weight: 700; cursor: pointer;
    }
    .edit-btn:hover { background: #b98a14; }
    .no-img-box {
      width: 50px; height: 50px; border-radius: 6px; background: #f3ece4;
      color: #9a8a7a; font-size: 11px; display: flex; align-items: center;
      justify-content: center; text-align: center;
    }

    .edit-modal-overlay {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      width: 100vw; height: 100vh;
      background: rgba(20, 12, 6, 0.75);
      display: flex; align-items: center; justify-content: center;
      z-index: 9999; padding: 20px;
      animation: editFadeIn 0.2s ease;
    }
    .edit-modal-box {
      background: #fff; border-radius: 22px;
      width: 100%; max-width: 460px; max-height: 92vh; overflow-y: auto;
      padding: 26px 24px 22px;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
      animation: editPopIn 0.25s ease;
    }
    .edit-modal-box h3 {
      margin: 0 0 16px; text-align: center;
      color: #2B1B0E; font-size: 19px; font-weight: 800;
    }
    .edit-img-wrap { text-align: center; margin-bottom: 16px; }
    .edit-img-box {
      width: 130px; height: 130px; margin: 0 auto 10px;
      border-radius: 14px; overflow: hidden; background: #f3ece4;
      display: flex; align-items: center; justify-content: center;
      color: #9a8a7a; font-size: 13px;
    }
    .edit-img { width: 100%; height: 100%; object-fit: cover; }
    .edit-img-btn {
      display: inline-block; background: #2B1B0E; color: #FFC93C;
      border-radius: 10px; padding: 8px 16px; font-size: 14px;
      font-weight: 700; cursor: pointer;
    }
    .edit-field { margin-bottom: 12px; }
    .edit-field label {
      display: block; margin-bottom: 5px; font-size: 13px;
      font-weight: 700; color: #7a1f10;
    }
    .edit-field input, .edit-field select {
      width: 100%; box-sizing: border-box; padding: 10px 12px;
      border: 1.5px solid #e0d4c6; border-radius: 10px;
      font-size: 15px; background: #fff;
    }
    .edit-field input:focus, .edit-field select:focus {
      outline: none; border-color: #d9a520;
    }
    .edit-row { display: flex; gap: 12px; }
    .edit-row .edit-field { flex: 1; }
    .edit-actions { display: flex; gap: 10px; margin-top: 18px; }
    .edit-actions button {
      flex: 1; padding: 13px; border: none; border-radius: 12px;
      font-size: 15px; font-weight: 700; cursor: pointer; margin: 0; width: auto;
    }
    .edit-cancel { background: #c0392b; color: #fff; }
    .edit-cancel:hover { background: #a5301f; }
    .edit-save { background: #3C8031; color: #fff; box-shadow: 0 6px 16px rgba(60,128,49,0.35); }
    .edit-save:hover { background: #2C601E; }
    .edit-save:disabled { opacity: 0.6; cursor: default; }

    .del-modal-box {
      background: #fff; border-radius: 22px;
      width: 100%; max-width: 340px;
      padding: 36px 28px 28px; text-align: center;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
      animation: editPopIn 0.25s ease;
    }
    .del-modal-icon {
      width: 72px; height: 72px; margin: 0 auto 18px;
      border-radius: 50%; font-size: 34px;
      display: flex; align-items: center; justify-content: center;
      background: linear-gradient(150deg, #FFC93C, #F2760C);
      box-shadow: 0 8px 20px rgba(242, 118, 12, 0.35);
    }
    .del-modal-box h3 {
      margin: 0 0 8px; color: #2B1B0E; font-size: 19px; font-weight: 800;
    }
    .del-modal-box p {
      margin: 0 0 6px; color: #6b5a4a; font-size: 14px; line-height: 1.5;
    }
    .del-modal-name {
      color: #7a1f10; font-weight: 800; word-break: break-word;
    }
    .del-modal-warn { font-size: 12px !important; color: #9a8a7a !important; margin-bottom: 24px !important; }
    .del-actions { display: flex; gap: 10px; }
    .del-actions button {
      flex: 1; padding: 13px; border: none; border-radius: 12px;
      font-size: 15px; font-weight: 700; cursor: pointer; margin: 0; width: auto;
    }
    .del-cancel { background: #f3ece4; color: #7a1f10; }
    .del-cancel:hover { background: #e8dccf; }
    .del-confirm { background: #c0392b; color: #fff; box-shadow: 0 6px 16px rgba(192,57,43,0.35); }
    .del-confirm:hover { background: #a5301f; }
    .del-confirm:disabled { opacity: 0.6; cursor: default; }

    .edit-modal-overlay.top { z-index: 10001; }
    .opt-row { display: flex; gap: 6px; align-items: center; }
    .opt-row select { flex: 1; min-width: 0; width: auto; }
    .opt-btn {
      width: 40px; height: 40px; flex: 0 0 40px; border: none; border-radius: 10px;
      color: #fff; font-size: 18px; font-weight: 700; cursor: pointer;
      padding: 0; margin: 0; display: flex; align-items: center; justify-content: center;
    }
    .opt-add { background: #3C8031; }
    .opt-add:hover { background: #2C601E; }
    .opt-del { background: #b8380e; }
    .opt-del:hover { background: #8f2c0a; }
    .add-error {
      display: none; background: #fdecea; color: #b3261e; border-radius: 10px;
      padding: 9px 12px; font-size: 13px; font-weight: 700; margin-top: 4px;
    }
    .opt-input {
      width: 100%; box-sizing: border-box; padding: 11px 12px;
      border: 1.5px solid #e0d4c6; border-radius: 10px; font-size: 15px;
      margin: 4px 0 20px;
    }
    .opt-input:focus { outline: none; border-color: #d9a520; }
    .opt-confirm { background: #3C8031; color: #fff; box-shadow: 0 6px 16px rgba(60,128,49,0.35); }
    .opt-confirm:hover { background: #2C601E; }

    .admin-toast {
      position: fixed; left: 50%; bottom: 30px; transform: translateX(-50%);
      background: #2B1B0E; color: #FFC93C; padding: 12px 22px;
      border-radius: 999px; font-weight: 700; font-size: 15px;
      z-index: 10002; box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    }
    @keyframes editFadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes editPopIn {
      from { transform: scale(0.9); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
  `;
  document.head.appendChild(s);
})();

function showSaveConfirm() {
  return new Promise((resolve) => {
    let overlay = document.getElementById('save-confirm-modal');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'save-confirm-modal';
      overlay.className = 'edit-modal-overlay top';
      document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
      <div class="del-modal-box">
        <div class="del-modal-icon"></div>
        <h3>ບັນທຶກການແກ້ໄຂ</h3>
        <p>ຕ້ອງການບັນທຶກການແກ້ໄຂເມນູນີ້ບໍ?</p>
        <div class="del-actions">
          <button class="del-cancel" id="save-confirm-no">ຍົກເລີກ</button>
          <button class="edit-save" id="save-confirm-yes">ບັນທຶກ</button>
        </div>
      </div>
    `;

    const close = (result) => {
      overlay.remove();
      resolve(result);
    };

    document.getElementById('save-confirm-yes').onclick = () => close(true);
    document.getElementById('save-confirm-no').onclick = () => close(false);
    overlay.onclick = (e) => { if (e.target === overlay) close(false); };
  });
}

function showAdminToast(message) {
  const old = document.getElementById('admin-toast');
  if (old) old.remove();
  const t = document.createElement('div');
  t.id = 'admin-toast';
  t.className = 'admin-toast';
  t.textContent = message;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

async function loadOptions() {
  const res = await fetch('/api/settings/options');
  const data = await res.json();
  categoryList = data.categories;
  spiceList = data.spiceLevels;
}

async function loadProducts() {
  const res = await fetch('/api/products');
  const products = await res.json();
  productsCache = products;

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
              ? `<img src="${p.image}" width="50" height="50" style="object-fit:cover; border-radius:6px;">`
              : `<div class="no-img-box">ບໍ່ມີຮູບ</div>`}
          </td>
          <td>${escapeHtml(p.name)}</td>
          <td>${Number(p.price)} ກີບ</td>
          <td>${escapeHtml(p.size)}</td>
          <td>${escapeHtml(p.color)}</td>
          <td>${p.stock} ຈານ</td>
          <td class="action-cell">
            <button class="edit-btn" onclick="openEditProduct(${p.id})">ແກ້ໄຂ</button>
            <button class="delete-btn" onclick="deleteProduct(${p.id})">ລຶບ</button>
          </td>
        </tr>
      `).join('')}
    </table>
  `;
}

// ===== ປັອບອັບແກ້ໄຂເມນູ =====
function optionsHtml(list, current) {
  const items = (!current || list.includes(current)) ? list : [current, ...list];
  return items
    .map(opt => `<option value="${escapeHtml(opt)}" ${opt === current ? 'selected' : ''}>${escapeHtml(opt)}</option>`)
    .join('');
}

function openEditProduct(id) {
  const p = productsCache.find(x => x.id === id);
  if (!p) return;

  editingProductId = id;
  editingImageFile = null;
  if (editingPreviewUrl) {
    URL.revokeObjectURL(editingPreviewUrl);
    editingPreviewUrl = null;
  }

  let overlay = document.getElementById('edit-product-modal');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'edit-product-modal';
    overlay.className = 'edit-modal-overlay';
    // ກົດພື້ນມືດນອກກ່ອງເພື່ອປິດ
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeEditProduct();
    });
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="edit-modal-box">
      <h3>ແກ້ໄຂເມນູ</h3>

      <div class="edit-img-wrap">
        <div class="edit-img-box" id="edit-img-box">
          ${p.image ? `<img src="${p.image}" class="edit-img">` : 'ບໍ່ມີຮູບ'}
        </div>
        <label class="edit-img-btn" for="edit-image-input">📷 ປ່ຽນຮູບ</label>
        <input type="file" id="edit-image-input" accept="image/*" style="display:none;" onchange="onEditImageChosen(this)">
      </div>

      <div class="edit-field">
        <label>ຊື່ເມນູ</label>
        <input type="text" id="edit-name" value="${escapeHtml(p.name)}">
      </div>

      <div class="edit-row">
        <div class="edit-field">
          <label>ລາຄາ (ກີບ)</label>
          <input type="number" id="edit-price" value="${Number(p.price)}" min="0" max="1000000" oninput="restrictMaxValue(this, 1000000)">
        </div>
        <div class="edit-field">
          <label>ຈຳນວນ (ຈານ)</label>
          <input type="number" id="edit-stock" value="${p.stock}" min="0" max="100" oninput="restrictMaxValue(this, 100)">
        </div>
      </div>

      <div class="edit-row">
        <div class="edit-field">
          <label>ປະເພດ</label>
          <select id="edit-size">${optionsHtml(categoryList, p.size)}</select>
        </div>
        <div class="edit-field">
          <label>ຄວາມເຜັດ</label>
          <select id="edit-color">${optionsHtml(spiceList, p.color)}</select>
        </div>
      </div>

      <div class="edit-actions">
        <button class="edit-cancel" onclick="closeEditProduct()">ຍົກເລີກ</button>
        <button class="edit-save" id="edit-save-btn" onclick="saveEditProduct()">ບັນທຶກ</button>
      </div>
    </div>
  `;
}

function closeEditProduct() {
  const overlay = document.getElementById('edit-product-modal');
  if (overlay) overlay.remove();
  if (editingPreviewUrl) {
    URL.revokeObjectURL(editingPreviewUrl);
    editingPreviewUrl = null;
  }
  editingProductId = null;
  editingImageFile = null;
}

function onEditImageChosen(input) {
  const file = input.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    alert('ອະນຸຍາດແຕ່ໄຟລ໌ຮູບພາບເທົ່ານັ້ນ (jpg, png, gif, ...)');
    input.value = '';
    return;
  }
  editingImageFile = file;
  if (editingPreviewUrl) URL.revokeObjectURL(editingPreviewUrl);
  editingPreviewUrl = URL.createObjectURL(file);
  document.getElementById('edit-img-box').innerHTML = `<img src="${editingPreviewUrl}" class="edit-img">`;
}

async function saveEditProduct() {
  const p = productsCache.find(x => x.id === editingProductId);
  if (!p) {
    closeEditProduct();
    return;
  }

  const ok = await showSaveConfirm();
  if (!ok) return;

  const name = document.getElementById('edit-name').value.trim();
  const priceRaw = document.getElementById('edit-price').value;
  const stockRaw = document.getElementById('edit-stock').value;
  const size = document.getElementById('edit-size').value;
  const color = document.getElementById('edit-color').value;

  if (!name) {
    alert('ກະລຸນາໃສ່ຊື່ເມນູ');
    return;
  }
  if (priceRaw === '' || Number(priceRaw) < 0) {
    alert('ກະລຸນາໃສ່ລາຄາໃຫ້ຖືກຕ້ອງ');
    return;
  }
  if (stockRaw === '' || Number(stockRaw) < 0) {
    alert('ກະລຸນາໃສ່ຈຳນວນໃຫ້ຖືກຕ້ອງ');
    return;
  }

  // ເກັບສະເພາະຊ່ອງທີ່ມີການປ່ຽນແປງ
  const changes = [];
  if (name !== p.name) changes.push(['name', name]);
  if (Number(priceRaw) !== Number(p.price)) changes.push(['price', priceRaw]);
  if (size !== p.size) changes.push(['size', size]);
  if (color !== p.color) changes.push(['color', color]);
  if (Number(stockRaw) !== Number(p.stock)) changes.push(['stock', stockRaw]);

  if (changes.length === 0 && !editingImageFile) {
    closeEditProduct();
    return;
  }

  const saveBtn = document.getElementById('edit-save-btn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'ກຳລັງບັນທຶກ...';

  for (const [field, value] of changes) {
    const ok = await updateField(p.id, field, value);
    if (!ok) {
      alert('ບັນທຶກບໍ່ສຳເລັດ ກະລຸນາລອງໃໝ່ອີກຄັ້ງ');
      saveBtn.disabled = false;
      saveBtn.textContent = 'ບັນທຶກ';
      return;
    }
  }

  if (editingImageFile) {
    const ok = await uploadProductImage(p.id, editingImageFile);
    if (!ok) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'ບັນທຶກ';
      return;
    }
  }

  closeEditProduct();
  await loadProducts();
  showAdminToast('✅ ບັນທຶກແລ້ວ');
}

async function updateField(id, field, value) {
  try {
    const res = await fetch(`/api/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value })
    });
    return res.ok;
  } catch (err) {
    return false;
  }
}

async function uploadProductImage(id, file) {
  if (!file.type.startsWith('image/')) {
    alert('ອະນຸຍາດແຕ່ໄຟລ໌ຮູບພາບເທົ່ານັ້ນ (jpg, png, gif, ...)');
    return false;
  }
  const formData = new FormData();
  formData.append('image', file);
  try {
    const res = await fetch(`/api/products/${id}/image`, {
      method: 'PUT',
      body: formData
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      alert(errorData.error || 'ອັບໂຫລດຮູບບໍ່ສຳເລັດ');
      return false;
    }
    return true;
  } catch (err) {
    alert('ອັບໂຫລດຮູບບໍ່ສຳເລັດ');
    return false;
  }
}

// ===== ປັອບອັບຢືນຢັນລຶບເມນູ =====
let deletingProductId = null;

function deleteProduct(id) {
  const p = productsCache.find(x => x.id === id);
  if (!p) return;

  deletingProductId = id;

  let overlay = document.getElementById('delete-product-modal');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'delete-product-modal';
    overlay.className = 'edit-modal-overlay';
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeDeleteProduct();
    });
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="del-modal-box">
      <div class="del-modal-icon">🗑️</div>
      <h3>ລຶບເມນູ</h3>
      <p>ຢືນຢັນວ່າຈະລຶບ <span class="del-modal-name">${escapeHtml(p.name)}</span> ອອກຈາກເມນູ?</p>
      <p class="del-modal-warn">ການລຶບບໍ່ສາມາດກູ້ຄືນໄດ້</p>
      <div class="del-actions">
        <button class="del-cancel" onclick="closeDeleteProduct()">ຍົກເລີກ</button>
        <button class="del-confirm" id="delete-confirm-btn" onclick="confirmDeleteProduct()">ລຶບ</button>
      </div>
    </div>
  `;
}

function closeDeleteProduct() {
  const overlay = document.getElementById('delete-product-modal');
  if (overlay) overlay.remove();
  deletingProductId = null;
}

async function confirmDeleteProduct() {
  if (deletingProductId === null) return;
  const id = deletingProductId;

  const btn = document.getElementById('delete-confirm-btn');
  btn.disabled = true;
  btn.textContent = 'ກຳລັງລຶບ...';

  try {
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      closeDeleteProduct();
      showAdminToast('❌ ' + (data.error || 'ລຶບບໍ່ສຳເລັດ'));
      return;
    }
  } catch (err) {
    closeDeleteProduct();
    showAdminToast('❌ ລຶບບໍ່ສຳເລັດ');
    return;
  }

  closeDeleteProduct();
  await loadProducts();
  showAdminToast('🗑️ ລຶບເມນູແລ້ວ');
}

// ===== ປັອບອັບເພີ່ມເມນູໃໝ່ =====
let addImageFile = null;
let addPreviewUrl = null;
let optionInputType = null; // 'category' | 'spice'
let optionDeleteInfo = null; // { type, value }

function fillAddSelect(id, list, placeholder, keep) {
  const sel = document.getElementById(id);
  if (!sel) return;
  sel.innerHTML = `<option value="">${placeholder}</option>` +
    list.map(opt => `<option value="${escapeHtml(opt)}" ${opt === keep ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('');
}

function refreshAddSelects(keepSize, keepColor) {
  fillAddSelect('add-size', categoryList, 'ປະເພດອາຫານ', keepSize);
  fillAddSelect('add-color', spiceList, 'ລະດັບຄວາມເຜັດ', keepColor);
}

function setAddError(message) {
  const el = document.getElementById('add-error');
  if (!el) return;
  if (message) {
    el.textContent = message;
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
  }
}

function openAddProduct() {
  addImageFile = null;
  if (addPreviewUrl) {
    URL.revokeObjectURL(addPreviewUrl);
    addPreviewUrl = null;
  }

  let overlay = document.getElementById('add-product-modal');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'add-product-modal';
    overlay.className = 'edit-modal-overlay';
    // ບໍ່ປິດເມື່ອກົດພື້ນມືດ ເພື່ອກັນຂໍ້ມູນທີ່ກຳລັງຕື່ມຫາຍ
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="edit-modal-box">
      <h3>➕ ເພີ່ມເມນູໃໝ່</h3>

      <div class="edit-img-wrap">
        <div class="edit-img-box" id="add-img-box">ຍັງບໍ່ມີຮູບ</div>
        <label class="edit-img-btn" for="add-image-input">📷 ເລືອກຮູບ</label>
        <input type="file" id="add-image-input" accept="image/*" style="display:none;" onchange="onAddImageChosen(this)">
      </div>

      <div class="edit-field">
        <label>ຊື່ເມນູ</label>
        <input type="text" id="add-name" placeholder="ຊື່ເມນູ">
      </div>

      <div class="edit-row">
        <div class="edit-field">
          <label>ລາຄາ (ກີບ)</label>
          <input type="number" id="add-price" placeholder="ລາຄາ" min="0" max="1000000" oninput="restrictMaxValue(this, 1000000)">
        </div>
        <div class="edit-field">
          <label>ຈຳນວນ (ຈານ)</label>
          <input type="number" id="add-stock" placeholder="ຈຳນວນ" min="0" max="100" oninput="restrictMaxValue(this, 100)">
        </div>
      </div>

      <div class="edit-field">
        <label>ປະເພດອາຫານ</label>
        <div class="opt-row">
          <select id="add-size"></select>
          <button type="button" class="opt-btn opt-add" title="ເພີ່ມປະເພດໃໝ່" onclick="openOptionInput('category')">+</button>
          <button type="button" class="opt-btn opt-del" title="ລຶບປະເພດທີ່ເລືອກ" onclick="askRemoveOption('category')">🗑</button>
        </div>
      </div>

      <div class="edit-field">
        <label>ລະດັບຄວາມເຜັດ</label>
        <div class="opt-row">
          <select id="add-color"></select>
          <button type="button" class="opt-btn opt-add" title="ເພີ່ມລະດັບໃໝ່" onclick="openOptionInput('spice')">+</button>
          <button type="button" class="opt-btn opt-del" title="ລຶບລະດັບທີ່ເລືອກ" onclick="askRemoveOption('spice')">🗑</button>
        </div>
      </div>

      <div class="add-error" id="add-error"></div>

      <div class="edit-actions">
        <button class="edit-cancel" onclick="closeAddProduct()">ຍົກເລີກ</button>
        <button class="edit-save" id="add-save-btn" onclick="saveAddProduct()">ບັນທຶກ</button>
      </div>
    </div>
  `;

  refreshAddSelects('', '');
  document.getElementById('add-name').focus();
}

function closeAddProduct() {
  const overlay = document.getElementById('add-product-modal');
  if (overlay) overlay.remove();
  if (addPreviewUrl) {
    URL.revokeObjectURL(addPreviewUrl);
    addPreviewUrl = null;
  }
  addImageFile = null;
}

function onAddImageChosen(input) {
  const file = input.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    setAddError('ອະນຸຍາດແຕ່ໄຟລ໌ຮູບພາບເທົ່ານັ້ນ (jpg, png, gif, ...)');
    input.value = '';
    return;
  }
  setAddError('');
  addImageFile = file;
  if (addPreviewUrl) URL.revokeObjectURL(addPreviewUrl);
  addPreviewUrl = URL.createObjectURL(file);
  document.getElementById('add-img-box').innerHTML = `<img src="${addPreviewUrl}" class="edit-img">`;
}

async function saveAddProduct() {
  const name = document.getElementById('add-name').value.trim();
  const price = document.getElementById('add-price').value;
  const stock = document.getElementById('add-stock').value;
  const size = document.getElementById('add-size').value;
  const color = document.getElementById('add-color').value;

  setAddError('');

  if (!name || price === '') {
    setAddError('ກະລຸນາໃສ່ຊື່ເມນູ ແລະ ລາຄາ');
    return;
  }
  if (Number(price) > 1000000) {
    setAddError('ລາຄາຕ້ອງບໍ່ເກີນ 1,000,000 ກີບ');
    return;
  }
  if (Number(price) < 0) {
    setAddError('ລາຄາຕ້ອງບໍ່ຕິດລົບ');
    return;
  }
  if (Number(stock) > 100) {
    setAddError('ຈຳນວນສະຕັອກຕ້ອງບໍ່ເກີນ 100');
    return;
  }
  if (Number(stock) < 0) {
    setAddError('ຈຳນວນສະຕັອກຕ້ອງບໍ່ຕິດລົບ');
    return;
  }
  if (addImageFile && !addImageFile.type.startsWith('image/')) {
    setAddError('ອະນຸຍາດແຕ່ໄຟລ໌ຮູບພາບເທົ່ານັ້ນ (jpg, png, gif, ...)');
    return;
  }

  const formData = new FormData();
  formData.append('name', name);
  formData.append('price', price);
  formData.append('size', size);
  formData.append('color', color);
  formData.append('stock', stock || 0);
  if (addImageFile) {
    formData.append('image', addImageFile);
  }

  const saveBtn = document.getElementById('add-save-btn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'ກຳລັງບັນທຶກ...';

  try {
    const res = await fetch('/api/products', {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      setAddError(errorData.error || 'ບັນທຶກບໍ່ສຳເລັດ');
      saveBtn.disabled = false;
      saveBtn.textContent = 'ບັນທຶກ';
      return;
    }
  } catch (err) {
    setAddError('ບັນທຶກບໍ່ສຳເລັດ ກະລຸນາລອງໃໝ່ອີກຄັ້ງ');
    saveBtn.disabled = false;
    saveBtn.textContent = 'ບັນທຶກ';
    return;
  }

  closeAddProduct();
  await loadProducts();
  showAdminToast('✅ ເພີ່ມເມນູແລ້ວ');
}

// ----- ເພີ່ມ / ລຶບ ຕົວເລືອກ (ປະເພດອາຫານ, ລະດັບຄວາມເຜັດ) -----
function openOptionInput(type) {
  optionInputType = type;
  const title = type === 'category' ? 'ເພີ່ມປະເພດອາຫານໃໝ່' : 'ເພີ່ມລະດັບຄວາມເຜັດໃໝ່';
  const hint = type === 'category' ? 'ໃສ່ຊື່ປະເພດອາຫານ' : 'ໃສ່ຊື່ລະດັບຄວາມເຜັດ';

  let overlay = document.getElementById('option-input-modal');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'option-input-modal';
    overlay.className = 'edit-modal-overlay top';
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeOptionInput();
    });
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="del-modal-box">
      <div class="del-modal-icon">➕</div>
      <h3>${title}</h3>
      <input type="text" class="opt-input" id="option-input-value" placeholder="${hint}"
        onkeydown="if (event.key === 'Enter') submitOptionInput()">
      <div class="del-actions">
        <button class="del-cancel" onclick="closeOptionInput()">ຍົກເລີກ</button>
        <button class="opt-confirm" id="option-input-save" onclick="submitOptionInput()">ບັນທຶກ</button>
      </div>
    </div>
  `;
  document.getElementById('option-input-value').focus();
}

function closeOptionInput() {
  const overlay = document.getElementById('option-input-modal');
  if (overlay) overlay.remove();
  optionInputType = null;
}

async function submitOptionInput() {
  const input = document.getElementById('option-input-value');
  const value = input.value.trim();
  if (!value) {
    input.focus();
    return;
  }

  const type = optionInputType;
  const btn = document.getElementById('option-input-save');
  btn.disabled = true;

  try {
    const res = await fetch(`/api/settings/options/${type}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value })
    });
    if (!res.ok) {
      btn.disabled = false;
      showAdminToast('❌ ເພີ່ມບໍ່ສຳເລັດ');
      return;
    }
  } catch (err) {
    btn.disabled = false;
    showAdminToast('❌ ເພີ່ມບໍ່ສຳເລັດ');
    return;
  }

  closeOptionInput();

  // ໂຫລດລາຍການໃໝ່ ແລ້ວເລືອກຕົວທີ່ຫາກໍເພີ່ມໃຫ້ເລີຍ
  const currentSize = document.getElementById('add-size')?.value || '';
  const currentColor = document.getElementById('add-color')?.value || '';
  await loadOptions();
  refreshAddSelects(
    type === 'category' ? value : currentSize,
    type === 'spice' ? value : currentColor
  );
}

function askRemoveOption(type) {
  const select = document.getElementById(type === 'category' ? 'add-size' : 'add-color');
  const value = select.value;

  if (!value) {
    setAddError('ກະລຸນາເລືອກຕົວເລືອກທີ່ຢາກລຶບກ່ອນ');
    return;
  }
  setAddError('');
  optionDeleteInfo = { type, value };

  let overlay = document.getElementById('option-delete-modal');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'option-delete-modal';
    overlay.className = 'edit-modal-overlay top';
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeOptionDelete();
    });
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="del-modal-box">
      <div class="del-modal-icon">🗑️</div>
      <h3>ລຶບຕົວເລືອກ</h3>
      <p>ລຶບ <span class="del-modal-name">${escapeHtml(value)}</span> ອອກບໍ?</p>
      <p class="del-modal-warn">ການລຶບບໍ່ສາມາດກູ້ຄືນໄດ້</p>
      <div class="del-actions">
        <button class="del-cancel" onclick="closeOptionDelete()">ຍົກເລີກ</button>
        <button class="del-confirm" id="option-delete-yes" onclick="confirmRemoveOption()">ລຶບ</button>
      </div>
    </div>
  `;
}

function closeOptionDelete() {
  const overlay = document.getElementById('option-delete-modal');
  if (overlay) overlay.remove();
  optionDeleteInfo = null;
}

async function confirmRemoveOption() {
  if (!optionDeleteInfo) return;
  const { type, value } = optionDeleteInfo;

  const btn = document.getElementById('option-delete-yes');
  btn.disabled = true;

  try {
    const res = await fetch(`/api/settings/options/${type}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value })
    });
    if (!res.ok) {
      closeOptionDelete();
      showAdminToast('❌ ລຶບບໍ່ສຳເລັດ');
      return;
    }
  } catch (err) {
    closeOptionDelete();
    showAdminToast('❌ ລຶບບໍ່ສຳເລັດ');
    return;
  }

  closeOptionDelete();

  // ໂຫລດລາຍການໃໝ່ ແລະເກັບຄ່າທີ່ເລືອກໄວ້ໃນອີກຊ່ອງ
  const currentSize = document.getElementById('add-size')?.value || '';
  const currentColor = document.getElementById('add-color')?.value || '';
  await loadOptions();
  refreshAddSelects(
    type === 'category' ? '' : currentSize,
    type === 'spice' ? '' : currentColor
  );
}

// ປຸ່ມ Esc ປິດປັອບອັບຊັ້ນເທິງສຸດກ່ອນ
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (document.getElementById('option-delete-modal')) closeOptionDelete();
  else if (document.getElementById('option-input-modal')) closeOptionInput();
  else if (deletingProductId !== null) closeDeleteProduct();
  else if (editingProductId !== null) closeEditProduct();
  else if (document.getElementById('add-product-modal')) closeAddProduct();
});

async function init() {
  await loadOptions();
  await loadProducts();
}
init();