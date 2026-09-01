async function checkAuth() {
    const res = await fetch('/api/auth/check');
    const data = await res.json();
    if (!data.loggedIn) {
      window.location.href = 'login.html';
    }
  }
  checkAuth();
  
  async function loadStaff() {
    const res = await fetch('/api/admins');
    const admins = await res.json();
  
    const table = document.getElementById('staff-table');
    table.innerHTML = `
      <tr><th>ລະຫັດ</th><th>Username</th><th>ຊື່</th><th></th></tr>
      ${admins.map(a => `
        <tr>
          <td>${a.id}</td>
          <td>${a.username}</td>
          <td>${a.name}</td>
          <td><button class="delete-btn" onclick="deleteStaff(${a.id}, '${a.name}')">ລົບ</button></td>
        </tr>
      `).join('')}
    `;
  }
  
  async function addStaff() {
    const username = document.getElementById('new-username').value.trim();
    const password = document.getElementById('new-password').value.trim();
    const name = document.getElementById('new-name').value.trim();
  
    if (!username || !password || !name) {
      alert('ກະລຸນາປ້ອນຂໍ້ມູນໃຫ້ຄົບ');
      return;
    }
  
    const res = await fetch('/api/admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, name })
    });
    const data = await res.json();
  
    if (res.ok) {
      document.getElementById('new-username').value = '';
      document.getElementById('new-password').value = '';
      document.getElementById('new-name').value = '';
      loadStaff();
    } else {
      alert('ຜິດພາດ: ' + data.error);
    }
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
  
  loadStaff();