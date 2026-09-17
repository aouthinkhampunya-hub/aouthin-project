const express = require('express');
const router = express.Router();
const { pool } = require('../db');

router.get('/', async (req, res) => {
  try {
    const [orders] = await pool.query(`
      SELECT orders.*, products.name AS product_name, products.price, bills.table_number
      FROM orders
      JOIN products ON orders.product_id = products.id
      JOIN bills ON orders.bill_id = bills.id
      ORDER BY orders.created_at DESC
    `);
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.get('/bills', async (req, res) => {
  try {
    const [bills] = await pool.query(
      `SELECT * FROM bills WHERE status = 'open' ORDER BY table_number`
    );

    const billsWithItems = await Promise.all(
      bills.map(async (bill) => {
        const [items] = await pool.query(
          `SELECT orders.*, products.name AS product_name, products.price
           FROM orders
           JOIN products ON orders.product_id = products.id
           WHERE orders.bill_id = ?
           ORDER BY orders.created_at`,
          [bill.id]
        );
        return { ...bill, items };
      })
    );

    res.json(billsWithItems);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.post('/', async (req, res) => {
  const { table_number, items } = req.body;

  if (!table_number || !items || items.length === 0) {
    return res.status(400).json({ error: 'ຂໍ້ມູນບໍ່ຄບ' });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    let [bills] = await connection.query(
      `SELECT * FROM bills WHERE table_number = ? AND status = 'open'`,
      [table_number]
    );
    let bill = bills[0];

    if (!bill) {
      const [result] = await connection.query(
        `INSERT INTO bills (table_number) VALUES (?)`,
        [table_number]
      );
      bill = { id: result.insertId };
    }

    for (const item of items) {
      const [products] = await connection.query(
        'SELECT * FROM products WHERE id = ? FOR UPDATE',
        [item.product_id]
      );
      const product = products[0];

      if (!product) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ error: `ไม่พบเมนู id ${item.product_id}` });
      }
      if (product.stock < item.quantity) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ error: `${product.name} ไม่พอ` });
      }
    }

    for (const item of items) {
      await connection.query(
        'INSERT INTO orders (bill_id, product_id, quantity) VALUES (?, ?, ?)',
        [bill.id, item.product_id, item.quantity]
      );
      await connection.query(
        'UPDATE products SET stock = stock - ? WHERE id = ?',
        [item.quantity, item.product_id]
      );
    }

    await connection.commit();
    connection.release();

    res.json({ bill_id: bill.id, message: 'ສັ່ງອາຫານສເລັດ' });
  } catch (err) {
    await connection.rollback();
    connection.release();
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { status } = req.body;
    await pool.query('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    const order = rows[0];

    if (!order) {
      return res.status(404).json({ error: 'ບໍ່ພົບອໍເດີ້ນີ້' });
    }
    if (order.status !== 'pending') {
      return res.status(400).json({ error: 'ຍົກເລີກບໍ່ໄດ້ ຮ້ານເລີ່ມເຮັດອາຫານແລ້ວ' });
    }

    await pool.query('UPDATE products SET stock = stock + ? WHERE id = ?', [order.quantity, order.product_id]);
    await pool.query('DELETE FROM orders WHERE id = ?', [req.params.id]);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.put('/bills/:id/close', async (req, res) => {
  try {
    await pool.query(
      `UPDATE bills SET status = 'paid', paid_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;