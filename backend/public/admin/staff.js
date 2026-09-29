let currentRole = null;
let resetTargetId = null;
let deleteTargetId = null;

function showNotice(message) {
  document.getElementById('notice-modal-text').textContent = message;
  document.getElementById('notice-modal').style.display = 'flex';
}

document.getElementById('notice-modal-ok').addEventListener('click', () => {
  document.getElementById('notice-modal').style.display = 'none';
});

async function checkAuth() {
  const res = await fetch('/api/auth/me', { credentials: 'include' });
  if (!res.ok) {
    window.location.href = 'login.html';
    return;
  }
  const data = await res.json();
  currentRole = data.role;
}

async function loadStaff() {
  await checkAuth();

  const res = await fetch('/api/admins');
  const admins = await res.json();

  const table = document.getElementById('staff-table');
  table.innerHTML = `
    <tr><th>ລະຫັດ</th><th>Username</th><th>ຊື່</th><th>ບົດບາດ</th><th></th></tr>
    ${admins.map(a => `
      <tr>
        <td>${a.id}</td>
        <td>${a.username}</td>
        <td>${a.name}</td>
        <td>${a.role === 'owner' ? '👑 ເຈົ້າຂອງຮ້ານ' : '👤 ພະນັກງານ'}</td>
        <td>
          ${currentRole === 'owner' && a.role !== 'owner'
            ? `<button class="delete-btn" onclick="deleteStaff(${a.id}, '${a.name}')">ລົບ</button>
               <button class="reset-btn" onclick="resetPassword(${a.id}, '${a.name}')">ຣີເຊັດລະຫັດ</button>`
            : ''}
        </td>
      </tr>
    `).join('')}
  `;
}

function deleteStaff(id, name) {
  deleteTargetId = id;
  document.getElementById('delete-modal-text').textContent = `ຢືນຢັນລົບພະນັກງານ "${name}"?`;
  document.getElementById('delete-modal').style.display = 'flex';
}

document.getElementById('delete-modal-cancel').addEventListener('click', () => {
  document.getElementById('delete-modal').style.display = 'none';
});

document.getElementById('delete-modal-ok').addEventListener('click', async () => {
  document.getElementById('delete-modal').style.display = 'none';

  const res = await fetch(`/api/admins/${deleteTargetId}`, { method: 'DELETE' });
  const data = await res.json();

  if (res.ok) {
    loadStaff();
  } else {
    showNotice('ຜິດພາດ: ' + data.error);
  }
});

function resetPassword(id, name) {
  resetTargetId = id;
  document.getElementById('reset-modal-text').textContent = `ໃສ່ລະຫັດຜ່ານໃໝ່ສຳລັບ "${name}" (ຢ່າງໜ້ອຍ 4 ໂຕ):`;
  document.getElementById('reset-modal-input').value = '';
  document.getElementById('reset-modal').style.display = 'flex';
}

document.getElementById('reset-modal-cancel').addEventListener('click', () => {
  document.getElementById('reset-modal').style.display = 'none';
});

document.getElementById('reset-modal-ok').addEventListener('click', async () => {
  const newPassword = document.getElementById('reset-modal-input').value;
  if (!newPassword || newPassword.length < 4) {
    showNotice('ລະຫັດຜ່ານຕ້ອງມີຢ່າງໜ້ອຍ 4 ໂຕ');
    return;
  }
  document.getElementById('reset-modal').style.display = 'none';

  const res = await fetch(`/api/admins/${resetTargetId}/reset-password`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: newPassword })
  });
  const data = await res.json();

  if (res.ok) {
    showNotice(`ຣີເຊັດລະຫັດຜ່ານສຳເລັດ! ລະຫັດຜ່ານໃໝ່: ${newPassword}`);
  } else {
    showNotice('ຜິດພາດ: ' + data.error);
  }
});

// ===== ປັອບອັບເພີ່ມພະນັກງານໃໝ່ (ແທນໜ້າ add-staff.html) =====
(function addStaffPopupStyle() {
  const s = document.createElement('style');
  s.textContent = `
    .sp-overlay {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      width: 100vw; height: 100vh; background: rgba(20, 12, 6, 0.75);
      display: flex; align-items: center; justify-content: center;
      z-index: 9999; padding: 20px; animation: spFadeIn 0.2s ease;
    }
    .sp-box {
      background: #fff; border-radius: 22px; width: 100%; max-width: 400px;
      padding: 26px 24px 22px; box-shadow: 0 24px 60px rgba(0,0,0,0.45);
      animation: spPopIn 0.25s ease;
    }
    .sp-box h3 { margin: 0 0 18px; text-align: center; color: #2B1B0E; font-size: 19px; font-weight: 800; }
    .sp-field { margin-bottom: 14px; }
    .sp-field label { display: block; margin-bottom: 5px; font-size: 13px; font-weight: 700; color: #7a1f10; }
    .sp-field input {
      width: 100%; box-sizing: border-box; padding: 10px 12px;
      border: 1.5px solid #e0d4c6; border-radius: 10px; font-size: 15px;
    }
    .sp-field input:focus { outline: none; border-color: #d9a520; }
    .sp-error {
      display: none; background: #fdecea; color: #b3261e; border-radius: 10px;
      padding: 9px 12px; font-size: 13px; font-weight: 700; margin-bottom: 14px;
    }
    .sp-actions { display: flex; gap: 10px; }
    .sp-actions button {
      flex: 1; padding: 13px; border: none; border-radius: 12px;
      font-size: 15px; font-weight: 700; cursor: pointer; margin: 0; width: auto;
    }
    .sp-cancel { background: #c0392b; color: #fff; }
    .sp-cancel:hover { background: #a5301f; }
    .sp-save { background: #3C8031; color: #fff; box-shadow: 0 6px 16px rgba(60,128,49,0.35); }
    .sp-save:hover { background: #2C601E; }
    .sp-save:disabled { opacity: 0.6; cursor: default; }
    @keyframes spFadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes spPopIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  `;
  document.head.appendChild(s);
})();

function openAddStaff() {
  let overlay = document.getElementById('add-staff-modal');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'add-staff-modal';
    overlay.className = 'sp-overlay';
    // ບໍ່ປິດເມື່ອກົດພື້ນມືດ ເພື່ອກັນຂໍ້ມູນທີ່ພິມໄວ້ຫາຍ
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="sp-box">
      <h3>➕ ເພີ່ມພະນັກງານໃໝ່</h3>

      <div class="sp-field">
        <label>Username</label>
        <input type="text" id="sp-username" placeholder="Username">
      </div>
      <div class="sp-field">
        <label>Password</label>
        <input type="password" id="sp-password" placeholder="Password">
      </div>
      <div class="sp-field">
        <label>ຊື່ພະນັກງານ</label>
        <input type="text" id="sp-name" placeholder="ຊື່ພະນັກງານ">
      </div>

      <div class="sp-error" id="sp-error"></div>

      <div class="sp-actions">
        <button class="sp-cancel" onclick="closeAddStaff()">ຍົກເລີກ</button>
        <button class="sp-save" id="sp-save-btn" onclick="submitAddStaff()">ບັນທຶກ</button>
      </div>
    </div>
  `;
  document.getElementById('sp-username').focus();
}

function closeAddStaff() {
  const overlay = document.getElementById('add-staff-modal');
  if (overlay) overlay.remove();
}

function setStaffError(message) {
  const el = document.getElementById('sp-error');
  if (!el) return;
  if (message) {
    el.textContent = message;
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
  }
}

async function submitAddStaff() {
  const username = document.getElementById('sp-username').value.trim();
  const password = document.getElementById('sp-password').value.trim();
  const name = document.getElementById('sp-name').value.trim();

  setStaffError('');

  if (!username || !password || !name) {
    setStaffError('ກະລຸນາປ້ອນຂໍ້ມູນໃຫ້ຄົບ');
    return;
  }

  const btn = document.getElementById('sp-save-btn');
  btn.disabled = true;
  btn.textContent = 'ກຳລັງບັນທຶກ...';

  try {
    const res = await fetch('/api/admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, name })
    });
    const data = await res.json();

    if (!res.ok) {
      setStaffError(data.error || 'ບັນທຶກບໍ່ສຳເລັດ');
      btn.disabled = false;
      btn.textContent = 'ບັນທຶກ';
      return;
    }
  } catch (err) {
    setStaffError('ບັນທຶກບໍ່ສຳເລັດ ກະລຸນາລອງໃໝ່ອີກຄັ້ງ');
    btn.disabled = false;
    btn.textContent = 'ບັນທຶກ';
    return;
  }

  closeAddStaff();
  await loadStaff();
  showNotice('✅ ເພີ່ມພະນັກງານແລ້ວ');
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.getElementById('add-staff-modal')) closeAddStaff();
});

loadStaff();