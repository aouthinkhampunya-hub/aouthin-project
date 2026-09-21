async function checkAuth() {
  const res = await fetch('/api/auth/me', { credentials: 'include' });
  if (!res.ok) {
    window.location.href = 'login.html';
  }
}
checkAuth();

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
    window.location.href = 'staff.html';
  } else {
    alert('ຜິດພາດ: ' + data.error);
  }
}