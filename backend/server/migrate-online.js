const { pool } = require('./db');

const columns = [
  "ADD COLUMN order_type VARCHAR(20) NOT NULL DEFAULT 'dine_in'",
  'ADD COLUMN customer_name VARCHAR(100) NULL',
  'ADD COLUMN customer_phone VARCHAR(20) NULL',
  'ADD COLUMN address VARCHAR(255) NULL',
  "ADD COLUMN payment_method VARCHAR(20) NOT NULL DEFAULT 'cash'",
  'ADD COLUMN latitude DECIMAL(10,7) NULL',
  'ADD COLUMN longitude DECIMAL(10,7) NULL',
];

(async () => {
  for (const col of columns) {
    try {
      await pool.query(`ALTER TABLE bills ${col}`);
      console.log('✅ ເພີ່ມແລ້ວ:', col);
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('⏭️ ມີຢູ່ແລ້ວ ຂ້າມ:', col);
      } else {
        console.error('❌ ຜິດພາດ:', col, err.message);
      }
    }
  }
  console.log('ສຳເລັດ');
  process.exit(0);
})();