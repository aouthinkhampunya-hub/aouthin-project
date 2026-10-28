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
const payqrRouter = require('./routes/payqr');
const adminsRouter = require('./routes/admin');
const staffCallRouter = require('./routes/staffcall');
const authRouter = require('./routes/auth');
const requireAuth = require('./middleware/requireAuth');
const { getToken } = require('./middleware/authCookie');
const kitchenAlertsRouter = require('./routes/kitchenalerts');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost',
  'https://aouthin-123.web.app',
  'https://aouthin-123.firebaseapp.com',
  'https://aouthin-project-1.onrender.com',
];
if (process.env.FRONTEND_URL && !allowedOrigins.includes(process.env.FRONTEND_URL)) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    const isLocalNetwork = /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.)\d+\.\d+(:\d+)?$/.test(origin);
    const isCloudflare = /^https?:\/\/[a-z0-9\-]+\.trycloudflare\.com(:\d+)?$/i.test(origin);
    const isCloudflarePages = /^https?:\/\/[a-z0-9\-]+\.pages\.dev(:\d+)?$/i.test(origin);
    const isFirebase = /^https?:\/\/[a-z0-9\-]+\.(web\.app|firebaseapp\.com)(:\d+)?$/i.test(origin);
    const isRender = /^https?:\/\/[a-z0-9\-]+\.onrender\.com(:\d+)?$/i.test(origin);

    if (allowedOrigins.includes(origin) || isLocalNetwork || isCloudflare || isCloudflarePages || isFirebase || isRender) {
      return callback(null, true);
    }

    // Allow all other origins dynamically rather than throwing a 500 error
    callback(null, true);
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// ===== ໜ້າ React (ຟ້ອນເອັນ) ທີ່ build ແລ້ວ =====
const DIST_DIR = process.env.FRONTEND_DIST || path.join(__dirname, '../../frontend/aouthin-react/dist');
const HAS_REACT = fs.existsSync(path.join(DIST_DIR, 'index.html'));

function sendReactIndex(req, res) {
  res.set('Cache-Control', 'no-cache'); // build ໃໝ່ແລ້ວ refresh ເຫັນທັນທີ
  res.sendFile(path.join(DIST_DIR, 'index.html'));
}

// ===== ແຍກໜ້າ: ບັນຊີຄົວ (role 'kitchen') ເປີດໜ້າ admin ເກົ່າ (/admin/*.html) ບໍ່ໄດ້ =====
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

if (HAS_REACT) {
  // ໄຟລ໌ຂອງ React (js, css, ຮູບ) ຢູ່ /assets/...
  app.use(express.static(DIST_DIR, { index: false }));
  // ໜ້າ /menu, /admin/..., /kitchen/... ໃຫ້ React ຈັດການ
  app.get(/^\/(menu|admin|kitchen)(\/[^.]*)?$/, sendReactIndex);
} else {
  // ໜ້າຄົວຂອງ backend: /kitchen/login
  app.get('/kitchen/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/kitchen/login.html'));
  });
}

// ===== ເອົາ "ຄົວ" ອອກຈາກໜ້າ admin ເກົ່າ (/admin/*.html) =====
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
const KITCHEN_ALLOWED = [
  ['GET', /^\/api\/auth\/me$/],
  ['POST', /^\/api\/auth\/login$/],
  ['POST', /^\/api\/auth\/logout$/],
  ['GET', /^\/api\/health$/],
  ['GET', /^\/api\/orders\/bills$/],
  ['PUT', /^\/api\/orders\/\d+$/],
  ['DELETE', /^\/api\/orders\/\d+$/],
  ['GET', /^\/api\/products$/],          // ← ເພີ່ມ (ປຸ່ມສະຕ໊ອກສິນຄ້າໂຫຼດລາຍການເມນູ)
  ['POST', /^\/api\/kitchen-alerts$/],   // ← ເພີ່ມ (ຄົວແຈ້ງແອັດມິນ)
];

app.use('/api', (req, res, next) => {
  if (req.method === 'OPTIONS') return next();

  const token = getToken(req);
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
app.use('/api/payqr', payqrRouter);
app.use('/api/admins', adminsRouter);
app.use('/api/staffcall', staffCallRouter);
app.use('/api/kitchen-alerts', kitchenAlertsRouter);   // ← ເພີ່ມ (ແກ້ 404)

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server ກຳລັງເຮັດວຽກຢູ່' });
});

// ໜ້າທຳອິດ: ມີ React → ໄປ /menu, ບໍ່ມີ → ໜ້າ HTML ເກົ່າ
app.get('/', (req, res) => {
  res.redirect(HAS_REACT ? '/menu' : '/menu/index.html');
});

if (!HAS_REACT) {
  app.get('/admin', (req, res) => {
    res.redirect('/admin/index.html');
  });
}

app.get('/app', (req, res) => {
  res.redirect('/app/');
});

app.get(/^\/app\/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/app/index.html'));
});

// ໜ້າອື່ນຂອງ React ທີ່ບໍ່ຢູ່ໃນ /menu /admin /kitchen (ບໍ່ແຕະ /api, /uploads, /app)
if (HAS_REACT) {
  app.get(/^\/(?!api(\/|$)|uploads(\/|$)|app(\/|$))[^.]*$/, sendReactIndex);
}

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

async function startServer() {
  try {
    await initDb();

    app.listen(PORT, async () => {
      console.log(`Server ຣັນຢູ່ທີ່ http://localhost:${PORT}`);
      console.log(HAS_REACT
        ? `ໜ້າເວັບ: ໃຊ້ React build ຈາກ ${DIST_DIR}`
        : 'ໜ້າເວັບ: ໃຊ້ໜ້າ HTML ເກົ່າ (ຍັງບໍ່ມີ dist ຂອງ React)');

      // ເປີດເບຣົາເຊີອັດຕະໂນມັດສະເພາະຕອນຣັນໃນເຄື່ອງ (ບໍ່ເປີດເທິງ Render)
      if (process.env.NODE_ENV !== 'production' && !process.env.DOCKER) {
        const menuUrl = `http://localhost:${PORT}${HAS_REACT ? '/menu' : '/menu/index.html'}`;
        const adminUrl = `http://localhost:${PORT}${HAS_REACT ? '/admin' : '/admin/index.html'}`;
        try {
          const open = (await import('open')).default;
          await open(menuUrl);
          await open(adminUrl);
        } catch (err) {
          console.log('ເປີດເບຣົາເຊີອັດຕະໂນມັດບໍ່ໄດ້ (ບໍ່ເປັນຫຍັງ):', err.code || err.message);
          console.log(`ເປີດເອງທີ່ ${menuUrl}`);
        }
      }
    });
  } catch (err) {
    console.error('❌ ບໍ່ສາມາດເຊື່ອມຕໍ່ຖານຂໍ້ມູນ:', err);
    process.exit(1);
  }
}

startServer();