import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getRestaurantLocation, saveRestaurantLocation, authMe } from '../api.js';

const pinIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  shadowSize: [41, 41],
});

// ໄລຍະສົ່ງສູງສຸດ (ກມ): ຕ້ອງກົງກັບ backend (delivery.js)
const MIN_MAX_KM = 1;
const MAX_MAX_KM = 100;
const DEFAULT_MAX_KM = 20;

// ປຸ່ມ "ຕັ້ງທີ່ຕັ້ງຮ້ານ" + popup ແຜນທີ່ (ໃຊ້ໃນໜ້າ QR Code)
export default function ShopLocationButton() {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [canEdit, setCanEdit] = useState(false); // ມີແຕ່ເຈົ້າຂອງຮ້ານປ່ຽນໄດ້
  const [pos, setPos] = useState(null);
  const [maxKm, setMaxKm] = useState(String(DEFAULT_MAX_KM)); // ເກັບເປັນຂໍ້ຄວາມ ເພື່ອໃຫ້ພິມໄດ້ສະດວກ
  const [isDefault, setIsDefault] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  // ເປີດ popup: ໂຫຼດພິກັດຮ້ານ + ໄລຍະສົ່ງສູງສຸດ + ກວດສິດ
  const openModal = async () => {
    setOpen(true);
    setReady(false);
    setDirty(false);
    setMsg('');
    try {
      const loc = await getRestaurantLocation();
      setPos({ lat: Number(loc.lat), lng: Number(loc.lng) });
      setIsDefault(!!loc.isDefault);
      const km = Number(loc.max_km);
      setMaxKm(String(Number.isFinite(km) && km >= MIN_MAX_KM ? km : DEFAULT_MAX_KM));
    } catch (e) {
      setPos({ lat: 17.9757, lng: 102.6331 });
      setMaxKm(String(DEFAULT_MAX_KM));
    }
    try {
      const me = await authMe();
      setCanEdit(!!me && me.role !== 'staff' && me.role !== 'kitchen');
    } catch (e) {
      setCanEdit(false);
    }
    setReady(true);
  };

  const closeModal = () => setOpen(false);

  // Esc ປິດ popup
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // ສ້າງແຜນທີ່ເມື່ອ popup ເປີດ ແລະ ໂຫຼດພິກັດແລ້ວ
  useEffect(() => {
    if (!open || !ready || !pos || !mapDivRef.current) return undefined;
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
    setTimeout(() => map.invalidateSize(), 150);
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ready, canEdit]);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setMsg('⚠️ ເບຣາວເຊີນີ້ບໍ່ຮອງຮັບຕຳແໜ່ງ ກະລຸນາກົດເລືອກເທິງແຜນທີ່');
      return;
    }
    setMsg('⏳ ກຳລັງຫາຕຳແໜ່ງ...');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const lat = p.coords.latitude;
        const lng = p.coords.longitude;
        setPos({ lat, lng });
        setDirty(true);
        setMsg('');
        if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
        if (mapRef.current) mapRef.current.setView([lat, lng], 17);
      },
      () => setMsg('⚠️ ຫາຕຳແໜ່ງບໍ່ໄດ້ ກະລຸນາກົດເລືອກເທິງແຜນທີ່'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // ===== ໄລຍະສົ່ງສູງສຸດ (ກມ) =====
  const clampKm = (n) => Math.min(MAX_MAX_KM, Math.max(MIN_MAX_KM, Math.round(n)));

  const stepKm = (delta) => {
    const current = Number(maxKm) || MIN_MAX_KM;
    setMaxKm(String(clampKm(current + delta)));
    setDirty(true);
    setMsg('');
  };

  const onKmInput = (e) => {
    setMaxKm(e.target.value.replace(/\D/g, '').slice(0, 3));
    setDirty(true);
    setMsg('');
  };

  // ອອກຈາກຊ່ອງ: ຖ້າຫວ່າງ ຫຼື ເກີນຂອບເຂດ ໃຫ້ປັບເຂົ້າຂອບເຂດ
  const onKmBlur = () => {
    const n = Number(maxKm);
    setMaxKm(String(Number.isFinite(n) && n > 0 ? clampKm(n) : DEFAULT_MAX_KM));
  };

  const save = async () => {
    if (!pos) return;
    const km = Number(maxKm);
    if (!Number.isFinite(km) || km < MIN_MAX_KM || km > MAX_MAX_KM) {
      setMsg(`⚠️ ໄລຍະສົ່ງສູງສຸດຕ້ອງຢູ່ລະຫວ່າງ ${MIN_MAX_KM} ຫາ ${MAX_MAX_KM} ກມ`);
      return;
    }
    setSaving(true);
    setMsg('');
    try {
      await saveRestaurantLocation(pos.lat, pos.lng, Math.round(km));
      setMaxKm(String(Math.round(km)));
      setDirty(false);
      setIsDefault(false);
      setMsg('✅ ບັນທຶກສຳເລັດ');
    } catch (err) {
      setMsg('❌ ' + ((err && err.error) || 'ບັນທຶກບໍ່ສຳເລັດ'));
    }
    setSaving(false);
  };

  const msgIsOk = msg.startsWith('✅');
  const msgIsBad = msg.startsWith('❌') || msg.startsWith('⚠️');

  return (
    <>
      <style>{`
        @keyframes slmPop { from { transform: scale(0.94); opacity: 0; } to { transform: scale(1); opacity: 1; } }

        body.is-admin .slm-open-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 10px 20px;
          border: none;
          border-radius: 8px;
          background: #2e7d32;
          color: #fff;
          font-size: 15px;
          font-weight: 800;
          font-family: inherit;
          cursor: pointer;
        }
        body.is-admin .slm-open-btn:hover { filter: brightness(1.1); }

        body.is-admin .slm-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          background: rgba(20, 12, 6, 0.75);
        }
        body.is-admin .slm-box {
          width: 100%;
          max-width: 580px;
          max-height: 94vh;
          overflow-y: auto;
          box-sizing: border-box;
          border-radius: 20px;
          background: #fff;
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
          color: #2b1b0e;
          animation: slmPop 0.2s ease;
        }
        body.is-admin .slm-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 14px 16px 14px 20px;
          background: linear-gradient(to right, #8b0000, #a30000);
          color: #fff;
        }
        body.is-admin .slm-head h3 {
          margin: 0;
          font-size: 19px;
          font-weight: 900;
          color: #fff;
          text-align: left;
        }
        body.is-admin .slm-close {
          flex: 0 0 auto;
          width: 34px;
          height: 34px;
          padding: 0;
          border: none;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          color: #fff;
          font-size: 17px;
          font-weight: 800;
          line-height: 1;
          cursor: pointer;
        }
        body.is-admin .slm-close:hover { background: rgba(255, 255, 255, 0.35); }

        body.is-admin .slm-body {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 16px 20px 20px;
        }
        body.is-admin .slm-note {
          margin: 0;
          font-size: 14px;
          font-weight: 700;
          line-height: 1.6;
          color: #6b5a4c;
          text-align: left;
        }
        body.is-admin .slm-status {
          display: inline-flex;
          align-items: center;
          align-self: flex-start;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 800;
        }
        body.is-admin .slm-status.ok { background: #e6f4ea; color: #1e7a34; }
        body.is-admin .slm-status.warn { background: #fff3cd; color: #7a1f0f; }

        /* ===== ໄລຍະສົ່ງສູງສຸດ ===== */
        body.is-admin .slm-range {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 10px 14px;
          border-radius: 12px;
          background: #fffaf3;
          border: 1px solid #f0e0cc;
        }
        body.is-admin .slm-range-label {
          font-size: 14px;
          font-weight: 800;
          color: #5a4636;
        }
        body.is-admin .slm-range-label small {
          display: block;
          margin-top: 2px;
          font-size: 12px;
          font-weight: 700;
          color: #8a7968;
        }
        body.is-admin .slm-stepper {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        body.is-admin .slm-step-btn {
          width: 38px;
          height: 38px;
          padding: 0;
          border: 1px solid #c9a98a;
          border-radius: 10px;
          background: #f8eee2;
          color: #7a1f0f;
          font-size: 22px;
          font-weight: 900;
          line-height: 1;
          font-family: inherit;
          cursor: pointer;
        }
        body.is-admin .slm-step-btn:hover:not(:disabled) { background: #f3e4d2; }
        body.is-admin .slm-step-btn:active:not(:disabled) { transform: scale(0.94); }
        body.is-admin .slm-step-btn:disabled { opacity: 0.4; cursor: default; }
        body.is-admin .slm-km-input {
          width: 64px;
          height: 38px;
          box-sizing: border-box;
          padding: 0 6px;
          border: 1px solid #d9c3ab;
          border-radius: 10px;
          background: #fff;
          color: #2b1b0e;
          font-size: 17px;
          font-weight: 900;
          font-family: inherit;
          text-align: center;
        }
        body.is-admin .slm-km-input:disabled { background: #f3ece4; }
        body.is-admin .slm-km-unit {
          font-size: 14px;
          font-weight: 800;
          color: #5a4636;
        }

        body.is-admin .slm-map {
          width: 100%;
          height: 330px;
          border-radius: 14px;
          overflow: hidden;
          border: 1px solid #e8d5c4;
          box-shadow: 0 6px 18px rgba(80, 40, 10, 0.15);
          z-index: 0;
          isolation: isolate;
        }
        body.is-admin .slm-coords {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 10px 14px;
          border-radius: 12px;
          background: #fffaf3;
          border: 1px solid #f0e0cc;
          font-size: 14px;
          font-weight: 700;
          color: #5a4636;
        }
        body.is-admin .slm-coords a {
          font-weight: 800;
          color: #1a56c4;
          text-decoration: none;
        }
        body.is-admin .slm-coords a:hover { text-decoration: underline; }

        body.is-admin .slm-btns {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        body.is-admin .slm-btn {
          flex: 1 1 200px;
          padding: 13px 14px;
          border: none;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 800;
          font-family: inherit;
          cursor: pointer;
          transition: filter 0.15s ease, transform 0.1s ease;
        }
        body.is-admin .slm-btn:active:not(:disabled) { transform: scale(0.98); }
        body.is-admin .slm-btn.loc { background: #e8f0fe; color: #1a56c4; border: 1px solid #b9cdf5; }
        body.is-admin .slm-btn.loc:hover { background: #dce8fd; }
        body.is-admin .slm-btn.save {
          background: #2e7d32;
          color: #fff;
          box-shadow: 0 6px 16px rgba(46, 125, 50, 0.3);
        }
        body.is-admin .slm-btn.save:hover:not(:disabled) { filter: brightness(1.08); }
        body.is-admin .slm-btn:disabled {
          background: #cfc6bd;
          color: #fff;
          border: none;
          box-shadow: none;
          cursor: default;
        }
        body.is-admin .slm-msg {
          margin: 0;
          padding: 10px 14px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 800;
          text-align: left;
          background: #f3ece4;
          color: #5a4636;
        }
        body.is-admin .slm-msg.ok { background: #e6f4ea; color: #1e7a34; }
        body.is-admin .slm-msg.bad { background: #fdecea; color: #c0392b; }
      `}</style>

      <div style={{ textAlign: 'center', margin: '10px 0' }}>
        <button type="button" className="slm-open-btn" onClick={openModal}>
          📍 ຕັ້ງທີ່ຕັ້ງຮ້ານ
        </button>
      </div>

      {open && createPortal(
        <div
          className="slm-overlay"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="slm-box">
            <div className="slm-head">
              <h3>📍 ທີ່ຕັ້ງຮ້ານ</h3>
              <button type="button" className="slm-close" onClick={closeModal} aria-label="ປິດ">✕</button>
            </div>

            <div className="slm-body">
              <p className="slm-note">
                ໃຊ້ເປັນຈຸດເລີ່ມຕົ້ນຄິດຄ່າສົ່ງ.
                {canEdit
                  ? ' ກົດເທິງແຜນທີ່ ຫຼື ລາກມຸດ ໄປຍັງຕຳແໜ່ງຮ້ານ ແລ້ວກົດບັນທຶກ.'
                  : ' ສະເພາະເຈົ້າຂອງຮ້ານເທົ່ານັ້ນທີ່ປ່ຽນໄດ້.'}
              </p>

              {!ready && <p className="slm-note">⏳ ກຳລັງໂຫຼດ...</p>}

              {/* ໄລຍະສົ່ງສູງສຸດ: ແອັດມິນກົດ − / + ຫຼື ພິມເລກເອງ */}
              {ready && (
                <div className="slm-range">
                  <div className="slm-range-label">
                    🛵 ໄລຍະສົ່ງສູງສຸດ
                    <small>ໄກກວ່ານີ້ລູກຄ້າສັ່ງສົ່ງບໍ່ໄດ້ ({MIN_MAX_KM}-{MAX_MAX_KM} ກມ)</small>
                  </div>
                  <div className="slm-stepper">
                    {canEdit && (
                      <button
                        type="button"
                        className="slm-step-btn"
                        aria-label="ຫຼຸດໄລຍະທາງ"
                        disabled={(Number(maxKm) || 0) <= MIN_MAX_KM}
                        onClick={() => stepKm(-1)}
                      >
                        −
                      </button>
                    )}
                    <input
                      className="slm-km-input"
                      type="text"
                      inputMode="numeric"
                      maxLength={3}
                      value={maxKm}
                      disabled={!canEdit}
                      onChange={onKmInput}
                      onBlur={onKmBlur}
                      aria-label="ໄລຍະສົ່ງສູງສຸດ (ກມ)"
                    />
                    {canEdit && (
                      <button
                        type="button"
                        className="slm-step-btn"
                        aria-label="ເພີ່ມໄລຍະທາງ"
                        disabled={(Number(maxKm) || 0) >= MAX_MAX_KM}
                        onClick={() => stepKm(1)}
                      >
                        +
                      </button>
                    )}
                    <span className="slm-km-unit">ກມ</span>
                  </div>
                </div>
              )}

              {ready && (
                <span className={`slm-status ${isDefault ? 'warn' : 'ok'}`}>
                  {isDefault
                    ? '⚠️ ຍັງບໍ່ໄດ້ຕັ້ງທີ່ຕັ້ງຮ້ານ (ກຳລັງໃຊ້ຄ່າເລີ່ມຕົ້ນ)'
                    : '✅ ຕັ້ງທີ່ຕັ້ງຮ້ານແລ້ວ'}
                </span>
              )}

              {ready && <div ref={mapDivRef} className="slm-map" />}

              {ready && pos && (
                <div className="slm-coords">
                  <span>ພິກັດ: {pos.lat.toFixed(6)}, {pos.lng.toFixed(6)}</span>
                  <a
                    href={`https://www.google.com/maps?q=${pos.lat},${pos.lng}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    🗺️ ກວດໃນ Google Maps
                  </a>
                </div>
              )}

              {ready && canEdit && (
                <div className="slm-btns">
                  <button type="button" className="slm-btn loc" onClick={useMyLocation}>
                    📍 ໃຊ້ຕຳແໜ່ງປັດຈຸບັນຂອງຂ້ອຍ
                  </button>
                  <button
                    type="button"
                    className="slm-btn save"
                    disabled={saving || !dirty}
                    onClick={save}
                  >
                    {saving ? 'ກຳລັງບັນທຶກ...' : '💾 ບັນທຶກທີ່ຕັ້ງຮ້ານ'}
                  </button>
                </div>
              )}

              {msg && (
                <p className={`slm-msg${msgIsOk ? ' ok' : msgIsBad ? ' bad' : ''}`}>{msg}</p>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}