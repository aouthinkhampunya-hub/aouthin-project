const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../public/uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

// ✅ ตรวจสอบให้แน่ใจว่าเป็นไฟล์รูปภาพเท่านั้น
function imageFileFilter(req, file, cb) {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('ອະນຸຍາດແຕ່ໄຟລ໌ຮູບພາບເທົ່ານັ້ນ'), false);
  }
}

const upload = multer({
  storage: storage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // ຈຳກັດຂະໜາດໄຟລ໌ບໍ່ເກີນ 5MB
});

// ດຶງສິນຄ້າທັງໝົດ
router.get('/', async (req, res) => {
  try {
    const [products] = await pool.query('SELECT * FROM products');
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ເພີ່ມສິນຄ້າໃໝ່
router.post('/', (req, res) => {
  upload.single('image')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    try {
  const { name, price, size, color, stock } = req.body;

  if (Number(price) > 1000000 || Number(price) < 0) {
    return res.status(400).json({ error: 'ລາຄາຕ້ອງຢູ່ລະຫວ່າງ 0 - 1,000,000 ກີບ' });
  }
  if (Number(stock) > 100 || Number(stock) < 0) {
    return res.status(400).json({ error: 'ຈຳນວນສະຕັອກຕ້ອງຢູ່ລະຫວ່າງ 0 - 100' });
  }

  const image = req.file ? '/uploads/' + req.file.filename : '';

  const [result] = await pool.query(
        'INSERT INTO products (name, price, size, color, stock, image) VALUES (?, ?, ?, ?, ?, ?)',
        [name, price, size, color, stock, image]
      );
      res.json({ id: result.insertId });
    } catch (dbErr) {
      console.error(dbErr);
      res.status(500).json({ error: 'Database error' });
    }
  });
});

// ແກ້ໄຂຂໍ້ມູນເມນູ (ຊື່, ລາຄາ, ປະເພດ, ຄວາມເຜັດ, ສະຕັອກ) - ແກ້ໄດ້ທີລະ field
router.put('/:id', async (req, res) => {
  try {
    const allowedFields = ['name', 'price', 'size', 'color', 'stock'];
    const updates = [];
    const values = [];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'ບໍ່ມີຂໍ້ມູນໃຫ້ແກ້ໄຂ' });
    }

    values.push(req.params.id);
    await pool.query(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`, values);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ແກ້ໄຂຮູບເມນູ
router.put('/:id/image', (req, res) => {
  upload.single('image')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ error: 'ບໍ່ມີໄຟລ໌ຮູບ' });
      }
      const image = '/uploads/' + req.file.filename;
      await pool.query('UPDATE products SET image = ? WHERE id = ?', [image, req.params.id]);
      res.json({ success: true, image });
    } catch (dbErr) {
      console.error(dbErr);
      res.status(500).json({ error: 'Database error' });
    }
  });
});

// ລຶບສິນຄ້າ
router.delete('/:id', async (req, res) => {
  try {
    const productId = req.params.id;
    await pool.query('DELETE FROM orders WHERE product_id = ?', [productId]);
    await pool.query('DELETE FROM products WHERE id = ?', [productId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;