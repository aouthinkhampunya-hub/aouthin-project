import React, { useEffect, useRef, useState } from 'react';
import {
  getMenuQR, getTableQRs, getPaymentQR, uploadPaymentQR,
  addTable, deleteTable, getOpenBills,
} from '../../api.js';
import '../../styles/admin-qrcode.css';

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

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (dialog) setDialog(null);
      else setPayOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
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

  const uploadPayQR = async () => {
    const file = fileRef.current?.files[0];
    if (!file) { showToast('ກະລຸນາເລືອກຮູບ QR ກ່ອນ'); return; }
    const fd = new FormData();
    fd.append('qr', file);
    try {
      await uploadPaymentQR(fd);
      showToast('✅ ບັນທຶກ QR ສຳເລັດ');
      fileRef.current.value = '';
      loadPayQR();
    } catch (e) {
      showToast('❌ ' + (e?.error || 'ເກີດຂໍ້ຜິດພາດ'));
    }
  };

  return (
    <>
      {/* ສະໄຕລ໌ປຸ່ມຖັງຂີ້ເຫຍື້ອ + ຊ່ອນຕອນສັ່ງພິມ */}
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
        @media print {
          .tq-del, .tq-add-input { display: none !important; }
        }
      `}</style>

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
        <div className="pay-modal-overlay open" onClick={(e) => e.target === e.currentTarget && setPayOpen(false)}>
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