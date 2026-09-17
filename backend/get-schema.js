const Database = require('better-sqlite3');
const db = new Database('./server/store.db', { readonly: true });

const tables = db.prepare(
  "SELECT sql FROM sqlite_master WHERE type='table'"
).all();

tables.forEach(t => console.log(t.sql + ';\n'));