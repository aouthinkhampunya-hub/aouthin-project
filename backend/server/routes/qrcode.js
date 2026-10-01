const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');

const TOTAL_TABLES = 20;

// ທີ່ຢູ່ສາທາລະນະຂອງເວັບ (ບ່ອນ QR ຈະພາລູກຄ້າໄປ) ຕັ້ງຄ່າຜ່ານ .env ໄດ້ (PUBLIC_BASE_URL)
// ຄ່າເລີ່ມຕົ້ນເປັນເວັບທີ່ deploy ແລ້ວຈິງ (Render) ເພື່ອບໍ່ໃຫ້ QR ອີງໃສ່ IP ໃນເຄືອຂ່າຍທ້ອງຖິ່ນອີກຕໍ່ໄປ
// (ສາເຫດເກົ່າ: getLocalIP() ບາງຄັ້ງເລືອກ adapter ຜິດ ເຊັ່ນ WSL ແທນ Wi-Fi ຈິງ)
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || 'https://aouthin-project-1.onrender.com').replace(/\/$/, '');

// QR ອັນດຽວ (ໜ້າເມນູລວມ ບໍ່ລະບຸໂຕະ) — ຄົງໄວ້ເພື່ອບໍ່ໃຫ້ຂອງເກົ່າພັງ
router.get('/', async (req, res) => {
  try {
    const menuUrl = `${PUBLIC_BASE_URL}/menu/index.html`;
    const qrImage = await QRCode.toDataURL(menuUrl);
    res.json({ qrImage, menuUrl });
  } catch (err) {
    res.status(500).json({ error: 'ສ້າງ QR Code ບໍ່ສຳເລດ' });
  }
});

// QR ແຍກຕາມໂຕະ 1-20 (ສະແກນແລ້ວເຂົ້າໂຕະນັ້ນທັນທີ ບໍ່ຕ້ອງພິມເລກເອງ)
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
    res.status(500).json({ error: 'ສ້າງ QR Code ບໍ່ສຳເລດ' });
  }
});

module.exports = router;