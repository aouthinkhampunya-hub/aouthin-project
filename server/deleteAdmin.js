const db = require('./db');

const username = process.argv[2];

if (!username) {
  console.log('ວິທີໃຊ້: node server/deleteAdmin.js <username>');
  process.exit(1);
}

const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);

if (!admin) {
  console.log(`ບໍ່ພົບ admin ຊື່ "${username}"`);
  process.exit(1);
}

db.prepare('DELETE FROM admins WHERE username = ?').run(username);
console.log(`ລົບ admin "${admin.name}" (${username}) ສຳເລັດ`);