const express = require('express');
const router = express.Router();
const db = require('../db');
router.get('/', (req, res) => {
  const orders = db.prepare(`
    SELECT orders.*, products.name AS product_name, products.price, bills.table_number
    FROM orders
    JOIN products ON orders.product_id = products.id
    JOIN bills ON orders.bill_id = bills.id
    ORDER BY orders.created_at DESC
  `).all();
  res.json(orders);
});

router.get('/bills', (req, res) => {
  const bills = db.prepare(`SELECT * FROM bills WHERE status = 'open' ORDER BY table_number`).all();

  const billsWithItems = bills.map(bill => {
    const items = db.prepare(`
      SELECT orders.*, products.name AS product_name, products.price
      FROM orders
      JOIN products ON orders.product_id = products.id
      WHERE orders.bill_id = ?
      ORDER BY orders.created_at
    `).all(bill.id);
    return { ...bill, items };
  });

  res.json(billsWithItems);
});

router.post('/', (req, res) => {
  const { table_number, items } = req.body;

  if (!table_number || !items || items.length === 0) {
    return res.status(400).json({ error: 'ຂໍ້ມູນບໍ່ຄບ' });
  }

  let bill = db.prepare(`SELECT * FROM bills WHERE table_number = ? AND status = 'open'`).get(table_number);
  if (!bill) {
    const result = db.prepare(`INSERT INTO bills (table_number) VALUES (?)`).run(table_number);
    bill = { id: result.lastInsertRowid };
  }

  for (const item of items) {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
    if (!product) {
      return res.status(404).json({ error: `ไม่พบเมนู id ${item.product_id}` });
    }
    if (product.stock < item.quantity) {
      return res.status(400).json({ error: `${product.name} ไม่พอ` });
    }
  }

  const insertOrder = db.prepare('INSERT INTO orders (bill_id, product_id, quantity) VALUES (?, ?, ?)');
  const updateStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');

  for (const item of items) {
    insertOrder.run(bill.id, item.product_id, item.quantity);
    updateStock.run(item.quantity, item.product_id);
  }

  res.json({ bill_id: bill.id, message: 'ສັ່ງອາຫານສເລັດ' });
});

router.put('/:id', (req, res) => {
  const { status } = req.body;
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ success: true });
});

router.put('/bills/:id/close', (req, res) => {
  db.prepare(`UPDATE bills SET status = 'paid', paid_at = CURRENT_TIMESTAMP WHERE id = ?`).run(req.params.id);
  res.json({ success: true });
});

module.exports = router;