import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getAdmins, addAdmin, deleteAdmin, resetAdminPassword } from '../../api.js';

export default function Staff() {
  const { admin } = useOutletContext();
  const [admins, setAdmins] = useState([]);
  const [form, setForm] = useState({ username: '', password: '', name: '' });

  useEffect(() => { load(); }, []);

  async function load() {
    setAdmins(await getAdmins());
  }

  async function handleAdd() {
    if (!form.username || !form.password || !form.name) {
      alert('ກະລຸນາປ້ອນຂໍ້ມູນໃຫ້ຄົບ');
      return;
    }
    try {
      await addAdmin(form.username, form.password, form.name);
      setForm({ username: '', password: '', name: '' });
      load();
    } catch (err) {
      alert('ຜິດພາດ: ' + (err.error || ''));
    }
  }

  async function handleDelete(id, name) {
    if (!confirm(`ຢືນຢັນລົບພະນັກງານ "${name}"?`)) return;
    try {
      await deleteAdmin(id);
      load();
    } catch (err) {
      alert('ຜິດພາດ: ' + (err.error || ''));
    }
  }

  async function handleReset(id, name) {
    const newPassword = prompt(`ໃສ່ລະຫັດຜ່ານໃໝ່ສຳລັບ "${name}" (ຢ່າງໜ້ອຍ 4 ໂຕ):`);
    if (!newPassword) return;
    try {
      await resetAdminPassword(id, newPassword);
      alert(`ຣີເຊັດລະຫັດຜ່ານຂອງ "${name}" ສຳເລັດ! ລະຫັດຜ່ານໃໝ່: ${newPassword}`);
    } catch (err) {
      alert('ຜິດພາດ: ' + (err.error || ''));
    }
  }

  return (
    <main>
      <div className="add-form">
        <h2>ເພີ່ມພະນັກງານໃໝ່</h2>
        <input placeholder="Username" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
        <input placeholder="Password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
        <input placeholder="ຊື່ພະນັກງານ" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <button onClick={handleAdd}>ເພີ່ມ</button>
      </div>

      <table>
        <tbody>
          <tr><th>ລະຫັດ</th><th>Username</th><th>ຊື່</th><th>ບົດບາດ</th><th></th></tr>
          {admins.map(a => (
            <tr key={a.id}>
              <td>{a.id}</td>
              <td>{a.username}</td>
              <td>{a.name}</td>
              <td>{a.role === 'owner' ? '👑 ເຈົ້າຂອງຮ້ານ' : '👤 ພະນັກງານ'}</td>
              <td>
                {admin?.role === 'owner' && a.role !== 'owner' && (
                  <>
                    <button className="delete-btn" onClick={() => handleDelete(a.id, a.name)}>ລົບ</button>
                    <button className="reset-btn" onClick={() => handleReset(a.id, a.name)}>ຣີເຊັດລະຫັດ</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}