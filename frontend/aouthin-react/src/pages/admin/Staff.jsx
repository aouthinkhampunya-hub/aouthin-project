import React, { useEffect, useState } from 'react';
import { authMe, getAdmins, addAdmin, deleteAdmin, resetAdminPassword } from '../../api.js';
import '../../styles/admin-staff.css';

// ຫົວຂໍ້ຂອງແຕ່ລະສ່ວນ (ຢູ່ເທິງຕາຕະລາງ)
const sectionTitleStyle = {
  margin: '0 0 12px',
  fontSize: 20,
  fontWeight: 800,
  color: '#7a1f0f',
};

export default function Staff() {
  const [role, setRole] = useState(null);
  const [admins, setAdmins] = useState([]);

  // popup ເພີ່ມບັນຊີ: addRole = 'staff' (ພະນັກງານ) ຫຼື 'kitchen' (ພະນັກງານຄົວ)
  const [addOpen, setAddOpen] = useState(false);
  const [addRole, setAddRole] = useState('staff');
  const [form, setForm] = useState({ username: '', password: '', name: '' });
  const [addError, setAddError] = useState('');
  const [saving, setSaving] = useState(false);

  // popup ລົບ / ຣີເຊັດລະຫັດ / ແຈ້ງເຕືອນ
  const [deleteTarget, setDeleteTarget] = useState(null); // { id, name }
  const [resetTarget, setResetTarget] = useState(null);   // { id, name }
  const [resetPw, setResetPw] = useState('');
  const [notice, setNotice] = useState('');

  const loadStaff = async () => {
    try {
      const data = await getAdmins();
      setAdmins(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    authMe().then((d) => setRole(d.role)).catch(() => setRole(null));
    loadStaff();
  }, []);

  // ກົດ Esc ປິດ popup ເພີ່ມບັນຊີ
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setAddOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const openAdd = (whichRole) => {
    setAddRole(whichRole);
    setForm({ username: '', password: '', name: '' });
    setAddError('');
    setSaving(false);
    setAddOpen(true);
  };

  const submitAdd = async () => {
    const username = form.username.trim();
    const password = form.password.trim();
    const name = form.name.trim();
    setAddError('');
    if (!username || !password || !name) {
      setAddError('ກະລຸນາປ້ອນຂໍ້ມູນໃຫ້ຄົບ');
      return;
    }
    setSaving(true);
    try {
      await addAdmin(username, password, name, addRole);
    } catch (e) {
      setAddError(e?.error || 'ບັນທຶກບໍ່ສຳເລັດ');
      setSaving(false);
      return;
    }
    setAddOpen(false);
    setSaving(false);
    await loadStaff();
    setNotice(addRole === 'kitchen' ? '✅ ເພີ່ມພະນັກງານຄົວແລ້ວ' : '✅ ເພີ່ມພະນັກງານແລ້ວ');
  };

  const confirmDelete = async () => {
    const target = deleteTarget;
    setDeleteTarget(null);
    try {
      await deleteAdmin(target.id);
      loadStaff();
    } catch (e) {
      setNotice('ຜິດພາດ: ' + (e?.error || ''));
    }
  };

  const confirmReset = async () => {
    if (!resetPw || resetPw.length < 4) {
      setNotice('ລະຫັດຜ່ານຕ້ອງມີຢ່າງໜ້ອຍ 4 ໂຕ');
      return;
    }
    const target = resetTarget;
    const pw = resetPw;
    setResetTarget(null);
    try {
      await resetAdminPassword(target.id, pw);
      setNotice(`ຣີເຊັດລະຫັດຜ່ານສຳເລັດ! ລະຫັດຜ່ານໃໝ່: ${pw}`);
    } catch (e) {
      setNotice('ຜິດພາດ: ' + (e?.error || ''));
    }
  };

  const setField = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  // ແຍກລາຍຊື່: ພະນັກງານ (ລວມເຈົ້າຂອງຮ້ານ) / ພະນັກງານຄົວ
  const staffList = admins.filter((a) => a.role !== 'kitchen');
  const kitchenList = admins.filter((a) => a.role === 'kitchen');

  const kitchenLoginUrl = `${window.location.origin}/kitchen/login`;

  // ປຸ່ມ ລົບ / ຣີເຊັດລະຫັດ (ສະເພາະເຈົ້າຂອງຮ້ານ ແລະ ບໍ່ແມ່ນແຖວເຈົ້າຂອງ)
  const renderActions = (a) =>
    role === 'owner' && a.role !== 'owner' && (
      <div className="staff-actions">
        <button className="staff-del-btn" onClick={() => setDeleteTarget({ id: a.id, name: a.name })}>ລົບ</button>
        <button
          className="staff-reset-btn"
          onClick={() => { setResetTarget({ id: a.id, name: a.name }); setResetPw(''); }}
        >
          ຣີເຊັດລະຫັດ
        </button>
      </div>
    );

  const renderTable = (list, emptyText) => (
    <table className="staff-table">
      <thead>
        <tr><th>ລະຫັດ</th><th>Username</th><th>ຊື່</th><th>ບົດບາດ</th><th></th></tr>
      </thead>
      <tbody>
        {list.length === 0 && (
          <tr><td colSpan={5} style={{ textAlign: 'center', color: '#6b5a4c' }}>{emptyText}</td></tr>
        )}
        {list.map((a, index) => (
          <tr key={a.id}>
            <td>{index + 1}</td>
            <td>{a.username}</td>
            <td>{a.name}</td>
            <td>
              {a.role === 'owner' ? '👑 ເຈົ້າຂອງຮ້ານ' : a.role === 'kitchen' ? '👨‍🍳 ພະນັກງານຄົວ' : '👤 ພະນັກງານ'}
            </td>
            <td>{renderActions(a)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className="staff-page">
      {/* ===== ສ່ວນ 1: ພະນັກງານ ===== */}
      <h2 style={sectionTitleStyle}>👥 ພະນັກງານ</h2>
      <button type="button" className="staff-add-btn" onClick={() => openAdd('staff')}>➕ ເພີ່ມພະນັກງານ</button>
      {renderTable(staffList, 'ຍັງບໍ່ມີພະນັກງານ')}

      {/* ===== ສ່ວນ 2: ພະນັກງານຄົວ ===== */}
      <h2 style={{ ...sectionTitleStyle, marginTop: 40 }}>👨‍🍳 ພະນັກງານຄົວ</h2>
      <p style={{ margin: '0 0 12px', color: '#6b5a4c', fontSize: 14, lineHeight: 1.6 }}>
        ບັນຊີຄົວເຂົ້າໄດ້ສະເພາະໜ້າຄົວ ທີ່ລິ້ງ <b>{kitchenLoginUrl}</b>
      </p>
      <button type="button" className="staff-add-btn" onClick={() => openAdd('kitchen')}>➕ ເພີ່ມພະນັກງານຄົວ</button>
      {renderTable(kitchenList, 'ຍັງບໍ່ມີບັນຊີຄົວ')}

      {/* ເພີ່ມບັນຊີ (ບໍ່ປິດເມື່ອກົດພື້ນມືດ ເພື່ອກັນຂໍ້ມູນຫາຍ) */}
      {addOpen && (
        <div className="sp-overlay">
          <div className="sp-box">
            <h3>{addRole === 'kitchen' ? '➕ ເພີ່ມພະນັກງານຄົວໃໝ່' : '➕ ເພີ່ມພະນັກງານໃໝ່'}</h3>
            <div className="sp-field">
              <label>Username</label>
              <input type="text" placeholder="Username" value={form.username} onChange={setField('username')} autoFocus />
            </div>
            <div className="sp-field">
              <label>Password</label>
              <input type="password" placeholder="Password" value={form.password} onChange={setField('password')} />
            </div>
            <div className="sp-field">
              <label>{addRole === 'kitchen' ? 'ຊື່ພະນັກງານຄົວ' : 'ຊື່ພະນັກງານ'}</label>
              <input
                type="text"
                placeholder={addRole === 'kitchen' ? 'ຊື່ພະນັກງານຄົວ' : 'ຊື່ພະນັກງານ'}
                value={form.name}
                onChange={setField('name')}
              />
            </div>
            {addError && <div className="sp-error">{addError}</div>}
            <div className="sp-actions">
              <button className="sp-cancel" onClick={() => setAddOpen(false)}>ຍົກເລີກ</button>
              <button className="sp-save" onClick={submitAdd} disabled={saving}>
                {saving ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ຢືນຢັນລົບ */}
      {deleteTarget && (
        <div className="sm-overlay">
          <div className="sm-box">
            <p>ຢືນຢັນລົບບັນຊີ "{deleteTarget.name}"?</p>
            <div className="sm-buttons">
              <button className="sm-cancel" onClick={() => setDeleteTarget(null)}>ຍົກເລີກ</button>
              <button className="sm-danger" onClick={confirmDelete}>ລົບ</button>
            </div>
          </div>
        </div>
      )}

      {/* ຣີເຊັດລະຫັດ */}
      {resetTarget && (
        <div className="sm-overlay">
          <div className="sm-box">
            <p>ໃສ່ລະຫັດຜ່ານໃໝ່ສຳລັບ "{resetTarget.name}" (ຢ່າງໜ້ອຍ 4 ໂຕ):</p>
            <input
              type="text"
              placeholder="ລະຫັດຜ່ານໃໝ່"
              value={resetPw}
              onChange={(e) => setResetPw(e.target.value)}
              autoFocus
            />
            <div className="sm-buttons">
              <button className="sm-cancel" onClick={() => setResetTarget(null)}>ຍົກເລີກ</button>
              <button className="sm-ok" onClick={confirmReset}>ບັນທຶກ</button>
            </div>
          </div>
        </div>
      )}

      {/* ແຈ້ງເຕືອນ */}
      {notice && (
        <div className="sm-overlay">
          <div className="sm-box">
            <p>{notice}</p>
            <div className="sm-buttons">
              <button className="sm-ok" onClick={() => setNotice('')}>OK</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}