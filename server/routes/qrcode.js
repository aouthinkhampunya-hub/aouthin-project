const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');

router.get('/', async (req, res) => {
  try {
    const menuUrl = `http://192.168.8.186:3000/menu/index.html`;
    const qrImage = await QRCode.toDataURL(menuUrl);
    res.json({ qrImage, menuUrl });
  } catch (err) {
    res.status(500).json({ error: 'ສ້າງ QR Code ບໍ່ສຳເລດ' });
  }
});

module.exports = router;