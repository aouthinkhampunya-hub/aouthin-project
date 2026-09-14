import React, { useEffect, useState } from 'react';
import { getOrders } from '../../api.js';

function getVientianeDateStr(dateInput) {
  return new Date(dateInput).toLocaleDateString('en-CA', { timeZone: 'Asia/Vientiane' });
}
function daysAgoStr(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return getVientianeDateStr(d);
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [topItems, setTopItems] = useState([]);

  useEffect(() => { load(); }, []);

  async function load() {
    const orders = await getOrders();
    const completed = orders.filter(o => o.status === 'completed');

    const todayStr = getVientianeDateStr(new Date());
    const weekStart = daysAgoStr(7);
    const monthStart = daysAgoStr(30);

    let today = { rev: 0, cnt: 0 }, week = { rev: 0, cnt: 0 }, month = { rev: 0, cnt: 0 };
    const itemSales = {};

    completed.forEach(o => {
      const d = getVientianeDateStr(o.created_at);
      const amount = o.price * o.quantity;
      if (d === todayStr) { today.rev += amount; today.cnt += o.quantity; }
      if (d >= weekStart) {
        week.rev += amount; week.cnt += o.quantity;
        itemSales[o.product_name] = (itemSales[o.product_name] || 0) + o.quantity;
      }
      if (d >= monthStart) { month.rev += amount; month.cnt += o.quantity; }
    });

    setStats({ today, week, month });
    setTopItems(Object.entries(itemSales).sort((a, b) => b[1] - a[1]).slice(0, 5));
  }

  if (!stats) return <main><p style={{ textAlign: 'center', padding: 40 }}>ກຳລັງໂຫລດ...</p></main>;

  return (
    <main>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="label">ຍອດຂາຍມື້ນີ້</div>
          <div className="value">{stats.today.rev.toLocaleString()} ກີບ</div>
          <div className="sub">{stats.today.cnt} ຈານ</div>
        </div>
        <div className="stat-card">
          <div className="label">ຍອດຂາຍ 7 ວັນຫຼ້າສຸດ</div>
          <div className="value">{stats.week.rev.toLocaleString()} ກີບ</div>
          <div className="sub">{stats.week.cnt} ຈານ</div>
        </div>
        <div className="stat-card">
          <div className="label">ຍອດຂາຍ 30 ວັນຫຼ້າສຸດ</div>
          <div className="value">{stats.month.rev.toLocaleString()} ກີບ</div>
          <div className="sub">{stats.month.cnt} ຈານ</div>
        </div>
      </div>

      <div className="top-items">
        <h2>🔥 ເມນູຂາຍດີ (ອາທິດນີ້)</h2>
        {topItems.length === 0 ? <p>ຍັງບໍ່ມີຂໍ້ມູນ</p> : topItems.map(([name, qty], i) => (
          <div className="top-item-row" key={name}>
            <span>{i + 1}. {name}</span>
            <strong>{qty} ຈານ</strong>
          </div>
        ))}
      </div>
    </main>
  );
}
