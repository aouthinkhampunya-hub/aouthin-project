import React, { useEffect, useRef, useState } from 'react';
import {
  getMenuQR, getTableQRs, getPaymentQR, uploadPaymentQR,
  addTable, deleteTable, getOpenBills,
} from '../../api.js';
import '../../styles/admin-qrcode.css';
import ShopLocationButton from '../../components/ShopLocationButton.jsx';

// ໄອຄອນຖັງຂີ້ເຫຍື້ອ (SVG) ສີຈະຕາມ currentColor
function TrashIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

export default function QrCodePage() {
  const [qrImage, setQrImage] = useState('');
  const [menuUrl, setMenuUrl] = useState('');
  const [tables, setTables] = useState(null);
  const [tablesError, setTablesError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newNumber, setNewNumber] = useState('');

  const [payOpen, setPayOpen] = useState(false);
  const [payImage, setPayImage] = useState(null);
  const [picked, setPicked] = useState(null); // { name, url } ຮູບໃໝ່ທີ່ເລືອກ ແຕ່ຍັງບໍ່ໄດ້ບັນທຶກ
  const [paySaving, setPaySaving] = useState(false);
  const fileRef = useRef(null);

  const [dialog, setDialog] = useState(null);
  const [toast, setToast] = useState('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const loadTables = () =>
    getTableQRs()
      .then((data) => { setTables(data.tables); setTablesError(false); })
      .catch(() => setTablesError(true));

  useEffect(() => {
    getMenuQR()
      .then((data) => { setQrImage(data.qrImage); setMenuUrl(data.menuUrl); })
      .catch((e) => console.error(e));
    loadTables();
  }, []);

  // ລ້າງຮູບທີ່ເລືອກ (ປ່ອຍໜ່ວຍຄວາມຈຳຂອງຮູບຕົວຢ່າງ)
  const clearPicked = () => {
    setPicked((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
    if (fileRef.current) fileRef.current.value = '';
  };

  const closePay = () => {
    setPayOpen(false);
    clearPicked();
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (dialog) setDialog(null);
      else closePay();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog]);

  // ເພີ່ມໂຕະ: ມີເລກໃນຊ່ອງ = ເພີ່ມເລກນັ້ນ | ຊ່ອງວ່າງ = ເລກຖັດໄປ
  const handleAddTable = async () => {
    setBusy(true);
    try {
      const data = await addTable(newNumber.trim());
      setNewNumber('');
      await loadTables();
      showToast('✅ ເພີ່ມໂຕະ ' + data.table + ' ແລ້ວ');
    } catch (e) {
      showToast('❌ ' + (e?.error || 'ເພີ່ມໂຕະບໍ່ສຳເລັດ'));
    } finally {
      setBusy(false);
    }
  };

  // ກົດຖັງຂີ້ເຫຍື້ອທີ່ບັດໂຕະ n
  const handleDeleteTable = async (n) => {
    setBusy(true);
    try {
      const bills = await getOpenBills();
      const hasBill = bills.some(
        (b) => (b.order_type || 'dine_in') === 'dine_in' && Number(b.table_number) === n
      );

      if (hasBill) {
        setDialog({
          icon: '⚠️',
          title: 'ລຶບບໍ່ໄດ້',
          text: `ໂຕະ ${n} ຍັງມີບິນເປີດຢູ່ ກະລຸນາປິດບິນກ່ອນ`,
          okText: 'ຮັບຮູ້',
          cancelText: 'ປິດ',
          danger: false,
          onOk: () => {},
        });
        return;
      }

      setDialog({
        icon: '🗑️',
        title: 'ຢືນຢັນລຶບໂຕະ',
        text: `ລຶບໂຕະ ${n} ແທ້ບໍ? QR ຂອງໂຕະນີ້ຈະໃຊ້ບໍ່ໄດ້ອີກ`,
        okText: '🗑️ ລຶບ',
        cancelText: 'ຍົກເລີກ',
        danger: true,
        onOk: async () => {
          try {
            await deleteTable(n);
            await loadTables();
            showToast('✅ ລຶບໂຕະ ' + n + ' ແລ້ວ');
          } catch (e) {
            showToast('❌ ' + (e?.error || 'ລຶບໂຕະບໍ່ສຳເລັດ'));
          }
        },
      });
    } catch (e) {
      showToast('❌ ' + (e?.error || 'ເກີດຂໍ້ຜິດພາດ'));
    } finally {
      setBusy(false);
    }
  };

  const closeDialog = (ok) => {
    const d = dialog;
    setDialog(null);
    if (ok && d?.onOk) d.onOk();
  };

  const loadPayQR = async () => {
    try {
      const data = await getPaymentQR();
      setPayImage(data.qrImage || null);
    } catch (e) {
      setPayImage(null);
    }
  };
  const openPayModal = () => { setPayOpen(true); loadPayQR(); };

  // ເລືອກໄຟລ໌ຮູບ QR ໃໝ່ -> ສະແດງຕົວຢ່າງກ່ອນບັນທຶກ
  const pickPayFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('ກະລຸນາເລືອກໄຟລ໌ຮູບພາບ');
      e.target.value = '';
      return;
    }
    setPicked((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return { name: file.name, url: URL.createObjectURL(file) };
    });
  };

  const uploadPayQR = async () => {
    const file = fileRef.current?.files[0];
    if (!file) { showToast('ກະລຸນາເລືອກຮູບ QR ກ່ອນ'); return; }
    const fd = new FormData();
    fd.append('qr', file);
    setPaySaving(true);
    try {
      await uploadPaymentQR(fd);
      showToast('✅ ບັນທຶກ QR ສຳເລັດ');
      clearPicked();
      loadPayQR();
    } catch (e) {
      showToast('❌ ' + (e?.error || 'ເກີດຂໍ້ຜິດພາດ'));
    }
    setPaySaving(false);
  };

  return (
    <>
      {/* ສະໄຕລ໌ປຸ່ມຖັງຂີ້ເຫຍື້ອ + popup QR ຮັບເງິນ + ຊ່ອນຕອນສັ່ງພິມ */}
      <style>{`
        .tq-del {
          position: absolute;
          top: 4px;
          right: 4px;
          width: 28px;
          height: 28px;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #f3c9c4;
          border-radius: 50%;
          background: #ffffff;
          color: #d93025;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.18);
          transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
        }
        .tq-del:hover:not(:disabled) {
          background: #d93025;
          color: #ffffff;
          border-color: #d93025;
          transform: scale(1.1);
          box-shadow: 0 4px 10px rgba(217, 48, 37, 0.45);
        }
        .tq-del:active:not(:disabled) {
          transform: scale(0.95);
        }
        .tq-del:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .table-qr-card { padding-top: 26px; }

        /* ===== popup QR ຮັບເງິນ (ແບບໃໝ່) ===== */
        @keyframes pqPop { from { transform: scale(0.94); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        body.is-admin .pq-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          z-index: 9000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          background: rgba(20, 12, 6, 0.75);
        }
        body.is-admin .pq-box {
          width: 100%;
          max-width: 400px;
          max-height: 94vh;
          overflow-y: auto;
          box-sizing: border-box;
          border-radius: 20px;
          background: #fff;
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
          color: #2b1b0e;
          animation: pqPop 0.2s ease;
        }
        body.is-admin .pq-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 14px 16px 14px 20px;
          background: linear-gradient(to right, #8b0000, #a30000);
          color: #fff;
        }
        body.is-admin .pq-head h3 {
          margin: 0;
          font-size: 19px;
          font-weight: 900;
          color: #fff;
          text-align: left;
        }
        body.is-admin .pq-close {
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
        body.is-admin .pq-close:hover { background: rgba(255, 255, 255, 0.35); }
        body.is-admin .pq-body {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 12px;
          padding: 18px 20px 22px;
        }
        body.is-admin .pq-sub {
          margin: 0;
          font-size: 14px;
          font-weight: 700;
          line-height: 1.5;
          color: #6b5a4c;
          text-align: center;
        }
        body.is-admin .pq-preview {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          align-self: center;
          width: 100%;
          max-width: 280px;
          min-height: 200px;
          padding: 14px;
          box-sizing: border-box;
          border: 2px dashed #e0c9b0;
          border-radius: 16px;
          background: #fffaf3;
          color: #8a7968;
          font-size: 14px;
          font-weight: 700;
        }
        body.is-admin .pq-preview img {
          display: block;
          width: 100%;
          height: auto;
          border-radius: 10px;
        }
        body.is-admin .pq-badge {
          position: absolute;
          top: -11px;
          left: 50%;
          transform: translateX(-50%);
          padding: 3px 12px;
          border-radius: 999px;
          background: #e67e22;
          color: #fff;
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }
        body.is-admin .pq-file {
          margin: -4px 0 0;
          font-size: 13px;
          font-weight: 700;
          color: #6b5a4c;
          text-align: center;
          overflow-wrap: anywhere;
        }
        body.is-admin .pq-btn {
          width: 100%;
          padding: 13px 14px;
          border: none;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 800;
          font-family: inherit;
          cursor: pointer;
          transition: filter 0.15s ease, transform 0.1s ease;
        }
        body.is-admin .pq-btn:active:not(:disabled) { transform: scale(0.98); }
        body.is-admin .pq-btn.ghost {
          background: #f8eee2;
          color: #7a1f0f;
          border: 2px dashed #c9a98a;
        }
        body.is-admin .pq-btn.ghost:hover { background: #f3e4d2; }
        body.is-admin .pq-btn.primary {
          background: #2e7d32;
          color: #fff;
          box-shadow: 0 6px 16px rgba(46, 125, 50, 0.3);
        }
        body.is-admin .pq-btn.primary:hover:not(:disabled) { filter: brightness(1.08); }
        body.is-admin .pq-btn.primary:disabled {
          background: #cfc6bd;
          color: #fff;
          box-shadow: none;
          cursor: default;
        }

        @media print {
          .tq-del, .tq-add-input, .slm-open-btn { display: none !important; }
        }
      `}</style>

      <div className="qr-page">
        <button className="confirm-btn" style={{ marginBottom: 10 }} onClick={openPayModal}>
          ➕ ໄປທີ່ QR ຈ່າຍເງິນ
        </button>

        {/* ປຸ່ມຕັ້ງທີ່ຕັ້ງຮ້ານ (ແອັດມິນປັກມຸດເທິງແຜນທີ່) */}
        <ShopLocationButton />

        <h2>ສະແກນເພື່ອສັ່ງອາຫານ</h2>
        <div className="qr-box">
          {qrImage && <img src={qrImage} alt="QR Code" width="280" height="280" />}
        </div>
        <p>{menuUrl}</p>

        <div className="table-qr-section">
          <h2>📋 QR ແຍກຕາມໂຕະ (ທັງໝົດ {tables ? tables.length : '...'} ໂຕະ)</h2>
          <div className="table-qr-grid">
            {tablesError ? (
              <p style={{ gridColumn: '1 / -1' }}>ສ້າງ QR ບໍ່ສຳເລັດ ລອງໂຫລດໜ້ານີ້ໃໝ່</p>
            ) : tables === null ? (
              <p style={{ gridColumn: '1 / -1' }}>ກຳລັງສ້າງ QR...</p>
            ) : (
              tables.map((t) => (
                <div className="table-qr-card" key={t.table} style={{ position: 'relative' }}>
                  <button
                    type="button"
                    className="tq-del"
                    title={`ລຶບໂຕະ ${t.table}`}
                    aria-label={`ລຶບໂຕະ ${t.table}`}
                    disabled={busy}
                    onClick={() => handleDeleteTable(t.table)}
                  >
                    <TrashIcon />
                  </button>
                  <img src={t.qrImage} alt={`QR ໂຕະ ${t.table}`} />
                  <div className="tq-label">ໂຕະ {t.table}</div>
                </div>
              ))
            )}
          </div>

          <div className="table-qr-actions">
            <input
              className="tq-add-input"
              type="text"
              inputMode="numeric"
              maxLength={3}
              placeholder="ເພີ່ມເລກໂຕະ"
              value={newNumber}
              onChange={(e) => setNewNumber(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => { if (e.key === 'Enter' && !busy) handleAddTable(); }}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid #ccc',
                fontSize: 15,
                minWidth: 230,
              }}
            />
            <button className="table-qr-add-btn" onClick={handleAddTable} disabled={busy}>
              ➕ ເພີ່ມໂຕະ
            </button>
            <button className="table-qr-print-btn" onClick={() => window.print()}>
              🖨️ ພິມ QR ທັງໝົດ
            </button>
          </div>
        </div>
      </div>

      {payOpen && (
        <div className="pq-overlay" onClick={(e) => e.target === e.currentTarget && closePay()}>
          <div className="pq-box">
            <div className="pq-head">
              <h3>💳 QR ຮັບເງິນ</h3>
              <button type="button" className="pq-close" onClick={closePay} aria-label="ປິດ">✕</button>
            </div>
            <div className="pq-body">
              <p className="pq-sub">QR ນີ້ໃຊ້ໃຫ້ລູກຄ້າສະແກນເພື່ອຈ່າຍເງິນ</p>

              <div className="pq-preview">
                {picked ? (
                  <>
                    <span className="pq-badge">ຮູບໃໝ່ (ຍັງບໍ່ໄດ້ບັນທຶກ)</span>
                    <img src={picked.url} alt="ຮູບ QR ໃໝ່" />
                  </>
                ) : payImage ? (
                  <img src={payImage} alt="QR ຮັບເງິນ" />
                ) : (
                  <span>ຍັງບໍ່ມີຮູບ QR</span>
                )}
              </div>

              {/* ຊ່ອງເລືອກໄຟລ໌ຖືກຊ່ອນ ແລ້ວໃຊ້ປຸ່ມສວຍແທນ */}
              <input
                type="file"
                accept="image/*"
                ref={fileRef}
                onChange={pickPayFile}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                className="pq-btn ghost"
                onClick={() => fileRef.current && fileRef.current.click()}
              >
                📁 {picked ? 'ປ່ຽນຮູບທີ່ເລືອກ' : 'ເລືອກຮູບ QR ໃໝ່'}
              </button>
              {picked && <p className="pq-file">{picked.name}</p>}

              <button
                type="button"
                className="pq-btn primary"
                disabled={!picked || paySaving}
                onClick={uploadPayQR}
              >
                {paySaving ? 'ກຳລັງບັນທຶກ...' : '💾 ບັນທຶກ QR'}
              </button>
            </div>
          </div>
        </div>
      )}

      {dialog && (
        <div className="cf-overlay" onClick={(e) => e.target === e.currentTarget && closeDialog(false)}>
          <div className="cf-box">
            <div className={`cf-icon ${dialog.danger ? '' : 'warn'}`}>{dialog.icon}</div>
            <h3>{dialog.title}</h3>
            <p>{dialog.text}</p>
            <div className="cf-actions">
              <button className="cf-cancel" onClick={() => closeDialog(false)}>{dialog.cancelText}</button>
              <button
                className={`cf-ok ${dialog.danger ? '' : 'green'}`}
                onClick={() => closeDialog(true)}
                autoFocus
              >
                {dialog.okText}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="qr-toast">{toast}</div>}
    </>
  );
}