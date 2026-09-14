const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');

// ตั้งค่າ multer ให้เก็บไฟล์ที่ public/uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../public/uploads'));
  },
  filename: (req, file, cb) => {
    // ตั้งชื่อไฟล์ใหม่ ป้องกันชื่อซ (ใช้เวลาปัจจุบัน + นามสกุลไฟล์เดิม)
    const uniqueName = Date.now() + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({ storage: storage });

// ดึงสินค้าทั้งหมด
router.get('/', (req, res) => {
  const products = db.prepare('SELECT * FROM products').all();
  res.json(products);
});

// เพิ่มสินค้าใหม่ (รับไฟล์รูปภาพด้วย)
router.post('/', upload.single('image'), (req, res) => {
  const { name, price, size, color, stock } = req.body;
  const image = req.file ? '/uploads/' + req.file.filename : '';

  const stmt = db.prepare(
    'INSERT INTO products (name, price, size, color, stock, image) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const result = stmt.run(name, price, size, color, stock, image);
  res.json({ id: result.lastInsertRowid });
});

// ลบสินค้า (ลบออເດີ້ທີ່ກຽວຂ້ອງກ່ອນ ເພື່ອບໍ່ໃຫ້ຕິດ FOREIGN KEY)
router.delete('/:id', (req, res) => {
  const productId = req.params.id;

  // ลบออเดอร์ที่ผูกกับสินค้านี้กอน
  db.prepare('DELETE FROM orders WHERE product_id = ?').run(productId);

  // แล้วค่อยลบสินค้า
  db.prepare('DELETE FROM products WHERE id = ?').run(productId);

  res.json({ success: true });
});

module.exports = router;