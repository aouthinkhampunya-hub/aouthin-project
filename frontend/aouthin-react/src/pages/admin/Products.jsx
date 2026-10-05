import { useEffect, useRef, useState } from 'react';
import {
  getProducts, deleteProduct, addProduct, updateProductField, updateProductImage,
  getOptions, addOption, removeOption, API_BASE,
} from '../../api.js';
import '../../styles/admin-products.css';

const imgUrl = (p) => (!p ? '' : /^(https?:|blob:)/.test(p) ? p : API_BASE + p);

const clamp = (v, max) => {
  if (v === '') return '';
  const n = Number(v);
  return isNaN(n) || n < 0 || n > max ? null : v; // null = ປະຕິເສດຄ່າ
};

const emptyAdd = { name: '', price: '', stock: '', size: '', color: '' };

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [spices, setSpices] = useState([]);
  const [toast, setToast] = useState('');

  // popup ແກ້ໄຂ
  const [editing, setEditing] = useState(null);       // product
  const [editForm, setEditForm] = useState({});
  const [editFile, setEditFile] = useState(null);
  const [editPreview, setEditPreview] = useState(null);
  const [saveConfirm, setSaveConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  // popup ລຶບເມນູ
  const [deleting, setDeleting] = useState(null);
  const [delBusy, setDelBusy] = useState(false);

  // popup ເພີ່ມເມນູ
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(emptyAdd);
  const [addFile, setAddFile] = useState(null);
  const [addPreview, setAddPreview] = useState(null);
  const [addError, setAddError] = useState('');
  const [addSaving, setAddSaving] = useState(false);

  // ຕົວເລືອກ (ປະເພດ / ຄວາມເຜັດ)
  const [optInput, setOptInput] = useState(null);     // { type }
  const [optValue, setOptValue] = useState('');
  const [optDel, setOptDel] = useState(null);         // { type, value }

  const toastTimer = useRef();
  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2200);
  };

  const loadOptions = async () => {
    const data = await getOptions();
    setCategories(data.categories);
    setSpices(data.spiceLevels);
  };
  const loadProducts = async () => {
    setProducts(await getProducts());
    setLoading(false);
  };
  useEffect(() => {
    (async () => {
      try { await loadOptions(); await loadProducts(); }
      catch (e) { console.error(e); setLoading(false); }
    })();
  }, []);

  // Esc ປິດ popup ຊັ້ນເທິງສຸດ
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (optDel) setOptDel(null);
      else if (optInput) setOptInput(null);
      else if (saveConfirm) setSaveConfirm(false);
      else if (deleting) setDeleting(null);
      else if (editing) closeEdit();
      else if (addOpen) closeAdd();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  /* ===================== ແກ້ໄຂ ===================== */
  const openEdit = (p) => {
    setEditing(p);
    setEditForm({ name: p.name ?? '', price: Number(p.price), stock: p.stock, size: p.size ?? '', color: p.color ?? '' });
    setEditFile(null);
    setEditPreview(null);
  };
  const closeEdit = () => {
    if (editPreview) URL.revokeObjectURL(editPreview);
    setEditing(null); setEditFile(null); setEditPreview(null);
    setSaveConfirm(false); setSaving(false);
  };
  const onEditImage = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) { alert('ອະນຸຍາດແຕ່ໄຟລ໌ຮູບພາບເທົ່ານັ້ນ (jpg, png, gif, ...)'); e.target.value = ''; return; }
    if (editPreview) URL.revokeObjectURL(editPreview);
    setEditFile(f);
    setEditPreview(URL.createObjectURL(f));
  };
  const setEditNum = (key, max) => (e) => {
    const v = clamp(e.target.value, max);
    if (v !== null) setEditForm({ ...editForm, [key]: v });
  };

  const updateField = async (id, field, value) => {
    try { await updateProductField(id, field, value); return true; }
    catch { return false; }
  };
  const uploadImage = async (id, file) => {
    const fd = new FormData();
    fd.append('image', file);
    try { await updateProductImage(id, fd); return true; }
    catch (e) { alert(e?.error || 'ອັບໂຫລດຮູບບໍ່ສຳເລັດ'); return false; }
  };

  // ກົດ "ບັນທຶກ" ໃນ popup ແກ້ໄຂ → ກວດຂໍ້ມູນ → ຖາມຢືນຢັນ
  const askSave = () => {
    if (!String(editForm.name).trim()) return alert('ກະລຸນາໃສ່ຊື່ເມນູ');
    if (editForm.price === '' || Number(editForm.price) < 0) return alert('ກະລຸນາໃສ່ລາຄາໃຫ້ຖືກຕ້ອງ');
    if (editForm.stock === '' || Number(editForm.stock) < 0) return alert('ກະລຸນາໃສ່ຈຳນວນໃຫ້ຖືກຕ້ອງ');
    setSaveConfirm(true);
  };
  const doSave = async () => {
    setSaveConfirm(false);
    const p = editing;
    const name = String(editForm.name).trim();
    const changes = [];
    if (name !== p.name) changes.push(['name', name]);
    if (Number(editForm.price) !== Number(p.price)) changes.push(['price', editForm.price]);
    if (editForm.size !== p.size) changes.push(['size', editForm.size]);
    if (editForm.color !== p.color) changes.push(['color', editForm.color]);
    if (Number(editForm.stock) !== Number(p.stock)) changes.push(['stock', editForm.stock]);

    if (changes.length === 0 && !editFile) { closeEdit(); return; }

    setSaving(true);
    for (const [field, value] of changes) {
      if (!(await updateField(p.id, field, value))) {
        alert('ບັນທຶກບໍ່ສຳເລັດ ກະລຸນາລອງໃໝ່ອີກຄັ້ງ');
        setSaving(false);
        return;
      }
    }
    if (editFile && !(await uploadImage(p.id, editFile))) { setSaving(false); return; }

    closeEdit();
    await loadProducts();
    showToast('✅ ບັນທຶກແລ້ວ');
  };

  /* ===================== ລຶບເມນູ ===================== */
  const confirmDelete = async () => {
    setDelBusy(true);
    try {
      await deleteProduct(deleting.id);
    } catch (e) {
      setDeleting(null); setDelBusy(false);
      showToast('❌ ' + (e?.error || 'ລຶບບໍ່ສຳເລັດ'));
      return;
    }
    setDeleting(null); setDelBusy(false);
    await loadProducts();
    showToast('🗑️ ລຶບເມນູແລ້ວ');
  };

  /* ===================== ເພີ່ມເມນູ ===================== */
  const openAdd = () => {
    setAddForm(emptyAdd); setAddFile(null); setAddPreview(null);
    setAddError(''); setAddSaving(false); setAddOpen(true);
  };
  const closeAdd = () => {
    if (addPreview) URL.revokeObjectURL(addPreview);
    setAddOpen(false); setAddFile(null); setAddPreview(null);
  };
  const onAddImage = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) { setAddError('ອະນຸຍາດແຕ່ໄຟລ໌ຮູບພາບເທົ່ານັ້ນ (jpg, png, gif, ...)'); e.target.value = ''; return; }
    setAddError('');
    if (addPreview) URL.revokeObjectURL(addPreview);
    setAddFile(f);
    setAddPreview(URL.createObjectURL(f));
  };
  const setAddNum = (key, max) => (e) => {
    const v = clamp(e.target.value, max);
    if (v !== null) setAddForm({ ...addForm, [key]: v });
  };
  const saveAdd = async () => {
    const { name, price, stock, size, color } = addForm;
    setAddError('');
    if (!name.trim() || price === '') return setAddError('ກະລຸນາໃສ່ຊື່ເມນູ ແລະ ລາຄາ');
    if (Number(price) > 1000000) return setAddError('ລາຄາຕ້ອງບໍ່ເກີນ 1,000,000 ກີບ');
    if (Number(stock) > 100) return setAddError('ຈຳນວນສະຕັອກຕ້ອງບໍ່ເກີນ 100');

    const fd = new FormData();
    fd.append('name', name.trim());
    fd.append('price', price);
    fd.append('size', size);
    fd.append('color', color);
    fd.append('stock', stock || 0);
    if (addFile) fd.append('image', addFile);

    setAddSaving(true);
    try {
      await addProduct(fd);
    } catch (e) {
      setAddError(e?.error || 'ບັນທຶກບໍ່ສຳເລັດ ກະລຸນາລອງໃໝ່ອີກຄັ້ງ');
      setAddSaving(false);
      return;
    }
    closeAdd();
    await loadProducts();
    showToast('✅ ເພີ່ມເມນູແລ້ວ');
  };

  /* ============ ເພີ່ມ / ລຶບ ຕົວເລືອກ (ປະເພດ, ຄວາມເຜັດ) ============ */
  const submitOption = async () => {
    const value = optValue.trim();
    if (!value) return;
    const type = optInput.type;
    try { await addOption(type, value); }
    catch { return showToast('❌ ເພີ່ມບໍ່ສຳເລັດ'); }
    setOptInput(null); setOptValue('');
    await loadOptions();
    setAddForm((f) => ({ ...f, [type === 'category' ? 'size' : 'color']: value }));
  };
  const askRemoveOption = (type) => {
    const value = type === 'category' ? addForm.size : addForm.color;
    if (!value) return setAddError('ກະລຸນາເລືອກຕົວເລືອກທີ່ຢາກລຶບກ່ອນ');
    setAddError('');
    setOptDel({ type, value });
  };
  const confirmRemoveOption = async () => {
    const { type, value } = optDel;
    try { await removeOption(type, value); }
    catch { setOptDel(null); return showToast('❌ ລຶບບໍ່ສຳເລັດ'); }
    setOptDel(null);
    await loadOptions();
    setAddForm((f) => ({ ...f, [type === 'category' ? 'size' : 'color']: '' }));
  };

  // ຖ້າຄ່າເກົ່າບໍ່ຢູ່ໃນລາຍການ ໃຫ້ເພີ່ມໃສ່ໜ້າສຸດ
  const withCurrent = (list, cur) => (!cur || list.includes(cur) ? list : [cur, ...list]);

  return (
    <main>
      <button type="button" className="confirm-btn"
        style={{ display: 'inline-block', width: 'auto', marginBottom: 16 }}
        onClick={openAdd}>
        ➕ ເພີ່ມເມນູ
      </button>

      <section id="product-list">
        {loading ? <p>ກຳລັງໂຫລດ...</p> : products.length === 0 ? <p>ຍັງບໍ່ມີເມນູ</p> : (
          <table>
            <thead>
              <tr>
                <th>ຮູບ</th><th>ຊື່ເມນູ</th><th>ລາຄາ</th><th>ປະເພດ</th>
                <th>ຄວາມເຜັດ</th><th>ຈຳນວນ</th><th></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.image
                      ? <img src={imgUrl(p.image)} width="50" height="50" alt="" style={{ objectFit: 'cover', borderRadius: 6 }} />
                      : <div className="no-img-box">ບໍ່ມີຮູບ</div>}
                  </td>
                  <td>{p.name}</td>
                  <td>{Number(p.price)} ກີບ</td>
                  <td>{p.size}</td>
                  <td>{p.color}</td>
                  <td>{p.stock} ຈານ</td>
                  <td className="action-cell">
                    <button className="edit-btn" onClick={() => openEdit(p)}>ແກ້ໄຂ</button>
                    <button className="delete-btn" onClick={() => setDeleting(p)}>ລຶບ</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ===== popup ແກ້ໄຂ ===== */}
      {editing && (
        <div className="edit-modal-overlay" onClick={(e) => e.target === e.currentTarget && closeEdit()}>
          <div className="edit-modal-box">
            <h3>ແກ້ໄຂເມນູ</h3>
            <div className="edit-img-wrap">
              <div className="edit-img-box">
                {editPreview || editing.image
                  ? <img src={editPreview || imgUrl(editing.image)} className="edit-img" alt="" />
                  : 'ບໍ່ມີຮູບ'}
              </div>
              <label className="edit-img-btn" htmlFor="edit-image-input">📷 ປ່ຽນຮູບ</label>
              <input type="file" id="edit-image-input" accept="image/*" style={{ display: 'none' }} onChange={onEditImage} />
            </div>
            <div className="edit-field">
              <label>ຊື່ເມນູ</label>
              <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div className="edit-row">
              <div className="edit-field">
                <label>ລາຄາ (ກີບ)</label>
                <input type="number" min="0" max="1000000" value={editForm.price} onChange={setEditNum('price', 1000000)} />
              </div>
              <div className="edit-field">
                <label>ຈຳນວນ (ຈານ)</label>
                <input type="number" min="0" max="100" value={editForm.stock} onChange={setEditNum('stock', 100)} />
              </div>
            </div>
            <div className="edit-row">
              <div className="edit-field">
                <label>ປະເພດ</label>
                <select value={editForm.size} onChange={(e) => setEditForm({ ...editForm, size: e.target.value })}>
                  {withCurrent(categories, editing.size).map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="edit-field">
                <label>ຄວາມເຜັດ</label>
                <select value={editForm.color} onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}>
                  {withCurrent(spices, editing.color).map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
            <div className="edit-actions">
              <button className="edit-cancel" onClick={closeEdit}>ຍົກເລີກ</button>
              <button className="edit-save" disabled={saving} onClick={askSave}>
                {saving ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== ຢືນຢັນບັນທຶກການແກ້ໄຂ ===== */}
      {saveConfirm && (
        <div className="edit-modal-overlay top" onClick={(e) => e.target === e.currentTarget && setSaveConfirm(false)}>
          <div className="del-modal-box">
            <div className="del-modal-icon"></div>
            <h3>ບັນທຶກການແກ້ໄຂ</h3>
            <p>ຕ້ອງການບັນທຶກການແກ້ໄຂເມນູນີ້ບໍ?</p>
            <div className="del-actions">
              <button className="del-cancel" onClick={() => setSaveConfirm(false)}>ຍົກເລີກ</button>
              <button className="edit-save" onClick={doSave}>ບັນທຶກ</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== ຢືນຢັນລຶບເມນູ ===== */}
      {deleting && (
        <div className="edit-modal-overlay" onClick={(e) => e.target === e.currentTarget && setDeleting(null)}>
          <div className="del-modal-box">
            <div className="del-modal-icon">🗑️</div>
            <h3>ລຶບເມນູ</h3>
            <p>ຢືນຢັນວ່າຈະລຶບ <span className="del-modal-name">{deleting.name}</span> ອອກຈາກເມນູ?</p>
            <p className="del-modal-warn">ການລຶບບໍ່ສາມາດກູ້ຄືນໄດ້</p>
            <div className="del-actions">
              <button className="del-cancel" onClick={() => setDeleting(null)}>ຍົກເລີກ</button>
              <button className="del-confirm" disabled={delBusy} onClick={confirmDelete}>
                {delBusy ? 'ກຳລັງລຶບ...' : 'ລຶບ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== popup ເພີ່ມເມນູ (ບໍ່ປິດເມື່ອກົດພື້ນມືດ) ===== */}
      {addOpen && (
        <div className="edit-modal-overlay">
          <div className="edit-modal-box">
            <h3>➕ ເພີ່ມເມນູໃໝ່</h3>
            <div className="edit-img-wrap">
              <div className="edit-img-box">
                {addPreview ? <img src={addPreview} className="edit-img" alt="" /> : 'ຍັງບໍ່ມີຮູບ'}
              </div>
              <label className="edit-img-btn" htmlFor="add-image-input">📷 ເລືອກຮູບ</label>
              <input type="file" id="add-image-input" accept="image/*" style={{ display: 'none' }} onChange={onAddImage} />
            </div>
            <div className="edit-field">
              <label>ຊື່ເມນູ</label>
              <input type="text" placeholder="ຊື່ເມນູ" autoFocus value={addForm.name}
                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} />
            </div>
            <div className="edit-row">
              <div className="edit-field">
                <label>ລາຄາ (ກີບ)</label>
                <input type="number" placeholder="ລາຄາ" min="0" max="1000000" value={addForm.price} onChange={setAddNum('price', 1000000)} />
              </div>
              <div className="edit-field">
                <label>ຈຳນວນ (ຈານ)</label>
                <input type="number" placeholder="ຈຳນວນ" min="0" max="100" value={addForm.stock} onChange={setAddNum('stock', 100)} />
              </div>
            </div>
            <div className="edit-field">
              <label>ປະເພດອາຫານ</label>
              <div className="opt-row">
                <select value={addForm.size} onChange={(e) => setAddForm({ ...addForm, size: e.target.value })}>
                  <option value="">ປະເພດອາຫານ</option>
                  {categories.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <button type="button" className="opt-btn opt-add" title="ເພີ່ມປະເພດໃໝ່"
                  onClick={() => { setOptValue(''); setOptInput({ type: 'category' }); }}>+</button>
                <button type="button" className="opt-btn opt-del" title="ລຶບປະເພດທີ່ເລືອກ"
                  onClick={() => askRemoveOption('category')}>🗑</button>
              </div>
            </div>
            <div className="edit-field">
              <label>ລະດັບຄວາມເຜັດ</label>
              <div className="opt-row">
                <select value={addForm.color} onChange={(e) => setAddForm({ ...addForm, color: e.target.value })}>
                  <option value="">ລະດັບຄວາມເຜັດ</option>
                  {spices.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <button type="button" className="opt-btn opt-add" title="ເພີ່ມລະດັບໃໝ່"
                  onClick={() => { setOptValue(''); setOptInput({ type: 'spice' }); }}>+</button>
                <button type="button" className="opt-btn opt-del" title="ລຶບລະດັບທີ່ເລືອກ"
                  onClick={() => askRemoveOption('spice')}>🗑</button>
              </div>
            </div>
            {addError && <div className="add-error">{addError}</div>}
            <div className="edit-actions">
              <button className="edit-cancel" onClick={closeAdd}>ຍົກເລີກ</button>
              <button className="edit-save" disabled={addSaving} onClick={saveAdd}>
                {addSaving ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== ເພີ່ມຕົວເລືອກໃໝ່ ===== */}
      {optInput && (
        <div className="edit-modal-overlay top" onClick={(e) => e.target === e.currentTarget && setOptInput(null)}>
          <div className="del-modal-box">
            <div className="del-modal-icon">➕</div>
            <h3>{optInput.type === 'category' ? 'ເພີ່ມປະເພດອາຫານໃໝ່' : 'ເພີ່ມລະດັບຄວາມເຜັດໃໝ່'}</h3>
            <input type="text" className="opt-input" autoFocus value={optValue}
              placeholder={optInput.type === 'category' ? 'ໃສ່ຊື່ປະເພດອາຫານ' : 'ໃສ່ຊື່ລະດັບຄວາມເຜັດ'}
              onChange={(e) => setOptValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitOption()} />
            <div className="del-actions">
              <button className="del-cancel" onClick={() => setOptInput(null)}>ຍົກເລີກ</button>
              <button className="opt-confirm" onClick={submitOption}>ບັນທຶກ</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== ຢືນຢັນລຶບຕົວເລືອກ ===== */}
      {optDel && (
        <div className="edit-modal-overlay top" onClick={(e) => e.target === e.currentTarget && setOptDel(null)}>
          <div className="del-modal-box">
            <div className="del-modal-icon">🗑️</div>
            <h3>ລຶບຕົວເລືອກ</h3>
            <p>ລຶບ <span className="del-modal-name">{optDel.value}</span> ອອກບໍ?</p>
            <p className="del-modal-warn">ການລຶບບໍ່ສາມາດກູ້ຄືນໄດ້</p>
            <div className="del-actions">
              <button className="del-cancel" onClick={() => setOptDel(null)}>ຍົກເລີກ</button>
              <button className="del-confirm" onClick={confirmRemoveOption}>ລຶບ</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="admin-toast">{toast}</div>}
    </main>
  );
}