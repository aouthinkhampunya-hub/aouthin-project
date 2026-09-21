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

// ===== ຈັດການ ປະເພດອາຫານ / ລະດັບຄວາມເຜັດ =====
// type ຕ້ອງເປັນ 'category' ຫຼື 'spice' ເທົ່ານັ້ນ
const SETTINGS_KEY = {
  category: 'product_categories',
  spice: 'spice_levels'
};

const DEFAULTS = {
  category: ['ເຂົ້າ', 'ເຄື່ອງດື່ມ', 'ຂອງກິນຫລີ້ນ', 'ເສັ້ນ', 'ຕຳ'],
  spice: ['ບໍ່ເຜັດ', 'ເຜັດໜ້ອຍ', 'ເຜັດປານກາງ', 'ເຜັດຫຼາຍ']
};

async function getOptionList(type) {
  const key = SETTINGS_KEY[type];
  const [rows] = await pool.query('SELECT value FROM settings WHERE `key` = ?', [key]);
  if (rows[0]) {
    try {
      return JSON.parse(rows[0].value);
    } catch {
      return DEFAULTS[type];
    }
  }
  return DEFAULTS[type];
}

async function saveOptionList(type, list) {
  const key = SETTINGS_KEY[type];
  const json = JSON.stringify(list);
  const [rows] = await pool.query('SELECT * FROM settings WHERE `key` = ?', [key]);
  if (rows[0]) {
    await pool.query('UPDATE settings SET value = ? WHERE `key` = ?', [json, key]);
  } else {
    await pool.query('INSERT INTO settings (`key`, value) VALUES (?, ?)', [key, json]);
  }
}

// ດຶງລາຍການ ປະເພດ + ຄວາມເຜັດ ພ້ອມກັນ
router.get('/options', async (req, res) => {
  try {
    const categories = await getOptionList('category');
    const spiceLevels = await getOptionList('spice');
    res.json({ categories, spiceLevels });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ເພີ່ມຕົວເລືອກໃໝ່
router.post('/options/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { value } = req.body;
    if (!SETTINGS_KEY[type]) return res.status(400).json({ error: 'ປະເພດບໍ່ຖືກຕ້ອງ' });
    if (!value || !value.trim()) return res.status(400).json({ error: 'ກະລຸນາໃສ່ຊື່' });

    const list = await getOptionList(type);
    if (!list.includes(value.trim())) {
      list.push(value.trim());
      await saveOptionList(type, list);
    }
    res.json({ success: true, list });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ລຶບຕົວເລືອກ
router.delete('/options/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { value } = req.body;
    if (!SETTINGS_KEY[type]) return res.status(400).json({ error: 'ປະເພດບໍ່ຖືກຕ້ອງ' });

    let list = await getOptionList(type);
    list = list.filter(v => v !== value);
    await saveOptionList(type, list);
    res.json({ success: true, list });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;