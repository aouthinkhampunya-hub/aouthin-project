import React, { useEffect, useState } from 'react';
import { API_BASE, getPaymentQR, uploadOnlineSlip } from '../api.js';
import './online-order.css';

export default function SlipModal({ billId, phone, total, onDone }) {
  const [qrImage, setQrImage] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // ໂຫລດ QR ຮັບເງິນຂອງຮ້ານ
  useEffect(() => {
    getPaymentQR()
      .then((d) => { if (d.qrImage) setQrImage(d.qrImage); })
      .catch(() => {});
  }, []);

  // ສ້າງຮູບຕົວຢ່າງຂອງສະລິບທີ່ເລືອກ
  useEffect(() => {
    if (!file) { setPreview(''); return undefined; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const send = async () => {
    if (!file) return setError('ກະລຸນາແນບຮູບສະລິບກ່ອນ');
    setError('');
    setBusy(true);
    try {
      await uploadOnlineSlip(billId, phone, file);
      onDone();
    } catch (e) {
      setError(e?.error || 'ສົ່ງສະລິບບໍ່ສຳເລັດ ກະລຸນາລອງໃໝ່');
    }
    setBusy(false);
  };

  return (
    <div className="ol-overlay">
      <div className="ol-box">
        <h2>🏦 ໂອນເງິນ</h2>

        <p style={{ textAlign: 'center', margin: '4px 0' }}>
          ຍອດທີ່ຕ້ອງໂອນ: <strong>{total} ກີບ</strong>
        </p>

        {qrImage ? (
          <div style={{ textAlign: 'center' }}>
            <p>ສະແກນ QR ນີ້ເພື່ອໂອນເງິນ</p>
            <img
              src={qrImage.startsWith('http') || qrImage.startsWith('data:') ? qrImage : API_BASE + qrImage}
              alt="QR ໂອນເງິນ"
              style={{ maxWidth: '100%', maxHeight: 280 }}
            />
          </div>
        ) : (
          <p style={{ textAlign: 'center' }}>ຮ້ານຍັງບໍ່ໄດ້ຕັ້ງຄ່າ QR ກະລຸນາຕິດຕໍ່ຮ້ານ</p>
        )}

        <p style={{ marginTop: 16, marginBottom: 6 }}>📎 ໂອນແລ້ວ ກະລຸນາແນບຮູບສະລິບ:</p>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files[0] || null)}
        />

        {preview && (
          <div style={{ textAlign: 'center', marginTop: 10 }}>
            <img src={preview} alt="ຕົວຢ່າງສະລິບ" style={{ maxWidth: '100%', maxHeight: 200 }} />
          </div>
        )}

        {error && <p className="ol-error">⚠️ {error}</p>}

        <div className="ol-actions">
          <button className="ol-cancel" disabled={busy} onClick={onDone}>ສົ່ງພາຍຫຼັງ</button>
          <button className="ol-ok" disabled={busy} onClick={send}>
            {busy ? 'ກຳລັງສົ່ງ...' : 'ສົ່ງສະລິບ'}
          </button>
        </div>
      </div>
    </div>
  );
}