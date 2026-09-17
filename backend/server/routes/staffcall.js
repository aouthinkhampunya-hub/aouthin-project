const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// ລູກຄ້າກົດເອີ້ນພະນັກງານ
router.post('/', async (req, res) => {
  try {
    const { table_number } = req.body;
    if (!table_number) {
      return res.status(400).json({ error: 'ບໍ່ພົບເລກໂຕະ' });
    }
    await pool.query(`INSERT INTO staff_calls (table_number) VALUES (?)`, [table_number]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ຫຼັງຮ້ານດຶງລາຍການທີ່ຍັງບໍ່ໄດ້ຮັບຮູ້
router.get('/', async (req, res) => {
  try {
    const [calls] = await pool.query(
      `SELECT * FROM staff_calls WHERE status = 'pending' ORDER BY created_at DESC`
    );
    res.json(calls);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ຮັບຮູ້ແລ້ວ (ລຶບອອກ)
router.put('/:id/ack', async (req, res) => {
  try {
    await pool.query(`UPDATE staff_calls SET status = 'done' WHERE id = ?`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;