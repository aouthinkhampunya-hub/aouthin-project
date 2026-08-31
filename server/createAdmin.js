const bcrypt = require('bcryptjs');
const db = require('./db');

const username = process.argv[2];
const password = process.argv[3];
const name = process.argv[4];

if (!username || !password || !name) {
  console.log('ວິທີໃຊ້: node server/createAdmin.js <username> <password> "<ຊື່>"');
  process.exit(1);
}

const hashed = bcrypt.hashSync(password, 10);

try {
  const stmt = db.prepare(`INSERT INTO admins (username, password, name) VALUES (?, ?, ?)`);
  const result = stmt.run(username, hashed, name);
  console.log(`ເພີ່ມ admin "${name}" (${username}) ສຳເລັດ, id: ${result.lastInsertRowid}`);
} catch (err) {
  console.error('ລົ້ມເຫລວ:', err.message);
}