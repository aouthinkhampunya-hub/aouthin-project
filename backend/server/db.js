const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

// ເປີດ SSL ເມື່ອຕັ້ງ DB_SSL=true (ຈຳເປັນສຳລັບ Aiven)
const useSsl = String(process.env.DB_SSL || '').toLowerCase() === 'true';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 20000,
  ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});
pool.on('error', (err) => {
  console.error('MySQL pool error (ignored, pool will reconnect):', err.code || err.message);
});

async function columnExists(tableName, columnName) {
  const [rows] = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [process.env.DB_NAME, tableName, columnName]
  );
  return rows.length > 0;
}

// ອ່ານຈຳນວນໂຕະຈາກໄຟລ໌ເກົ່າ (ໃຊ້ຕອນຍ້າຍມາ MySQL ຄັ້ງທຳອິດເທົ່ານັ້ນ)
function legacyTableCount() {
  try {
    const file = path.join(__dirname, 'table-settings.json');
    const n = Number(JSON.parse(fs.readFileSync(file, 'utf8')).count);
    return Number.isInteger(n) && n >= 1 && n <= 200 ? n : 20;
  } catch (e) {
    return 20;
  }
}

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      size VARCHAR(50),
      color VARCHAR(50),
      stock INT DEFAULT 0,
      image VARCHAR(500)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bills (
      id INT AUTO_INCREMENT PRIMARY KEY,
      table_number VARCHAR(50) NOT NULL,
      status VARCHAR(20) DEFAULT 'open',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      paid_at DATETIME
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      bill_id INT NOT NULL,
      product_id INT NOT NULL,
      quantity INT NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (bill_id) REFERENCES bills(id)
    )
  `);

  if (!(await columnExists('orders', 'customer_phone'))) {
    await pool.query(`ALTER TABLE orders ADD COLUMN customer_phone VARCHAR(50)`);
  }
  if (!(await columnExists('orders', 'customer_address'))) {
    await pool.query(`ALTER TABLE orders ADD COLUMN customer_address VARCHAR(500)`);
  }
  if (!(await columnExists('orders', 'slip_image'))) {
    await pool.query(`ALTER TABLE orders ADD COLUMN slip_image VARCHAR(500)`);
  }

  // ຄໍລຳຂອງ bills ສຳລັບອໍເດີອອນລາຍ + ຄ່າສົ່ງ + ເລກບິນແຍກຕາມແຖບ
  const billCols = [
    ['order_type', `VARCHAR(20) NOT NULL DEFAULT 'dine_in'`],
    ['customer_name', `VARCHAR(255) NULL`],
    ['customer_phone', `VARCHAR(50) NULL`],
    ['address', `VARCHAR(500) NULL`],
    ['payment_method', `VARCHAR(20) NULL`],
    ['slip_image', `VARCHAR(500) NULL`],
    ['latitude', `DECIMAL(10,7) NULL`],
    ['longitude', `DECIMAL(10,7) NULL`],
    ['delivery_fee', `INT NOT NULL DEFAULT 0`],
    ['delivery_distance', `DECIMAL(6,1) NULL`],
    ['bill_no', `INT NULL`],
  ];
  for (const [name, def] of billCols) {
    if (!(await columnExists('bills', name))) {
      await pool.query(`ALTER TABLE bills ADD COLUMN ${name} ${def}`);
    }
  }

  // ໃສ່ເລກບິນ (bill_no) ໃຫ້ບິນເກົ່າທີ່ຍັງບໍ່ມີ
  // ໜ້າໂຕະ ນັບ 1,2,3... ແຍກ ແລະ ອອນລາຍ ນັບ 1,2,3... ແຍກ
  const [missing] = await pool.query(
    `SELECT id, order_type FROM bills WHERE bill_no IS NULL ORDER BY id`
  );
  if (missing.length > 0) {
    const [[d]] = await pool.query(
      `SELECT COALESCE(MAX(bill_no), 0) AS m FROM bills WHERE order_type = 'dine_in'`
    );
    const [[o]] = await pool.query(
      `SELECT COALESCE(MAX(bill_no), 0) AS m FROM bills WHERE order_type <> 'dine_in'`
    );
    let dineNo = Number(d.m);
    let onlineNo = Number(o.m);
    for (const b of missing) {
      const no = b.order_type === 'dine_in' ? ++dineNo : ++onlineNo;
      await pool.query(`UPDATE bills SET bill_no = ? WHERE id = ?`, [no, b.id]);
    }
    console.log(`ໃສ່ເລກບິນ (bill_no) ໃຫ້ບິນເກົ່າ ${missing.length} ໃບແລ້ວ`);
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      \`key\` VARCHAR(100) PRIMARY KEY,
      value TEXT
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS staff_calls (
      id INT AUTO_INCREMENT PRIMARY KEY,
      table_number VARCHAR(50) NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ລາຍຊື່ໂຕະ (ເພີ່ມ/ລຶບໂຕະໄດ້)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS restaurant_tables (
      table_number INT PRIMARY KEY
    )
  `);
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM restaurant_tables`);
  if (Number(total) === 0) {
    const count = legacyTableCount();
    const rows = Array.from({ length: count }, (_, i) => [i + 1]);
    await pool.query(`INSERT INTO restaurant_tables (table_number) VALUES ?`, [rows]);
    console.log(`ສ້າງລາຍຊື່ໂຕະ 1-${count} ຈາກຄ່າເກົ່າແລ້ວ`);
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  if (!(await columnExists('admins', 'name'))) {
    await pool.query(`ALTER TABLE admins ADD COLUMN name VARCHAR(255)`);
  }
  if (!(await columnExists('admins', 'role'))) {
    await pool.query(`ALTER TABLE admins ADD COLUMN role VARCHAR(20) DEFAULT 'staff'`);
  }

  console.log('Database schema ພ້ອມແລ້ວ');
}

module.exports = { pool, initDb };