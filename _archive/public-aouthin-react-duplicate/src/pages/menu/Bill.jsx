import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBills, cancelOrder } from '../../api.js';

function statusLabel(status) {
  if (status === 'pending') return '⏳ ລໍຖ້າ';
  if (status === 'cooking') return '🔥 ກຳລັງເຮັດ';
  if (status === 'completed') return '✅ ພ້ອມແລ້ວ';
  return status;
}

export default function CustomerBill() {
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const tableNumber = params.get('table') || sessionStorage.getItem('tableNumber');

  const [myBill, setMyBill] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [cancelSuccess, setCancelSuccess] = useState(false);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  async function load() {
    const bills = await getBills();
    const bill = bills.find(b => String(b.table_number) === String(tableNumber));
    setMyBill(bill || null);
  }

  async function doCancel() {
    if (!confirmId) return;
    const res = await fetch(`/api/orders/${confirmId}`, { method: 'DELETE' }).then(r => r.json());
    setConfirmId(null);
    if (res.success) {
      setCancelSuccess(true);
      load();
    } else {
      alert('ຍົກເລີກບໍ່ໄດ້: ' + res.error);
    }
  }

  const items = myBill?.items || [];
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);

  return (
    <div>
      <header>
        <h1>ບິນຂອງທ່ານ</h1>
        <p id="table-label">ໂຕະ {tableNumber}</p>
      </header>

      <main className="bill-page">
        <div id="bill-content">
          {items.length === 0 ? <p>ຍັງບໍ່ມີການສັ່ງອາຫານ</p> : (
            <>
              <table className="bill-table">
                <tbody>
                  <tr><th>ເມນູ</th><th>ຈຳນວນ</th><th>ລາຄາ</th><th>ສະຖານະ</th><th></th></tr>
                  {items.map(i => (
                    <tr key={i.id}>
                      <td>{i.product_name}</td>
                      <td>{i.quantity}</td>
                      <td>{i.price * i.quantity} ກີບ</td>
                      <td>{statusLabel(i.status)}</td>
                      <td>{i.status === 'pending' &&
                        <button className="cancel-order-btn" onClick={() => setConfirmId(i.id)}>ຍົກເລີກ</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="cart-total">ລວມທັງໝົດ: {total} ກີບ</p>
            </>
          )}
        </div>

        <a className="back-link" onClick={() => navigate(`/menu?table=${tableNumber}`)}>
          <svg className="arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          ກັບ
        </a>
      </main>

      {confirmId && (
        <div id="cancel-confirm-overlay">
          <div className="confirm-box">
            <div className="icon-circle">🗑️</div>
            <h3>ຍົກເລີກອໍເດີ້</h3>
            <p>ຢືນຢັນວ່າຈະຍົກເລີກລາຍການອາຫານນີ້?</p>
            <div className="confirm-actions">
              <button className="confirm-cancel-red" onClick={() => setConfirmId(null)}>ຍົກເລີກ</button>
              <button className="confirm-yes" onClick={doCancel}>ຢືນຢັນ</button>
            </div>
          </div>
        </div>
      )}

      {cancelSuccess && (
        <div id="cancel-success-overlay">
          <div className="success-box">
            <div className="success-icon">🍽️</div>
            <h2>ຍົກເລີກອໍເດີສຳເລັດ!</h2>
            <p>ລາຍການອາຫານຖືກຍົກເລີກແລ້ວ</p>
            <button className="success-btn" onClick={() => setCancelSuccess(false)}>ຕົກລົງ</button>
          </div>
        </div>
      )}
    </div>
  );
}
