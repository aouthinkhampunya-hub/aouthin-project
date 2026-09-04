const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');
const requireAuth = require('../middleware/requireAuth');
const { requireOwner } = require('../middleware/requireAuth');

router.get('/', requireAuth, (req, res) => {
  const admins = db.prepare('SELECT id, username, name, role FROM admins').all();
  res.json(admins);
});

router.post('/', requireAuth, (req, res) => {
  const { username, password, name } = req.body;
  if (!username || !password || !name) {
    return res.status(400).json({ error: 'ຂໍ້ມູນບໍ່ຄບ' });
  }
  const exists = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
  if (exists) {
    return res.status(400).json({ error: 'username ນີ້ມີຄົນໃຊ້ແລ້ວ' });
  }
  const hashed = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO admins (username, password, name, role) VALUES (?, ?, ?, ?)').run(username, hashed, name, 'staff');
  res.json({ id: result.lastInsertRowid });
});

router.put('/:id/reset-password', requireOwner, (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 4) {
    return res.status(400).json({ error: 'ລະຫັດຜ່ານຕ້ອງມີຢ່າງໜ້ອຍ 4 ໂຕ' });
  }

  const target = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.params.id);
  if (!target) {
    return res.status(404).json({ error: 'ບໍ່ພົບພະນັກງານນີ້' });
  }

  const hashed = bcrypt.hashSync(password, 10);
  db.prepare('UPDATE admins SET password = ? WHERE id = ?').run(hashed, req.params.id);
  res.json({ success: true });
});

router.delete('/:id', requireOwner, (req, res) => {
  const count = db.prepare('SELECT COUNT(*) as c FROM admins').get().c;
  if (count <= 1) {
    return res.status(400).json({ error: 'ຕ້ອງເຫຼືອ admin ຢ່າງໜ້ອຍ 1 ຄົນ' });
  }

  const target = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.params.id);
  if (target && target.role === 'owner') {
    return res.status(400).json({ error: 'ບໍ່ສາມາດລຶບເຈົ້າຂອງຮ້ານໄດ້' });
  }

  db.prepare('DELETE FROM admins WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;