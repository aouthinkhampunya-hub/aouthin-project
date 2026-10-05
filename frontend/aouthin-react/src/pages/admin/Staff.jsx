import React, { useEffect, useState } from 'react';
import { authMe, getAdmins, addAdmin, deleteAdmin, resetAdminPassword } from '../../api.js';
import '../../styles/admin-staff.css';

export default function Staff() {
  const [role, setRole] = useState(null);
  const [admins, setAdmins] = useState([]);

  // popup ເພີ່ມພະນັກງານ
  const [addOpen, setAddOpen] = useState(false);
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

  // ກົດ Esc ປິດ popup ເພີ່ມພະນັກງານ
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setAddOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const openAdd = () => {
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
      await addAdmin(username, password, name);
    } catch (e) {
      setAddError(e?.error || 'ບັນທຶກບໍ່ສຳເລັດ');
      setSaving(false);
      return;
    }
    setAddOpen(false);
    setSaving(false);
    await loadStaff();
    setNotice('✅ ເພີ່ມພະນັກງານແລ້ວ');
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

  return (
    <div className="staff-page">
      <button type="button" className="staff-add-btn" onClick={openAdd}>➕ ເພີ່ມພະນັກງານ</button>

      <table className="staff-table">
        <thead>
          <tr><th>ລະຫັດ</th><th>Username</th><th>ຊື່</th><th>ບົດບາດ</th><th></th></tr>
        </thead>
        <tbody>
          {admins.map((a, index) => (
            <tr key={a.id}>
              <td>{index + 1}</td>
              <td>{a.username}</td>
              <td>{a.name}</td>
              <td>{a.role === 'owner' ? '👑 ເຈົ້າຂອງຮ້ານ' : '👤 ພະນັກງານ'}</td>
              <td>
                {role === 'owner' && a.role !== 'owner' && (
                  <div className="staff-actions">
                    <button className="staff-del-btn" onClick={() => setDeleteTarget({ id: a.id, name: a.name })}>ລົບ</button>
                    <button
                      className="staff-reset-btn"
                      onClick={() => { setResetTarget({ id: a.id, name: a.name }); setResetPw(''); }}
                    >
                      ຣີເຊັດລະຫັດ
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ເພີ່ມພະນັກງານ (ບໍ່ປິດເມື່ອກົດພື້ນມືດ ເພື່ອກັນຂໍ້ມູນຫາຍ) */}
      {addOpen && (
        <div className="sp-overlay">
          <div className="sp-box">
            <h3>➕ ເພີ່ມພະນັກງານໃໝ່</h3>
            <div className="sp-field">
              <label>Username</label>
              <input type="text" placeholder="Username" value={form.username} onChange={setField('username')} autoFocus />
            </div>
            <div className="sp-field">
              <label>Password</label>
              <input type="password" placeholder="Password" value={form.password} onChange={setField('password')} />
            </div>
            <div className="sp-field">
              <label>ຊື່ພະນັກງານ</label>
              <input type="text" placeholder="ຊື່ພະນັກງານ" value={form.name} onChange={setField('name')} />
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
            <p>ຢືນຢັນລົບພະນັກງານ "{deleteTarget.name}"?</p>
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