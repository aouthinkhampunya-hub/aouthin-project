import React, { useCallback, useEffect, useState } from 'react';
import { API_BASE } from '../../api.js';

// ===== ໜ້າ "ຕິດຕໍ່ລູກຄ້າ" =====
// ສະແດງເມນູທີ່ຄົວແຈ້ງ + ຊື່ ແລະ ເບີໂທ ຂອງລູກຄ້າທີ່ສັ່ງເມນູນັ້ນ ເພື່ອໃຫ້ແອັດມິນໂທ/ທັກຫາ

async function api(path, options = {}) {
  const res = await fetch(API_BASE + '/api' + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, ...data };
  return data;
}

const imgSrc = (p) => {
  if (!p) return '';
  if (/^(https?:|data:)/.test(p)) return p;
  return API_BASE + (p.startsWith('/') ? p : '/' + p);
};

const fmt = (v) =>
  v ? new Date(v).toLocaleString('en-GB', { timeZone: 'Asia/Vientiane' }) : '-';

const typeLabel = (c) => {
  if (c.order_type === 'pickup') return `🥡 ມາຮັບເອງ #${c.bill_no}`;
  if (c.order_type === 'delivery') return `🛵 ສົ່ງເຖິງບ້ານ #${c.bill_no}`;
  return `🍽️ ໂຕະ ${c.table_number}`;
};

// ເບີລາວ 020xxxxxxxx → ລິ້ງ WhatsApp 85620xxxxxxxx
const waLink = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  return 'https://wa.me/856' + digits.replace(/^0+/, '');
};

const keyOf = (a) => String(a.product_id ?? a.product_name);

// ລວມເລື່ອງທີ່ຄົວແຈ້ງເມນູດຽວກັນ (ສະຖານະດຽວກັນ) ໃຫ້ເປັນບັດດຽວ
// - ລູກຄ້າລວມກັນ (ບິນດຽວກັນນັບຄັ້ງດຽວ ໃຊ້ຂໍ້ມູນຈາກການແຈ້ງຄັ້ງຫຼ້າສຸດ)
// - ids = ລະຫັດທຸກການແຈ້ງທີ່ຖືກລວມ (ໃຊ້ຕອນກົດ "ຕິດຕໍ່ແລ້ວ" ແລະ "ລຶບ")
function groupAlerts(list) {
  const sorted = [...list].sort((x, y) => new Date(x.created_at) - new Date(y.created_at));
  const map = new Map();
  sorted.forEach((a) => {
    const k = `${a.status === 'open' ? 'open' : 'done'}|${keyOf(a)}`;
    let g = map.get(k);
    if (!g) {
      g = { ...a, ids: [], notes: [], reports: 0, byBill: new Map() };
      map.set(k, g);
    }
    g.ids.push(a.id);
    g.reports += 1;
    g.created_at = a.created_at; // ເວລາແຈ້ງຫຼ້າສຸດ
    g.reported_by = a.reported_by || g.reported_by;
    g.product_name = a.product_name;
    g.product_image = a.product_image || g.product_image;
    if (a.note && !g.notes.includes(a.note)) g.notes.push(a.note);
    (a.customers || []).forEach((c) => g.byBill.set(c.bill_id, c));
  });
  return [...map.values()]
    .map((g) => {
      const out = { ...g, customers: [...g.byBill.values()], note: g.notes.join(' • ') };
      delete out.byBill;
      return out;
    })
    .sort((x, y) => new Date(y.created_at) - new Date(x.created_at));
}

export default function ContactCustomers() {
  const [alerts, setAlerts] = useState(null); // null = ກຳລັງໂຫຼດ
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null); // ເລື່ອງທີ່ກຳລັງຈະລຶບ
  const [deleting, setDeleting] = useState(false);
  // ລູກຄ້າໜ້າໂຕະທີ່ແຈ້ງແລ້ວ (ຈື່ໄວ້ ເຖິງຣີເຟຣຊໜ້າກໍບໍ່ຫາຍ)
  const [notified, setNotified] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('notifiedCustomers') || '[]')); }
    catch (e) { return new Set(); }
  });

  const loadAlerts = useCallback(async () => {
    try {
      const d = await api('/kitchen-alerts');
      setAlerts(Array.isArray(d) ? d : []);
      setError('');
    } catch (e) {
      setAlerts((prev) => prev || []);
      setError(e?.error || 'ໂຫຼດຂໍ້ມູນບໍ່ໄດ້');
    }
  }, []);

  // ໂຫຼດຄັ້ງທຳອິດ + ຣີເຟຣຊທຸກ 10 ວິນາທີ
  useEffect(() => {
    loadAlerts();
    const t = setInterval(loadAlerts, 10000);
    return () => clearInterval(t);
  }, [loadAlerts]);

  const resolve = async (ids) => {
    try {
      await Promise.all(ids.map((id) => api(`/kitchen-alerts/${id}/resolve`, { method: 'PUT' })));
    } catch (e) {
      setError(e?.error || 'ບັນທຶກບໍ່ສຳເລັດ');
    }
    await loadAlerts();
    // ບອກແຖບເມນູໃຫ້ອັບເດດເລກສີແດງ
    window.dispatchEvent(new Event('kitchen-alerts-changed'));
  };

  // ແຈ້ງລູກຄ້າໜ້າໂຕະ: ຂຶ້ນຈຸດແດງທີ່ປຸ່ມ "ເບິ່ງບິນ" ຂອງໂຕະນັ້ນ ແລະສະແດງວ່າເມນູຍັງບໍ່ພ້ອມ
  const notifyCustomer = async (a, c) => {
    try {
      await api('/orders/notify-unavailable', {
        method: 'POST',
        body: JSON.stringify({
          bill_id: c.bill_id,
          product_id: a.product_id,
          product_name: a.product_name,
        }),
      });
      setError('');
      setNotified((prev) => {
        const next = new Set(prev);
        next.add(`${keyOf(a)}|${c.bill_id}`);
        try { localStorage.setItem('notifiedCustomers', JSON.stringify([...next].slice(-300))); } catch (e) { /* ignore */ }
        return next;
      });
    } catch (e) {
      setError(e?.error || 'ແຈ້ງລູກຄ້າບໍ່ສຳເລັດ');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await Promise.all(deleteTarget.ids.map((id) => api(`/kitchen-alerts/${id}`, { method: 'DELETE' })));
      setError('');
    } catch (e) {
      setError(e?.error || 'ລຶບບໍ່ສຳເລັດ');
    }
    setDeleting(false);
    setDeleteTarget(null);
    await loadAlerts();
    window.dispatchEvent(new Event('kitchen-alerts-changed'));
  };

  const grouped = groupAlerts(alerts || []);
  const openAlerts = grouped.filter((a) => a.status === 'open');
  const doneAlerts = grouped.filter((a) => a.status !== 'open');

  const renderAlert = (a) => {
    const isOpen = a.status === 'open';
    return (
      <div className={`ccp-card${isOpen ? '' : ' done'}`} key={`${a.status}-${keyOf(a)}`}>
        <div className="ccp-card-head">
          {a.product_image
            ? <img className="ccp-img" src={imgSrc(a.product_image)} alt="" />
            : <div className="ccp-img empty">🍽️</div>}
          <div className="ccp-card-title">
            <div className="ccp-menu">{a.product_name}</div>
            <div className="ccp-meta">
              ແຈ້ງໂດຍ {a.reported_by || 'ຄົວ'} • {fmt(a.created_at)}{a.reports > 1 ? ` • ແຈ້ງ ${a.reports} ຄັ້ງ` : ''}
            </div>
            {a.note && <div className="ccp-note">📝 {a.note}</div>}
          </div>
          <span className={`ccp-badge ${isOpen ? 'open' : 'done'}`}>
            {isOpen ? 'ລໍຕິດຕໍ່' : '✅ ຕິດຕໍ່ແລ້ວ'}
          </span>
        </div>

        {a.customers.length === 0 ? (
          <div className="ccp-none">ຕອນແຈ້ງ ບໍ່ມີບິນຄ້າງທີ່ສັ່ງເມນູນີ້</div>
        ) : (
          <div className="ccp-customers">
            {a.customers.map((c) => {
              const hasPhone = !!c.customer_phone;
              const sent = notified.has(`${keyOf(a)}|${c.bill_id}`);
              return (
                <div className="ccp-cust" key={c.bill_id}>
                  <div className="ccp-cust-main">
                    <div className="ccp-cust-name">
                      👤 {c.customer_name || (c.order_type === 'dine_in' ? `ລູກຄ້າໂຕະ ${c.table_number}` : 'ບໍ່ມີຊື່')}
                    </div>
                    <div className="ccp-cust-sub">
                      {typeLabel(c)} • ສັ່ງ <b>x{c.quantity}</b>
                    </div>
                  </div>
                  {hasPhone ? (
                    <div className="ccp-cust-actions">
                      <a className="ccp-phone" href={`tel:${c.customer_phone}`}>📞 {c.customer_phone}</a>
                      <a className="ccp-wa" href={waLink(c.customer_phone)} target="_blank" rel="noreferrer">💬 WhatsApp</a>
                    </div>
                  ) : isOpen && c.order_type !== 'pickup' && c.order_type !== 'delivery' ? (
                    <button
                      type="button"
                      className={`ccp-notify${sent ? ' sent' : ''}`}
                      disabled={sent}
                      onClick={() => notifyCustomer(a, c)}
                    >
                      {sent ? '✅ ແຈ້ງລູກຄ້າແລ້ວ' : '🔔 ແຈ້ງລູກຄ້າ (ເມນູບໍ່ພ້ອມ)'}
                    </button>
                  ) : (
                    <div className="ccp-nophone">ບໍ່ມີເບີໂທ (ສັ່ງໜ້າໂຕະ)</div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {isOpen && (
          <button type="button" className="ccp-resolve" onClick={() => resolve(a.ids)}>
            ✅ ຕິດຕໍ່ລູກຄ້າແລ້ວ
          </button>
        )}

        {!isOpen && (
          <button type="button" className="ccp-delete" onClick={() => setDeleteTarget(a)}>
            🗑️ ລຶບ
          </button>
        )}
      </div>
    );
  };

  return (
    <main>
      <style>{`
        body.is-admin .ccp-wrap { width: 100%; max-width: 1700px; margin: 0 auto; padding: 8px 8px 48px; box-sizing: border-box; }
        body.is-admin .ccp-title { margin: 0 0 6px; font-size: 32px; font-weight: 900; color: #7a1f0f; }
        body.is-admin .ccp-sub { margin: 0 0 22px; font-size: 17px; color: #6b5a4c; }
        body.is-admin .ccp-section { margin: 26px 0 14px; font-size: 20px; font-weight: 800; color: #6b5a4c; }
        body.is-admin .ccp-empty { padding: 70px 10px; text-align: center; color: #6b5a4c; font-size: 18px; }
        body.is-admin .ccp-error {
          margin: 0 0 14px; padding: 12px 16px; border-radius: 12px;
          background: #fdecea; color: #b3261e; font-size: 16px; font-weight: 700;
        }

        body.is-admin .ccp-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(560px, 1fr));
          gap: 20px;
          align-items: start;
        }

        body.is-admin .ccp-card {
          padding: 22px;
          border: 2px solid #e8b923; border-radius: 20px; background: #fffdf5;
        }
        body.is-admin .ccp-card.done { border-color: #e3d9ce; background: #faf7f3; opacity: 0.85; }
        body.is-admin .ccp-card-head { display: flex; align-items: center; gap: 18px; }
        body.is-admin .ccp-img {
          width: 92px; height: 92px; flex-shrink: 0; object-fit: cover; border-radius: 16px; background: #f3ece4;
        }
        body.is-admin .ccp-img.empty { display: flex; align-items: center; justify-content: center; font-size: 40px; }
        body.is-admin .ccp-card-title { flex: 1; min-width: 0; }
        body.is-admin .ccp-menu { font-size: 28px; font-weight: 900; color: #2b1b0e; line-height: 1.25; }
        body.is-admin .ccp-meta { font-size: 15px; color: #7d6e60; margin-top: 4px; }
        body.is-admin .ccp-note { margin-top: 6px; font-size: 16px; font-weight: 700; color: #b8380e; }
        body.is-admin .ccp-badge {
          flex-shrink: 0; padding: 8px 16px; border-radius: 999px; font-size: 15px; font-weight: 800;
        }
        body.is-admin .ccp-badge.open { background: #fff3cd; color: #7a5b00; }
        body.is-admin .ccp-badge.done { background: #e8f5e9; color: #2e6b1f; }

        body.is-admin .ccp-none { margin-top: 14px; padding: 12px; color: #6b5a4c; font-size: 16px; }
        body.is-admin .ccp-customers { margin-top: 16px; display: flex; flex-direction: column; gap: 12px; }
        body.is-admin .ccp-cust {
          display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px 16px;
          padding: 16px 18px; border-radius: 14px; background: #fff; border: 1px solid #f0e3d6;
        }
        body.is-admin .ccp-cust-name { font-size: 22px; font-weight: 800; color: #2b1b0e; }
        body.is-admin .ccp-cust-sub { font-size: 16px; color: #6b5a4c; margin-top: 4px; }
        body.is-admin .ccp-cust-actions { display: flex; flex-wrap: wrap; gap: 10px; }
        body.is-admin .ccp-phone, body.is-admin .ccp-wa {
          padding: 12px 20px; border-radius: 12px; font-size: 18px; font-weight: 800;
          text-decoration: none; white-space: nowrap;
        }
        body.is-admin .ccp-phone { background: #e3f2fd; color: #0d47a1; }
        body.is-admin .ccp-wa { background: #e8f5e9; color: #1b5e20; }
        body.is-admin .ccp-nophone { font-size: 16px; color: #8a7a6c; }

        body.is-admin .ccp-resolve {
          width: 100%; margin-top: 16px; min-height: 58px;
          border: none; border-radius: 14px;
          background: #2e7d32; color: #fff;
          font-size: 19px; font-weight: 800; font-family: inherit; cursor: pointer;
        }
        body.is-admin .ccp-resolve:hover { filter: brightness(1.08); }

        /* ປຸ່ມລຶບ: ນ້ອຍ ຢູ່ມຸມຂວາລຸ່ມຂອງບັດ */
        body.is-admin .ccp-delete {
          display: block; width: auto; margin: 12px 0 0 auto; min-height: 0;
          padding: 6px 14px;
          border: 1.5px solid #d9362b; border-radius: 8px;
          background: #fff; color: #d9362b;
          font-size: 13px; font-weight: 800; font-family: inherit; cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease;
        }
        body.is-admin .ccp-delete:hover { background: #d9362b; color: #fff; }

        body.is-admin .ccp-ov {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 10100;
          display: flex; align-items: center; justify-content: center;
          padding: 16px; background: rgba(30, 20, 10, 0.6);
        }
        body.is-admin .ccp-dlg {
          width: 100%; max-width: 380px; box-sizing: border-box;
          padding: 28px 26px 24px; border-radius: 22px; background: #fff;
          text-align: center; box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
        }
        body.is-admin .ccp-dlg-icon { font-size: 48px; line-height: 1.1; margin-bottom: 6px; }
        body.is-admin .ccp-dlg h3 { margin: 0 0 8px; font-size: 22px; font-weight: 900; color: #2b1b0e; }
        body.is-admin .ccp-dlg p { margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #4a3a2c; }
        body.is-admin .ccp-dlg-warn { font-size: 14px; font-weight: 700; color: #d9362b; }
        body.is-admin .ccp-dlg-actions { display: flex; gap: 10px; }
        body.is-admin .ccp-dlg-actions button {
          flex: 1; min-height: 50px; border: none; border-radius: 12px;
          font-size: 17px; font-weight: 800; font-family: inherit; cursor: pointer;
        }
        body.is-admin .ccp-dlg-no { background: #f3e4de; color: #7a1f0f; }
        body.is-admin .ccp-dlg-yes { background: #d9362b; color: #fff; }
        body.is-admin .ccp-dlg-actions button:disabled { opacity: 0.6; cursor: default; }

        body.is-admin .ccp-notify {
          padding: 12px 20px; border: none; border-radius: 12px;
          background: #d9362b; color: #fff;
          font-size: 18px; font-weight: 800; font-family: inherit; cursor: pointer;
          white-space: nowrap;
        }
        body.is-admin .ccp-notify:hover { filter: brightness(1.1); }
        body.is-admin .ccp-notify.sent { background: #e8f5e9; color: #1b5e20; cursor: default; filter: none; }

        @media (max-width: 700px) {
          body.is-admin .ccp-grid { grid-template-columns: 1fr; }
          body.is-admin .ccp-title { font-size: 26px; }
          body.is-admin .ccp-menu { font-size: 22px; }
          body.is-admin .ccp-img { width: 72px; height: 72px; }
        }
      `}</style>

      <div className="ccp-wrap">
        <h2 className="ccp-title">📞 ຕິດຕໍ່ລູກຄ້າ</h2>
        <p className="ccp-sub">ເມນູທີ່ຄົວແຈ້ງວ່າເຮັດບໍ່ໄດ້ ພ້ອມລູກຄ້າທີ່ສັ່ງເມນູນັ້ນ ເພື່ອໂທ ຫຼື ທັກຫາ</p>

        {error && <div className="ccp-error">⚠️ {error}</div>}
        {alerts === null && <div className="ccp-empty">ກຳລັງໂຫຼດ...</div>}

        {alerts !== null && alerts.length === 0 && !error && (
          <div className="ccp-empty">ຍັງບໍ່ມີເລື່ອງທີ່ຄົວແຈ້ງ</div>
        )}

        {openAlerts.length > 0 && (
          <>
            <div className="ccp-section">ລໍຕິດຕໍ່ ({openAlerts.length})</div>
            <div className="ccp-grid">{openAlerts.map(renderAlert)}</div>
          </>
        )}
        {doneAlerts.length > 0 && (
          <>
            <div className="ccp-section">ຕິດຕໍ່ແລ້ວ</div>
            <div className="ccp-grid">{doneAlerts.map(renderAlert)}</div>
          </>
        )}
      </div>

      {deleteTarget && (
        <div
          className="ccp-ov"
          onClick={(e) => e.target === e.currentTarget && !deleting && setDeleteTarget(null)}
        >
          <div className="ccp-dlg">
            <div className="ccp-dlg-icon">🗑️</div>
            <h3>ລຶບລາຍການນີ້?</h3>
            <p>
              ລຶບ <b>{deleteTarget.product_name}</b> ອອກຈາກລາຍການຕິດຕໍ່ລູກຄ້າ
              <br />
              <span className="ccp-dlg-warn">ການລຶບບໍ່ສາມາດກູ້ຄືນໄດ້</span>
            </p>
            <div className="ccp-dlg-actions">
              <button type="button" className="ccp-dlg-no" disabled={deleting} onClick={() => setDeleteTarget(null)}>
                ຍົກເລີກ
              </button>
              <button type="button" className="ccp-dlg-yes" disabled={deleting} onClick={confirmDelete}>
                {deleting ? 'ກຳລັງລຶບ...' : 'ລຶບ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}