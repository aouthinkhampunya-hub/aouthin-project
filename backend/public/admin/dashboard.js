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

function getVientianeDateStr(dateInput) {
  return new Date(dateInput).toLocaleDateString('en-CA', { timeZone: 'Asia/Vientiane' });
}

function daysAgoStr(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return getVientianeDateStr(d);
}

const PERIODS = [
  { key: 'today', label: 'ມື້ນີ້' },
  { key: 'week', label: '7 ວັນຫຼ້າສຸດ' },
  { key: 'month', label: '30 ວັນຫຼ້າສຸດ' },
  { key: 'all', label: 'ທັງໝົດ (ຕັ້ງແຕ່ເປີດຮ້ານ)' }
];

const DONUT_COLORS = ['#b8380e', '#f2760c', '#d9a520', '#3C8031', '#2b6cb0', '#8a7c6a'];

let allCompletedOrders = [];
let periodStats = {}; // key -> { revenue, count, itemSales: {name: qty} }
let selectedPeriod = 'today';

async function loadDashboard() {
  const res = await fetch('/api/orders');
  const orders = await res.json();
  allCompletedOrders = orders.filter(o => o.status === 'completed');

  const todayStr = getVientianeDateStr(new Date());
  const weekStart = daysAgoStr(7);
  const monthStart = daysAgoStr(30);

  const buckets = {
    today: { revenue: 0, count: 0, itemSales: {} },
    week: { revenue: 0, count: 0, itemSales: {} },
    month: { revenue: 0, count: 0, itemSales: {} },
    all: { revenue: 0, count: 0, itemSales: {} }
  };

  allCompletedOrders.forEach(o => {
    const orderDate = getVientianeDateStr(o.created_at);
    const amount = o.price * o.quantity;

    const addTo = (bucket) => {
      bucket.revenue += amount;
      bucket.count += o.quantity;
      bucket.itemSales[o.product_name] = (bucket.itemSales[o.product_name] || 0) + o.quantity;
    };

    if (orderDate === todayStr) addTo(buckets.today);
    if (orderDate >= weekStart) addTo(buckets.week);
    if (orderDate >= monthStart) addTo(buckets.month);
    addTo(buckets.all);
  });

  periodStats = buckets;

  renderPeriodTabs();
  renderSelectedPeriod();
}

function renderPeriodTabs() {
  const container = document.getElementById('period-tabs');
  container.innerHTML = PERIODS.map(p => {
    const stat = periodStats[p.key];
    return `
      <button type="button" class="period-tab ${p.key === selectedPeriod ? 'active' : ''}" onclick="selectPeriod('${p.key}')">
        <div class="pt-label">${p.label}</div>
        <div class="pt-value">${stat.revenue.toLocaleString()} ກີບ</div>
      </button>
    `;
  }).join('');
}

function selectPeriod(key) {
  selectedPeriod = key;
  renderPeriodTabs();
  renderSelectedPeriod();
}

function renderSelectedPeriod() {
  const period = PERIODS.find(p => p.key === selectedPeriod);
  const stat = periodStats[selectedPeriod];

  document.getElementById('period-summary').innerHTML = `
    <span class="ps-title">${period.label}:</span>
    <span class="ps-value">${stat.revenue.toLocaleString()} ກີບ</span>
    <span class="ps-sub">${stat.count} ຈານ</span>
  `;

  renderDonut(stat.itemSales);
  renderTopItems(period.label, stat.itemSales);
}

function renderDonut(itemSales) {
  const donut = document.getElementById('revenue-donut');
  const legend = document.getElementById('revenue-legend');

  const entries = Object.entries(itemSales).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, qty]) => sum + qty, 0);

  if (total === 0) {
    donut.style.background = '#f0e0cf';
    donut.innerHTML = `
      <div class="donut-hole">
        <div class="donut-total">0</div>
        <div class="donut-sub">ຍັງບໍ່ມີຂໍ້ມູນ</div>
      </div>
    `;
    legend.innerHTML = '<p style="color:#8a7c6a;">ຍັງບໍ່ມີການຂາຍໃນຊ່ວງນີ້</p>';
    return;
  }

  // ເອົາ 5 ອັນທຳອິດ ທີ່ເຫຼືອລວມເປັນ "ອື່ນໆ"
  const top = entries.slice(0, 5);
  const restQty = entries.slice(5).reduce((sum, [, qty]) => sum + qty, 0);
  const slices = restQty > 0 ? [...top, ['ອື່ນໆ', restQty]] : top;

  let cumulative = 0;
  const gradientParts = slices.map(([name, qty], i) => {
    const start = (cumulative / total) * 360;
    cumulative += qty;
    const end = (cumulative / total) * 360;
    const color = DONUT_COLORS[i % DONUT_COLORS.length];
    return `${color} ${start}deg ${end}deg`;
  });

  donut.style.background = `conic-gradient(${gradientParts.join(', ')})`;
  donut.innerHTML = `
    <div class="donut-hole">
      <div class="donut-total">${total} ຈານ</div>
      <div class="donut-sub">ລວມທີ່ຂາຍ</div>
    </div>
  `;

  legend.innerHTML = slices.map(([name, qty], i) => {
    const pct = Math.round((qty / total) * 100);
    const color = DONUT_COLORS[i % DONUT_COLORS.length];
    return `
      <div class="donut-legend-row">
        <span class="donut-dot" style="background:${color};"></span>
        <span class="donut-legend-name">${name}</span>
        <span class="donut-legend-qty">${qty} ຈານ</span>
        <span class="donut-legend-pct">${pct}%</span>
      </div>
    `;
  }).join('');
}

function renderTopItems(periodLabel, itemSales) {
  document.getElementById('top-items-title').textContent = `🔥 ເມນູຂາຍດີ (${periodLabel})`;

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