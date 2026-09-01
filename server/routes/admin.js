const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');

router.get('/', (req, res) => {
  const admins = db.prepare('SELECT id, username, name FROM admins').all();
  res.json(admins);
});

router.post('/', (req, res) => {
  const { username, password, name } = req.body;
  if (!username || !password || !name) {
    return res.status(400).json({ error: 'ຂໍ້ມູນບໍ່ຄບ' });
  }
  const exists = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
  if (exists) {
    return res.status(400).json({ error: 'username ນີ້ມີຄົນໃຊ້ແລ້ວ' });
  }
  const hashed = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO admins (username, password, name) VALUES (?, ?, ?)').run(username, hashed, name);
  res.json({ id: result.lastInsertRowid });
});

router.delete('/:id', (req, res) => {
  const count = db.prepare('SELECT COUNT(*) as c FROM admins').get().c;
  if (count <= 1) {
    return res.status(400).json({ error: 'ຕ້ອງເຫຼືອ admin ຢ່າງໜ້ອຍ 1 ຄົນ' });
  }
  db.prepare('DELETE FROM admins WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;