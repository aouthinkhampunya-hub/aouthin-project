// ສຳເນົາຂໍ້ມູນຈາກ MySQL ໃນເຄື່ອງ (backend\.env) ຂຶ້ນ MySQL ປາຍທາງ (REMOTE_*)
// ໃຊ້ຄັ້ງດຽວ, ແລ້ວລຶບໄຟລ໌ນີ້ອອກໄດ້
require('dotenv').config();
const mysql = require('mysql2/promise');

const local = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

const remote = {
  host: process.env.REMOTE_HOST,
  port: Number(process.env.REMOTE_PORT) || 3306,
  user: process.env.REMOTE_USER,
  password: process.env.REMOTE_PASSWORD,
  database: process.env.REMOTE_NAME,
  ssl: { rejectUnauthorized: false },
  connectTimeout: 20000,
};

async function main() {
  if (!remote.host || !remote.user || !remote.password || !remote.database) {
    console.error('ຂາດຄ່າ REMOTE_HOST / REMOTE_USER / REMOTE_PASSWORD / REMOTE_NAME');
    process.exit(1);
  }
  if (local.host === remote.host && local.port === remote.port) {
    console.error('ຕົ້ນທາງ ແລະ ປາຍທາງເປັນເຄື່ອງດຽວກັນ, ຢຸດເພື່ອກັນຂໍ້ມູນຫາຍ');
    process.exit(1);
  }

  console.log(`ຕົ້ນທາງ : ${local.host}:${local.port}/${local.database}`);
  console.log(`ປາຍທາງ : ${remote.host}:${remote.port}/${remote.database}`);

  const src = await mysql.createConnection(local);
  const dst = await mysql.createConnection(remote);

  await dst.query('SET FOREIGN_KEY_CHECKS = 0');

  const [tables] = await src.query('SHOW TABLES');
  for (const row of tables) {
    const table = Object.values(row)[0];

    const [dstCols] = await dst.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [remote.database, table]
    );
    if (dstCols.length === 0) {
      console.log(`ຂ້າມ  ${table} (ບໍ່ມີຕາຕະລາງນີ້ຢູ່ປາຍທາງ)`);
      continue;
    }
    const dstNames = dstCols.map((c) => c.COLUMN_NAME);

    const [rows] = await src.query(`SELECT * FROM \`${table}\``);
    await dst.query(`DELETE FROM \`${table}\``);

    if (rows.length === 0) {
      console.log(`ວ່າງ  ${table} (0 ແຖວ)`);
      continue;
    }

    const cols = Object.keys(rows[0]).filter((c) => dstNames.includes(c));
    const colSql = cols.map((c) => `\`${c}\``).join(', ');
    const values = rows.map((r) => cols.map((c) => r[c]));

    for (let i = 0; i < values.length; i += 200) {
      await dst.query(
        `INSERT INTO \`${table}\` (${colSql}) VALUES ?`,
        [values.slice(i, i + 200)]
      );
    }
    console.log(`ສຳເນົາ ${table}: ${rows.length} ແຖວ`);
  }

  await dst.query('SET FOREIGN_KEY_CHECKS = 1');
  await src.end();
  await dst.end();
  console.log('ສຳເລັດ');
}

main().catch((err) => {
  console.error('ຜິດພາດ:', err.message);
  process.exit(1);
});