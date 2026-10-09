import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getBillHistory, API_BASE } from '../../api.js';
import '../../styles/admin-orders-history.css';

function statusLabel(status) {
  if (status === 'pending') return 'ລໍຖ້າ';
  if (status === 'cooking') return 'ກຳລັງເຮັດ';
  if (status === 'ready') return '🍽️ ລໍເສີບ';
  if (status === 'completed') return '✅ ເສີບແລ້ວ';
  return status;
}

const billTotal = (bill) =>
  (bill.items || []).reduce((s, i) => s + i.price * i.quantity, 0) + Number(bill.delivery_fee || 0);
const typeOf = (b) => b.order_type || 'dine_in';
const typeLabel = (b) => {
  if (typeOf(b) === 'pickup') return '🥡 ມາຮັບເອງ';
  if (typeOf(b) === 'delivery') return '🛵 ສົ່ງເຖິງບ້ານ';
  return `🍽️ ໂຕະ ${b.table_number}`;
};
const fmt = (v) => (v ? new Date(v).toLocaleString('en-GB', { timeZone: 'Asia/Vientiane' }) : '-');
const isPaid = (b) => b.status === 'paid';

export default function Orders() {
  const [allBills, setAllBills] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await getBillHistory();
        const sorted = [...data].sort((a, b) => b.id - a.id);
        setAllBills(sorted);
        setFiltered(sorted);
      } catch (e) {
        console.error(e);
      }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setDetail(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  function applyFilter() {
    if (!dateFrom && !dateTo) { setFiltered(allBills); return; }
    const from = dateFrom ? new Date(dateFrom + 'T00:00:00+07:00') : null;
    const to = dateTo ? new Date(dateTo + 'T23:59:59+07:00') : null;
    setFiltered(allBills.filter((b) => {
      const created = new Date(b.ordered_at);
      if (from && created < from) return false;
      if (to && created > to) return false;
      return true;
    }));
  }

  function clearFilter() {
    setDateFrom('');
    setDateTo('');
    setFiltered(allBills);
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

      <section className="oh-section">
        {!loaded ? null : filtered.length === 0 ? (
          <p className="oh-empty">ບໍ່ພົບບິນໃນຊ່ວງນີ້</p>
        ) : (
          <div className="oh-table-wrap">
            <table className="oh-table">
              <thead>
                <tr>
                  <th>ລະຫັດບິນ</th>
                  <th>ປະເພດ</th>
                  <th>ລາຍການ</th>
                  <th>ລາຄາລວມ</th>
                  <th>ສະຖານະ</th>
                  <th>ເວລາສັ່ງ</th>
                  <th>ເວລາປິດບິນ</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b.id} onClick={() => setDetail(b)}>
                    <td><b>#{b.id}</b></td>
                    <td>{typeLabel(b)}</td>
                    <td>{b.items.length}</td>
                    <td>{billTotal(b).toLocaleString()} ກີບ</td>
                    <td>
                      <span className={`oh-chip ${isPaid(b) ? 'paid' : 'open'}`}>
                        {isPaid(b) ? '✅ ປິດບິນແລ້ວ' : '🟡 ຍັງເປີດຢູ່'}
                      </span>
                    </td>
                    <td>{fmt(b.ordered_at)}</td>
                    <td>{isPaid(b) ? fmt(b.paid_at) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {detail && createPortal(
        <div className="oh-overlay" onClick={(e) => e.target === e.currentTarget && setDetail(null)}>
          <div className="oh-box">
            <button className="oh-close" onClick={() => setDetail(null)}>✕</button>

            <div className="oh-head">
              <h2>ຮ້ານອາຫານຕາມສັ່ງ AOUTHIN</h2>
              <div className="oh-billno">ບິນ #{detail.id}</div>
              <div className="oh-badges">
                <span className="oh-badge">{typeLabel(detail)}</span>
                <span className={`oh-chip ${isPaid(detail) ? 'paid' : 'open'}`}>
                  {isPaid(detail) ? '✅ ປິດບິນແລ້ວ' : '🟡 ຍັງເປີດຢູ່'}
                </span>
              </div>
            </div>

            <div className="oh-info">
              <div><span>🕒 ເວລາສັ່ງ</span><b>{fmt(detail.ordered_at)}</b></div>
              <div><span>💰 ເວລາປິດບິນ</span><b>{isPaid(detail) ? fmt(detail.paid_at) : '-'}</b></div>
              {typeOf(detail) !== 'dine_in' && (
                <>
                  <div><span>👤 ລູກຄ້າ</span><b>{detail.customer_name}</b></div>
                  <div><span>📞 ເບີໂທ</span><b>{detail.customer_phone}</b></div>
                  {detail.address && <div><span>📍 ທີ່ຢູ່</span><b>{detail.address}</b></div>}
                  <div>
                    <span>ການຊຳລະ</span>
                    <b>{detail.payment_method === 'transfer' ? '🏦 ໂອນເງິນ' : '💵 ເງິນສົດ'}</b>
                  </div>
                </>
              )}
            </div>

            <table className="oh-detail-table">
              <thead>
                <tr><th>ເມນູ</th><th>ຈຳນວນ</th><th>ລາຄາ</th><th>ສະຖານະ</th></tr>
              </thead>
              <tbody>
                {detail.items.map((i) => (
                  <tr key={i.id}>
                    <td>{i.product_name}</td>
                    <td>{i.quantity}</td>
                    <td>{(i.price * i.quantity).toLocaleString()} ກີບ</td>
                    <td>{statusLabel(i.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {Number(detail.delivery_fee) > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '8px 2px',
                  fontWeight: 700,
                }}
              >
                <span>🛵 ຄ່າສົ່ງ ({detail.delivery_distance} ກມ)</span>
                <span>{Number(detail.delivery_fee).toLocaleString()} ກີບ</span>
              </div>
            )}

            <div className="oh-total">
              <span>ຍອດລວມທັງໝົດ</span>
              <span>{billTotal(detail).toLocaleString()} ກີບ</span>
            </div>

            {detail.slip_image && (
              <div className="oh-slip-wrap">
                <p>🧾 ສະລິບການໂອນເງິນ (ກົດເພື່ອຂະຫຍາຍ)</p>
                <a href={API_BASE + detail.slip_image} target="_blank" rel="noreferrer">
                  <img className="oh-slip" src={API_BASE + detail.slip_image} alt="ສະລິບ" />
                </a>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </main>
  );
}