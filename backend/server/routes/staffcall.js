const express = require('express');
const router = express.Router();
const db = require('../db');

// ລູກຄ້າກົດເອີ້ນພະນັກງານ
router.post('/', (req, res) => {
  const { table_number } = req.body;
  if (!table_number) {
    return res.status(400).json({ error: 'ບໍ່ພົບເລກໂຕະ' });
  }
  db.prepare(`INSERT INTO staff_calls (table_number) VALUES (?)`).run(table_number);
  res.json({ success: true });
});

// ຫຼັງຮ້ານດຶງລາຍການທີ່ຍັງບໍ່ໄດ້ຮັບຮູ້
router.get('/', (req, res) => {
  const calls = db.prepare(`SELECT * FROM staff_calls WHERE status = 'pending' ORDER BY created_at DESC`).all();
  res.json(calls);
});

// ຮັບຮູ້ແລ້ວ (ລຶບອອກ)
router.put('/:id/ack', (req, res) => {
  db.prepare(`UPDATE staff_calls SET status = 'done' WHERE id = ?`).run(req.params.id);
  res.json({ success: true });
});

module.exports = router;