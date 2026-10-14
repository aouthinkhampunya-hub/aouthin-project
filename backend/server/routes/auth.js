const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'ປ່ຽນລະຫັດນີ້ໃນ production';

// ລັອກອິນ: ສົ່ງ area = 'admin' (ຄ່າເລີ່ມຕົ້ນ) ຫຼື 'kitchen' (ໜ້າລັອກອິນຄົວ)
//  - ບັນຊີ role 'kitchen' ເຂົ້າໄດ້ສະເພາະ area 'kitchen'
//  - ບັນຊີອື່ນ (owner / staff) ເຂົ້າໄດ້ທັງສອງ
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const area = req.body.area === 'kitchen' ? 'kitchen' : 'admin';

    if (!username || !password) {
      return res.status(401).json({ error: 'ຊື່ຜູ້ໃຊ້ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ' });
    }

    const [rows] = await pool.query(`SELECT * FROM admins WHERE username = ?`, [username]);
    const admin = rows[0];
    if (!admin) return res.status(401).json({ error: 'ຊື່ຜູ້ໃຊ້ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ' });

    const match = bcrypt.compareSync(password, admin.password);
    if (!match) return res.status(401).json({ error: 'ຊື່ຜູ້ໃຊ້ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ' });

    const role = admin.role || 'staff';

    // ບັນຊີຄົວ ຫ້າມເຂົ້າສູ່ລະບົບຜ່ານໜ້າລັອກອິນ admin
    if (area === 'admin' && role === 'kitchen') {
      return res.status(403).json({ error: 'ບັນຊີນີ້ເປັນບັນຊີຂອງຄົວ ກະລຸນາເຂົ້າສູ່ລະບົບທີ່ໜ້າລັອກອິນຄົວ' });
    }

    const token = jwt.sign(
      { id: admin.id, username: admin.username, name: admin.name, role },
      JWT_SECRET,
      { expiresIn: area === 'kitchen' ? '12h' : '8h' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      secure: process.env.NODE_ENV === 'production'
    });
    res.json({ success: true, name: admin.name, role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

router.get('/me', (req, res) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: 'ຍັງບໍ່ໄດ້ login' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ id: decoded.id, username: decoded.username, name: decoded.name, role: decoded.role || 'staff' });
  } catch {
    res.status(401).json({ error: 'session หมดอายุ' });
  }
});

module.exports = router;
module.exports.JWT_SECRET = JWT_SECRET;