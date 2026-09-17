const { pool } = require('./db');

const username = process.argv[2];

async function run() {
  if (!username) {
    console.log('ວິທີໃຊ້: node server/deleteAdmin.js <username>');
    process.exit(1);
  }

  const [rows] = await pool.query('SELECT * FROM admins WHERE username = ?', [username]);
  const admin = rows[0];

  if (!admin) {
    console.log(`ບໍ່ພົບ admin ຊື່ "${username}"`);
    process.exit(1);
  }

  await pool.query('DELETE FROM admins WHERE username = ?', [username]);
  console.log(`ລົບ admin "${admin.name}" (${username}) ສຳເລັດ`);

  await pool.end();
  process.exit(0);
}

run().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});