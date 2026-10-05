import React, { useEffect, useMemo, useState } from 'react';
import { getOrders, getProducts } from '../../api.js';
import '../../styles/admin-dashboard.css';

const PERIODS = [
  { key: 'today', label: 'ມື້ນີ້' },
  { key: 'week', label: '7 ວັນຫຼ້າສຸດ' },
  { key: 'month', label: '30 ວັນຫຼ້າສຸດ' },
  { key: 'all', label: 'ທັງໝົດ (ຕັ້ງແຕ່ເປີດຮ້ານ)' },
];

const DONUT_COLORS = ['#b8380e', '#f2760c', '#d9a520', '#3C8031', '#2b6cb0', '#8a7c6a'];

const dateStr = (input) =>
  new Date(input).toLocaleDateString('en-CA', { timeZone: 'Asia/Vientiane' });

const daysAgoStr = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dateStr(d);
};

export default function Dashboard() {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [selected, setSelected] = useState('today');

  useEffect(() => {
    getOrders()
      .then((data) => setOrders(Array.isArray(data) ? data : []))
      .catch((e) => console.error(e));
    getProducts()
      .then((data) => setProducts(Array.isArray(data) ? data : []))
      .catch(() => setProducts([]));
  }, []);

  // ຄິດໄລ່ຍອດຂາຍແຍກຕາມຊ່ວງເວລາ
  const stats = useMemo(() => {
    const buckets = {
      today: { revenue: 0, count: 0, itemSales: {} },
      week: { revenue: 0, count: 0, itemSales: {} },
      month: { revenue: 0, count: 0, itemSales: {} },
      all: { revenue: 0, count: 0, itemSales: {} },
    };
    const todayStr = dateStr(new Date());
    const weekStart = daysAgoStr(7);
    const monthStart = daysAgoStr(30);

    orders
      .filter((o) => o.status === 'completed')
      .forEach((o) => {
        const d = dateStr(o.created_at);
        const amount = o.price * o.quantity;
        const addTo = (b) => {
          b.revenue += amount;
          b.count += o.quantity;
          b.itemSales[o.product_name] = (b.itemSales[o.product_name] || 0) + o.quantity;
        };
        if (d === todayStr) addTo(buckets.today);
        if (d >= weekStart) addTo(buckets.week);
        if (d >= monthStart) addTo(buckets.month);
        addTo(buckets.all);
      });
    return buckets;
  }, [orders]);

  const period = PERIODS.find((p) => p.key === selected);
  const stat = stats[selected];

  // ຂໍ້ມູນ donut: 5 ອັນທຳອິດ ທີ່ເຫຼືອລວມເປັນ "ອື່ນໆ"
  const { slices, total, gradient } = useMemo(() => {
    const entries = Object.entries(stat.itemSales).sort((a, b) => b[1] - a[1]);
    const sum = entries.reduce((s, [, q]) => s + q, 0);
    if (sum === 0) return { slices: [], total: 0, gradient: '#f0e0cf' };

    const top = entries.slice(0, 5);
    const restQty = entries.slice(5).reduce((s, [, q]) => s + q, 0);
    const sl = restQty > 0 ? [...top, ['ອື່ນໆ', restQty]] : top;

    let cum = 0;
    const parts = sl.map(([, qty], i) => {
      const start = (cum / sum) * 360;
      cum += qty;
      const end = (cum / sum) * 360;
      return `${DONUT_COLORS[i % DONUT_COLORS.length]} ${start}deg ${end}deg`;
    });
    return { slices: sl, total: sum, gradient: `conic-gradient(${parts.join(', ')})` };
  }, [stat]);

  const topItems = useMemo(
    () => Object.entries(stat.itemSales).sort((a, b) => b[1] - a[1]).slice(0, 5),
    [stat]
  );

  const unsold = useMemo(
    () => products.filter((p) => !stat.itemSales[p.name]),
    [products, stat]
  );

  return (
    <div className="dash-page">
      <div className="dash-box">
        <h2>📊 ປຽບທຽບຍອດຂາຍ (ກົດເລືອກຊ່ວງເວລາ)</h2>

        <div className="dash-period-tabs">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              className={`dash-period-tab${p.key === selected ? ' active' : ''}`}
              onClick={() => setSelected(p.key)}
            >
              <div className="pt-label">{p.label}</div>
              <div className="pt-value">{stats[p.key].revenue.toLocaleString()} ກີບ</div>
            </button>
          ))}
        </div>

        <div className="dash-period-summary">
          <span className="ps-title">{period.label}:</span>
          <span className="ps-value">{stat.revenue.toLocaleString()} ກີບ</span>
          <span className="ps-sub">{stat.count} ຈານ</span>
        </div>

        <div className="dash-donut-wrap">
          <div className="dash-donut" style={{ background: gradient }}>
            <div className="dash-donut-hole">
              {total === 0 ? (
                <>
                  <div className="donut-total">0</div>
                  <div className="donut-sub">ຍັງບໍ່ມີຂໍ້ມູນ</div>
                </>
              ) : (
                <>
                  <div className="donut-total">{total} ຈານ</div>
                  <div className="donut-sub">ລວມທີ່ຂາຍ</div>
                </>
              )}
            </div>
          </div>

          <div className="dash-donut-legend">
            {total === 0 ? (
              <p className="dash-muted">ຍັງບໍ່ມີການຂາຍໃນຊ່ວງນີ້</p>
            ) : (
              slices.map(([name, qty], i) => (
                <div className="dash-legend-row" key={name}>
                  <span
                    className="dash-dot"
                    style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
                  />
                  <span className="dash-legend-name">{name}</span>
                  <span className="dash-legend-qty">{qty} ຈານ</span>
                  <span className="dash-legend-pct">{Math.round((qty / total) * 100)}%</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="dash-box">
        <h2>🔥 ເມນູຂາຍດີ ({period.label})</h2>
        {topItems.length === 0 ? (
          <p className="dash-muted">ຍັງບໍ່ມີຂໍ້ມູນ</p>
        ) : (
          topItems.map(([name, qty], i) => (
            <div className="dash-row" key={name}>
              <span>{i + 1}. {name}</span>
              <strong>{qty} ຈານ</strong>
            </div>
          ))
        )}
      </div>

      <div className="dash-box">
        <h2>🚫 ເມນູທີ່ບໍ່ໄດ້ຂາຍ ({period.label})</h2>
        <div className="dash-hint">
          ອາຫານໃນລາຍການເມນູ ທີ່ບໍ່ມີໃຜສັ່ງເລີຍໃນຊ່ວງນີ້ — ພິຈາລະນາເອົາອອກ ຫຼືປັບປຸງ
        </div>
        {products.length === 0 ? (
          <p className="dash-muted">ຍັງບໍ່ມີຂໍ້ມູນເມນູ</p>
        ) : unsold.length === 0 ? (
          <p className="dash-ok">✅ ທຸກເມນູມີການສັ່ງໃນຊ່ວງນີ້</p>
        ) : (
          unsold.map((p, i) => (
            <div className="dash-row" key={p.id ?? p.name}>
              <span>{i + 1}. {p.name}</span>
              <strong>0 ຈານ</strong>
            </div>
          ))
        )}
      </div>
    </div>
  );
}