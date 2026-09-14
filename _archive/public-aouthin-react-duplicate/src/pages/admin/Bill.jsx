import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBills, getPaymentQR, closeBill } from '../../api.js';

export default function AdminBill() {
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const billId = params.get('bill');

  const [bill, setBill] = useState(null);
  const [qrImage, setQrImage] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const [bills, qrData] = await Promise.all([getBills(), getPaymentQR()]);
    const b = bills.find(x => String(x.id) === String(billId));
    setQrImage(qrData.qrImage);
    if (!b) { setNotFound(true); return; }
    setBill(b);
  }

  async function handleConfirm() {
    await closeBill(billId);
    navigate('/admin/tables');
  }

  if (notFound) return <main className="bill-page"><p style={{ textAlign: 'center', padding: 40 }}>ບໍ່ພົບໃບບິນນີ້ (ອາດຈະຈ່າຍໄປແລ້ວ)</p></main>;
  if (!bill) return <main className="bill-page"><p style={{ textAlign: 'center', padding: 40 }}>ກຳລັງໂຫລດ...</p></main>;

  const total = bill.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const now = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Vientiane' });

  return (
    <main className="bill-page">
      <div className="receipt">
        <div className="receipt-header">
          <h2>ຮ້ານອາຫານຕາມສັ່ງ AOUTHIN</h2>
          <p>ໂຕະ {bill.table_number} &nbsp;•&nbsp; {now}</p>
        </div>

        <table className="receipt-table">
          <tbody>
            <tr><th>ເມນູ</th><th>ຈຳນວນ</th><th>ລາຄາ</th></tr>
            {bill.items.map(i => (
              <tr key={i.id}>
                <td>{i.product_name}</td>
                <td>{i.quantity}</td>
                <td>{i.price * i.quantity} ກີບ</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="receipt-total">
          <span>ຍອດລວມທັງໝົດ</span>
          <span>{total} ກີບ</span>
        </div>

        <div className="qr-section">
          {qrImage ? (
            <>
              <p>ສະແກນ QR ນີ້ເພື່ອຊຳລະເງິນ</p>
              <img src={qrImage} alt="QR ຮັບເງິນ" />
            </>
          ) : <p>ຍັງບໍ່ໄດ້ຕັ້ງຄ່າ QR ຮັບເງິນ (ໄປທີ່ໜ້າຕັ້ງຄ່າ)</p>}
        </div>

        <div className="bill-actions">
          <button className="btn-print" onClick={() => window.print()}>🖨️ ພິມບິນ</button>
          <button className="btn-confirm" onClick={() => setConfirmOpen(true)}>🧾 ກວດສອບບິນ</button>
        </div>
      </div>

      {confirmOpen && (
        <div id="confirm-overlay">
          <div className="confirm-box">
            <div className="icon-circle">💰</div>
            <h3>ຢືນຢັນຮັບເງິນ</h3>
            <p>ໂຕະນີ້ຈ່າຍເງິນຄົບຖ້ວນແລ້ວແທ້ບໍ່?<br />ການດຳເນີນການນີ້ຈະປິດບິນ</p>
            <div className="confirm-actions">
              <button className="confirm-no" onClick={() => setConfirmOpen(false)}>ຍົກເລີກ</button>
              <button className="confirm-yes" onClick={handleConfirm}>✓ ຢືນຢັນ</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
