import React, { useEffect, useMemo, useState } from 'react';
import { getProducts, createOrder, callStaff, API_BASE } from '../../api.js';

function getTableNumber() {
  const params = new URLSearchParams(window.location.search);
  let table = params.get('table');
  if (!table) table = sessionStorage.getItem('tableNumber');
  if (!table) table = prompt('ປ້ອນເລກໂຕະ (ສຳລັບທົດສອບ):');
  sessionStorage.setItem('tableNumber', table);
  return table;
}

function loadSavedCart(table) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(`cart_table_${table}`));
    return Array.isArray(saved) ? saved : [];
  } catch (e) {
    return [];
  }
}

function billStatusLabel(status) {
  if (status === 'pending') return '⏳ ລໍຖ້າ';
  if (status === 'cooking') return '🔥 ກຳລັງເຮັດ';
  if (status === 'ready') return '⏳ ລໍຖ້າ';
  if (status === 'completed') return '✅ ພ້ອມແລ້ວ';
  return status;
}

export default function Menu() {
  const [tableNumber] = useState(getTableNumber);
  const [products, setProducts] = useState([]);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState(() => loadSavedCart(tableNumber));
  const [cartOpen, setCartOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [callState, setCallState] = useState('idle'); // idle | calling | called

  // ສະຖານະຂອງບິນ (popup)
  const [billOpen, setBillOpen] = useState(false);
  const [billLoading, setBillLoading] = useState(false);
  const [billError, setBillError] = useState('');
  const [billItems, setBillItems] = useState([]);
  const [qrImage, setQrImage] = useState('');
  const [cancelId, setCancelId] = useState(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [billToast, setBillToast] = useState('');

  // ບັນທຶກກະຕ່າທຸກຄັ້ງທີ່ປ່ຽນ
  useEffect(() => {
    try {
      sessionStorage.setItem(`cart_table_${tableNumber}`, JSON.stringify(cart));
    } catch (e) {}
  }, [cart, tableNumber]);

  useEffect(() => { loadProducts(); }, []);

  async function loadProducts() {
    const data = await getProducts();
    setProducts(data);

    // ປັບກະຕ່າທີ່ບັນທຶກໄວ້ໃຫ້ກົງກັບສະຕັອກປັດຈຸບັນ
    setCart(prev =>
      prev
        .map(item => {
          const p = data.find(x => x.id === item.product_id);
          if (!p || p.stock <= 0) return null;
          return {
            ...item,
            price: p.price,
            stock: p.stock,
            quantity: Math.min(item.quantity, p.stock)
          };
        })
        .filter(Boolean)
    );
  }

  const categories = useMemo(
    () => [...new Set(products.map(p => p.size).filter(Boolean))],
    [products]
  );

  const filtered = products.filter(p => {
    const matchCategory = !category || p.size === category;
    const matchName = String(p.name ?? '').toLowerCase().includes(search.trim().toLowerCase());
    return matchCategory && matchName;
  });

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 1800);
  }

  function addToCart(product) {
    const existing = cart.find(i => i.product_id === product.id);
    const currentQty = existing ? existing.quantity : 0;
    if (currentQty + 1 > product.stock) {
      alert('ອາຫານໃນສະຕອກບໍ່ພໍ');
      return;
    }
    if (existing) {
      setCart(cart.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setCart([...cart, { product_id: product.id, name: product.name, price: product.price, quantity: 1, stock: product.stock }]);
    }
    showToast(`✅ ເພີ່ມ "${product.name}" ແລ້ວ`);
  }

  function changeQty(id, delta) {
    setCart(prev => {
      const item = prev.find(i => i.product_id === id);
      if (!item) return prev;
      const newQty = item.quantity + delta;
      if (newQty < 1) return prev.filter(i => i.product_id !== id);
      if (newQty > item.stock) { alert('ອາຫານໃນສະຕັອກບໍ່ພໍ'); return prev; }
      return prev.map(i => i.product_id === id ? { ...i, quantity: newQty } : i);
    });
  }

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  async function confirmOrder() {
    if (cart.length === 0) { alert('ຍັງບໍ່ໄດ້ເລືອກອາຫານ'); return; }
    const items = cart.map(i => ({ product_id: i.product_id, quantity: i.quantity }));
    try {
      await createOrder(tableNumber, items);
      setCart([]);
      setCartOpen(false);
      setSuccessOpen(true);
      loadProducts();
    } catch (err) {
      alert('ເກີດຂໍ້ຜິດພາດ: ' + (err.error || 'ບໍ່ຮູ້ສາເຫດ'));
    }
  }

  async function handleCallStaff() {
    setCallState('calling');
    await callStaff(tableNumber);
    setCallState('called');
    setTimeout(() => setCallState('idle'), 15000);
  }

  // ===== ບິນ (popup) =====
  function showBillToast(msg) {
    setBillToast(msg);
    setTimeout(() => setBillToast(''), 2200);
  }

  async function loadBill() {
    setBillLoading(true);
    setBillError('');
    setBillItems([]);
    setQrImage('');

    try {
      const res = await fetch(`${API_BASE}/api/orders/bills`);
      if (!res.ok) throw new Error('bill api failed');
      const bills = await res.json();
      const myBill = bills.find(b => String(b.table_number) === String(tableNumber));
      setBillItems(myBill ? myBill.items : []);
    } catch (e) {
      setBillError('ໂຫລດບິນບໍ່ສຳເລັດ ກະລຸນາລອງໃໝ່');
      setBillLoading(false);
      return;
    }
    setBillLoading(false);

    // QR ຈ່າຍເງິນ (ຖ້າໂຫລດບໍ່ໄດ້ກໍຂ້າມໄປ)
    try {
      const qres = await fetch(`${API_BASE}/api/settings/qr`);
      const qdata = await qres.json();
      if (qdata.qrImage) setQrImage(qdata.qrImage);
    } catch (e) {}
  }

  function openBill() {
    setBillOpen(true);
    loadBill();
  }

  async function doCancelOrder() {
    if (cancelId === null) return;
    setCancelBusy(true);

    try {
      const res = await fetch(`${API_BASE}/api/orders/${cancelId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCancelId(null);
        setCancelBusy(false);
        showBillToast('❌ ' + (data.error || 'ຍົກເລີກບໍ່ໄດ້'));
        return;
      }
    } catch (e) {
      setCancelId(null);
      setCancelBusy(false);
      showBillToast('❌ ຍົກເລີກບໍ່ໄດ້');
      return;
    }

    setCancelId(null);
    setCancelBusy(false);
    await loadBill();
    loadProducts();
    showBillToast('✅ ຍົກເລີກລາຍການແລ້ວ');
  }

  const billTotal = billItems.reduce((s, i) => s + i.price * i.quantity, 0);

  return (
    <div className="customer-app">
      <header>
        <h1>ຮ້ານອາຫານຕາມສັ່ງ AOUTHIN</h1>
        <p id="table-label">ໂຕະ {tableNumber}</p>
      </header>

      <div className="filter-bar">
        <select id="category-filter" value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">ທຸກປະເພດ</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <input
          type="text"
          id="search-input"
          placeholder="🔍 ຄົ້ນຫາເມນູ..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <main id="product-list">
        {filtered.length === 0 ? <p>ບໍ່ພົບເມນູທີ່ຄົ້ນຫາ</p> : filtered.map(p => (
          <div className="product-card" key={p.id}>
            {p.image && <img src={p.image.startsWith('http') ? p.image : API_BASE + p.image} className="product-img" alt={p.name} />}
            <h3>{p.name}</h3>
            <p>ປະເພດ: {p.size} | ລົດຊາດ: {p.color}</p>
            <p>ເຫຼືອ: {p.stock} ຈານ</p>
            <p className="price">{p.price} ກີບ</p>
            <button onClick={() => addToCart(p)} disabled={p.stock <= 0}>
              {p.stock <= 0 ? 'ອາຫານໝົດ' : 'ເພີ່ມໃສ່ກະຕ່າ'}
            </button>
          </div>
        ))}
      </main>

      <div className="left-buttons">
        <button id="bill-button" onClick={openBill}>🧾 ເບິ່ງບິນ</button>
        <button id="call-staff-button" onClick={handleCallStaff} disabled={callState !== 'idle'}>
          {callState === 'idle' && '🔔 ເອີ້ນພະນັກງານ'}
          {callState === 'calling' && '📞 ກຳລັງແຈ້ງ...'}
          {callState === 'called' && '✅ ແຈ້ງແລ້ວ ລໍຖ້າພະນັກງານ'}
        </button>
      </div>

      <button id="cart-button" onClick={() => setCartOpen(true)}>
        🛒 ກະຕ່າ (<span id="cart-count">{cartCount}</span>)
      </button>

      {cartOpen && (
        <div id="cart-overlay">
          <div className="cart-box">
            <h2>ກະຕ່າອາຫານ</h2>
            <div id="cart-items">
              {cart.length === 0 ? <p>ຍັງບໍ່ໄດ້ເລືອກອາຫານ</p> : cart.map(item => (
                <div className="cart-item" key={item.product_id}>
                  <span>{item.name}</span>
                  <div className="qty-control">
                    <button onClick={() => changeQty(item.product_id, -1)}>-</button>
                    <input type="number" className="qty-input" value={item.quantity} min="1" max={item.stock} readOnly />
                    <button onClick={() => changeQty(item.product_id, 1)}>+</button>
                  </div>
                  <span>{item.price * item.quantity} ກີບ</span>
                </div>
              ))}
            </div>
            <p className="cart-total">ລວມ: <span id="cart-total">{cartTotal}</span> ກີບ</p>
            <button className="confirm-btn" onClick={confirmOrder}>ຢືນຢັນສັ່ງອາຫານ</button>
            <button className="cancel-btn" onClick={() => setCartOpen(false)}>ປິດ</button>
          </div>
        </div>
      )}

      {successOpen && (
        <div id="success-overlay">
          <div className="success-box">
            <div className="success-icon">🍽️</div>
            <h2>ສັ່ງອາຫານສຳເລັດ!</h2>
            <p>ອາຫານຂອງທ່ານກຳລັງຖືກກຽມ ກະລຸນາລໍຖ້າບຶ່ງໜ້ອຍໜຶ່ງ</p>
            <button className="success-btn" onClick={() => setSuccessOpen(false)}>ຕົກລົງ</button>
          </div>
        </div>
      )}

      {billOpen && (
        <div className="bill-overlay">
          <div className="bill-box">
            <button className="bill-close" onClick={() => setBillOpen(false)}>✕</button>
            <div className="bill-box-scroll">
              <h2>ຮ້ານອາຫານຕາມສັ່ງ AOUTHIN</h2>
              <div className="bill-meta">
                ໂຕະ {tableNumber} • {new Date().toLocaleString('en-GB')}
              </div>

              <table className="bill-table">
                <thead>
                  <tr><th>ເມນູ</th><th>ຈຳນວນ</th><th>ລາຄາ</th></tr>
                </thead>
                <tbody>
                  {billLoading && <tr><td colSpan="3">ກຳລັງໂຫລດ...</td></tr>}
                  {!billLoading && billError && <tr><td colSpan="3">{billError}</td></tr>}
                  {!billLoading && !billError && billItems.length === 0 && (
                    <tr><td colSpan="3">ຍັງບໍ່ມີການສັ່ງອາຫານ</td></tr>
                  )}
                  {!billLoading && !billError && billItems.map(i => (
                    <tr key={i.id}>
                      <td>
                        {i.product_name}
                        <div className="bill-item-status">
                          <span>{billStatusLabel(i.status)}</span>
                          {i.status === 'pending' && (
                            <button type="button" className="bill-cancel-link" onClick={() => setCancelId(i.id)}>
                              ຍົກເລີກ
                            </button>
                          )}
                        </div>
                      </td>
                      <td>{i.quantity}</td>
                      <td>{i.price * i.quantity} ກີບ</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="bill-total">
                <span>ຍອດລວມທັງໝົດ</span>
                <strong>{billTotal} ກີບ</strong>
              </div>

              {qrImage && (
                <div className="bill-qr">
                  <p>ສະແກນ QR ນີ້ເພື່ອຈ່າຍເງິນ</p>
                  <img
                    src={qrImage.startsWith('http') || qrImage.startsWith('data:') ? qrImage : API_BASE + qrImage}
                    alt="QR ຊຳລະເງິນ"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {cancelId !== null && (
        <div className="bc-overlay" onClick={() => setCancelId(null)}>
          <div className="bc-box" onClick={e => e.stopPropagation()}>
            <div className="bc-icon">🗑️</div>
            <h3>ຍົກເລີກອໍເດີ້</h3>
            <p>ຢືນຢັນວ່າຈະຍົກເລີກລາຍການອາຫານນີ້?</p>
            <div className="bc-actions">
              <button className="bc-no" onClick={() => setCancelId(null)}>ຍົກເລີກ</button>
              <button className="bc-yes" disabled={cancelBusy} onClick={doCancelOrder}>ຢືນຢັນ</button>
            </div>
          </div>
        </div>
      )}

      {billToast && <div className="bc-toast">{billToast}</div>}

      {toast && <div id="toast" className="show">{toast}</div>}
    </div>
  );
}