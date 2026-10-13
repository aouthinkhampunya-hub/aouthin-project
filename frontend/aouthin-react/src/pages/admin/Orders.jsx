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
// ເລກບິນທີ່ສະແດງ: ໃຊ້ bill_no (ແຍກຕາມແຖບ) ຖ້າບໍ່ມີ ໃຊ້ id ແທນ
const billNo = (b) => (b.bill_no ? b.bill_no : b.id);
const fmt = (v) => (v ? new Date(v).toLocaleString('en-GB', { timeZone: 'Asia/Vientiane' }) : '-');
const isPaid = (b) => b.status === 'paid';

export default function Orders() {
  const [allBills, setAllBills] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  // ຊ່ວງວັນທີທີ່ກົດ "ກວດສອບ" ແລ້ວ (ແຍກຈາກຊ່ອງພິມ)
  const [applied, setApplied] = useState({ from: '', to: '' });
  const [tab, setTab] = useState('dine_in');      // dine_in | online
  const [onlineSub, setOnlineSub] = useState('all'); // all | pickup | delivery
  const [detail, setDetail] = useState(null);
  const [zoomSrc, setZoomSrc] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await getBillHistory();
        setAllBills([...data].sort((a, b) => b.id - a.id));
      } catch (e) {
        console.error(e);
      }
      setLoaded(true);
    })();
  }, []);

  // Esc: ປິດຮູບຂະຫຍາຍກ່ອນ ຖ້າບໍ່ມີຮູບຈຶ່ງປິດປັອບອັບບິນ
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (zoomSrc) setZoomSrc(null);
      else setDetail(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [zoomSrc]);

  function applyFilter() {
    setApplied({ from: dateFrom, to: dateTo });
  }

  function clearFilter() {
    setDateFrom('');
    setDateTo('');
    setApplied({ from: '', to: '' });
  }

  // ກອງຕາມວັນທີ
  const inRange = (b) => {
    const from = applied.from ? new Date(applied.from + 'T00:00:00+07:00') : null;
    const to = applied.to ? new Date(applied.to + 'T23:59:59+07:00') : null;
    const created = new Date(b.ordered_at);
    if (from && created < from) return false;
    if (to && created > to) return false;
    return true;
  };
  const dated = allBills.filter(inRange);

  const dineBills = dated.filter((b) => typeOf(b) === 'dine_in');
  const onlineAll = dated.filter((b) => typeOf(b) !== 'dine_in');
  const pickupBills = onlineAll.filter((b) => typeOf(b) === 'pickup');
  const deliveryBills = onlineAll.filter((b) => typeOf(b) === 'delivery');

  let filtered = dineBills;
  if (tab === 'online') {
    filtered =
      onlineSub === 'pickup' ? pickupBills :
      onlineSub === 'delivery' ? deliveryBills :
      onlineAll;
  }

  const isOnlineTab = tab === 'online';

  return (
    <main>
      <style>{`
        body.is-admin .oh-tabs {
          display: flex;
          gap: 10px;
          margin: 0 0 14px;
          flex-wrap: wrap;
        }
        body.is-admin .oh-tab {
          flex: 1 1 200px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 13px 16px;
          border: 2px solid #e8d5c4;
          border-radius: 14px;
          background: #fff;
          color: #7a1f0f;
          font-size: 16px;
          font-weight: 800;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
        }
        body.is-admin .oh-tab:hover { border-color: #b8380e; }
        body.is-admin .oh-tab.active {
          background: #7a1f0f;
          border-color: #7a1f0f;
          color: #fff;
        }
        body.is-admin .oh-tab-count {
          min-width: 26px;
          padding: 2px 8px;
          border-radius: 999px;
          background: #f3ece4;
          color: #7a1f0f;
          font-size: 13px;
          font-weight: 800;
          text-align: center;
        }
        body.is-admin .oh-tab.active .oh-tab-count {
          background: #ffc93c;
          color: #2b1b0e;
        }
        body.is-admin .oh-subtabs {
          display: flex;
          gap: 8px;
          margin: 0 0 14px;
          flex-wrap: wrap;
        }
        body.is-admin .oh-subtab {
          padding: 8px 16px;
          border: 1.5px solid #e8d5c4;
          border-radius: 999px;
          background: #fff;
          color: #7a1f0f;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
        }
        body.is-admin .oh-subtab.active {
          background: #fff3cd;
          border-color: #e0a800;
        }
        body.is-admin .oh-slip-trigger {
          display: block;
          margin: 0 auto;
          padding: 0;
          border: none;
          background: none;
          cursor: zoom-in;
        }
        body.is-admin .oh-lightbox {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          z-index: 11000;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 14px;
          padding: 24px 16px;
          background: rgba(10, 6, 3, 0.88);
          animation: ohLbFade 0.18s ease;
        }
        body.is-admin .oh-lightbox-img {
          max-width: 100%;
          max-height: calc(100vh - 120px);
          object-fit: contain;
          border-radius: 12px;
          background: #fff;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
        }
        body.is-admin .oh-lightbox-close {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 44px;
          height: 44px;
          border: none;
          border-radius: 50%;
          background: #fff;
          color: #c0392b;
          font-size: 22px;
          font-weight: 800;
          line-height: 1;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
          transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease;
        }
        body.is-admin .oh-lightbox-close:hover {
          background: #c0392b;
          color: #fff;
          transform: scale(1.08);
        }
        body.is-admin .oh-lightbox-open {
          padding: 9px 18px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.15);
          color: #fff;
          font-size: 13px;
          font-weight: 700;
          text-decoration: none;
          border: 1px solid rgba(255, 255, 255, 0.35);
        }
        body.is-admin .oh-lightbox-open:hover {
          background: rgba(255, 255, 255, 0.28);
        }
        @keyframes ohLbFade { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

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

      {/* ===== 2 ແຖບ: ໜ້າໂຕະ / ອອນລາຍ ===== */}
      <div className="oh-tabs">
        <button
          type="button"
          className={`oh-tab${tab === 'dine_in' ? ' active' : ''}`}
          onClick={() => setTab('dine_in')}
        >
          🍽️ ສັ່ງໜ້າໂຕະ
          <span className="oh-tab-count">{dineBills.length}</span>
        </button>
        <button
          type="button"
          className={`oh-tab${tab === 'online' ? ' active' : ''}`}
          onClick={() => setTab('online')}
        >
          🛵 ສັ່ງອອນລາຍ
          <span className="oh-tab-count">{onlineAll.length}</span>
        </button>
      </div>

      {isOnlineTab && (
        <div className="oh-subtabs">
          <button
            type="button"
            className={`oh-subtab${onlineSub === 'all' ? ' active' : ''}`}
            onClick={() => setOnlineSub('all')}
          >
            ທັງໝົດ ({onlineAll.length})
          </button>
          <button
            type="button"
            className={`oh-subtab${onlineSub === 'pickup' ? ' active' : ''}`}
            onClick={() => setOnlineSub('pickup')}
          >
            🥡 ມາຮັບເອງ ({pickupBills.length})
          </button>
          <button
            type="button"
            className={`oh-subtab${onlineSub === 'delivery' ? ' active' : ''}`}
            onClick={() => setOnlineSub('delivery')}
          >
            🛵 ສົ່ງເຖິງບ້ານ ({deliveryBills.length})
          </button>
        </div>
      )}

      <section className="oh-section">
        {!loaded ? null : filtered.length === 0 ? (
          <p className="oh-empty">ບໍ່ພົບບິນໃນຊ່ວງນີ້</p>
        ) : (
          <div className="oh-table-wrap">
            <table className="oh-table">
              <thead>
                <tr>
                  <th>ເລກບິນ</th>
                  <th>{isOnlineTab ? 'ປະເພດ' : 'ໂຕະ'}</th>
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
                    <td><b>#{billNo(b)}</b></td>
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
              <div className="oh-billno">ບິນ #{billNo(detail)}</div>
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
                <button
                  type="button"
                  className="oh-slip-trigger"
                  onClick={() => setZoomSrc(API_BASE + detail.slip_image)}
                >
                  <img className="oh-slip" src={API_BASE + detail.slip_image} alt="ສະລິບ" />
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* ===== ຮູບສະລິບຂະຫຍາຍ (ປິດໄດ້ດ້ວຍ ✕ / ກົດພື້ນມືດ / Esc) ===== */}
      {zoomSrc && createPortal(
        <div
          className="oh-lightbox"
          onClick={(e) => e.target === e.currentTarget && setZoomSrc(null)}
        >
          <button
            type="button"
            className="oh-lightbox-close"
            aria-label="ປິດຮູບ"
            onClick={() => setZoomSrc(null)}
          >
            ✕
          </button>
          <img className="oh-lightbox-img" src={zoomSrc} alt="ສະລິບການໂອນເງິນ" />
          <a className="oh-lightbox-open" href={zoomSrc} target="_blank" rel="noreferrer">
            ເປີດໃນແທັບໃໝ່
          </a>
        </div>,
        document.body
      )}
    </main>
  );
}