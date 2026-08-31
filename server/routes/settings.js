const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');

// ตั้งค่า multer เก็บรูป QR ที่ public/uploads
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
router.get('/qr', (req, res) => {
  const row = db.prepare(`SELECT value FROM settings WHERE key = 'payment_qr'`).get();
  res.json({ qrImage: row ? row.value : null });
});

// ອັບໂຫລດ / ປ່ຽນ QR ຮັບເງິນ
router.post('/qr', upload.single('qr'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'ບໍ່ພົບໄຟລ໌ຮູບ' });
  }
  const imagePath = '/uploads/' + req.file.filename;

  const existing = db.prepare(`SELECT * FROM settings WHERE key = 'payment_qr'`).get();
  if (existing) {
    db.prepare(`UPDATE settings SET value = ? WHERE key = 'payment_qr'`).run(imagePath);
  } else {
    db.prepare(`INSERT INTO settings (key, value) VALUES ('payment_qr', ?)`).run(imagePath);
  }

  res.json({ success: true, qrImage: imagePath });
});

module.exports = router;