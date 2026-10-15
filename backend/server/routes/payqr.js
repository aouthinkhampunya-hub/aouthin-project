const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const router = express.Router();

// ===== ສ້າງ QR ຮັບເງິນທີ່ "ໃສ່ຈຳນວນເງິນໃຫ້ເລີຍ" =====
// ວິທີເຮັດວຽກ: ອ່ານຂໍ້ມູນ (payload) ຈາກຮູບ QR ຮັບເງິນຂອງຮ້ານທີ່ອັບໂຫຼດໄວ້ແລ້ວ
// ແລ້ວເພີ່ມຈຳນວນເງິນ (tag 54) ແລະຄຳນວນ CRC ໃໝ່ ຕາມມາດຕະຖານ EMVCo QR (ໃຊ້ກັບ LAO QR)
// ບໍ່ຕ້ອງແກ້ໄຟລ໌ settings ເດີມ

// ເລືອກໄດ້: ຖ້າແອັບທະນາຄານບໍ່ສະແດງຈຳນວນເງິນ ໃຫ້ຕັ້ງ PAYQR_DYNAMIC=1 ໃນ .env (ປ່ຽນ tag 01 ເປັນ 12)
const FORCE_DYNAMIC = process.env.PAYQR_DYNAMIC === '1';

// ---------- ເຄື່ອງມື EMV QR ----------
function crc16(str) {
  let crc = 0xffff;
  const bytes = Buffer.from(str, 'utf8');
  for (const b of bytes) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// ແຍກ payload ເປັນລາຍການ [tag, value] (ຄວາມຍາວນັບເປັນໄບຕ໌ UTF-8 ຕາມມາດຕະຖານ)
function parseTLV(payload) {
  const buf = Buffer.from(payload, 'utf8');
  const items = [];
  let pos = 0;
  while (pos < buf.length) {
    if (pos + 4 > buf.length) throw new Error('QR payload ບໍ່ຖືກຕ້ອງ');
    const tag = buf.slice(pos, pos + 2).toString('ascii');
    const len = parseInt(buf.slice(pos + 2, pos + 4).toString('ascii'), 10);
    if (!Number.isInteger(len) || pos + 4 + len > buf.length) throw new Error('QR payload ບໍ່ຖືກຕ້ອງ');
    items.push([tag, buf.slice(pos + 4, pos + 4 + len).toString('utf8')]);
    pos += 4 + len;
  }
  return items;
}

function toTLV(tag, value) {
  const len = Buffer.byteLength(value, 'utf8');
  return tag + String(len).padStart(2, '0') + value;
}

// ກວດວ່າ CRC ຂອງ payload ຖືກຕ້ອງ
function hasValidCrc(payload) {
  if (payload.length < 8 || payload.slice(-8, -4) !== '6304') return false;
  return crc16(payload.slice(0, -4)).toUpperCase() === payload.slice(-4).toUpperCase();
}

// ສ້າງ payload ໃໝ່ທີ່ມີຈຳນວນເງິນ (ກີບ)
function buildAmountPayload(basePayload, amount) {
  const amt = Math.round(Number(amount));
  if (!Number.isFinite(amt) || amt < 1 || amt > 999999999999) throw new Error('ຈຳນວນເງິນບໍ່ຖືກຕ້ອງ');

  let items = parseTLV(basePayload).filter(([tag]) => tag !== '63' && tag !== '54');

  if (FORCE_DYNAMIC) {
    items = items.map(([tag, val]) => (tag === '01' ? ['01', '12'] : [tag, val]));
  }

  // ໃສ່ tag 54 ຕາມລຳດັບເລກ (ກ່ອນ tag ທຳອິດທີ່ໃຫຍ່ກວ່າ 54)
  const idx = items.findIndex(([tag]) => tag > '54');
  const amountItem = ['54', String(amt)];
  if (idx === -1) items.push(amountItem);
  else items.splice(idx, 0, amountItem);

  const body = items.map(([tag, val]) => toTLV(tag, val)).join('') + '6304';
  return body + crc16(body);
}

// ---------- ອ່ານ payload ຈາກຮູບ QR ຂອງຮ້ານ ----------
function getLocal(pathname) {
  return new Promise((resolve, reject) => {
    const port = process.env.PORT || 3000;
    http.get({ host: '127.0.0.1', port, path: pathname }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function decodeQrFromBuffer(buf) {
  const jsQR = require('jsqr');
  let width, height, data;
  const isPng = buf[0] === 0x89 && buf[1] === 0x50;
  const isJpg = buf[0] === 0xff && buf[1] === 0xd8;
  if (isPng) {
    const { PNG } = require('pngjs');
    const png = PNG.sync.read(buf);
    width = png.width; height = png.height; data = png.data;
  } else if (isJpg) {
    const jpeg = require('jpeg-js');
    const img = jpeg.decode(buf, { useTArray: true });
    width = img.width; height = img.height; data = img.data;
  } else {
    throw new Error('ຮູບ QR ຕ້ອງເປັນ PNG ຫຼື JPG');
  }
  const code = jsQR(new Uint8ClampedArray(data), width, height, { inversionAttempts: 'attemptBoth' });
  if (!code || !code.data) throw new Error('ອ່ານ QR ຈາກຮູບບໍ່ໄດ້');
  return code.data;
}

let cache = { key: null, payload: null };

async function getBasePayload() {
  const info = await getLocal('/api/settings/qr'); // ຄືກັບທີ່ໜ້າລູກຄ້າໃຊ້ (ສາທາລະນະ)
  const qrImage = info && info.qrImage;
  if (!qrImage) throw new Error('ຮ້ານຍັງບໍ່ໄດ້ຕັ້ງ QR ຮັບເງິນ');

  const key = crypto.createHash('sha1').update(String(qrImage)).digest('hex');
  if (cache.key === key && cache.payload) return cache.payload;

  let buf;
  if (qrImage.startsWith('data:')) {
    buf = Buffer.from(qrImage.split(',')[1] || '', 'base64');
  } else if (qrImage.startsWith('http')) {
    throw new Error('ຮອງຮັບສະເພາະຮູບ QR ທີ່ເກັບໃນ server');
  } else {
    const rel = qrImage.split('?')[0].replace(/^\/+/, '');
    const file = path.join(__dirname, '../../public', rel);
    if (!file.startsWith(path.join(__dirname, '../../public'))) throw new Error('path ບໍ່ຖືກຕ້ອງ');
    buf = fs.readFileSync(file);
  }

  const payload = decodeQrFromBuffer(buf);
  if (!hasValidCrc(payload)) throw new Error('QR ຮັບເງິນນີ້ບໍ່ແມ່ນ QR ແບບ EMV (LAO QR)');
  cache = { key, payload };
  return payload;
}

// ===== GET /api/payqr/amount?amount=88000 → { qrImage: "data:image/png;base64,..." } =====
router.get('/amount', async (req, res) => {
  try {
    const amount = Number(req.query.amount);
    if (!Number.isFinite(amount) || amount < 1 || amount > 1000000000) {
      return res.status(400).json({ error: 'ຈຳນວນເງິນບໍ່ຖືກຕ້ອງ' });
    }

    const base = await getBasePayload();
    const payload = buildAmountPayload(base, amount);

    const QRCode = require('qrcode');
    const qrImage = await QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 420,
    });
    res.json({ qrImage, amount: Math.round(amount) });
  } catch (err) {
    console.error('payqr:', err.message);
    res.status(404).json({ error: err.message || 'ສ້າງ QR ບໍ່ສຳເລັດ' });
  }
});

module.exports = router;
module.exports._test = { crc16, parseTLV, buildAmountPayload, hasValidCrc };