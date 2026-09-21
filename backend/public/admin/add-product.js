// ✅ ถ้าพิมพ์แล้วเกินขีดจำกัด ให้ดีดกลับไปค่าล่าสุดที่ถูกต้อง (ไม่กระโดดไปที่ max)
function restrictMaxValue(input, max) {
  input.dataset.lastValid = input.value === '' ? '' : Math.min(Number(input.value), max);

  input.addEventListener('input', function () {
    if (this.value === '') {
      this.dataset.lastValid = '';
      return;
    }
    const value = Number(this.value);
    if (value > max || value < 0 || isNaN(value)) {
      this.value = this.dataset.lastValid;
    } else {
      this.dataset.lastValid = this.value;
    }
  });
}

restrictMaxValue(document.getElementById('price'), 1000000);
restrictMaxValue(document.getElementById('stock'), 100);

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

function fillSelect(select, list, placeholder, keepValue) {
  select.innerHTML = `<option value="">${placeholder}</option>` +
    list.map(opt => `<option value="${opt}" ${opt === keepValue ? 'selected' : ''}>${opt}</option>`).join('');
}

async function loadOptions(keepSize, keepColor) {
  const res = await fetch('/api/settings/options');
  const data = await res.json();
  fillSelect(document.getElementById('size'), data.categories, 'ປະເພດອາຫານ', keepSize);
  fillSelect(document.getElementById('color'), data.spiceLevels, 'ລະດັບຄວາມເຜັດ', keepColor);
}
loadOptions();

async function addOption(type) {
  const label = type === 'category' ? 'ປະເພດອາຫານ' : 'ລະດັບຄວາມເຜັດ';
  const value = prompt(`ໃສ່ຊື່ ${label} ໃໝ່:`);
  if (!value || !value.trim()) return;

  await fetch(`/api/settings/options/${type}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: value.trim() })
  });

  await loadOptions();
}

async function removeOption(type) {
  const selectId = type === 'category' ? 'size' : 'color';
  const select = document.getElementById(selectId);
  const value = select.value;

  if (!value) {
    alert('ກະລຸນາເລືອກຕົວເລືອກທີ່ຢາກລຶບກ່ອນ');
    return;
  }
  if (!confirm(`ລຶບ "${value}" ອອກບໍ?`)) return;

  await fetch(`/api/settings/options/${type}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value })
  });

  await loadOptions();
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

  if (Number(price) > 1000000) {
    alert('ລາຄາຕ້ອງບໍ່ເກີນ 1,000,000 ກີບ');
    return;
  }
  if (Number(price) < 0) {
    alert('ລາຄາຕ້ອງບໍ່ຕິດລົບ');
    return;
  }
  if (Number(stock) > 100) {
    alert('ຈຳນວນສະຕັອກຕ້ອງບໍ່ເກີນ 100');
    return;
  }
  if (Number(stock) < 0) {
    alert('ຈຳນວນສະຕັອກຕ້ອງບໍ່ຕິດລົບ');
    return;
  }

  if (imageFile && !imageFile.type.startsWith('image/')) {
    alert('ອະນຸຍາດແຕ່ໄຟລ໌ຮູບພາບເທົ່ານັ້ນ (jpg, png, gif, ...)');
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

  const res = await fetch('/api/products', {
    method: 'POST',
    body: formData
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    alert(errorData.error || 'ບັນທຶກເມນູບໍ່ສຳເລັດ');
    return;
  }

  window.location.href = 'index.html';
}