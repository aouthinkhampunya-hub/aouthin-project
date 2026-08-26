const express = require('express');
const router = express.Router();
const db = require('../db');

// ดึงสินค้าทั้งหมด
router.get('/', (req, res) => {
  const products = db.prepare('SELECT * FROM products').all();
  res.json(products);
});

// เพิ่มสินค้าใหม่
router.post('/', (req, res) => {
  const { name, price, size, color, stock, image } = req.body;
  const stmt = db.prepare(
    'INSERT INTO products (name, price, size, color, stock, image) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const result = stmt.run(name, price, size, color, stock, image);
  res.json({ id: result.lastInsertRowid });
});

// ลบสินค้า
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;