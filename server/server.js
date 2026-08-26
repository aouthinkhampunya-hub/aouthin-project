const express = require('express');
const cors = require('cors');
const path = require('path');
const productsRouter = require('./routes/products');
const ordersRouter = require('./routes/orders');
const qrcodeRouter = require('./routes/qrcode'); // ← เพิ่มบรรทัดนี้

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.use('/api/products', productsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/qrcode', qrcodeRouter); // ← เพิ่มบรรทัดนี้

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server กำลังทำงานอยู่' });
});

app.listen(PORT, () => {
  console.log(`Server รันอยู่ที่ http://localhost:${PORT}`);
});