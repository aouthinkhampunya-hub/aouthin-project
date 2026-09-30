async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) {
      window.location.href = 'login.html';
    }
  } catch (err) {
    window.location.href = 'login.html';
  }
}
checkAuth();

let allOrders = [];

async function loadOrders() {
  const res = await fetch('/api/orders');
  allOrders = await res.json();
  allOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  renderOrders(allOrders);
}
function renderOrders(orders) {
  const container = document.getElementById('order-list');

  if (orders.length === 0) {
    container.innerHTML = '<p>ບໍ່ພົບຄຳສັ່ງອາຫານໃນຊ່ວງນີ້</p>';
    return;
  }

    container.innerHTML = `
    <table>
      <tr>
        <th>ລະຫັດ</th><th>ເມນູ</th><th>ຈຳນວນ</th><th>ລາຄາລວມ</th><th>ສະຖານະ</th><th>ເວລາສັ່ງ</th><th></th>
      </tr>
      ${orders.map((o, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${o.product_name}</td>
          <td>${o.quantity}</td>
          <td>${o.price * o.quantity} ກີບ</td>
          <td>${statusLabel(o.status)}</td>
          <td class="time-column">
  <div class="time-content">
    ${new Date(o.created_at).toLocaleString('en-GB', {
      timeZone: 'Asia/Vientiane'
    })}

    ${o.status === 'ready'
      ? `<button class="delete-btn" onclick="completeOrder(${o.id})">ເສີບແລ້ວ</button>`
      : ''
    }
  </div>
</td>
        </tr>
      `).join('')}
    </table>
  `;
}

function applyDateFilter() {
  const fromVal = document.getElementById('date-from').value;
  const toVal = document.getElementById('date-to').value;

  if (!fromVal && !toVal) {
    renderOrders(allOrders);
    return;
  }

  const from = fromVal ? new Date(fromVal + 'T00:00:00+07:00') : null;
  const to = toVal ? new Date(toVal + 'T23:59:59+07:00') : null;

  const filtered = allOrders.filter(o => {
    const created = new Date(o.created_at);
    if (from && created < from) return false;
    if (to && created > to) return false;
    return true;
  });

  renderOrders(filtered);
}

function clearDateFilter() {
  document.getElementById('date-from').value = '';
  document.getElementById('date-to').value = '';
  renderOrders(allOrders);
}

function statusLabel(status) {
  if (status === 'pending') return 'ລໍຖ້າ';
  if (status === 'cooking') return 'ກຳລັງເຮັດ';
  if (status === 'ready') return '🍽️ ເຮັດແລ້ວ ລໍເສີບ';
  if (status === 'completed') return '✅ ເສີບແລ້ວ';
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