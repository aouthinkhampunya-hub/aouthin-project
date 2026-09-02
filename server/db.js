const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'store.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    size TEXT,
    color TEXT,
    stock INTEGER DEFAULT 0,
    image TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id)
  )
`);

// ➕ ເພີ່ມຖັນໃໝ່ໃສ່ orders (ຖ້າຍັງບໍ່ມີ) — ເບີໂທ, ທີ່ຢູ່, ຮູບສະລິບ
const orderColumns = db.prepare(`PRAGMA table_info(orders)`).all().map(c => c.name);

if (!orderColumns.includes('customer_phone')) {
  db.exec(`ALTER TABLE orders ADD COLUMN customer_phone TEXT`);
}
if (!orderColumns.includes('customer_address')) {
  db.exec(`ALTER TABLE orders ADD COLUMN customer_address TEXT`);
}
if (!orderColumns.includes('slip_image')) {
  db.exec(`ALTER TABLE orders ADD COLUMN slip_image TEXT`);
}

// ➕ ຕາຕະລາງໃໝ່ — ເກັບ QR ຮັບເງິນຂອງຮ້ານ (ໃຊ້ຮ່ວມກັນທຸກອໍເດີ)
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )
`);

// ➕ ຕາຕະລາງແຈ້ງເຕືອນເອີ້ນພະນັກງານ
db.exec(`
  CREATE TABLE IF NOT EXISTS staff_calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_number TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// ຕາຕະລາງບັນຊີແອດມິນ (admin account)
db.exec(`CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

const adminColumns = db.prepare(`PRAGMA table_info(admins)`).all().map(c => c.name);
if (!adminColumns.includes('name')) {
  db.exec(`ALTER TABLE admins ADD COLUMN name TEXT`);
}

module.exports = db;