import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getPaymentQR, getDeliveryFee, API_BASE } from '../api.js';
import './online-order.css';

// ປ່ຽນເປັນພິກັດຮ້ານຂອງເຈົ້າ (ເປີດ Google Maps ກົດຂວາທີ່ຮ້ານ ຈະເຫັນເລກ lat, lng)
const DEFAULT_CENTER = [17.9757, 102.6331];

const pinIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  shadowSize: [41, 41],
});

// ຫຍໍ້ຮູບສະລິບໃຫ້ນ້ອຍລົງກ່ອນສົ່ງ (ປະຢັດເນັດ ແລະ ພື້ນທີ່)
function compressImage(file, maxSide = 1280, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('image'));
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function OnlineOrderModal({ total, onClose, onSubmit }) {
  const saved = (() => {
    try { return JSON.parse(sessionStorage.getItem('onlineBill') || 'null'); } catch (e) { return null; }
  })();

  const [type, setType] = useState('pickup');
  const [payment, setPayment] = useState('cash'); // cash | transfer
  const [name, setName] = useState(saved?.name || '');
  const [phone, setPhone] = useState(saved?.phone || '');
  const [address, setAddress] = useState('');
  const [hint, setHint] = useState('👆 ກົດເທິງແຜນທີ່ ຫຼື ລາກໝຸດ ເພື່ອເລືອກຈຸດສົ່ງ');
  const [slip, setSlip] = useState('');           // data URL ຂອງສະລິບ
  const [payQr, setPayQr] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // ຄ່າສົ່ງ: status = idle | loading | ok | far | error
  const [feeInfo, setFeeInfo] = useState({ status: 'idle' });

  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const pinRef = useRef(null);
  const fileRef = useRef(null);
  const feeReqRef = useRef(0);

  // ຍອດອາຫານ (ແປງເປັນຕົວເລກສະເໝີ)
  const foodTotal = Number(String(total).replace(/[^\d.]/g, '')) || 0;
  const deliveryFee = type === 'delivery' && feeInfo.status === 'ok' ? feeInfo.fee : 0;
  const grandTotal = foodTotal + deliveryFee;
  const feeBlocked =
    type === 'delivery' && ['loading', 'far', 'error'].includes(feeInfo.status);

  // ຖາມ server ວ່າຄ່າສົ່ງເທົ່າໃດ (ເອີ້ນທຸກຄັ້ງທີ່ປັກ / ລາກໝຸດ)
  const fetchFee = async (lat, lng) => {
    const id = ++feeReqRef.current;
    setFeeInfo({ status: 'loading' });
    try {
      const d = await getDeliveryFee(lat, lng);
      if (id !== feeReqRef.current) return; // ມີຄຳຂໍໃໝ່ກວ່າ ຂ້າມອັນເກົ່າ
      if (d.tooFar) setFeeInfo({ status: 'far', km: d.km, max: d.max_km });
      else setFeeInfo({ status: 'ok', km: d.km, fee: d.fee });
    } catch (e) {
      if (id !== feeReqRef.current) return;
      setFeeInfo({ status: 'error', msg: (e && e.error) || 'ຄິດຄ່າສົ່ງບໍ່ໄດ້ ກະລຸນາລອງໃໝ່' });
    }
  };

  const placePin = (lat, lng, pan) => {
    const map = mapRef.current;
    if (!map) return;
    pinRef.current = { lat, lng };
    if (!markerRef.current) {
      markerRef.current = L.marker([lat, lng], { draggable: true, icon: pinIcon }).addTo(map);
      markerRef.current.on('dragend', () => {
        const p = markerRef.current.getLatLng();
        placePin(p.lat, p.lng, false);
      });
    } else {
      markerRef.current.setLatLng([lat, lng]);
    }
    if (pan) map.setView([lat, lng], 17);
    setHint(`📍 ປັກໝຸດແລ້ວ (${lat.toFixed(5)}, ${lng.toFixed(5)})`);
    fetchFee(lat, lng);
  };

  // ສ້າງແຜນທີ່ເມື່ອເລືອກ "ສົ່ງເຖິງບ້ານ"
  useEffect(() => {
    if (type !== 'delivery' || !mapDivRef.current) return undefined;
    const start = pinRef.current;
    const map = L.map(mapDivRef.current).setView(
      start ? [start.lat, start.lng] : DEFAULT_CENTER,
      start ? 17 : 13
    );
    mapRef.current = map;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);
    map.on('click', (e) => placePin(e.latlng.lat, e.latlng.lng, false));
    if (start) placePin(start.lat, start.lng, false);
    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  // ໂຫລດ QR ຮັບເງິນຂອງຮ້ານ ເມື່ອເລືອກໂອນເງິນ
  useEffect(() => {
    if (payment !== 'transfer' || payQr) return;
    getPaymentQR()
      .then((d) => { if (d?.qrImage) setPayQr(d.qrImage); })
      .catch(() => {});
  }, [payment, payQr]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setHint('⚠️ ເບຣາວເຊີນີ້ບໍ່ຮອງຮັບຕຳແໜ່ງ ກະລຸນາກົດເລືອກເທິງແຜນທີ່');
      return;
    }
    setHint('⏳ ກຳລັງຫາຕຳແໜ່ງຂອງທ່ານ...');
    navigator.geolocation.getCurrentPosition(
      (pos) => placePin(pos.coords.latitude, pos.coords.longitude, true),
      () => setHint('⚠️ ຫາຕຳແໜ່ງບໍ່ໄດ້ ກະລຸນາກົດເລືອກເທິງແຜນທີ່'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const pickSlip = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('ກະລຸນາເລືອກໄຟລ໌ຮູບພາບ');
      return;
    }
    try {
      setSlip(await compressImage(file));
      setError('');
    } catch (err) {
      setError('ອ່ານຮູບບໍ່ໄດ້ ກະລຸນາລອງຮູບອື່ນ');
    }
  };

  const removeSlip = () => {
    setSlip('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const submit = async () => {
    if (!name.trim()) return setError('ກະລຸນາໃສ່ຊື່');
    if (!/^[0-9+\s-]{8,15}$/.test(phone.trim())) return setError('ເບີໂທບໍ່ຖືກຕ້ອງ');
    if (type === 'delivery' && !address.trim()) return setError('ກະລຸນາໃສ່ທີ່ຢູ່ສົ່ງ');
    if (type === 'delivery' && !pinRef.current) return setError('ກະລຸນາປັກໝຸດຈຸດສົ່ງເທິງແຜນທີ່');
    if (type === 'delivery' && feeInfo.status !== 'ok') return setError('ຍັງຄິດຄ່າສົ່ງບໍ່ໄດ້ ກະລຸນາລໍຖ້າ ຫຼື ປັກໝຸດໃໝ່');
    if (payment === 'transfer' && !slip) return setError('ກະລຸນາແນບສະລິບການໂອນເງິນ');
    setError('');
    setBusy(true);
    const msg = await onSubmit({
      order_type: type,
      customer_name: name.trim(),
      customer_phone: phone.trim(),
      address: type === 'delivery' ? address.trim() : '',
      payment_method: payment,
      slip_image: payment === 'transfer' ? slip : null,
      latitude: type === 'delivery' ? pinRef.current.lat : null,
      longitude: type === 'delivery' ? pinRef.current.lng : null,
    });
    setBusy(false);
    if (msg) setError(msg);
  };

  const qrSrc = payQr
    ? (payQr.startsWith('http') || payQr.startsWith('data:') ? payQr : API_BASE + payQr)
    : '';

  // ແຖວຄ່າສົ່ງ (ສະແດງສະເພາະ "ສົ່ງເຖິງບ້ານ")
  const renderFeeRow = () => {
    if (feeInfo.status === 'idle') {
      return <div className="ol-fee-row muted"><span>🛵 ຄ່າສົ່ງ</span><span>ປັກໝຸດເພື່ອຄິດຄ່າສົ່ງ</span></div>;
    }
    if (feeInfo.status === 'loading') {
      return <div className="ol-fee-row muted"><span>🛵 ຄ່າສົ່ງ</span><span>⏳ ກຳລັງຄິດ...</span></div>;
    }
    if (feeInfo.status === 'far') {
      return (
        <div className="ol-fee-row bad">
          <span>🛵 ໄລຍະທາງ {feeInfo.km} ກມ</span>
          <span>ໄກເກີນ {feeInfo.max} ກມ ບໍ່ຮັບສົ່ງ</span>
        </div>
      );
    }
    if (feeInfo.status === 'error') {
      return <div className="ol-fee-row bad"><span>🛵 ຄ່າສົ່ງ</span><span>{feeInfo.msg}</span></div>;
    }
    return (
      <div className="ol-fee-row">
        <span>🛵 ຄ່າສົ່ງ ({feeInfo.km} ກມ)</span>
        <span>{feeInfo.fee.toLocaleString()} ກີບ</span>
      </div>
    );
  };

  return (
    <div className="ol-overlay">
      <div className="ol-box">
        <h2>🛵 ຂໍ້ມູນການສັ່ງອອນລາຍ</h2>

        <div className="ol-types">
          <button
            type="button"
            className={`ol-type${type === 'pickup' ? ' active' : ''}`}
            onClick={() => setType('pickup')}
          >
            🥡 ແກັບ (ມາຮັບເອງ)
          </button>
          <button
            type="button"
            className={`ol-type${type === 'delivery' ? ' active' : ''}`}
            onClick={() => setType('delivery')}
          >
            🛵 ສົ່ງເຖິງບ້ານ
          </button>
        </div>

        <input
          type="text"
          placeholder="ຊື່ຂອງທ່ານ"
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="tel"
          placeholder="ເບີໂທ ເຊັ່ນ 02012345678"
          maxLength={15}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />

        {type === 'delivery' && (
          <div>
            <textarea
              placeholder="ທີ່ຢູ່ສົ່ງ (ບ້ານ, ເມືອງ, ຈຸດສັງເກດ)"
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            <button type="button" className="ol-loc-btn" onClick={useMyLocation}>
              📍 ໃຊ້ຕຳແໜ່ງປັດຈຸບັນຂອງຂ້ອຍ
            </button>
            <div ref={mapDivRef} className="ol-map" />
            <p className="ol-map-hint">{hint}</p>
          </div>
        )}

        <div className="ol-pay">
          <div className="ol-pay-label">ວິທີຊຳລະເງິນ</div>
          <div className="ol-pay-choices">
            <button
              type="button"
              className={`ol-pay-choice${payment === 'cash' ? ' active' : ''}`}
              onClick={() => setPayment('cash')}
            >
              💵 ເງິນສົດ
              <small>{type === 'delivery' ? 'ຈ່າຍຕອນຮັບທີ່ບ້ານ' : 'ຈ່າຍຕອນມາຮັບ'}</small>
            </button>
            <button
              type="button"
              className={`ol-pay-choice${payment === 'transfer' ? ' active' : ''}`}
              onClick={() => setPayment('transfer')}
            >
              🏦 ໂອນເງິນ
              <small>ແນບສະລິບ</small>
            </button>
          </div>

          {payment === 'transfer' && (
            <div className="ol-transfer">
              {qrSrc ? (
                <>
                  <p className="ol-transfer-note">
                    1) ສະແກນ QR ເພື່ອໂອນເງິນ {grandTotal.toLocaleString()} ກີບ
                    {type === 'delivery' && feeInfo.status !== 'ok' && ' (ຍອດຈະລວມຄ່າສົ່ງຫຼັງປັກໝຸດ)'}
                  </p>
                  <img className="ol-qr" src={qrSrc} alt="QR ຮັບເງິນ" />
                </>
              ) : (
                <p className="ol-transfer-note">ຮ້ານຍັງບໍ່ໄດ້ຕັ້ງ QR ຮັບເງິນ ກະລຸນາໂອນຕາມທີ່ຮ້ານແຈ້ງ</p>
              )}

              <p className="ol-transfer-note">2) ແນບສະລິບການໂອນເງິນ</p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={pickSlip}
              />
              {slip && (
                <div className="ol-slip-preview">
                  <img src={slip} alt="ສະລິບ" />
                  <button type="button" onClick={removeSlip}>ລຶບຮູບ</button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="ol-fee-box">
          <div className="ol-fee-row">
            <span>🍽️ ຄ່າອາຫານ</span>
            <span>{foodTotal.toLocaleString()} ກີບ</span>
          </div>
          {type === 'delivery' && renderFeeRow()}
        </div>

        <div className="ol-sum">
          <span>ຍອດລວມ</span>
          <strong>{grandTotal.toLocaleString()} ກີບ</strong>
        </div>

        {error && <p className="ol-error">⚠️ {error}</p>}

        <div className="ol-actions">
          <button className="ol-cancel" onClick={onClose}>ຍົກເລີກ</button>
          <button className="ol-ok" disabled={busy || feeBlocked} onClick={submit}>
            {busy ? 'ກຳລັງສົ່ງ...' : 'ຢືນຢັນສັ່ງອາຫານ'}
          </button>
        </div>
      </div>
    </div>
  );
}