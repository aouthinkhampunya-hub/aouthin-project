const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const productsRouter = require('./routes/products');
const ordersRouter = require('./routes/orders');
const qrcodeRouter = require('./routes/qrcode');
const settingsRouter = require('./routes/settings');
const authRouter = require('./routes/auth');
const requireAuth = require('./middleware/requireAuth');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));

app.use('/api/auth', authRouter);
app.use('/api/products', productsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/qrcode', qrcodeRouter);
app.use('/api/settings', settingsRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server ກຳລັງເຮດວຽກຢູ່' });
});

app.get('/', (req, res) => {
  res.redirect('/menu/index.html');
});

app.get('/admin', (req, res) => {
  res.redirect('/admin/index.html');
});

app.listen(PORT, async () => {
  console.log(`Server ຣັນຢູ່ທີ່ http://localhost:${PORT}`);
  
  const open = (await import('open')).default;
  open(`http://localhost:${PORT}/menu/index.html`);
  open(`http://localhost:${PORT}/admin/index.html`);
});