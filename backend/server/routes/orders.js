const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const { calcDelivery } = require('../delivery');
const requireAuth = require('../middleware/requireAuth');
const { JWT_SECRET } = require('./auth');

// ອ່ານຜູ້ໃຊ້ຈາກ cookie (ຄືນ null ຖ້າບໍ່ໄດ້ລັອກອິນ) ໃຊ້ໃນເສັ້ນທາງທີ່ລູກຄ້າກໍເຂົ້າໄດ້
function getUser(req) {
  const token = req.cookies && req.cookies.token;
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

// pending = ລໍຖ້າ, cooking = ກຳລັງເຮັດ, ready = ຄົວເຮັດແລ້ວ ລໍເສີບ, completed = ເສີບແລ້ວ
const ALLOWED_STATUSES = ['pending', 'cooking', 'ready', 'completed'];

// ແປງຄ່າພິກັດເປັນຕົວເລກ (ຄ່າຫວ່າງ / null / undefined ຖືວ່າຜິດ → NaN)
function toCoord(v) {
  if (v === null || v === undefined || String(v).trim() === '') return NaN;
  return Number(v);
}

// ເລກບິນຖັດໄປ ແຍກເປັນ 2 ກຸ່ມ: ໜ້າໂຕະ (dine_in) ກັບ ອອນລາຍ (pickup / delivery)
// ຕ້ອງເອີ້ນພາຍໃນ transaction ແລະກ່ອນ INSERT ບິນ
async function nextBillNo(connection, isOnline) {
  const cond = isOnline ? `order_type <> 'dine_in'` : `order_type = 'dine_in'`;
  const [[row]] = await connection.query(
    `SELECT COALESCE(MAX(bill_no), 0) + 1 AS next FROM bills WHERE ${cond} FOR UPDATE`
  );
  return Number(row.next);
}

// ===== ສະລິບໂອນເງິນ =====
const SLIP_DIR = path.join(__dirname, '../../public/uploads/slips');
const SLIP_MAX_BYTES = 5 * 1024 * 1024;
const SLIP_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

// ກວດ data URL ແລ້ວຄືນ { buf, ext } (throw ຖ້າບໍ່ຖືກຕ້ອງ)
function parseSlip(dataUrl) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) throw { status: 400, message: 'ໄຟລ໌ສະລິບບໍ່ຖືກຕ້ອງ (ໃຊ້ຮູບ JPG / PNG)' };

  const buf = Buffer.from(m[2], 'base64');
  if (buf.length < 100 || buf.length > SLIP_MAX_BYTES) {
    throw { status: 400, message: 'ຮູບສະລິບໃຫຍ່ເກີນໄປ (ສູງສຸດ 5MB)' };
  }

  // ກວດຫົວໄຟລ໌ໃຫ້ກົງກັບຊະນິດຮູບແທ້
  const isJpg = buf[0] === 0xff && buf[1] === 0xd8;
  const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  const isWebp = buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP';
  if (!(isJpg || isPng || isWebp)) {
    throw { status: 400, message: 'ໄຟລ໌ນີ້ບໍ່ແມ່ນຮູບ' };
  }

  return { buf, ext: SLIP_EXT[m[1]] };
}

// ບັນທຶກຮູບລົງດິສ ແລ້ວຄືນ path ສຳລັບເປີດຜ່ານເວັບ
function writeSlip({ buf, ext }) {
  fs.mkdirSync(SLIP_DIR, { recursive: true });
  const name = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(SLIP_DIR, name), buf);
  return { url: `/uploads/slips/${name}`, file: path.join(SLIP_DIR, name) };
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const [orders] = await pool.query(`
      SELECT orders.*, products.name AS product_name, products.price,
             bills.table_number, bills.bill_no, bills.order_type
      FROM orders
      JOIN products ON orders.product_id = products.id
      JOIN bills ON orders.bill_id = bills.id
      ORDER BY orders.created_at DESC
    `);
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.get('/bills', async (req, res) => {
  try {
    // ຜູ້ທີ່ລັອກອິນ (admin / ຄົວ) ເຫັນທຸກບິນ. ລູກຄ້າທົ່ວໄປ (ບໍ່ລັອກອິນ) ເຫັນສະເພາະບິນໜ້າໂຕະ
    // ເພື່ອບໍ່ໃຫ້ຊື່ ເບີໂທ ທີ່ຢູ່ ແລະ ສະລິບຂອງລູກຄ້າອອນລາຍຫຼຸດອອກສູ່ສາທາລະນະ
    const loggedIn = !!getUser(req);
    const [bills] = await pool.query(
      loggedIn
        ? `SELECT * FROM bills WHERE status = 'open' ORDER BY table_number`
        : `SELECT * FROM bills WHERE status = 'open' AND order_type = 'dine_in' ORDER BY table_number`
    );

    const billsWithItems = await Promise.all(
      bills.map(async (bill) => {
        const [items] = await pool.query(
          `SELECT orders.*, products.name AS product_name, products.price
           FROM orders
           JOIN products ON orders.product_id = products.id
           WHERE orders.bill_id = ?
           ORDER BY orders.created_at`,
          [bill.id]
        );
        return { ...bill, items };
      })
    );

    res.json(billsWithItems);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ຄິດຄ່າສົ່ງຕາມພິກັດທີ່ປັກໝຸດ: GET /api/orders/delivery-fee?lat=..&lng=..
router.get('/delivery-fee', (req, res) => {
  const lat = toCoord(req.query.lat);
  const lng = toCoord(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'ພິກັດບໍ່ຖືກຕ້ອງ' });
  }
  res.json(calcDelivery(lat, lng));
});

// ປະຫວັດບິນທັງໝົດ (ເປີດຢູ່ + ປິດແລ້ວ) ພ້ອມລາຍການອາຫານ, ກອງຕາມວັນທີໄດ້
router.get('/history', requireAuth, async (req, res) => {
  try {
    const from = /^\d{4}-\d{2}-\d{2}$/.test(req.query.from || '') ? req.query.from : null;
    const to = /^\d{4}-\d{2}-\d{2}$/.test(req.query.to || '') ? req.query.to : null;

    const [bills] = await pool.query(
      `SELECT * FROM (
         SELECT bills.*,
                (SELECT MIN(o.created_at) FROM orders o WHERE o.bill_id = bills.id) AS ordered_at
         FROM bills
       ) b
       WHERE (? IS NULL OR DATE(b.ordered_at) >= ?)
         AND (? IS NULL OR DATE(b.ordered_at) <= ?)
       ORDER BY b.id DESC
       LIMIT 500`,
      [from, from, to, to]
    );

    if (bills.length === 0) return res.json([]);

    const [items] = await pool.query(
      `SELECT orders.*, products.name AS product_name, products.price
       FROM orders JOIN products ON orders.product_id = products.id
       WHERE orders.bill_id IN (?)
       ORDER BY orders.created_at`,
      [bills.map((b) => b.id)]
    );

    const byBill = {};
    items.forEach((i) => { (byBill[i.bill_id] = byBill[i.bill_id] || []).push(i); });

    res.json(bills.map((b) => ({ ...b, items: byBill[b.id] || [] })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.post('/', async (req, res) => {
  const { table_number, items } = req.body;

  if (!table_number || !items || items.length === 0) {
    return res.status(400).json({ error: 'ຂໍ້ມູນບໍ່ຄບ' });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    let [bills] = await connection.query(
      `SELECT * FROM bills WHERE table_number = ? AND status = 'open'`,
      [table_number]
    );
    let bill = bills[0];

    if (!bill) {
      // ບິນໃໝ່ຂອງໂຕະ → ຮັບເລກບິນຖັດໄປຂອງກຸ່ມ "ໜ້າໂຕະ"
      const billNo = await nextBillNo(connection, false);
      const [result] = await connection.query(
        `INSERT INTO bills (table_number, bill_no) VALUES (?, ?)`,
        [table_number, billNo]
      );
      bill = { id: result.insertId, bill_no: billNo };
    }

    for (const item of items) {
      const [products] = await connection.query(
        'SELECT * FROM products WHERE id = ? FOR UPDATE',
        [item.product_id]
      );
      const product = products[0];

      if (!product) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ error: `ບໍ່ພົບເມນູ id ${item.product_id}` });
      }
      if (product.stock < item.quantity) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ error: `${product.name} ບໍ່ພໍ` });
      }
    }

    for (const item of items) {
      await connection.query(
        'INSERT INTO orders (bill_id, product_id, quantity) VALUES (?, ?, ?)',
        [bill.id, item.product_id, item.quantity]
      );
      await connection.query(
        'UPDATE products SET stock = stock - ? WHERE id = ?',
        [item.quantity, item.product_id]
      );
    }

    await connection.commit();
    connection.release();

    res.json({ bill_id: bill.id, bill_no: bill.bill_no, message: 'ສັ່ງອາຫານສຳເລັດ' });
  } catch (err) {
    await connection.rollback();
    connection.release();
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ===== ສັ່ງອອນລາຍ (ແກັບ / ສົ່ງເຖິງບ້ານ, ເງິນສົດ ຫຼື ໂອນເງິນພ້ອມສະລິບ) =====
router.post('/online', async (req, res) => {
  const {
    order_type, customer_name, customer_phone, address,
    payment_method, slip_image, latitude, longitude, items,
  } = req.body;

  if (!['pickup', 'delivery'].includes(order_type)) {
    return res.status(400).json({ error: 'ກະລຸນາເລືອກປະເພດການຮັບອາຫານ' });
  }
  if (!customer_name || !String(customer_name).trim()) {
    return res.status(400).json({ error: 'ກະລຸນາໃສ່ຊື່' });
  }
  if (!/^020\d{8}$/.test(String(customer_phone || '').trim())) {
    return res.status(400).json({ error: 'ເບີໂທບໍ່ຖືກຕ້ອງ (ຕ້ອງເປັນ 020 ຕາມດ້ວຍເລກ 8 ໂຕ, ລວມ 11 ໂຕ)' });
  }
  if (order_type === 'delivery' && !String(address || '').trim()) {
    return res.status(400).json({ error: 'ກະລຸນາໃສ່ທີ່ຢູ່ສົ່ງ' });
  }

  const method = payment_method || 'cash';
  if (!['cash', 'transfer'].includes(method)) {
    return res.status(400).json({ error: 'ວິທີຊຳລະບໍ່ຖືກຕ້ອງ' });
  }

  // ໂອນເງິນ: ຕ້ອງແນບສະລິບ
  let slip = null;
  if (method === 'transfer') {
    if (!slip_image) {
      return res.status(400).json({ error: 'ກະລຸນາແນບສະລິບການໂອນເງິນ' });
    }
    try {
      slip = parseSlip(slip_image);
    } catch (e) {
      return res.status(e.status || 400).json({ error: e.message });
    }
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'ຍັງບໍ່ໄດ້ເລືອກອາຫານ' });
  }

  // ຈຸດສົ່ງເທິງແຜນທີ່ (ບັງຄັບສະເພາະສົ່ງເຖິງບ້ານ) + ຄິດຄ່າສົ່ງຝັ່ງ server
  let lat = null;
  let lng = null;
  let deliveryFee = 0;
  let deliveryKm = null;

  if (order_type === 'delivery') {
    lat = toCoord(latitude);
    lng = toCoord(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) ||
        lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ error: 'ກະລຸນາປັກໝຸດຈຸດສົ່ງເທິງແຜນທີ່' });
    }

    const d = calcDelivery(lat, lng);
    if (d.tooFar) {
      return res.status(400).json({ error: `ໄກເກີນໄປ (ຮັບສົ່ງສູງສຸດ ${d.max_km} ກມ)` });
    }
    deliveryFee = d.fee;
    deliveryKm = d.km;
  }

  const connection = await pool.getConnection();
  let savedSlip = null;
  try {
    await connection.beginTransaction();

    for (const item of items) {
      const qty = Number(item.quantity);
      if (!Number.isInteger(qty) || qty < 1) {
        throw { status: 400, message: 'ຈຳນວນບໍ່ຖືກຕ້ອງ' };
      }
      const [products] = await connection.query(
        'SELECT * FROM products WHERE id = ? FOR UPDATE',
        [item.product_id]
      );
      const product = products[0];
      if (!product) throw { status: 404, message: 'ບໍ່ພົບເມນູ' };
      if (product.stock < qty) throw { status: 400, message: `${product.name} ບໍ່ພໍ` };
    }

    // ບັນທຶກຮູບສະລິບ ຫຼັງຈາກກວດສະຕັອກຜ່ານແລ້ວ
    if (slip) savedSlip = writeSlip(slip);

    // ຮັບເລກບິນຖັດໄປຂອງກຸ່ມ "ອອນລາຍ"
    const billNo = await nextBillNo(connection, true);

    const [result] = await connection.query(
      `INSERT INTO bills
         (table_number, order_type, customer_name, customer_phone, address, payment_method, slip_image, latitude, longitude, delivery_fee, delivery_distance, bill_no)
       VALUES (0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        order_type,
        String(customer_name).trim(),
        String(customer_phone).trim(),
        order_type === 'delivery' ? String(address).trim() : null,
        method,
        savedSlip ? savedSlip.url : null,
        lat,
        lng,
        deliveryFee,
        deliveryKm,
        billNo,
      ]
    );
    const billId = result.insertId;

    for (const item of items) {
      await connection.query(
        'INSERT INTO orders (bill_id, product_id, quantity) VALUES (?, ?, ?)',
        [billId, item.product_id, item.quantity]
      );
      await connection.query(
        'UPDATE products SET stock = stock - ? WHERE id = ?',
        [item.quantity, item.product_id]
      );
    }

    await connection.commit();
    res.json({ bill_id: billId, bill_no: billNo, message: 'ສັ່ງອາຫານສຳເລັດ' });
  } catch (err) {
    await connection.rollback();
    // ລຶບຮູບສະລິບທີ່ບັນທຶກໄປແລ້ວ ຖ້າສັ່ງບໍ່ສຳເລັດ
    if (savedSlip) {
      try { fs.unlinkSync(savedSlip.file); } catch (e) {}
    }
    if (err && err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  } finally {
    connection.release();
  }
});

// ລູກຄ້າອອນລາຍເບິ່ງສະຖານະບິນຂອງຕົນ (ຕ້ອງມີ id + ເບີໂທ)
router.get('/online/:id', async (req, res) => {
  try {
    const phone = String(req.query.phone || '').trim();
    const [bills] = await pool.query(
      `SELECT id, bill_no, status, order_type, customer_name, address, payment_method,
              delivery_fee, delivery_distance
       FROM bills
       WHERE id = ? AND customer_phone = ? AND order_type <> 'dine_in'`,
      [req.params.id, phone]
    );
    if (!bills[0]) return res.status(404).json({ error: 'ບໍ່ພົບບິນ' });

    const [items] = await pool.query(
      `SELECT orders.*, products.name AS product_name, products.price
       FROM orders JOIN products ON orders.product_id = products.id
       WHERE orders.bill_id = ? ORDER BY orders.created_at`,
      [req.params.id]
    );
    res.json({ ...bills[0], items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ລູກຄ້າສົ່ງສະລິບໂອນເງິນພາຍຫຼັງສ້າງບິນ (ຕ້ອງມີ id + ເບີໂທ ເພື່ອຢືນຢັນເຈົ້າຂອງບິນ)
router.post('/online/:id/slip', async (req, res) => {
  const { slip_image, customer_phone } = req.body;
  const phone = String(customer_phone || req.query.phone || '').trim();

  let slip;
  try {
    slip = parseSlip(slip_image);
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message });
  }

  let saved = null;
  try {
    const [bills] = await pool.query(
      `SELECT id, slip_image FROM bills
       WHERE id = ? AND customer_phone = ? AND order_type <> 'dine_in'`,
      [req.params.id, phone]
    );
    const bill = bills[0];
    if (!bill) return res.status(404).json({ error: 'ບໍ່ພົບບິນ' });

    saved = writeSlip(slip);

    await pool.query(
      `UPDATE bills SET slip_image = ?, payment_method = 'transfer' WHERE id = ?`,
      [saved.url, bill.id]
    );

    // ລຶບສະລິບເກົ່າ (ຖ້າມີ)
    if (bill.slip_image) {
      try { fs.unlinkSync(path.join(__dirname, '../../public', bill.slip_image)); } catch (e) {}
    }

    res.json({ success: true, slip_image: saved.url });
  } catch (err) {
    if (saved) { try { fs.unlinkSync(saved.file); } catch (e) {} }
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { status } = req.body;

    if (!ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'ສະຖານະບໍ່ຖືກຕ້ອງ' });
    }

    // ຄົວປ່ຽນໄດ້ສະເພາະ ລໍຖ້າ → ກຳລັງເຮັດ → ເຮັດແລ້ວ. "ເສີບແລ້ວ" ເປັນໜ້າທີ່ຂອງພະນັກງານເສີບ
    const user = getUser(req);
    if (user && user.role === 'kitchen' && status === 'completed') {
      return res.status(403).json({ error: 'ບັນຊີຄົວປ່ຽນເປັນ "ເສີບແລ້ວ" ບໍ່ໄດ້' });
    }

    await pool.query('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    const order = rows[0];

    if (!order) {
      return res.status(404).json({ error: 'ບໍ່ພົບອໍເດີ້ນີ້' });
    }
    if (order.status !== 'pending') {
      return res.status(400).json({ error: 'ຍົກເລີກບໍ່ໄດ້ ຮ້ານເລີ່ມເຮັດອາຫານແລ້ວ' });
    }

    await pool.query('UPDATE products SET stock = stock + ? WHERE id = ?', [order.quantity, order.product_id]);
    await pool.query('DELETE FROM orders WHERE id = ?', [req.params.id]);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.put('/bills/:id/close', requireAuth, async (req, res) => {
  try {
    await pool.query(
      `UPDATE bills SET status = 'paid', paid_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;