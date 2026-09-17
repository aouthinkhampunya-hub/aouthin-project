const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const { initDb } = require('./db');
const productsRouter = require('./routes/products');
const ordersRouter = require('./routes/orders');
const qrcodeRouter = require('./routes/qrcode');
const settingsRouter = require('./routes/settings');
const adminsRouter = require('./routes/admin');
const staffCallRouter = require('./routes/staffcall');
const authRouter = require('./routes/auth');
const requireAuth = require('./middleware/requireAuth');

const app = express();
const PORT = process.env.PORT || 3000;
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
   'https://aouthin-123.web.app',
  'https://aouthin-123.firebaseapp.com',
];

app.use(cors({
  origin: function (origin, callback) {
    const isLocalNetwork = origin && /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.)\d+\.\d+(:\d+)?$/.test(origin);

    if (!origin || allowedOrigins.includes(origin) || isLocalNetwork) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));

app.use('/api/auth', authRouter);
app.use('/api/products', productsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/qrcode', qrcodeRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/admins', adminsRouter);
app.use('/api/staffcall', staffCallRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server ກຳລັງເຮັດວຽກຢູ່' });
});

app.get('/', (req, res) => {
  res.redirect('/menu/index.html');
});

app.get('/admin', (req, res) => {
  res.redirect('/admin/index.html');
});

app.get('/app', (req, res) => {
  res.redirect('/app/');
});

app.get(/^\/app\/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/app/index.html'));
});

async function startServer() {
  try {
    await initDb();

    app.listen(PORT, async () => {
      console.log(`Server ຣັນຢູ່ທີ່ http://localhost:${PORT}`);

      const open = (await import('open')).default;
      open(`http://localhost:${PORT}/menu/index.html`);
      open(`http://localhost:${PORT}/admin/index.html`);
    });
  } catch (err) {
    console.error('❌ ບໍ່ສາມາດເຊື່ອມຕໍ່ຖານຂໍ້ມູນ:', err);
    process.exit(1);
  }
}

startServer();