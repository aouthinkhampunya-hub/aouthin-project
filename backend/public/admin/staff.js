let currentRole = null;

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

async function deleteStaff(id, name) {
  if (!confirm(`ຢືນຢັນລົບພະນັກງານ "${name}"?`)) return;

  const res = await fetch(`/api/admins/${id}`, { method: 'DELETE' });
  const data = await res.json();

  if (res.ok) {
    loadStaff();
  } else {
    alert('ຜິດພາດ: ' + data.error);
  }
}

async function resetPassword(id, name) {
  const newPassword = prompt(`ໃສ່ລະຫັດຜ່ານໃໝ່ສຳລັບ "${name}" (ຢ່າງໜ້ອຍ 4 ໂຕ):`);
  if (!newPassword) return;

  const res = await fetch(`/api/admins/${id}/reset-password`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: newPassword })
  });
  const data = await res.json();

  if (res.ok) {
    alert(`ຣີເຊັດລະຫັດຜ່ານຂອງ "${name}" ສຳເລັດ! ລະຫັດຜ່ານໃໝ່: ${newPassword}`);
  } else {
    alert('ຜິດພາດ: ' + data.error);
  }
}

loadStaff();