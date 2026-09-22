async function checkAuth() {
  const res = await fetch('/api/auth/me', { credentials: 'include' });
  if (!res.ok) {
    window.location.href = 'login.html';
  }
}
checkAuth();

function showNotice(message) {
  document.getElementById('notice-modal-text').textContent = message;
  document.getElementById('notice-modal').style.display = 'flex';
}

document.getElementById('notice-modal-ok').addEventListener('click', () => {
  document.getElementById('notice-modal').style.display = 'none';
});

async function addStaff() {
  const username = document.getElementById('new-username').value.trim();
  const password = document.getElementById('new-password').value.trim();
  const name = document.getElementById('new-name').value.trim();

  if (!username || !password || !name) {
    showNotice('ກະລຸນາປ້ອນຂໍ້ມູນໃຫ້ຄົບ');
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
    showNotice('ຜິດພາດ: ' + data.error);
  }
}