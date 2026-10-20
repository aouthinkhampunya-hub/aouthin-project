const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const multer = require('multer');
const path = require('path');

// delivery.js: ຖ້າຢູ່ໂຟນເດີ routes ໃຊ້ './delivery' ຖ້າຢູ່ໜຶ່ງຊັ້ນຂ້າງເທິງໃຊ້ '../delivery'
let delivery;
try {
  delivery = require('../delivery');
} catch (e) {
  delivery = require('./delivery');
}

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

// ===== ທີ່ຕັ້ງຮ້ານ (ແອັດມິນປັກມຸດເທິງແຜນທີ່) + ໄລຍະສົ່ງສູງສຸດ =====
// ເກັບໃນຕາຕະລາງ settings: shop_lat, shop_lng, delivery_max_km
async function loadShopLocation() {
  try {
    const [rows] = await pool.query(
      "SELECT `key`, value FROM settings WHERE `key` IN ('shop_lat', 'shop_lng', 'delivery_max_km')"
    );
    const lat = rows.find((r) => r.key === 'shop_lat');
    const lng = rows.find((r) => r.key === 'shop_lng');
    const maxKm = rows.find((r) => r.key === 'delivery_max_km');
    if (lat && lng) {
      delivery.setRestaurantLocation(lat.value, lng.value);
    }
    if (maxKm) {
      delivery.setMaxKm(maxKm.value);
    }
  } catch (err) {
    console.error('loadShopLocation:', err.message);
  }
}
loadShopLocation(); // ໂຫຼດຄັ້ງດຽວຕອນເປີດ server

async function saveSetting(key, value) {
  await pool.query(
    'INSERT INTO settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?',
    [key, String(value), String(value)]
  );
}

// ດຶງພິກັດຮ້ານ + ໄລຍະສົ່ງສູງສຸດ (ລູກຄ້າໃຊ້ຕອນສັ່ງອອນລາຍ, ແອັດມິນໃຊ້ໃນໜ້າ Settings)
router.get('/location', (req, res) => {
  res.json(delivery.getRestaurantLocation());
});

// ບັນທຶກພິກັດຮ້ານ (ແລະ ໄລຍະສົ່ງສູງສຸດ ຖ້າສົ່ງ max_km ມາ)
router.post('/location', async (req, res) => {
  try {
    const lat = Number(req.body.lat);
    const lng = Number(req.body.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ error: 'ພິກັດບໍ່ຖືກຕ້ອງ' });
    }

    // ໄລຍະສົ່ງສູງສຸດ (ບໍ່ບັງຄັບ): ຕ້ອງເປັນເລກ 1 ຫາ 100 ກມ
    const hasMaxKm =
      req.body.max_km !== undefined && req.body.max_km !== null && req.body.max_km !== '';
    let maxKm = null;
    if (hasMaxKm) {
      maxKm = Number(req.body.max_km);
      if (!Number.isFinite(maxKm) || maxKm < 1 || maxKm > delivery.MAX_KM_LIMIT) {
        return res.status(400).json({
          error: `ໄລຍະສົ່ງສູງສຸດຕ້ອງຢູ່ລະຫວ່າງ 1 ຫາ ${delivery.MAX_KM_LIMIT} ກມ`,
        });
      }
      maxKm = Math.round(maxKm);
    }

    const latStr = lat.toFixed(6);
    const lngStr = lng.toFixed(6);
    await saveSetting('shop_lat', latStr);
    await saveSetting('shop_lng', lngStr);
    delivery.setRestaurantLocation(latStr, lngStr); // ໃຊ້ທັນທີ ບໍ່ຕ້ອງ restart

    if (maxKm !== null) {
      await saveSetting('delivery_max_km', maxKm);
      delivery.setMaxKm(maxKm);
    }

    res.json({ success: true, ...delivery.getRestaurantLocation() });
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