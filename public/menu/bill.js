const params = new URLSearchParams(window.location.search);
const tableNumber = params.get('table') || sessionStorage.getItem('tableNumber');

document.getElementById('table-label').textContent = `ໂຕະ ${tableNumber}`;

function statusLabel(status) {
  if (status === 'pending') return '⏳ ລໍຖ້າ';
  if (status === 'cooking') return '🔥 ກຳລັງເຮັດ';
  if (status === 'completed') return '✅ ພ້ອມແລ້ວ';
  return status;
}

async function loadBill() {
  const res = await fetch('/api/orders/bills');
  const bills = await res.json();

  const myBill = bills.find(b => String(b.table_number) === String(tableNumber));

  const container = document.getElementById('bill-content');

  if (!myBill || myBill.items.length === 0) {
    container.innerHTML = '<p>ຍັງບໍ່ມີການສັ່ງອາຫານ</p>';
    return;
  }

  const total = myBill.items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  container.innerHTML = `
    <table class="bill-table">
      <tr><th>ເມນູ</th><th>ຈຳນວນ</th><th>ລາຄາ</th><th>ສະຖານະ</th></tr>
      ${myBill.items.map(i => `
        <tr>
          <td>${i.product_name}</td>
          <td>${i.quantity}</td>
          <td>${i.price * i.quantity} ກີບ</td>
          <td>${statusLabel(i.status)}</td>
        </tr>
      `).join('')}
    </table>
    <p class="cart-total">ລວມທັງໝົດ: ${total} ກີບ</p>
  `;
}

loadBill();
setInterval(loadBill, 5000); // อัปเดตสถานะทุก 5 วินาที