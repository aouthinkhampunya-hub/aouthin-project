import React, { useEffect, useRef, useState } from 'react';
import { getMenuQR, getTableQRs, getPaymentQR, uploadPaymentQR } from '../../api.js';
import '../../styles/admin-qrcode.css';

export default function QrCodePage() {
  const [qrImage, setQrImage] = useState('');
  const [menuUrl, setMenuUrl] = useState('');
  const [tables, setTables] = useState(null);       // null = ກຳລັງສ້າງ, [] ຫຼື array
  const [tablesError, setTablesError] = useState(false);

  // popup QR ຈ່າຍເງິນ
  const [payOpen, setPayOpen] = useState(false);
  const [payImage, setPayImage] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    getMenuQR()
      .then((data) => { setQrImage(data.qrImage); setMenuUrl(data.menuUrl); })
      .catch((e) => console.error(e));
    getTableQRs()
      .then((data) => setTables(data.tables))
      .catch(() => setTablesError(true));
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setPayOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const loadPayQR = async () => {
    try {
      const data = await getPaymentQR();
      setPayImage(data.qrImage || null);
    } catch (e) {
      setPayImage(null);
    }
  };
  const openPayModal = () => { setPayOpen(true); loadPayQR(); };

  const uploadPayQR = async () => {
    const file = fileRef.current?.files[0];
    if (!file) { alert('ກະລຸນາເລືອກຮູບ QR ກ່ອນ'); return; }
    const fd = new FormData();
    fd.append('qr', file);
    try {
      await uploadPaymentQR(fd);
      alert('ບັນທຶກ QR ສຳເລັດ!');
      fileRef.current.value = '';
      loadPayQR();
    } catch (e) {
      alert('ເກີດຂໍ້ຜິດພາດ: ' + (e?.error || ''));
    }
  };

  return (
    <>
      <div className="qr-page">
        <button className="confirm-btn" style={{ marginBottom: 10 }} onClick={openPayModal}>
          ➕ ໄປທີ່ QR ຈ່າຍເງິນ
        </button>
        <h2>ສະແກນເພື່ອສັ່ງອາຫານ</h2>
        <div className="qr-box">
          {qrImage && <img src={qrImage} alt="QR Code" width="280" height="280" />}
        </div>
        <p>{menuUrl}</p>

        <div className="table-qr-section">
          <h2>📋 QR ແຍກຕາມໂຕະ (1-20)</h2>
          <div className="table-qr-grid">
            {tablesError ? (
              <p style={{ gridColumn: '1 / -1' }}>ສ້າງ QR ບໍ່ສຳເລັດ ລອງໂຫລດໜ້ານີ້ໃໝ່</p>
            ) : tables === null ? (
              <p style={{ gridColumn: '1 / -1' }}>ກຳລັງສ້າງ QR...</p>
            ) : (
              tables.map((t) => (
                <div className="table-qr-card" key={t.table}>
                  <img src={t.qrImage} alt={`QR ໂຕະ ${t.table}`} />
                  <div className="tq-label">ໂຕະ {t.table}</div>
                </div>
              ))
            )}
          </div>
          <button className="table-qr-print-btn" onClick={() => window.print()}>🖨️ ພິມ QR ທັງໝົດ</button>
        </div>
      </div>

      {payOpen && (
        <div className="pay-modal-overlay" onClick={(e) => e.target === e.currentTarget && setPayOpen(false)}>
          <div className="pay-modal-box">
            <button className="pay-modal-close" onClick={() => setPayOpen(false)}>×</button>
            <h3>QR ຮັບເງິນ</h3>
            <div className="pay-qr-preview">
              {payImage ? <img src={payImage} alt="QR ຮັບເງິນ" /> : <span>ຍັງບໍ່ມີຮູບ QR</span>}
            </div>
            <input type="file" accept="image/*" ref={fileRef} />
            <button className="pay-upload-btn" onClick={uploadPayQR}>ບັນທຶກ QR</button>
          </div>
        </div>
      )}
    </>
  );
}