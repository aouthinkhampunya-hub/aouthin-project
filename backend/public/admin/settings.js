async function checkAuth() {
    const res = await fetch('/api/auth/check');
    const data = await res.json();
    if (!data.loggedIn) {
      window.location.href = 'login.html';
    }
  }
  checkAuth();
  
  async function loadQR() {
    const res = await fetch('/api/settings/qr');
    const data = await res.json();
  
    const preview = document.getElementById('qr-preview');
    if (data.qrImage) {
      preview.innerHTML = `<img src="${data.qrImage}" alt="QR ຮັບເງິນ">`;
    } else {
      preview.innerHTML = `<span>ຍັງບໍ່ມີຮູບ QR</span>`;
    }
  }
  
  async function uploadQR() {
    const input = document.getElementById('qr-input');
    const file = input.files[0];
  
    if (!file) {
      alert('ກະລຸນາເລືອກຮູບ QR ກ່ອນ');
      return;
    }
  
    const formData = new FormData();
    formData.append('qr', file);
  
    const res = await fetch('/api/settings/qr', {
      method: 'POST',
      body: formData
    });
  
    const data = await res.json();
  
    if (res.ok) {
      alert('ບັນທຶກ QR ສຳເລັດ!');
      input.value = '';
      loadQR();
    } else {
      alert('ເກີດຂໍ້ຜິດພາດ: ' + data.error);
    }
  }
  
  loadQR();