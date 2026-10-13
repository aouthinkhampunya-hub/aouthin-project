// backend/server/routes/qrcode.js
const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');

const TOTAL_TABLES = 20;

// ທີ່ຢູ່ໜ້າເກົ່າຂອງ backend (ໃຊ້ເປັນຕົວສຳຮອງ ຖ້າບໍ່ໄດ້ຕັ້ງ FRONTEND_URL)
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || 'https://aouthin-project-1.onrender.com').replace(/\/$/, '');

// ທີ່ຢູ່ໜ້າ React (frontend) ຖ້າຕັ້ງ FRONTEND_URL ໄວ້ ຈະໃຊ້ອັນນີ້ກ່ອນ
// ຍົກເວັ້ນ: ຖ້າມັນເປັນ localhost ແຕ່ server ແລ່ນ online ຈະບໍ່ໃຊ້ (ມືຖືລູກຄ້າເປີດ localhost ບໍ່ໄດ້)
function getFrontendBase(req) {
  const raw = (process.env.FRONTEND_URL || '').replace(/\/+$/, '');
  if (!raw) return '';
  const frontIsLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(raw);
  const reqIsLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(req.get('host') || '');
  if (frontIsLocal && !reqIsLocal) return '';
  return raw;
}

// QR ອັນດຽວ (ໜ້າເມນູລວມ ບໍ່ລະບຸໂຕະ)
// ມີ FRONTEND_URL  -> FRONTEND_URL/menu
// ບໍ່ມີ            -> PUBLIC_BASE_URL/menu/index.html (ໜ້າເກົ່າ)
router.get('/', async (req, res) => {
  try {
    const frontend = getFrontendBase(req);
    const menuUrl = frontend
      ? `${frontend}/menu`
      : `${PUBLIC_BASE_URL}/menu/index.html`;
    const qrImage = await QRCode.toDataURL(menuUrl);
    res.json({ qrImage, menuUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'ສ້າງ QR Code ບໍ່ສຳເລັດ' });
  }
});

// ໝາຍເຫດ: ເສັ້ນທາງ /tables ດ້ານລຸ່ມນີ້ ຕອນນີ້ບໍ່ຖືກໃຊ້ແລ້ວ
// ເພາະ table-routes.js ຖືກ require ກ່ອນໃນ server.js ແລະຈັບ /api/qrcode/tables ໄປກ່ອນ
// ເກັບໄວ້ເປັນຕົວສຳຮອງເທົ່ານັ້ນ
router.get('/tables', async (req, res) => {
  try {
    const tables = [];
    for (let n = 1; n <= TOTAL_TABLES; n++) {
      const menuUrl = `${PUBLIC_BASE_URL}/menu/index.html?table=${n}`;
      const qrImage = await QRCode.toDataURL(menuUrl);
      tables.push({ table: n, menuUrl, qrImage });
    }
    res.json({ totalTables: TOTAL_TABLES, tables });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'ສ້າງ QR Code ບໍ່ສຳເລັດ' });
  }
});

module.exports = router;