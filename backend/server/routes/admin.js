const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const bcrypt = require('bcryptjs');
const requireAuth = require('../middleware/requireAuth');
const { requireOwner } = require('../middleware/requireAuth');

router.get('/', requireAuth, async (req, res) => {
  try {
    const [admins] = await pool.query('SELECT id, username, name, role FROM admins');
    res.json(admins);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { username, password, name } = req.body;
    if (!username || !password || !name) {
      return res.status(400).json({ error: 'ຂໍ້ມູນບໍ່ຄບ' });
    }

    const [existsRows] = await pool.query('SELECT * FROM admins WHERE username = ?', [username]);
    if (existsRows[0]) {
      return res.status(400).json({ error: 'username ນີ້ມີຄົນໃຊ້ແລ້ວ' });
    }

    const hashed = bcrypt.hashSync(password, 10);
    const [result] = await pool.query(
      'INSERT INTO admins (username, password, name, role) VALUES (?, ?, ?, ?)',
      [username, hashed, name, 'staff']
    );
    res.json({ id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.put('/:id/reset-password', requireOwner, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 4) {
      return res.status(400).json({ error: 'ລະຫັດຜ່ານຕ້ອງມີຢ່າງໜ້ອຍ 4 ໂຕ' });
    }

    const [rows] = await pool.query('SELECT * FROM admins WHERE id = ?', [req.params.id]);
    const target = rows[0];
    if (!target) {
      return res.status(404).json({ error: 'ບໍ່ພົບພະນັກງານນີ້' });
    }

    const hashed = bcrypt.hashSync(password, 10);
    await pool.query('UPDATE admins SET password = ? WHERE id = ?', [hashed, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.delete('/:id', requireOwner, async (req, res) => {
  try {
    const [countRows] = await pool.query('SELECT COUNT(*) as c FROM admins');
    const count = countRows[0].c;
    if (count <= 1) {
      return res.status(400).json({ error: 'ຕ້ອງເຫຼືອ admin ຢ່າງໜ້ອຍ 1 ຄົນ' });
    }

    const [rows] = await pool.query('SELECT * FROM admins WHERE id = ?', [req.params.id]);
    const target = rows[0];
    if (target && target.role === 'owner') {
      return res.status(400).json({ error: 'ບໍ່ສາມາດລຶບເຈົ້າຂອງຮ້ານໄດ້' });
    }

    await pool.query('DELETE FROM admins WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;