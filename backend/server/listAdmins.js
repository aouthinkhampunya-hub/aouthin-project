const db = require('./db');
const admins = db.prepare('SELECT id, username, name FROM admins').all();
console.log(admins);