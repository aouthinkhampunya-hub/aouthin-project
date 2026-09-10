import React, { useEffect, useRef, useState } from 'react';
import { getPaymentQR, uploadPaymentQR } from '../../api.js';

export default function Settings() {
  const [qrImage, setQrImage] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const data = await getPaymentQR();
    setQrImage(data.qrImage);
  }

  async function handleUpload() {
    const file = fileRef.current.files[0];
    if (!file) { alert('ກະລຸນາເລືອກຮູບ QR ກ່ອນ'); return; }
    const fd = new FormData();
    fd.append('qr', file);
    try {
      await uploadPaymentQR(fd);
      alert('ບັນທຶກ QR ສຳເລັດ!');
      fileRef.current.value = '';
      load();
    } catch (err) {
      alert('ເກີດຂໍ້ຜິດພາດ: ' + (err.error || ''));
    }
  }

  return (
    <main className="settings-page">
      <div className="settings-card">
        <h2>QR ຮັບເງິນ</h2>
        <div className="qr-preview">
          {qrImage ? <img src={qrImage} alt="QR ຮັບເງິນ" /> : <span>ຍັງບໍ່ມີຮູບ QR</span>}
        </div>
        <input type="file" ref={fileRef} accept="image/*" />
        <button className="upload-btn" onClick={handleUpload}>ບັນທຶກ QR</button>
      </div>
    </main>
  );
}
