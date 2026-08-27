async function checkAuth() {
    const res = await fetch('/api/auth/check');
    const data = await res.json();
    if (!data.loggedIn) {
      window.location.href = 'login.html';
    }
  }
  checkAuth();
  
  async function loadOrders() {
    const res = await fetch('/api/orders');
    const orders = await res.json();
  
    const container = document.getElementById('order-list');
  
    if (orders.length === 0) {
      container.innerHTML = '<p>ຍັງບໍ່ມີຄຳສັ່ງອາຫານ</p>';
      return;
    }
  
    container.innerHTML = `
      <table>
        <tr>
          <th>ລະຫັດ</th><th>ເມນູ</th><th>ຈຳນວນ</th><th>ລາຄາລວມ</th><th>ສະຖານະ</th><th>ເວລາສັ່ງ</th><th></th>
        </tr>
        ${orders.map(o => `
          <tr>
            <td>${o.id}</td>
            <td>${o.product_name}</td>
            <td>${o.quantity}</td>
            <td>${o.price * o.quantity} ບາດ</td>
            <td>${statusLabel(o.status)}</td>
            <td>${new Date(o.created_at).toLocaleString('th-TH')}</td>
            <td>
              ${o.status === 'pending' ? `<button class="delete-btn" onclick="completeOrder(${o.id})">ເສີບແລ້ວ</button>` : ''}
            </td>
          </tr>
        `).join('')}
      </table>
    `;
  }
  
  function statusLabel(status) {
    if (status === 'pending') return 'ກຳລັງເຮັດ';
    if (status === 'completed') return 'ເສີບແລ້ວ';
    return status;
  }
  
  async function completeOrder(id) {
    await fetch(`/api/orders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' })
    });
    loadOrders();
  }
  
  loadOrders();