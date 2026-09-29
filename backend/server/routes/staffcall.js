const express = require('express');
const router = express.Router();
const { pool } = require('../db');

const COOLDOWN_SECONDS = 60;

// ລູກຄ້າກົດເອີ້ນພະນັກງານ
router.post('/', async (req, res) => {
  try {
    const { table_number } = req.body;
    if (!table_number) {
      return res.status(400).json({ error: 'ບໍ່ພົບເລກໂຕະ' });
    }

    // ການເອີ້ນຄັ້ງຫຼ້າສຸດຂອງໂຕະນີ້ (ຄິດອາຍຸເປັນວິນາທີໃນ MySQL ເພື່ອບໍ່ໃຫ້ເວລາຄາດເຄື່ອນ)
    const [lastRows] = await pool.query(
      `SELECT TIMESTAMPDIFF(SECOND, created_at, NOW()) AS age_seconds
       FROM staff_calls
       WHERE table_number = ?
       ORDER BY id DESC
       LIMIT 1`,
      [table_number]
    );

    // ເອີ້ນຖີ່ເກີນໄປ (ບໍ່ຮອດ 60 ວິນາທີ)
    if (lastRows.length > 0 && lastRows[0].age_seconds < COOLDOWN_SECONDS) {
      const retryAfter = Math.max(1, COOLDOWN_SECONDS - lastRows[0].age_seconds);
      return res.status(429).json({
        error: 'ເອີ້ນຖີ່ເກີນໄປ ກະລຸນາລໍຖ້າ',
        retryAfter
      });
    }

    // ຖ້າອັນເກົ່າຂອງໂຕະນີ້ຍັງລໍແອັດມິນຮັບຮູ້ຢູ່ ບໍ່ສ້າງລາຍການໃໝ່ຊ້ຳ
    const [pendingRows] = await pool.query(
      `SELECT id FROM staff_calls WHERE table_number = ? AND status = 'pending' LIMIT 1`,
      [table_number]
    );
    if (pendingRows.length > 0) {
      return res.json({ success: true, alreadyCalled: true });
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