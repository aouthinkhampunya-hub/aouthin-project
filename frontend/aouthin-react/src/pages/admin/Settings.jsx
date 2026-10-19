import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  getPaymentQR,
  uploadPaymentQR,
  getRestaurantLocation,
  saveRestaurantLocation,
  authMe,
} from '../../api.js';

const pinIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  shadowSize: [41, 41],
});

export default function Settings() {
  const [qrImage, setQrImage] = useState(null);
  const fileRef = useRef(null);

  // ===== ທີ່ຕັ້ງຮ້ານ =====
  const [ready, setReady] = useState(false);        // ໂຫຼດພິກັດ + ສິດແລ້ວ
  const [canEdit, setCanEdit] = useState(false);    // ມີແຕ່ເຈົ້າຂອງຮ້ານປ່ຽນໄດ້
  const [pos, setPos] = useState(null);             // { lat, lng } ທີ່ກຳລັງເລືອກ
  const [isDefault, setIsDefault] = useState(true); // ຍັງບໍ່ເຄີຍປັກມຸດ
  const [dirty, setDirty] = useState(false);        // ມີການປ່ຽນທີ່ຍັງບໍ່ໄດ້ບັນທຶກ
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const data = await getPaymentQR();
    setQrImage(data.qrImage);
  }

  // ໂຫຼດພິກັດຮ້ານ + ກວດສິດ (ພະນັກງານທົ່ວໄປ / ຄົວ ເບິ່ງໄດ້ແຕ່ແກ້ບໍ່ໄດ້)
  useEffect(() => {
    (async () => {
      try {
        const loc = await getRestaurantLocation();
        setPos({ lat: Number(loc.lat), lng: Number(loc.lng) });
        setIsDefault(!!loc.isDefault);
      } catch (e) {
        setPos({ lat: 17.9757, lng: 102.6331 });
      }
      try {
        const me = await authMe();
        setCanEdit(!!me && me.role !== 'staff' && me.role !== 'kitchen');
      } catch (e) {
        setCanEdit(false);
      }
      setReady(true);
    })();
  }, []);

  const moveTo = (lat, lng, pan) => {
    setPos({ lat, lng });
    setDirty(true);
    setMsg('');
    if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
    if (pan && mapRef.current) mapRef.current.setView([lat, lng], 17);
  };

  // ສ້າງແຜນທີ່ເມື່ອໂຫຼດພິກັດແລ້ວ
  useEffect(() => {
    if (!ready || !pos || !mapDivRef.current || mapRef.current) return undefined;
    const map = L.map(mapDivRef.current).setView([pos.lat, pos.lng], 16);
    mapRef.current = map;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    const marker = L.marker([pos.lat, pos.lng], { draggable: canEdit, icon: pinIcon }).addTo(map);
    markerRef.current = marker;

    if (canEdit) {
      marker.on('dragend', () => {
        const p = marker.getLatLng();
        setPos({ lat: p.lat, lng: p.lng });
        setDirty(true);
        setMsg('');
      });
      map.on('click', (e) => {
        marker.setLatLng(e.latlng);
        setPos({ lat: e.latlng.lat, lng: e.latlng.lng });
        setDirty(true);
        setMsg('');
      });
    }
    setTimeout(() => map.invalidateSize(), 100);
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, canEdit]);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setMsg('⚠️ ເບຣາວເຊີນີ້ບໍ່ຮອງຮັບຕຳແໜ່ງ ກະລຸນາກົດເລືອກເທິງແຜນທີ່');
      return;
    }
    setMsg('⏳ ກຳລັງຫາຕຳແໜ່ງ...');
    navigator.geolocation.getCurrentPosition(
      (p) => { moveTo(p.coords.latitude, p.coords.longitude, true); setMsg(''); },
      () => setMsg('⚠️ ຫາຕຳແໜ່ງບໍ່ໄດ້ ກະລຸນາກົດເລືອກເທິງແຜນທີ່'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  async function handleSaveLocation() {
    if (!pos) return;
    setSaving(true);
    setMsg('');
    try {
      await saveRestaurantLocation(pos.lat, pos.lng);
      setDirty(false);
      setIsDefault(false);
      setMsg('✅ ບັນທຶກທີ່ຕັ້ງຮ້ານສຳເລັດ');
    } catch (err) {
      setMsg('❌ ' + (err.error || 'ບັນທຶກບໍ່ສຳເລັດ'));
    }
    setSaving(false);
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
      <style>{`
        body.is-admin .shop-map {
          width: 100%;
          height: 340px;
          margin: 12px 0 10px;
          border-radius: 14px;
          overflow: hidden;
          border: 1px solid #e8d5c4;
          z-index: 0;
        }
        body.is-admin .shop-note {
          margin: 6px 0;
          font-size: 14px;
          font-weight: 700;
          color: #6b5a4c;
          line-height: 1.6;
        }
        body.is-admin .shop-warn {
          margin: 6px 0 10px;
          padding: 10px 12px;
          border-radius: 10px;
          background: #fff3cd;
          color: #7a1f0f;
          font-size: 14px;
          font-weight: 700;
        }
        body.is-admin .shop-btns {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 6px;
        }
        body.is-admin .shop-btn {
          flex: 1 1 180px;
          padding: 12px 14px;
          border: none;
          border-radius: 10px;
          font-size: 15px;
          font-weight: 800;
          font-family: inherit;
          cursor: pointer;
        }
        body.is-admin .shop-btn.loc { background: #e8f0fe; color: #1a56c4; border: 1px solid #b9cdf5; }
        body.is-admin .shop-btn.save { background: #2e7d32; color: #fff; }
        body.is-admin .shop-btn:disabled { background: #cfc6bd; color: #fff; cursor: default; border: none; }
        body.is-admin .shop-link {
          display: inline-block;
          margin-top: 8px;
          font-size: 14px;
          font-weight: 700;
        }
      `}</style>

      <Link to="/admin/qrcode" className="back-link">
        <svg className="arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
        ກັບ
      </Link>

      <div className="settings-card">
        <h2>QR ຮັບເງິນ</h2>
        <div className="qr-preview">
          {qrImage ? <img src={qrImage} alt="QR ຮັບເງິນ" /> : <span>ຍັງບໍ່ມີຮູບ QR</span>}
        </div>
        <input type="file" ref={fileRef} accept="image/*" />
        <button className="upload-btn" onClick={handleUpload}>ບັນທຶກ QR</button>
      </div>

      <div className="settings-card">
        <h2>📍 ທີ່ຕັ້ງຮ້ານ</h2>
        <p className="shop-note">
          ໃຊ້ເປັນຈຸດເລີ່ມຕົ້ນຄິດຄ່າສົ່ງ (ໄລຍະທາງຈາກຮ້ານຫາບ້ານລູກຄ້າ).
          {canEdit
            ? ' ກົດເທິງແຜນທີ່ ຫຼື ລາກມຸດ ໄປຍັງຕຳແໜ່ງຮ້ານ ແລ້ວກົດບັນທຶກ.'
            : ' ສະເພາະເຈົ້າຂອງຮ້ານເທົ່ານັ້ນທີ່ປ່ຽນໄດ້.'}
        </p>

        {ready && isDefault && (
          <div className="shop-warn">
            ⚠️ ຍັງບໍ່ໄດ້ຕັ້ງທີ່ຕັ້ງຮ້ານ ກຳລັງໃຊ້ຄ່າເລີ່ມຕົ້ນ ຄ່າສົ່ງອາດບໍ່ຖືກຕ້ອງ
          </div>
        )}

        {!ready && <p className="shop-note">ກຳລັງໂຫຼດ...</p>}
        <div ref={mapDivRef} className="shop-map" style={{ display: ready ? 'block' : 'none' }} />

        {ready && pos && (
          <p className="shop-note">
            ພິກັດ: {pos.lat.toFixed(6)}, {pos.lng.toFixed(6)}
            <br />
            <a
              className="shop-link"
              href={`https://www.google.com/maps?q=${pos.lat},${pos.lng}`}
              target="_blank"
              rel="noreferrer"
            >
              🗺️ ກວດໃນ Google Maps
            </a>
          </p>
        )}

        {canEdit && (
          <div className="shop-btns">
            <button type="button" className="shop-btn loc" onClick={useMyLocation}>
              📍 ໃຊ້ຕຳແໜ່ງປັດຈຸບັນຂອງຂ້ອຍ
            </button>
            <button
              type="button"
              className="shop-btn save"
              disabled={saving || !dirty}
              onClick={handleSaveLocation}
            >
              {saving ? 'ກຳລັງບັນທຶກ...' : '💾 ບັນທຶກທີ່ຕັ້ງຮ້ານ'}
            </button>
          </div>
        )}

        {msg && <p className="shop-note">{msg}</p>}
      </div>
    </main>
  );
}