const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const requireAuth = require('./middleware/requireAuth');

const SETTINGS_FILE = path.join(__dirname, 'table-settings.json');

function getTableCount() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')).count || 20;
  } catch {
    return 20;
  }
}

module.exports = function (app) {
  // ສ້າງ QR ທຸກໂຕະ
  app.get('/api/qrcode/tables', async (req, res) => {
    try {
      const count = getTableCount();
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const tables = [];
      for (let i = 1; i <= count; i++) {
        const qrImage = await QRCode.toDataURL(`${baseUrl}/menu/index.html?table=${i}`);
        tables.push({ table: i, qrImage });
      }
      res.json({ tables });
    } catch (err) {
      res.status(500).json({ error: 'ສ້າງ QR ບໍ່ສຳເລັດ' });
    }
  });

  // ເພີ່ມໂຕະ (ຕ້ອງ login)
  app.post('/api/tables', requireAuth, (req, res) => {
    try {
      const count = getTableCount() + 1;
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify({ count }));
      res.json({ count });
    } catch (err) {
      res.status(500).json({ error: 'ບັນທຶກບໍ່ສຳເລັດ' });
    }
  });

  // ລຶບໂຕະສຸດທ້າຍ (ຕ້ອງ login)
  app.delete('/api/tables', requireAuth, (req, res) => {
    try {
      const current = getTableCount();
      if (current <= 1) {
        return res.status(400).json({ error: 'ຕ້ອງມີຢ່າງໜ້ອຍ 1 ໂຕະ' });
      }
      const count = current - 1;
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify({ count }));
      res.json({ count });
    } catch (err) {
      res.status(500).json({ error: 'ລຶບບໍ່ສຳເລັດ' });
    }
  });

  // ດຶງຈຳນວນໂຕະ
  app.get('/api/tables/count', (req, res) => {
    res.json({ count: getTableCount() });
  });
};