const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const multer = require('multer');
const path = require('path');

// ອັດໂຫຼດຮູບສະລິບ (ເກັບໃນໂຟນເດີ uploads ຄືກັບຮູບອາຫານ)
const slipStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../public/uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, 'slip_' + Date.now() + path.extname(file.originalname));
  }
});

const uploadSlip = multer({
  storage: slipStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('ອະນຸຍາດແຕ່ໄຟລ໌ຮູບພາບເທົ່ານັ້ນ'), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // ບໍ່ເກີນ 5MB
});

// pending = ລໍຖ້າ, cooking = ກຳລັງເຮັດ, ready = ຄົວເຮັດແລ້ວ ລໍເສີບ, completed = ເສີບແລ້ວ
const ALLOWED_STATUSES = ['pending', 'cooking', 'ready', 'completed'];

router.get('/', async (req, res) => {
  try {
    const [orders] = await pool.query(`
      SELECT orders.*, products.name AS product_name, products.price, bills.table_number
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
    const [bills] = await pool.query(
      `SELECT * FROM bills WHERE status = 'open' ORDER BY table_number`
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
      const [result] = await connection.query(
        `INSERT INTO bills (table_number) VALUES (?)`,
        [table_number]
      );
      bill = { id: result.insertId };
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
        return res.status(404).json({ error: `ไม่พบเมนู id ${item.product_id}` });
      }
      if (product.stock < item.quantity) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ error: `${product.name} ไม่พอ` });
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

    res.json({ bill_id: bill.id, message: 'ສັ່ງອາຫານສເລັດ' });
  } catch (err) {
    await connection.rollback();
    connection.release();
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.post('/online', async (req, res) => {
  const {
    order_type, customer_name, customer_phone, address,
    payment_method, latitude, longitude, items,
  } = req.body;

  if (!['pickup', 'delivery'].includes(order_type)) {
    return res.status(400).json({ error: 'ກະລຸນາເລືອກປະເພດການຮັບອາຫານ' });
  }
  if (!customer_name || !String(customer_name).trim()) {
    return res.status(400).json({ error: 'ກະລຸນາໃສ່ຊື່' });
  }
  if (!/^[0-9+\s-]{8,15}$/.test(String(customer_phone || ''))) {
    return res.status(400).json({ error: 'ເບີໂທບໍ່ຖືກຕ້ອງ' });
  }
  if (order_type === 'delivery' && !String(address || '').trim()) {
    return res.status(400).json({ error: 'ກະລຸນາໃສ່ທີ່ຢູ່ສົ່ງ' });
  }
 if (!['cash', 'transfer'].includes(payment_method || 'cash')) {
  return res.status(400).json({ error: 'ວິທີຊຳລະບໍ່ຖືກຕ້ອງ' });
}
const payMethod = payment_method || 'cash';
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'ຍັງບໍ່ໄດ້ເລືອກອາຫານ' });
  }

  // ຈຸດສົ່ງເທິງແຜນທີ່ (ບັງຄັບສະເພາະສົ່ງເຖິງບ້ານ)
  let lat = null;
  let lng = null;
  if (order_type === 'delivery') {
    lat = Number(latitude);
    lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) ||
        lat < -90 || lat > 90 || lng < -180 || lng > 180 ||
        latitude === null || longitude === null) {
      return res.status(400).json({ error: 'ກະລຸນາປັກໝຸດຈຸດສົ່ງເທິງແຜນທີ່' });
    }
  }

  const connection = await pool.getConnection();
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

    const [result] = await connection.query(
      `INSERT INTO bills
         (table_number, order_type, customer_name, customer_phone, address, payment_method, latitude, longitude)
       VALUES (0, ?, ?, ?, ?, ?, ?, ?)`,
[
  order_type,
  String(customer_name).trim(),
  String(customer_phone).trim(),
  order_type === 'delivery' ? String(address).trim() : null,
  payMethod,
  lat,
  lng,
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
    res.json({ bill_id: billId, message: 'ສັ່ງອາຫານສຳເລັດ' });
  } catch (err) {
    await connection.rollback();
    if (err && err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  } finally {
    connection.release();
  }
});
router.put('/:id', async (req, res) => {
  try {
    const { status } = req.body;

    if (!ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'ສະຖານະບໍ່ຖືກຕ້ອງ' });
    }

    await pool.query('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});
// ລູກຄ້າອອນລາຍເບິ່ງບິນຂອງຕົນເອງ (ຕ້ອງໃສ່ເບີໂທໃຫ້ກົງ)
router.get('/online/:id', async (req, res) => {
  try {
    const phone = String(req.query.phone || '').trim();
    const [bills] = await pool.query('SELECT * FROM bills WHERE id = ?', [req.params.id]);
    const bill = bills[0];

    if (!bill || !bill.customer_phone || String(bill.customer_phone) !== phone) {
      return res.status(404).json({ error: 'ບໍ່ພົບບິນນີ້' });
    }

    const [items] = await pool.query(
      `SELECT orders.*, products.name AS product_name, products.price
       FROM orders
       JOIN products ON orders.product_id = products.id
       WHERE orders.bill_id = ?
       ORDER BY orders.created_at`,
      [bill.id]
    );

    res.json({ ...bill, items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ລູກຄ້າອອນລາຍສົ່ງຮູບສະລິບ
router.post('/online/:id/slip', (req, res) => {
  uploadSlip.single('slip')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ error: 'ກະລຸນາແນບຮູບສະລິບ' });
      }

      const phone = String(req.body.customer_phone || '').trim();
      const [bills] = await pool.query('SELECT * FROM bills WHERE id = ?', [req.params.id]);
      const bill = bills[0];

      if (!bill || !bill.customer_phone || String(bill.customer_phone) !== phone) {
        return res.status(404).json({ error: 'ບໍ່ພົບບິນນີ້' });
      }
      if (bill.payment_method !== 'transfer') {
        return res.status(400).json({ error: 'ບິນນີ້ບໍ່ແມ່ນການຈ່າຍເງິນໂອນ' });
      }
      if (bill.status !== 'open') {
        return res.status(400).json({ error: 'ບິນນີ້ປິດແລ້ວ' });
      }

      const slipPath = '/uploads/' + req.file.filename;
      await pool.query(
        `UPDATE bills SET slip_image = ?, payment_status = 'slip_sent' WHERE id = ?`,
        [slipPath, bill.id]
      );

      res.json({ success: true, slip_image: slipPath });
    } catch (dbErr) {
      console.error(dbErr);
      res.status(500).json({ error: 'Database error' });
    }
  });
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

router.put('/bills/:id/close', async (req, res) => {
  try {
    await pool.query(
            `UPDATE bills SET status = 'paid', payment_status = 'paid', paid_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;