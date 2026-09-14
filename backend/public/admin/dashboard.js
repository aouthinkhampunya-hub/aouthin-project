async function checkAuth() {
    const res = await fetch('/api/auth/check');
    const data = await res.json();
    if (!data.loggedIn) {
      window.location.href = 'login.html';
    }
  }
  checkAuth();
  
  function getVientianeDateStr(dateInput) {
    return new Date(dateInput).toLocaleDateString('en-CA', { timeZone: 'Asia/Vientiane' });
  }
  
  function daysAgoStr(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return getVientianeDateStr(d);
  }
  
  async function loadDashboard() {
    const res = await fetch('/api/orders');
    const orders = await res.json();
  
    const completed = orders.filter(o => o.status === 'completed');
  
    const todayStr = getVientianeDateStr(new Date());
    const weekStart = daysAgoStr(7);
    const monthStart = daysAgoStr(30);
  
    let todayRevenue = 0, todayCount = 0;
    let weekRevenue = 0, weekCount = 0;
    let monthRevenue = 0, monthCount = 0;
    const itemSales = {};
  
    completed.forEach(o => {
      const orderDate = getVientianeDateStr(o.created_at);
      const amount = o.price * o.quantity;
  
      if (orderDate === todayStr) {
        todayRevenue += amount;
        todayCount += o.quantity;
      }
      if (orderDate >= weekStart) {
        weekRevenue += amount;
        weekCount += o.quantity;
        itemSales[o.product_name] = (itemSales[o.product_name] || 0) + o.quantity;
      }
      if (orderDate >= monthStart) {
        monthRevenue += amount;
        monthCount += o.quantity;
      }
    });
  
    document.getElementById('stats-grid').innerHTML = `
      <div class="stat-card">
        <div class="label">ຍອດຂາຍມື້ນີ້</div>
        <div class="value">${todayRevenue.toLocaleString()} ກີບ</div>
        <div class="sub">${todayCount} ຈານ</div>
      </div>
      <div class="stat-card">
        <div class="label">ຍອດຂາຍ 7 ວັນຫຼ້າສຸດ</div>
        <div class="value">${weekRevenue.toLocaleString()} ກີບ</div>
        <div class="sub">${weekCount} ຈານ</div>
      </div>
      <div class="stat-card">
        <div class="label">ຍອດຂາຍ 30 ວັນຫຼ້າສຸດ</div>
        <div class="value">${monthRevenue.toLocaleString()} ກີບ</div>
        <div class="sub">${monthCount} ຈານ</div>
      </div>
    `;
  
    const topItems = Object.entries(itemSales)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  
    const list = document.getElementById('top-items-list');
    if (topItems.length === 0) {
      list.innerHTML = '<p>ຍັງບໍ່ມີຂໍ້ມູນ</p>';
    } else {
      list.innerHTML = topItems.map(([name, qty], i) => `
        <div class="top-item-row">
          <span>${i + 1}. ${name}</span>
          <strong>${qty} ຈານ</strong>
        </div>
      `).join('');
    }
  }
  
  loadDashboard();