const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});
pool.on('error', (err) => {
  console.error('⚠️ MySQL pool error (ignored, pool will reconnect):', err.code || err.message);
});

async function columnExists(tableName, columnName) {
  const [rows] = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [process.env.DB_NAME, tableName, columnName]
  );
  return rows.length > 0;
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

  console.log('✅ Database schema ກຳລັງເຮັດວຽກ');
}

module.exports = { pool, initDb };