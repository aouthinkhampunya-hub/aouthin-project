async function checkAuth() {
    const res = await fetch('/api/auth/check');
    const data = await res.json();
    if (!data.loggedIn) {
      window.location.href = 'login.html';
    }
  }
  checkAuth();
  
  function statusLabel(status) {
    if (status === 'pending') return 'ລໍຖ້າ';
    if (status === 'cooking') return 'ກຳລັງເຮັດ';
    if (status === 'completed') return 'ພ້ອມແລ້ວ';
    return status;
  }
  
  function nextStatus(status) {
    if (status === 'pending') return 'cooking';
    if (status === 'cooking') return 'completed';
    return null;
  }
  
  function nextStatusLabel(status) {
    if (status === 'pending') return 'ເລີ່ມເຮັດ';
    if (status === 'cooking') return 'ພ້ອມແລ້ວ';
    return '';
  }
  
  async function loadTables() {
    const res = await fetch('/api/orders/bills');
    const bills = await res.json();
  
    const container = document.getElementById('tables-dashboard');
  
    if (bills.length === 0) {
      container.innerHTML = '<p>ຍັງບໍ່ມີໂຕະທີ່ເປີດຢູ່</p>';
      return;
    }
  
    container.innerHTML = bills.map(bill => {
      const total = bill.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
      const allServed = bill.items.every(i => i.status === 'completed');
  
      return `
        <div class="table-card">
          <h2>ໂຕະ ${bill.table_number}</h2>
          <table>
            <tr><th>ເມນູ</th><th>ຈຳນວນ</th><th>ສະຖານະ</th><th></th></tr>
            ${bill.items.map(item => `
              <tr>
                <td>${item.product_name}</td>
                <td>${item.quantity}</td>
                <td>${statusLabel(item.status)}</td>
                <td>
                  ${nextStatus(item.status) ? `
                    <button class="delete-btn" onclick="updateItemStatus(${item.id}, '${nextStatus(item.status)}')">
                      ${nextStatusLabel(item.status)}
                    </button>
                  ` : '✅'}
                </td>
              </tr>
            `).join('')}
          </table>
          <p class="cart-total">ລວມ: ${total} ກີບ</p>
          <button class="confirm-btn" onclick="goToBill(${bill.id})" ${!allServed ? 'disabled' : ''}>
            ${allServed ? 'ອອກບິນ / ຈ່າຍແລ້ວ' : 'ລໍຖ້າອາຫານໃຫ້ພ້ອມກ່ອນ'}
          </button>
        </div>
      `;
    }).join('');
  }
  
  async function updateItemStatus(orderId, status) {
    await fetch(`/api/orders/${orderId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    loadTables();
  }
  
  function goToBill(billId) {
    window.location.href = `bill.html?bill=${billId}`;
  }
  
  loadTables();
  setInterval(loadTables, 5000);