const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');

// สร้าง QR Code ที่ลิงก์ไปหน้าเมนู
router.get('/', async (req, res) => {
  try {
    // ใช้ IP หรือ domain จริงตอน deploy จริง ตอนนี้ใช้ localhost ก่อน
    const menuUrl = `http://${req.hostname}:3000/menu/index.html`;
    const qrImage = await QRCode.toDataURL(menuUrl);
    res.json({ qrImage, menuUrl });
  } catch (err) {
    res.status(500).json({ error: 'สร้าง QR Code ไม่สำเร็จ' });
  }
});

module.exports = router;