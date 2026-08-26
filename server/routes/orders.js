const express = require('express');
const router = express.Router();
const db = require('../db');

// ดึงออเดอร์ทั้งหมด (สหรับแอดมิน)
router.get('/', (req, res) => {
  const orders = db.prepare(`
    SELECT orders.*, products.name AS product_name, products.price
    FROM orders
    JOIN products ON orders.product_id = products.id
    ORDER BY orders.created_at DESC
  `).all();
  res.json(orders);
});

// สร้างออเดอร์ใหม่ (ลูกค้าสั่งซื้อ)
router.post('/', (req, res) => {
  const { product_id, quantity } = req.body;

  // เช็คสต็อกกอน
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
  if (!product) {
    return res.status(404).json({ error: 'ไม่พบสินค้านี้' });
  }
  if (product.stock < quantity) {
    return res.status(400).json({ error: 'สินค้าไม่พอ' });
  }

  // สร้างออเดอร์ + ตัดสต็อก
  const stmt = db.prepare('INSERT INTO orders (product_id, quantity) VALUES (?, ?)');
  const result = stmt.run(product_id, quantity);

  db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(quantity, product_id);

  res.json({ id: result.lastInsertRowid, message: 'สั่งซื้อสำเร็จ' });
});

// อัปเดตสถานะออเดอร์ (สำหรับแอดมิน เช่น เปลี่ยนเป็น "เสร็จแล้ว")
router.put('/:id', (req, res) => {
  const { status } = req.body;
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ success: true });
});

module.exports = router;