const params = new URLSearchParams(window.location.search);
const billId = params.get('bill');

async function checkAuth() {
  const res = await fetch('/api/auth/check');
  const data = await res.json();
  if (!data.loggedIn) {
    window.location.href = 'login.html';
  }
}
checkAuth();

async function loadBill() {
  const [billsRes, qrRes] = await Promise.all([
    fetch('/api/orders/bills'),
    fetch('/api/settings/qr')
  ]);

  const bills = await billsRes.json();
  const qrData = await qrRes.json();

  const bill = bills.find(b => String(b.id) === String(billId));
  const container = document.getElementById('receipt-container');

  if (!bill) {
    container.innerHTML = '<p style="text-align:center;padding:40px;">ບໍ່ພົບໃບບິນນີ້ (ອາດຈະຈ່າຍໄປແລ້ວ)</p>';
    return;
  }

  const total = bill.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const now = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Vientiane' });

  container.innerHTML = `
    <div class="receipt">
      <div class="receipt-header">
        <h2>ຮ້ານອາຫານຕາມສັ່ງ AOUTHIN</h2>
        <p>ໂຕະ ${bill.table_number} &nbsp;•&nbsp; ${now}</p>
      </div>

      <table class="receipt-table">
        <tr><th>ເມນູ</th><th>ຈຳນວນ</th><th>ລາຄາ</th></tr>
        ${bill.items.map(i => `
          <tr>
            <td>${i.product_name}</td>
            <td>${i.quantity}</td>
            <td>${i.price * i.quantity} ກີບ</td>
          </tr>
        `).join('')}
      </table>

      <div class="receipt-total">
        <span>ຍອດລວມທັງໝົດ</span>
        <span>${total} ກີບ</span>
      </div>

      ${qrData.qrImage ? `
        <div class="qr-section">
          <p>ສະແກນ QR ນີ້ເພື່ອຊຳລະເງິນ</p>
          <img src="${qrData.qrImage}" alt="QR ຮັບເງິນ">
        </div>
      ` : `
        <div class="qr-section">
          <p>ຍັງບໍ່ໄດ້ຕັ້ງຄ່າ QR ຮັບເງິນ (ໄປທີ່ໜ້າຕັ້ງຄ່າ)</p>
        </div>
      `}

      <div class="bill-actions">
        <button class="btn-print" onclick="window.print()">🖨️ ພິມບິນ</button>
        <button class="btn-confirm" onclick="confirmPaid(${bill.id})">✅ ຢືນຢັນຮັບເງິນແລ້ວ</button>
      </div>
    </div>
  `;
}

async function confirmPaid(id) {
  if (!confirm('ຢືນຢັນວ່າໂຕະນີ້ຈ່າຍເງິນຄົບແລ້ວ?')) return;

  await fetch(`/api/orders/bills/${id}/close`, {
    method: 'PUT'
  });

  alert('ປິດບິນສຳເລັດ! ✅');
  window.location.href = 'tables.html';
}

loadBill();