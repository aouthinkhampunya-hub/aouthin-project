const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const os = require('os');

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

router.get('/', async (req, res) => {
  try {
    const localIP = getLocalIP();
    const menuUrl = `http://${localIP}:3000/menu/index.html`;
    const qrImage = await QRCode.toDataURL(menuUrl);
    res.json({ qrImage, menuUrl });
  } catch (err) {
    res.status(500).json({ error: 'ສ້າງ QR Code ບໍ່ສຳເລດ' });
  }
});

module.exports = router;