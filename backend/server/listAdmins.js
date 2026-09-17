const { pool } = require('./db');

async function run() {
  const [admins] = await pool.query('SELECT id, username, name FROM admins');
  console.log(admins);
  await pool.end();
  process.exit(0);
}

run().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});