import React, { useEffect, useRef, useState } from 'react';
import {
  getMenuQR, getTableQRs, getPaymentQR, uploadPaymentQR,
  addTable, deleteLastTable, getTableCount, getOpenBills,
} from '../../api.js';
import '../../styles/admin-qrcode.css';

export default function QrCodePage() {
  const [qrImage, setQrImage] = useState('');
  const [menuUrl, setMenuUrl] = useState('');
  const [tables, setTables] = useState(null);
  const [tablesError, setTablesError] = useState(false);
  const [busy, setBusy] = useState(false);

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

  const handleAddTable = async () => {
    setBusy(true);
    try {
      const data = await addTable();
      await loadTables();
      showToast('✅ ເພີ່ມໂຕະ ' + data.count + ' ແລ້ວ');
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    } catch (e) {
      showToast('❌ ' + (e?.error || 'ເພີ່ມໂຕະບໍ່ສຳເລັດ'));
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteTable = async () => {
    setBusy(true);
    try {
      const { count } = await getTableCount();
      const bills = await getOpenBills();

      if (bills.some((b) => Number(b.table_number) === count)) {
        setDialog({
          icon: '⚠️',
          title: 'ລຶບບໍ່ໄດ້',
          text: `ໂຕະ ${count} ຍັງມີບິນເປີດຢູ່ ກະລຸນາປິດບິນກ່ອນ`,
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
        text: `ລຶບໂຕະ ${count} ແທ້ບໍ່? QR ຂອງໂຕະນີ້ຈະໃຊ້ບໍ່ໄດ້ອີກ`,
        okText: '🗑️ ລຶບ',
        cancelText: 'ຍົກເລີກ',
        danger: true,
        onOk: async () => {
          try {
            await deleteLastTable();
            await loadTables();
            showToast('✅ ລຶບໂຕະ ' + count + ' ແລ້ວ');
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
          <h2>📋 QR ແຍກຕາມໂຕະ (1-{tables ? tables.length : '...'})</h2>
          <div className="table-qr-grid">
            {tablesError ? (
              <p style={{ gridColumn: '1 / -1' }}>ສ້າງ QR ບໍ່ສຳເລັດ ລອງໂຫລດໜ້ານີ້ໃໝ່</p>
            ) : tables === null ? (
              <p style={{ gridColumn: '1 / -1' }}>ກຳລັງສ້າງ QR...</p>
            ) : (
              tables.map((t) => (
                <div className="table-qr-card" key={t.table}>
                  <img src={t.qrImage} alt={`QR ໂຕະ ${t.table}`} />
                  <div className="tq-label">ໂຕະ {t.table}</div>
                </div>
              ))
            )}
          </div>

          <div className="table-qr-actions">
            <button className="table-qr-add-btn" onClick={handleAddTable} disabled={busy}>
              ➕ ເພີ່ມໂຕະ
            </button>
            <button className="table-qr-del-btn" onClick={handleDeleteTable} disabled={busy}>
              🗑️ ລຶບໂຕະສຸດທ້າຍ
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