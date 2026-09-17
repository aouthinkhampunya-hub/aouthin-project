const Database = require('better-sqlite3');
const mysql = require('mysql2/promise');

const sqliteDb = new Database('./server/store.db', { readonly: true });

const tableOrder = ['products', 'bills', 'admins', 'settings', 'staff_calls', 'orders'];

async function run() {
  const pool = await mysql.createConnection({
    host: 'localhost',
    port: 3307,
    user: 'root',
    password: 'Aouthinkpy/11',
    database: 'aouthin',
  });

  for (const table of tableOrder) {
    const rows = sqliteDb.prepare('SELECT * FROM ' + table).all();
    if (rows.length === 0) {
      console.log(table + ': no data, skipped');
      continue;
    }
    for (const row of rows) {
      const columns = Object.keys(row).map(c => '`' + c + '`').join(', ');
      const placeholders = Object.keys(row).map(() => '?').join(', ');
      await pool.query(
        'INSERT INTO ' + table + ' (' + columns + ') VALUES (' + placeholders + ')',
        Object.values(row)
      );
    }
    console.log(table + ': migrated ' + rows.length + ' rows');
  }

  await pool.end();
  console.log('DONE');
}

run().catch(err => console.error('ERROR:', err));