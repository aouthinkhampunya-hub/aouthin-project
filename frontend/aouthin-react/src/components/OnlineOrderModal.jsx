import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getPaymentQR, getAmountQR, getDeliveryFee, API_BASE } from '../api.js';
import './online-order.css';

// ຈຸດເລີ່ມຕົ້ນຂອງແຜນທີ່ ຖ້າດຶງພິກັດຮ້ານຈາກ server ບໍ່ໄດ້ (ປົກກະຕິຈະໃຊ້ພິກັດຮ້ານທີ່ແອດມິນປັກໄວ້)
const DEFAULT_CENTER = [17.9757, 102.6331];

// ເບີໂທລາວ: 020 + ເລກ 8 ໂຕ = 11 ໂຕ ພໍດີ
const PHONE_LEN = 11;
const PHONE_REGEX = /^020\d{8}$/;

const pinIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  shadowSize: [41, 41],
});

// ໝຸດຮ້ານ (ສີສົ້ມ + ຕົວໜັງສື "ຮ້ານ") ແຍກຈາກໝຸດຈຸດສົ່ງຂອງລູກຄ້າ
const shopIcon = L.divIcon({
  className: 'ol-shop-pin-wrap',
  html: '<div class="ol-shop-pin"><span class="ol-shop-pin-icon">🏪</span><span class="ol-shop-pin-text">ຮ້ານ</span></div>',
  iconSize: [64, 44],
  iconAnchor: [32, 44],
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
  // ເອົາສະເພາະຕົວເລກ ແລະ ຕັດໃຫ້ເຫຼືອບໍ່ເກີນ 11 ໂຕ (ກັນກໍລະນີເບີເກົ່າທີ່ເກັບໄວ້ຍາວເກີນ)
  const [phone, setPhone] = useState(String(saved?.phone || '').replace(/\D/g, '').slice(0, PHONE_LEN));
  const [address, setAddress] = useState('');
  const [hint, setHint] = useState('👆 ກົດເທິງແຜນທີ່ ຫຼື ລາກໝຸດ ເພື່ອເລືອກຈຸດສົ່ງ');
  const [slip, setSlip] = useState('');           // data URL ຂອງສະລິບ
  const [payQr, setPayQr] = useState('');
  const [amountQr, setAmountQr] = useState('');   // QR ທີ່ມີຈຳນວນເງິນຢູ່ໃນ QR ແລ້ວ
  const [amountQrStatus, setAmountQrStatus] = useState('loading'); // loading | ok | error
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // ຄ່າສົ່ງ: status = idle | loading | ok | far | error
  const [feeInfo, setFeeInfo] = useState({ status: 'idle' });
  // ພິກັດຮ້ານ (ດຶງຈາກ server) ເພື່ອສະແດງໝຸດຮ້ານເທິງແຜນທີ່
  const [shop, setShop] = useState(null);

  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const shopMarkerRef = useRef(null);
  const shopRef = useRef(null);
  const pinRef = useRef(null);
  const fileRef = useRef(null);
  const feeReqRef = useRef(0);
  const amountQrCache = useRef({}); // ຈື່ QR ຕາມຈຳນວນເງິນ ເພື່ອສະແດງທັນທີເມື່ອກັບມາຍອດເກົ່າ

  // ຍອດອາຫານ (ແປງເປັນຕົວເລກສະເໝີ)
  const foodTotal = Number(String(total).replace(/[^\d.]/g, '')) || 0;
  const deliveryFee = type === 'delivery' && feeInfo.status === 'ok' ? feeInfo.fee : 0;
  const grandTotal = foodTotal + deliveryFee;
  const feeBlocked =
    type === 'delivery' && ['loading', 'far', 'error'].includes(feeInfo.status);

  // ດຶງພິກັດຮ້ານຈາກ server ຕອນເປີດຟອມ
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/settings/location`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        const lat = Number(d.lat);
        const lng = Number(d.lng);
        // ຖ້າແອດມິນຍັງບໍ່ໄດ້ປັກໝຸດຮ້ານ (isDefault) ບໍ່ສະແດງໝຸດ ເພາະບໍ່ແມ່ນຕຳແໜ່ງຈິງ
        if (Number.isFinite(lat) && Number.isFinite(lng) && !d.isDefault) {
          shopRef.current = { lat, lng };
          setShop({ lat, lng });
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

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
    const shopPos = shopRef.current;

    let center = DEFAULT_CENTER;
    let zoom = 13;
    if (start) {
      center = [start.lat, start.lng];
      zoom = 17;
    } else if (shopPos) {
      center = [shopPos.lat, shopPos.lng];
      zoom = 15;
    }

    const map = L.map(mapDivRef.current).setView(center, zoom);
    mapRef.current = map;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);
    map.on('click', (e) => placePin(e.latlng.lat, e.latlng.lng, false));
    if (start) placePin(start.lat, start.lng, false);
    setTimeout(() => map.invalidateSize(), 100);
    const onResize = () => map.invalidateSize();
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      shopMarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  // ໃສ່ໝຸດຮ້ານເທິງແຜນທີ່ (ຕ້ອງຢູ່ຕໍ່ຈາກ effect ສ້າງແຜນທີ່ ເພື່ອໃຫ້ຖືກຣັນຫຼັງ)
  useEffect(() => {
    const map = mapRef.current;
    if (type !== 'delivery' || !map || !shop) return;

    if (shopMarkerRef.current) {
      shopMarkerRef.current.remove();
      shopMarkerRef.current = null;
    }
    // interactive: false ເພື່ອໃຫ້ກົດທະລຸໝຸດຮ້ານໄປປັກຈຸດສົ່ງໄດ້
    shopMarkerRef.current = L.marker([shop.lat, shop.lng], {
      icon: shopIcon,
      interactive: false,
      keyboard: false,
      zIndexOffset: 1000,
    }).addTo(map);

    // ຖ້າລູກຄ້າຍັງບໍ່ໄດ້ປັກຈຸດສົ່ງ ໃຫ້ຍ້າຍແຜນທີ່ມາຢູ່ບ່ອນຮ້ານ
    if (!pinRef.current) map.setView([shop.lat, shop.lng], 15);
  }, [type, shop]);

  // ໂຫລດ QR ຮັບເງິນຂອງຮ້ານ ເມື່ອເລືອກໂອນເງິນ
  useEffect(() => {
    if (payment !== 'transfer' || payQr) return;
    getPaymentQR()
      .then((d) => { if (d?.qrImage) setPayQr(d.qrImage); })
      .catch(() => {});
  }, [payment, payQr]);

  // ສ້າງ QR ທີ່ມີຈຳນວນເງິນຢູ່ໃນ QR (ສະແກນແລ້ວຈຳນວນເງິນຂຶ້ນເອງ) ເມື່ອຍອດລວມປ່ຽນ
  // ສົ່ງເຖິງບ້ານ: ຕ້ອງຄິດຄ່າສົ່ງໄດ້ກ່ອນ ຈຶ່ງຈະສ້າງ (ກັນໂອນຂາດຄ່າສົ່ງ)
  const qrReady = type === 'pickup' || feeInfo.status === 'ok';
  // ໂຫຼດລ່ວງໜ້າທັນທີທີ່ຮູ້ຍອດ (ກ່ອນລູກຄ້າກົດ "ໂອນເງິນ") ເພື່ອໃຫ້ QR ໃໝ່ຂຶ້ນທັນທີ ບໍ່ກະພິບ
  useEffect(() => {
    if (!qrReady || grandTotal < 1) return undefined;

    const cached = amountQrCache.current[grandTotal];
    if (cached) {
      setAmountQr(cached);
      setAmountQrStatus('ok');
      return undefined;
    }

    // ຍອດປ່ຽນ: ເອົາ QR ເກົ່າອອກທັນທີ (ກັນລູກຄ້າສະແກນຍອດເກົ່າ)
    setAmountQr('');
    setAmountQrStatus('loading');
    let cancelled = false;
    getAmountQR(grandTotal)
      .then((d) => {
        if (cancelled) return;
        if (d?.qrImage) {
          amountQrCache.current[grandTotal] = d.qrImage;
          setAmountQr(d.qrImage);
          setAmountQrStatus('ok');
        } else {
          setAmountQrStatus('error');
        }
      })
      .catch(() => { if (!cancelled) setAmountQrStatus('error'); });
    return () => { cancelled = true; };
  }, [qrReady, grandTotal]);

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
    if (!PHONE_REGEX.test(phone.trim())) {
      return setError('ເບີໂທບໍ່ຖືກຕ້ອງ ຕ້ອງຂຶ້ນຕົ້ນດ້ວຍ 020 ຕາມດ້ວຍເລກ 8 ໂຕ (ລວມ 11 ໂຕ)');
    }
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

  // ສະໄຕລ໌ປຸ່ມ "+ ສະລິບການໂອນ" (ຂອບປະ ສີຄີມ)
  const slipBtnStyle = {
    display: 'block',
    width: '100%',
    padding: '16px 14px',
    border: '2px dashed #c9a98a',
    borderRadius: 14,
    background: '#f8eee2',
    color: '#7a1f0f',
    fontSize: 16,
    fontWeight: 800,
    textAlign: 'center',
    cursor: 'pointer',
    fontFamily: 'inherit',
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

  // ສະຖານະເບີໂທ: ເຕືອນເມື່ອພິມແລ້ວແຕ່ຍັງບໍ່ຖືກ
  const phoneOk = PHONE_REGEX.test(phone);
  const phoneBad = phone.length > 0 && !phoneOk;
  let phoneNote = '';
  if (phone.length > 0) {
    if (phone.length >= 3 && !phone.startsWith('020')) phoneNote = 'ເບີຕ້ອງຂຶ້ນຕົ້ນດ້ວຍ 020';
    else if (!phoneOk) phoneNote = `ໃສ່ແລ້ວ ${phone.length}/${PHONE_LEN} ໂຕ (020 + ເລກ 8 ໂຕ)`;
  }

  return (
    <div className="ol-overlay">
      {/* ຊ່ອນແຖບເລື່ອນຂອງກ່ອງຟອມ (ຍັງເລື່ອນດ້ວຍນິ້ວ/ລໍ້ເມົ້າໄດ້) */}
      <style>{`
        .ol-box {
          scrollbar-width: none;      /* Firefox */
          -ms-overflow-style: none;   /* Edge ເກົ່າ */
        }
        .ol-box::-webkit-scrollbar {
          display: none;              /* Chrome, Safari, Edge */
        }
        @keyframes olQrFade { from { opacity: 0; } to { opacity: 1; } }

        .ol-qr-skel {
          width: 160px;
          height: 160px;
          margin: 0 auto 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
          background: #fff;
          border: 1px solid #e8d5c4;
          color: #6b5a4c;
          font-weight: 700;
          font-size: 13px;
          text-align: center;
        }

        /* ໝຸດຮ້ານເທິງແຜນທີ່ */
        .ol-shop-pin-wrap {
          background: transparent !important;
          border: none !important;
        }
        .ol-shop-pin {
          display: flex;
          flex-direction: column;
          align-items: center;
          line-height: 1;
        }
        .ol-shop-pin-icon {
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          background: #f2760c;
          border: 3px solid #fff;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.45);
        }
        .ol-shop-pin-text {
          margin-top: 2px;
          padding: 2px 8px;
          font-size: 12px;
          font-weight: 800;
          color: #fff;
          background: #7a1f0f;
          border-radius: 999px;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
          white-space: nowrap;
        }

        /* ຈໍໃຫຍ່ (1200px ຂຶ້ນໄປ): ບິນຕໍ່ກັນຖັນດຽວ ກວ້າງປະມານເຄິ່ງໜຶ່ງ ຢູ່ກາງຈໍ
           ຈໍນ້ອຍ / ກາງ: ໃຊ້ແບບເກົ່າທຸກຢ່າງ */
        @media (min-width: 1200px) {
          .ol-overlay .ol-box {
            box-sizing: border-box;
            width: 448px !important;
            max-width: 92vw !important;
            max-height: 94vh;
            overflow-y: auto;
          }
        }
      `}</style>
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
          inputMode="numeric"
          placeholder="ເບີໂທ ເຊັ່ນ 02012345678"
          maxLength={PHONE_LEN}
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, PHONE_LEN))}
        />
        {phoneNote && (
          <p
            style={{
              margin: '-6px 4px 10px',
              fontSize: 13,
              fontWeight: 700,
              color: phoneBad ? '#c0392b' : '#6b5a4c',
            }}
          >
            {phoneNote}
          </p>
        )}

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
            {shop && (
              <p className="ol-map-hint" style={{ marginTop: 2 }}>
                🏪 ໝຸດສີສົ້ມ = ທີ່ຕັ້ງຮ້ານ
              </p>
            )}
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
              {!qrReady ? (
                <p className="ol-transfer-note">
                  1) ປັກໝຸດຈຸດສົ່ງເທິງແຜນທີ່ ເພື່ອຄິດຄ່າສົ່ງກ່ອນ ຈຶ່ງຈະສະແດງ QR ໂອນເງິນ
                </p>
              ) : amountQrStatus === 'loading' ? (
                <>
                  <p className="ol-transfer-note">
                    1) ສະແກນ QR ເພື່ອໂອນເງິນ {grandTotal.toLocaleString()} ກີບ
                  </p>
                  <div className="ol-qr-skel">⏳ ກຳລັງສ້າງ QR...</div>
                </>
              ) : amountQrStatus === 'ok' && amountQr ? (
                <>
                  <p className="ol-transfer-note">
                    1) ສະແກນ QR ເພື່ອໂອນເງິນ {grandTotal.toLocaleString()} ກີບ (ຈຳນວນເງິນຈະຂຶ້ນໃຫ້ເອງ)
                  </p>
                  <img
                    className="ol-qr"
                    src={amountQr}
                    alt="QR ຮັບເງິນ"
                    style={{ animation: 'olQrFade 0.25s ease' }}
                  />
                </>
              ) : qrSrc ? (
                <>
                  <p className="ol-transfer-note">
                    1) ສະແກນ QR ເພື່ອໂອນເງິນ {grandTotal.toLocaleString()} ກີບ
                  </p>
                  <img className="ol-qr" src={qrSrc} alt="QR ຮັບເງິນ" />
                </>
              ) : (
                <p className="ol-transfer-note">ຮ້ານຍັງບໍ່ໄດ້ຕັ້ງ QR ຮັບເງິນ ກະລຸນາໂອນຕາມທີ່ຮ້ານແຈ້ງ</p>
              )}

              <p className="ol-transfer-note">2) ແນບສະລິບການໂອນເງິນ</p>
              {/* ຊ່ອງເລືອກໄຟລ໌ຖືກຊ່ອນ ແລ້ວໃຊ້ປຸ່ມຂອບປະແທນ */}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={pickSlip}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                style={slipBtnStyle}
                onClick={() => fileRef.current && fileRef.current.click()}
              >
                {slip ? '🔄 ປ່ຽນຮູບສະລິບ' : '+ ສະລິບການໂອນ'}
              </button>
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