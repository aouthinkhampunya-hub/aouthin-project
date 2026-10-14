const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const fs = require('fs');
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
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  'https://aouthin-123.web.app',
  'https://aouthin-123.firebaseapp.com',
  'https://aouthin-project-1.onrender.com',
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
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// ===== ແຍກໜ້າ (ຝັ່ງ backend / ໜ້າ HTML ເກົ່າ): ບັນຊີຄົວ (role 'kitchen') ເປີດໜ້າ admin ເກົ່າ (/admin/*.html) ບໍ່ໄດ້ =====
// ຖືກສົ່ງໄປໜ້າຄົວຂອງ backend ເອງ (/kitchen/) ບໍ່ໄດ້ສົ່ງໄປ frontend. ຍົກເວັ້ນໜ້າລັອກອິນ ເພື່ອໃຫ້ສະຫຼັບບັນຊີໄດ້
const KITCHEN_HOME = '/kitchen/';

app.use((req, res, next) => {
  if (req.method !== 'GET') return next();

  const p = req.path;
  const isAdminPage =
    p === '/admin' || p === '/admin/' || (p.startsWith('/admin/') && p.endsWith('.html'));
  if (!isAdminPage || p === '/admin/login.html') return next();

  const token = req.cookies && req.cookies.token;
  if (!token) return next();

  try {
    const user = jwt.verify(token, authRouter.JWT_SECRET);
    if (user.role === 'kitchen') return res.redirect(KITCHEN_HOME);
  } catch (e) {
    // token ໝົດອາຍຸ/ບໍ່ຖືກ → ປ່ອຍຕາມປົກກະຕິ
  }
  next();
});

// ===== ໜ້າຄົວຂອງ backend (ແຍກຈາກ admin): /kitchen/ ແລະ ໜ້າລັອກອິນຄົວ /kitchen/login =====
// ໄຟລ໌ຢູ່ backend/public/kitchen/ (index.html = ໜ້າຄົວ, login.html = ລັອກອິນຄົວ)
app.get('/kitchen/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/kitchen/login.html'));
});

// ===== ເອົາ "ຄົວ" ອອກຈາກໜ້າ admin ເກົ່າ (/admin/*.html) =====
// - /admin/kitchen.html ສົ່ງໄປໜ້າຄົວແຍກຂອງ backend (/kitchen/) ສຳລັບທຸກຄົນ
// - ໜ້າ admin ອື່ນ: ລຶບລິ້ງ "ຄົວ" (href="kitchen.html") ອອກຈາກແຖບເມນູກ່ອນສົ່ງໃຫ້ browser
//   (ວິທີຊົ່ວຄາວ ບໍ່ຕ້ອງແກ້ HTML ທຸກໄຟລ໌)
app.get(/^\/admin\/([\w-]+)\.html$/, (req, res, next) => {
  const name = req.params[0];
  if (name === 'kitchen') return res.redirect(KITCHEN_HOME);

  const file = path.join(__dirname, '../public/admin', name + '.html');
  fs.readFile(file, 'utf8', (err, html) => {
    if (err) return next();
    const cleaned = html.replace(/<a\b[^>]*\bhref=["']kitchen\.html["'][^>]*>[\s\S]*?<\/a>[ \t]*/gi, '');
    res.type('html').send(cleaned);
  });
});

app.use(express.static(path.join(__dirname, '../public')));

// ===== ບັນຊີຄົວ (role 'kitchen') ໃຊ້ API ໄດ້ສະເພາະທີ່ຄົວຕ້ອງໃຊ້ =====
// ຄົວຕ້ອງໃຊ້ແຕ່: ກວດ session, ອອກຈາກລະບົບ, ເບິ່ງບິນ, ປ່ຽນສະຖານະອາຫານ, ຍົກເລີກລາຍການ
// API ອື່ນທັງໝົດ (ເມນູ, ລາຍງານ, ພະນັກງານ, ຕັ້ງຄ່າ, ປິດບິນ...) ຖືກບລັອກສຳລັບບັນຊີຄົວ
const KITCHEN_ALLOWED = [
  ['GET', /^\/api\/auth\/me$/],
  ['POST', /^\/api\/auth\/login$/],
  ['POST', /^\/api\/auth\/logout$/],
  ['GET', /^\/api\/health$/],
  ['GET', /^\/api\/orders\/bills$/],
  ['PUT', /^\/api\/orders\/\d+$/],
  ['DELETE', /^\/api\/orders\/\d+$/],
];

app.use('/api', (req, res, next) => {
  if (req.method === 'OPTIONS') return next();

  const token = req.cookies && req.cookies.token;
  if (!token) return next();

  let user;
  try {
    user = jwt.verify(token, authRouter.JWT_SECRET);
  } catch (e) {
    return next(); // token ໝົດອາຍຸ/ບໍ່ຖືກ → ປ່ອຍໃຫ້ middleware ຂອງແຕ່ລະເສັ້ນທາງຈັດການ
  }

  if (user.role !== 'kitchen') return next();

  const p = req.originalUrl.split('?')[0];
  const ok = KITCHEN_ALLOWED.some(([method, re]) => method === req.method && re.test(p));
  if (ok) return next();

  return res.status(403).json({ error: 'ບັນຊີຄົວບໍ່ມີສິດໃຊ້ງານສ່ວນນີ້' });
});

app.use('/api/auth', authRouter);
app.use('/api/products', productsRouter);
app.use('/api/orders', ordersRouter);

// ===== ເສັ້ນທາງໂຕະ (ຕ້ອງຢູ່ກ່ອນ /api/qrcode) =====
require('./table-routes')(app);

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

      // ເປີດເບຣົາເຊີອັດຕະໂນມັດສະເພາະຕອນຣັນໃນເຄື່ອງ (ບໍ່ເປີດເທິງ Render)
      if (process.env.NODE_ENV !== 'production') {
        try {
          const open = (await import('open')).default;
          await open(`http://localhost:${PORT}/menu/index.html`);
          await open(`http://localhost:${PORT}/admin/index.html`);
        } catch (err) {
          console.log('ເປີດເບຣົາເຊີອັດຕະໂນມັດບໍ່ໄດ້ (ບໍ່ເປັນຫຍັງ):', err.code || err.message);
          console.log(`ເປີດເອງທີ່ http://localhost:${PORT}/menu/index.html`);
        }
      }
    });
  } catch (err) {
    console.error('❌ ບໍ່ສາມາດເຊື່ອມຕໍ່ຖານຂໍ້ມູນ:', err);
    process.exit(1);
  }
}

startServer();