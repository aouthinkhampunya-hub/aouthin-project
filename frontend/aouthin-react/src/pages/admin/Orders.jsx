import React, { useEffect, useState } from 'react';
import { getOrders } from '../../api.js';

function statusLabel(status) {
  if (status === 'pending') return 'ລໍຖ້າ';
  if (status === 'cooking') return 'ກຳລັງເຮັດ';
  if (status === 'ready') return '🍽️ ເຮັດແລ້ວ ລໍເສີບ';
  if (status === 'completed') return '✅ ເສີບແລ້ວ';
  return status;
}

export default function Orders() {
  const [allOrders, setAllOrders] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await getOrders();
        // ລຽງຈາກໃໝ່ສຸດ ໄປເກົ່າສຸດ (ຄືກັບ backend)
        const sorted = [...data].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setAllOrders(sorted);
        setFiltered(sorted);
      } catch (e) {
        console.error(e);
      }
      setLoaded(true);
    })();
  }, []);

  function applyFilter() {
    if (!dateFrom && !dateTo) { setFiltered(allOrders); return; }
    const from = dateFrom ? new Date(dateFrom + 'T00:00:00+07:00') : null;
    const to = dateTo ? new Date(dateTo + 'T23:59:59+07:00') : null;
    setFiltered(allOrders.filter((o) => {
      const created = new Date(o.created_at);
      if (from && created < from) return false;
      if (to && created > to) return false;
      return true;
    }));
  }

  function clearFilter() {
    setDateFrom('');
    setDateTo('');
    setFiltered(allOrders);
  }

  return (
    <main>
      <div className="date-filter-bar">
        <div className="date-field">
          <label>ຈາກວັນທີ</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="date-field">
          <label>ຫາວັນທີ</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <button className="filter-btn" onClick={applyFilter}>ກວດສອບ</button>
        <button className="clear-btn" onClick={clearFilter}>ລ້າງ</button>
      </div>

      <section id="order-list">
        {!loaded ? null : filtered.length === 0 ? (
          <p>ບໍ່ພົບຄຳສັ່ງອາຫານໃນຊ່ວງນີ້</p>
        ) : (
          <table>
            <tbody>
              <tr>
                <th>ລະຫັດ</th><th>ເມນູ</th><th>ຈຳນວນ</th><th>ລາຄາລວມ</th><th>ສະຖານະ</th><th>ເວລາສັ່ງ</th>
              </tr>
              {filtered.map((o, index) => (
                <tr key={o.id}>
                  <td>{index + 1}</td>
                  <td>{o.product_name}</td>
                  <td>{o.quantity}</td>
                  <td>{o.price * o.quantity} ກີບ</td>
                  <td>{statusLabel(o.status)}</td>
                  <td className="time-column">
                    {new Date(o.created_at).toLocaleString('en-GB', { timeZone: 'Asia/Vientiane' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}