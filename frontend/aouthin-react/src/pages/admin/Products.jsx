import React, { useEffect, useState } from 'react';
import { getProducts, addProduct, deleteProduct, API_BASE } from '../../api.js';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ name: '', price: '', size: '', color: '', stock: '' });
  const [file, setFile] = useState(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setProducts(await getProducts());
  }

  async function handleAdd() {
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    if (file) fd.append('image', file);
    await addProduct(fd);
    setForm({ name: '', price: '', size: '', color: '', stock: '' });
    setFile(null);
    setShowForm(false);
    load();
  }

  async function handleDelete(id) {
    if (!confirm('ຢືນຢັນລົບສິນຄ້ານີ້?')) return;
    await deleteProduct(id);
    load();
  }

  return (
    <main>
      {!showForm && (
        <button className="confirm-btn" style={{ marginBottom: 16, display: 'inline-block', width: 'auto' }} onClick={() => setShowForm(true)}>
        ➕ ເພີ່ມເມນູ
      </button>
      )}

      {showForm && (
        <div className="add-form">
          <h2>ເພີ່ມເມນູໃໝ່</h2>
          <input placeholder="ຊື່ເມນູ" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input placeholder="ລາຄາ" type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
          <select value={form.size} onChange={e => setForm({ ...form, size: e.target.value })}>
            <option value="">ປະເພດອາຫານ</option>
            <option value="ອາຫານ">ອາຫານ</option>
            <option value="ເຄື່ອງດື່ມ">ເຄື່ອງດື່ມ</option>
            <option value="ຂອງກິນຫຼິ້ນ">ຂອງກິນຫຼິ້ນ</option>
            <option value="ເສັ້ນ">ເສັ້ນ</option>
            <option value="ຕຳ">ຕຳ</option>
          </select>
          <select value={form.color} onChange={e => setForm({ ...form, color: e.target.value })}>
            <option value="">ລະດັບຄວາມແຊບ</option>
            <option value="ຫວານ">ຫວານ</option>
            <option value="ເຜັດປານກາງ">ເຜັດປານກາງ</option>
            <option value="ເຜັດຫຼາຍ">ເຜັດຫຼາຍ</option>
          </select>
          <input placeholder="ຈຳນວນ (ຈານ)" type="number" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} />
          <input type="file" onChange={e => setFile(e.target.files[0])} />
          <button onClick={handleAdd}>ເພີ່ມເມນູ</button>
          <button onClick={() => setShowForm(false)} style={{ background: '#a1887f' }}>ຍົກເລີກ</button>
        </div>
      )}

      <table>
        <tbody>
          <tr><th>ຮູບ</th><th>ຊື່ເມນູ</th><th>ລາຄາ</th><th>ປະເພດ</th><th>ຄວາມແຊບ</th><th>ຈຳນວນ</th><th></th></tr>
          {products.map(p => (
            <tr key={p.id}>
              <td>{p.image && <img src={`${API_BASE}${p.image}`} width="50" alt="" />}</td>
              <td>{p.name}</td>
              <td>{p.price} ກີບ</td>
              <td>{p.size}</td>
              <td>{p.color}</td>
              <td>{p.stock} ຈານ</td>
              <td><button className="delete-btn" onClick={() => handleDelete(p.id)}>ລົບ</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}