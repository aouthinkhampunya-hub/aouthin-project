import React, { useEffect, useState } from 'react';
import { getMenuQR } from '../../api.js';

export default function QrCodePage() {
  const [qrImage, setQrImage] = useState('');
  const [menuUrl, setMenuUrl] = useState('');

  useEffect(() => {
    getMenuQR().then(data => {
      setQrImage(data.qrImage);
      setMenuUrl(data.menuUrl);
    });
  }, []);

  return (
    <div className="qr-page">
      <h2>ສະແກນເພື່ອສັ່ງອາຫານ</h2>
      <div className="qr-box">
        {qrImage && <img src={qrImage} alt="QR Code" width="280" height="280" />}
      </div>
      <p>{menuUrl}</p>
    </div>
  );
}
