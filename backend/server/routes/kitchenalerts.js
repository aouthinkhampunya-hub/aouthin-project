const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { pool } = require('../db');
const requireAuth = require('../middleware/requireAuth');
const { JWT_SECRET } = require('./auth');

// ===== ຄົວແຈ້ງເມນູ (ເຊັ່ນ ວັດຖຸດິບໝົດ) ໃຫ້ແອັດມິນ ພ້ອມລາຍຊື່ລູກຄ້າທີ່ສັ່ງເມນູນັ້ນ =====
// ຕາຕະລາງ kitchen_alerts ຖືກສ້າງອັດຕະໂນມັດຖ້າຍັງບໍ່ມີ (ບໍ່ຕ້ອງແກ້ db.js)
const tableReady = pool
  .query(`
    CREATE TABLE IF NOT EXISTS kitchen_alerts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      product_id INT NULL,
      product_name VARCHAR(255) NOT NULL,
      product_image VARCHAR(500) NULL,
      reported_by VARCHAR(255) NULL,
      note VARCHAR(500) NULL,
      customers TEXT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'open',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME NULL
    )
  `)
  .catch((err) => console.error('⚠️ ສ້າງຕາຕະລາງ kitchen_alerts ບໍ່ໄດ້:', err.message));

// ອ່ານຜູ້ໃຊ້ຈາກ cookie ເພື່ອບັນທຶກວ່າໃຜແຈ້ງ
function whoIs(req) {
  try {
    const token = req.cookies && req.cookies.token;
    const u = token ? jwt.verify(token, JWT_SECRET) : null;
    return u || req.user || req.admin || null;
  } catch (e) {
    return req.user || req.admin || null;
  }
}

function parseCustomers(text) {
  try {
    const v = JSON.parse(text || '[]');
    return Array.isArray(v) ? v : [];
  } catch (e) {
    return [];
  }
}

// ===== ຄົວ: ແຈ້ງເມນູໃຫ້ແອັດມິນ =====
// POST /api/kitchen-alerts  { product_id, note? }
router.post('/', requireAuth, async (req, res) => {
  try {
    await tableReady;
    const productId = Number(req.body.product_id);
    if (!Number.isInteger(productId) || productId < 1) {
      return res.status(400).json({ error: 'ກະລຸນາເລືອກເມນູ' });
    }
    const note = String(req.body.note || '').trim().slice(0, 500);

    const [products] = await pool.query('SELECT id, name, image FROM products WHERE id = ?', [productId]);
    const product = products[0];
    if (!product) return res.status(404).json({ error: 'ບໍ່ພົບເມນູນີ້' });

    // ລູກຄ້າ/ໂຕະ ທີ່ສັ່ງເມນູນີ້ ແລະ ຍັງບໍ່ໄດ້ເສີບ (ເກັບຕອນແຈ້ງ ເພື່ອໃຫ້ແອັດມິນຕິດຕໍ່ໄດ້ ເຖິງວ່າຄົວຈະຍົກເລີກລາຍການແລ້ວ)
    const [rows] = await pool.query(
      `SELECT o.quantity, b.id AS bill_id, b.bill_no, b.order_type, b.table_number,
              b.customer_name, b.customer_phone
       FROM orders o
       JOIN bills b ON o.bill_id = b.id
       WHERE o.product_id = ? AND b.status = 'open' AND o.status IN ('pending', 'cooking')
       ORDER BY b.id`,
      [productId]
    );

    // ລວມຕາມບິນ (ບິນດຽວສັ່ງເມນູນີ້ຫຼາຍແຖວ → ລວມຈຳນວນ)
    const byBill = new Map();
    rows.forEach((r) => {
      if (!byBill.has(r.bill_id)) {
        byBill.set(r.bill_id, {
          bill_id: r.bill_id,
          bill_no: r.bill_no || r.bill_id,
          order_type: r.order_type || 'dine_in',
          table_number: r.table_number,
          customer_name: r.customer_name || '',
          customer_phone: r.customer_phone || '',
          quantity: 0,
        });
      }
      byBill.get(r.bill_id).quantity += Number(r.quantity) || 0;
    });
    const customers = [...byBill.values()];

    const user = whoIs(req) || {};
    const [result] = await pool.query(
      `INSERT INTO kitchen_alerts (product_id, product_name, product_image, reported_by, note, customers)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [product.id, product.name, product.image || null, user.name || user.username || 'ຄົວ', note || null, JSON.stringify(customers)]
    );

    res.json({ id: result.insertId, customers_count: customers.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ===== ແອັດມິນ: ຈຳນວນທີ່ຍັງບໍ່ໄດ້ຕິດຕໍ່ (ໃຊ້ສະແດງເລກເທິງປຸ່ມ) =====
router.get('/count', requireAuth, async (req, res) => {
  try {
    await tableReady;
    const [[row]] = await pool.query(`SELECT COUNT(*) AS c FROM kitchen_alerts WHERE status = 'open'`);
    res.json({ open: Number(row.c) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ===== ແອັດມິນ: ລາຍການແຈ້ງທັງໝົດ (ຍັງບໍ່ຕິດຕໍ່ຢູ່ເທິງ) =====
router.get('/', requireAuth, async (req, res) => {
  try {
    await tableReady;
    const [rows] = await pool.query(
      `SELECT * FROM kitchen_alerts ORDER BY (status = 'open') DESC, id DESC LIMIT 100`
    );
    res.json(rows.map((r) => ({ ...r, customers: parseCustomers(r.customers) })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ===== ແອັດມິນ: ໝາຍວ່າຕິດຕໍ່ລູກຄ້າແລ້ວ =====
router.put('/:id/resolve', requireAuth, async (req, res) => {
  try {
    await tableReady;
    await pool.query(
      `UPDATE kitchen_alerts SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});
// ລຶບເລື່ອງທີ່ຄົວແຈ້ງ (ແອັດມິນເທົ່ານັ້ນ)
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM kitchen_alerts WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});
module.exports = router;