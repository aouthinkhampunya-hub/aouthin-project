const bcrypt = require('bcryptjs');
const { pool } = require('./db');

const username = process.argv[2];
const password = process.argv[3];
const name = process.argv[4];

async function run() {
  if (!username || !password || !name) {
    console.log('ວິທີໃຊ້: node server/createAdmin.js <username> <password> "<ຊື່>"');
    process.exit(1);
  }

  const hashed = bcrypt.hashSync(password, 10);

  try {
    const [result] = await pool.query(
      `INSERT INTO admins (username, password, name) VALUES (?, ?, ?)`,
      [username, hashed, name]
    );
    console.log(`ເພີ່ມ admin "${name}" (${username}) ສຳເລັດ, id: ${result.insertId}`);
  } catch (err) {
    console.error('ລົ້ມເຫລວ:', err.message);
  }

  await pool.end();
  process.exit(0);
}

run();