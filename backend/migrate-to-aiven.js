// ສຳເນົາ / ກວດຂໍ້ມູນລະຫວ່າງ MySQL ໃນເຄື່ອງ (backend\.env) ກັບ MySQL ຢູ່ Aiven
//   node migrate-to-aiven.js --check      -> ກວດຢ່າງດຽວ, ບໍ່ແກ້ຫຍັງ
//   node migrate-to-aiven.js              -> ສຳເນົາທຸກຕາຕະລາງ (ລຶບຂໍ້ມູນເກົ່າຢູ່ປາຍທາງກ່ອນ)
//   node migrate-to-aiven.js products     -> ສຳເນົາສະເພາະຕາຕະລາງທີ່ລະບຸ
// ສະຄຣິບຈະຖາມ password ຂອງ Aiven ຕອນແລ່ນ (ບໍ່ຕ້ອງໃຊ້ set)
require('dotenv').config();
const readline = require('readline');
const mysql = require('mysql2/promise');

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const onlyTables = args.filter((a) => !a.startsWith('--'));

const local = {
  host: (process.env.DB_HOST || '').trim(),
  port: Number(process.env.DB_PORT) || 3306,
  user: (process.env.DB_USER || '').trim(),
  password: process.env.DB_PASSWORD,
  database: (process.env.DB_NAME || '').trim(),
};

const remote = {
  host: (process.env.REMOTE_HOST || 'mysql-108d746-aouthinkhampunya-5897.i.aivencloud.com').trim(),
  port: Number((process.env.REMOTE_PORT || '14949').trim()),
  user: (process.env.REMOTE_USER || 'avnadmin').trim(),
  password: (process.env.REMOTE_PASSWORD || '').trim(),
  database: (process.env.REMOTE_NAME || 'defaultdb').trim(),
  ssl: { rejectUnauthorized: false },
  connectTimeout: 20000,
};

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  if (!remote.password) {
    remote.password = await ask('ວາງ password ຂອງ Aiven ແລ້ວກົດ Enter: ');
    console.clear();
  }
  if (!remote.password) {
    console.error('ບໍ່ໄດ້ໃສ່ password');
    process.exit(1);
  }
  if (local.host === remote.host && local.port === remote.port) {
    console.error('ຕົ້ນທາງ ແລະ ປາຍທາງເປັນເຄື່ອງດຽວກັນ, ຢຸດເພື່ອກັນຂໍ້ມູນຫາຍ');
    process.exit(1);
  }

  console.log(checkOnly ? 'ໂໝດກວດ (ບໍ່ແກ້ຫຍັງ)' : 'ໂໝດສຳເນົາຂໍ້ມູນ');
  console.log(`ຕົ້ນທາງ : ${local.host}:${local.port}/${local.database}`);
  console.log(`ປາຍທາງ : ${remote.host}:${remote.port}/${remote.database}`);

  const src = await mysql.createConnection(local);
  const dst = await mysql.createConnection(remote);

  if (!checkOnly) await dst.query('SET FOREIGN_KEY_CHECKS = 0');

  const [tables] = await src.query('SHOW TABLES');
  for (const row of tables) {
    const table = Object.values(row)[0];
    if (onlyTables.length > 0 && !onlyTables.includes(table)) continue;

    const [srcCols] = await src.query(`SHOW COLUMNS FROM \`${table}\``);
    const [dstCols] = await dst.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [remote.database, table]
    );

    if (dstCols.length === 0) {
      console.log(`\nຂາດຕາຕະລາງ: ${table}`);
      if (checkOnly) {
        const [[c]] = await src.query(`SHOW CREATE TABLE \`${table}\``);
        console.log(c['Create Table']);
      }
      continue;
    }

    const dstNames = dstCols.map((c) => c.COLUMN_NAME);
    const missing = srcCols.filter((c) => !dstNames.includes(c.Field));
    if (missing.length > 0) {
      console.log(`\nຂາດຄໍລຳໃນ ${table}:`);
      for (const c of missing) {
        console.log(`  ${c.Field}  ${c.Type}  null=${c.Null}  default=${c.Default}`);
      }
    } else if (checkOnly) {
      console.log(`ຄົບ: ${table}`);
    }

    if (checkOnly) continue;

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

  if (!checkOnly) await dst.query('SET FOREIGN_KEY_CHECKS = 1');
  await src.end();
  await dst.end();
  console.log('\nສຳເລັດ');
}

main().catch((err) => {
  console.error('ຜິດພາດ:', err.message);
  process.exit(1);
});