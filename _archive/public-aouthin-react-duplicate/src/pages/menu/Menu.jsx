import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProducts, createOrder, callStaff } from '../../api.js';

function getTableNumber() {
  const params = new URLSearchParams(window.location.search);
  let table = params.get('table');
  if (!table) table = sessionStorage.getItem('tableNumber');
  if (!table) table = prompt('ປ້ອນເລກໂຕະ (ສຳລັບທົດສອບ):');
  sessionStorage.setItem('tableNumber', table);
  return table;
}

export default function Menu() {
  const navigate = useNavigate();
  const [tableNumber] = useState(getTableNumber);
  const [products, setProducts] = useState([]);
  const [category, setCategory] = useState('');
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [callState, setCallState] = useState('idle'); // idle | calling | called

  useEffect(() => { loadProducts(); }, []);

  async function loadProducts() {
    const data = await getProducts();
    setProducts(data);
  }

  const categories = useMemo(
    () => [...new Set(products.map(p => p.size).filter(Boolean))],
    [products]
  );

  const filtered = category ? products.filter(p => p.size === category) : products;

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

  return (
    <div>
      <header>
        <h1>ຮ້ານອາຫານຕາມສັ່ງ AOUTHIN</h1>
        <p id="table-label">ໂຕະ {tableNumber}</p>
      </header>

      <div className="filter-bar">
        <select id="category-filter" value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">ທຸກປະເພດ</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <main id="product-list">
        {filtered.length === 0 ? <p>ບໍ່ພົບອາຫານໃນປະເພດນີ້</p> : filtered.map(p => (
          <div className="product-card" key={p.id}>
            {p.image && <img src={p.image} className="product-img" alt={p.name} />}
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
        <button id="bill-button" onClick={() => navigate(`/menu/bill?table=${tableNumber}`)}>🧾 ເບິ່ງບິນ</button>
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

      {toast && <div id="toast" className="show">{toast}</div>}
    </div>
  );
}
