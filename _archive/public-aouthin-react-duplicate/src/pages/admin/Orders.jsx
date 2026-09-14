import React, { useEffect, useState } from 'react';
import { getOrders, updateOrderStatus } from '../../api.js';

function statusLabel(status) {
  if (status === 'pending') return 'ກຳລັງເຮັດ';
  if (status === 'completed') return 'ເສີບແລ້ວ';
  return status;
}

export default function Orders() {
  const [allOrders, setAllOrders] = useState([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filtered, setFiltered] = useState([]);

  useEffect(() => { load(); }, []);

  async function load() {
    const data = await getOrders();
    setAllOrders(data);
    setFiltered(data);
  }

  function applyFilter() {
    if (!dateFrom && !dateTo) { setFiltered(allOrders); return; }
    const from = dateFrom ? new Date(dateFrom + 'T00:00:00+07:00') : null;
    const to = dateTo ? new Date(dateTo + 'T23:59:59+07:00') : null;
    setFiltered(allOrders.filter(o => {
      const c = new Date(o.created_at);
      if (from && c < from) return false;
      if (to && c > to) return false;
      return true;
    }));
  }

  function clearFilter() {
    setDateFrom(''); setDateTo(''); setFiltered(allOrders);
  }

  async function completeOrder(id) {
    await updateOrderStatus(id, 'completed');
    load();
  }

  return (
    <main>
      <div className="date-filter-bar">
        <div className="date-field">
          <label>ຈາກວັນທີ</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div className="date-field">
          <label>ຫາວັນທີ</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <button className="filter-btn" onClick={applyFilter}>ກວດສອບ</button>
        <button className="clear-btn" onClick={clearFilter}>ລ້າງ</button>
      </div>

      {filtered.length === 0 ? <p>ຍັງບໍ່ມີຄຳສັ່ງອາຫານ</p> : (
        <table>
          <tbody>
            <tr><th>ລະຫັດ</th><th>ເມນູ</th><th>ຈຳນວນ</th><th>ລາຄາລວມ</th><th>ສະຖານະ</th><th>ເວລາສັ່ງ</th><th></th></tr>
            {filtered.map(o => (
              <tr key={o.id}>
                <td>{o.id}</td>
                <td>{o.product_name}</td>
                <td>{o.quantity}</td>
                <td>{o.price * o.quantity} ກີບ</td>
                <td>{statusLabel(o.status)}</td>
                <td>{new Date(o.created_at).toLocaleString('en-GB', { timeZone: 'Asia/Vientiane' })}</td>
                <td>{o.status === 'pending' &&
                  <button className="delete-btn" onClick={() => completeOrder(o.id)}>ເສີບແລ້ວ</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
