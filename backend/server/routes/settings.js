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
    const uniqueName = 'payment-qr-' + Date.now() + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});
const upload = multer({ storage: storage });

// ດຶງ QR ຮັບເງິນ
router.get('/qr', async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT value FROM settings WHERE `key` = 'payment_qr'"
    );
    const row = rows[0];
    res.json({ qrImage: row ? row.value : null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ອັບໂຫລດ / ປ່ຽນ QR ຮັບເງິນ
router.post('/qr', upload.single('qr'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'ບໍ່ພົບໄຟລ໌ຮູບ' });
    }
    const imagePath = '/uploads/' + req.file.filename;

    const [rows] = await pool.query(
      "SELECT * FROM settings WHERE `key` = 'payment_qr'"
    );
    const existing = rows[0];

    if (existing) {
      await pool.query(
        "UPDATE settings SET value = ? WHERE `key` = 'payment_qr'",
        [imagePath]
      );
    } else {
      await pool.query(
        "INSERT INTO settings (`key`, value) VALUES ('payment_qr', ?)",
        [imagePath]
      );
    }

    res.json({ success: true, qrImage: imagePath });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;