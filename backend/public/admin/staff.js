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

loadStaff();