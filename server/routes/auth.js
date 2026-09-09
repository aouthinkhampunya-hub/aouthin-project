const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'ປ່ຽນລະຫັດນີ້ໃນ production';

router.post('/login', (req, res) => {
  const { username, password } = req.body;

  const admin = db.prepare(`SELECT * FROM admins WHERE username = ?`).get(username);
  if (!admin) return res.status(401).json({ error: 'ຊື່ຜູ້ໃຊ້ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ' });

  const match = bcrypt.compareSync(password, admin.password);
  if (!match) return res.status(401).json({ error: 'ຊື່ຜູ້ໃຊ້ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ' });

  const token = jwt.sign(
    { id: admin.id, username: admin.username, name: admin.name, role: admin.role || 'staff' },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  });
  res.json({ success: true, name: admin.name });
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