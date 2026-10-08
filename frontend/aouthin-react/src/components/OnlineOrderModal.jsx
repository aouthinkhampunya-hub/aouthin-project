import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
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

export default function OnlineOrderModal({ total, onClose, onSubmit }) {
  const saved = (() => {
    try { return JSON.parse(sessionStorage.getItem('onlineBill') || 'null'); } catch (e) { return null; }
  })();

  const [type, setType] = useState('pickup');
  const [name, setName] = useState(saved?.name || '');
  const [phone, setPhone] = useState(saved?.phone || '');
  const [address, setAddress] = useState('');
  const [hint, setHint] = useState('👆 ກົດເທິງແຜນທີ່ ຫຼື ລາກໝຸດ ເພື່ອເລືອກຈຸດສົ່ງ');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
const [payMethod, setPayMethod] = useState('cash');

  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const pinRef = useRef(null);

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

  const submit = async () => {
    if (!name.trim()) return setError('ກະລຸນາໃສ່ຊື່');
    if (!/^[0-9+\s-]{8,15}$/.test(phone.trim())) return setError('ເບີໂທບໍ່ຖືກຕ້ອງ');
    if (type === 'delivery' && !address.trim()) return setError('ກະລຸນາໃສ່ທີ່ຢູ່ສົ່ງ');
    if (type === 'delivery' && !pinRef.current) return setError('ກະລຸນາປັກໝຸດຈຸດສົ່ງເທິງແຜນທີ່');
    setError('');
    setBusy(true);
    const msg = await onSubmit({
      order_type: type,
      customer_name: name.trim(),
      customer_phone: phone.trim(),
      address: type === 'delivery' ? address.trim() : '',
      payment_method: payMethod,
      latitude: type === 'delivery' ? pinRef.current.lat : null,
      longitude: type === 'delivery' ? pinRef.current.lng : null,
    });
    setBusy(false);
    if (msg) setError(msg);
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
  <div
    className={`ol-pay-opt${payMethod === 'cash' ? ' active' : ''}`}
    onClick={() => setPayMethod('cash')}
    style={{ cursor: 'pointer', marginBottom: 8, opacity: payMethod === 'cash' ? 1 : 0.6 }}
  >
    💵 ຈ່າຍເງິນສົດ
    <small>{type === 'delivery' ? 'ຈ່າຍຕອນຮັບອາຫານທີ່ບ້ານ' : 'ຈ່າຍຕອນມາຮັບອາຫານ'}</small>
  </div>
  <div
    className={`ol-pay-opt${payMethod === 'transfer' ? ' active' : ''}`}
    onClick={() => setPayMethod('transfer')}
    style={{ cursor: 'pointer', opacity: payMethod === 'transfer' ? 1 : 0.6 }}
  >
    🏦 ຈ່າຍເງິນໂອນ
    <small>ສະແກນ QR ໂອນເງິນຫຼັງສັ່ງສຳເລັດ</small>
  </div>
</div>

        <div className="ol-sum">
          <span>ຍອດລວມ</span>
          <strong>{total} ກີບ</strong>
        </div>

        {error && <p className="ol-error">⚠️ {error}</p>}

        <div className="ol-actions">
          <button className="ol-cancel" onClick={onClose}>ຍົກເລີກ</button>
          <button className="ol-ok" disabled={busy} onClick={submit}>ຢືນຢັນສັ່ງອາຫານ</button>
        </div>
      </div>
    </div>
  );
}