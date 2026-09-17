const express = require('express');
const router = express.Router();
const { pool } = require('../db');
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
router.get('/', async (req, res) => {
  try {
    const [products] = await pool.query('SELECT * FROM products');
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// เพิ่มสินค้าใหม่ (รับไฟล์รูปภาพด้วย)
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { name, price, size, color, stock } = req.body;
    const image = req.file ? '/uploads/' + req.file.filename : '';

    const [result] = await pool.query(
      'INSERT INTO products (name, price, size, color, stock, image) VALUES (?, ?, ?, ?, ?, ?)',
      [name, price, size, color, stock, image]
    );
    res.json({ id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ลบสินค้า (ลบออເດີ້ທີ່ກຽວຂ້ອງກ່ອນ ເພື່ອບໍ່ໃຫ້ຕິດ FOREIGN KEY)
router.delete('/:id', async (req, res) => {
  try {
    const productId = req.params.id;

    // ลบออเดอร์ที่ผูกกับสินค้านี้กอน
    await pool.query('DELETE FROM orders WHERE product_id = ?', [productId]);

    // แล้วค่อยลบสินค้า
    await pool.query('DELETE FROM products WHERE id = ?', [productId]);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;