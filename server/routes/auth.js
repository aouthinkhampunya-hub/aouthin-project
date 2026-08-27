const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'my-secret-key-change-this-later';

router.post('/login', (req, res) => {
  const { username, password } = req.body;

  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
  if (!admin) {
    return res.status(401).json({ error: 'ຊື່ຜູ້ໃຊ້ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ' });
  }

  const isValid = bcrypt.compareSync(password, admin.password);
  if (!isValid) {
    return res.status(401).json({ error: 'ຊື່ຜູ້ໃຊ້ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ' });
  }

  const token = jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: '1d' });
  res.cookie('token', token, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
  res.json({ message: 'ເຂົ້າສູ່ລະບົບສຳເລັດ' });
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'ອອກຈາກລະບົບແລ້ວ' });
});

router.get('/check', (req, res) => {
  const token = req.cookies.token;
  if (!token) return res.json({ loggedIn: false });

  try {
    jwt.verify(token, JWT_SECRET);
    res.json({ loggedIn: true });
  } catch (err) {
    res.json({ loggedIn: false });
  }
});

module.exports = router;
module.exports.JWT_SECRET = JWT_SECRET;