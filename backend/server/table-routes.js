const QRCode = require('qrcode');
const requireAuth = require('./middleware/requireAuth');
const { pool } = require('./db');

const MAX_TABLE_NUMBER = 999;

// ລາຍຊື່ເລກໂຕະທັງໝົດ (ຮຽງນ້ອຍ → ໃຫຍ່)
async function getTables() {
  const [rows] = await pool.query(
    'SELECT table_number FROM restaurant_tables ORDER BY table_number'
  );
  return rows.map((r) => Number(r.table_number));
}

// ໂຕະນີ້ຍັງມີບິນເປີດຢູ່ບໍ່
async function hasOpenBill(n) {
  const [rows] = await pool.query(
    `SELECT id FROM bills WHERE table_number = ? AND status = 'open' LIMIT 1`,
    [String(n)]
  );
  return rows.length > 0;
}

// ແປງຄ່າທີ່ຮັບມາເປັນເລກໂຕະ (1-999) ຖ້າບໍ່ຖືກຄືນ null
function parseTableNumber(v) {
  const s = String(v ?? '').trim();
  if (!/^\d{1,3}$/.test(s)) return null;
  const n = Number(s);
  return n >= 1 && n <= MAX_TABLE_NUMBER ? n : null;
}

// ລິ້ງຂອງ QR ໂຕະ:
// - ຖ້າຕັ້ງ FRONTEND_URL ແລະມັນບໍ່ແມ່ນ localhost -> ຊີ້ໄປໜ້າ React ຕາມ FRONTEND_URL
// - ຖ້າ FRONTEND_URL ເປັນ localhost ແຕ່ server ແລ່ນ online (ເຊັ່ນ Render) -> ບໍ່ໃຊ້ມັນ
//   (ມືຖືລູກຄ້າເປີດ localhost ບໍ່ໄດ້) ໃຊ້ທີ່ຢູ່ຈິງຂອງ server ແທນ
// - ຖ້າບໍ່ຕັ້ງ ໃຊ້ໜ້າເມນູຂອງ backend ຄືເກົ່າ
function menuBaseUrl(req) {
  const front = (process.env.FRONTEND_URL || '').replace(/\/+$/, '');
  const frontIsLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(front);
  const reqIsLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(req.get('host') || '');

  if (front && (!frontIsLocal || reqIsLocal)) return `${front}/menu`;
  return `${req.protocol}://${req.get('host')}/menu/index.html`;
}

async function removeTable(n, res) {
  const tables = await getTables();
  if (!tables.includes(n)) {
    return res.status(404).json({ error: `ບໍ່ພົບໂຕະ ${n}` });
  }
  if (tables.length <= 1) {
    return res.status(400).json({ error: 'ຕ້ອງມີຢ່າງໜ້ອຍ 1 ໂຕະ' });
  }
  if (await hasOpenBill(n)) {
    return res.status(400).json({ error: `ໂຕະ ${n} ຍັງມີບິນເປີດຢູ່ ກະລຸນາປິດບິນກ່ອນ` });
  }

  await pool.query('DELETE FROM restaurant_tables WHERE table_number = ?', [n]);
  const updated = await getTables();
  return res.json({ removed: n, count: Math.max(...updated), tables: updated });
}

module.exports = function (app) {
  // ສ້າງ QR ທຸກໂຕະ (ມີ menuUrl ໃຫ້ກວດໄດ້ວ່າ QR ຊີ້ໄປບ່ອນໃດ)
  app.get('/api/qrcode/tables', async (req, res) => {
    try {
      const base = menuBaseUrl(req);
      const numbers = await getTables();
      const tables = await Promise.all(
        numbers.map(async (n) => {
          const menuUrl = `${base}?table=${n}`;
          return {
            table: n,
            menuUrl,
            qrImage: await QRCode.toDataURL(menuUrl),
          };
        })
      );
      res.json({ tables });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'ສ້າງ QR ບໍ່ສຳເລັດ' });
    }
  });

  // ເພີ່ມໂຕະ (ຕ້ອງ login)
  // ໃສ່ { number } = ເພີ່ມເລກນັ້ນ | ບໍ່ໃສ່ = ເພີ່ມເລກຖັດໄປ (ເລກສູງສຸດ + 1)
  app.post('/api/tables', requireAuth, async (req, res) => {
    try {
      const tables = await getTables();
      const raw = req.body ? req.body.number : undefined;
      let n;

      if (raw !== undefined && String(raw).trim() !== '') {
        n = parseTableNumber(raw);
        if (n === null) {
          return res.status(400).json({ error: `ເລກໂຕະຕ້ອງເປັນຕົວເລກ 1-${MAX_TABLE_NUMBER}` });
        }
      } else {
        n = (tables.length ? Math.max(...tables) : 0) + 1;
        if (n > MAX_TABLE_NUMBER) {
          return res.status(400).json({ error: `ເລກໂຕະສູງສຸດແມ່ນ ${MAX_TABLE_NUMBER}` });
        }
      }

      if (tables.includes(n)) {
        return res.status(409).json({ error: `ມີໂຕະ ${n} ຢູ່ແລ້ວ` });
      }

      await pool.query('INSERT INTO restaurant_tables (table_number) VALUES (?)', [n]);
      const updated = await getTables();
      res.json({ table: n, count: Math.max(...updated), tables: updated });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'ບັນທຶກບໍ່ສຳເລັດ' });
    }
  });

  // ລຶບໂຕະສຸດທ້າຍ = ເລກສູງສຸດ (ຕ້ອງ login) ເກັບໄວ້ໃຫ້ໜ້າເກົ່າໃຊ້ໄດ້
  app.delete('/api/tables', requireAuth, async (req, res) => {
    try {
      const tables = await getTables();
      if (tables.length === 0) {
        return res.status(400).json({ error: 'ບໍ່ມີໂຕະໃຫ້ລຶບ' });
      }
      await removeTable(Math.max(...tables), res);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'ລຶບບໍ່ສຳເລັດ' });
    }
  });

  // ລຶບໂຕະໃດກໍໄດ້ ຕາມເລກ (ຕ້ອງ login)
  app.delete('/api/tables/:number', requireAuth, async (req, res) => {
    try {
      const n = parseTableNumber(req.params.number);
      if (n === null) {
        return res.status(400).json({ error: 'ເລກໂຕະບໍ່ຖືກຕ້ອງ' });
      }
      await removeTable(n, res);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'ລຶບບໍ່ສຳເລັດ' });
    }
  });

  // ດຶງຈຳນວນໂຕະ: count = ເລກສູງສຸດ, tables = ລາຍຊື່ເລກທັງໝົດ
  app.get('/api/tables/count', async (req, res) => {
    try {
      const tables = await getTables();
      res.json({ count: tables.length ? Math.max(...tables) : 0, tables });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'ໂຫລດບໍ່ສຳເລັດ' });
    }
  });
};