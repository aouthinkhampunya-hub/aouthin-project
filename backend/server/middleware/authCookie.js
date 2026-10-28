// ແຍກ cookie ລັອກອິນຕາມບົດບາດ: admin ໃຊ້ 'token', ຄົວໃຊ້ 'kitchen_token'
// ເພື່ອໃຫ້ admin ກັບ ຄົວ ລັອກອິນພ້ອມກັນໃນ browser ດຽວກັນໄດ້ ໂດຍບໍ່ທັບກັນ
const ADMIN_COOKIE = 'token';
const KITCHEN_COOKIE = 'kitchen_token';

function cookieOptions(req) {
  const isReqSecure = req && (req.secure || req.get('x-forwarded-proto') === 'https');
  const isProd = process.env.NODE_ENV === 'production';
  const forceSecure = process.env.COOKIE_SECURE === 'true';
  const forceInsecure = process.env.COOKIE_SECURE === 'false';
  const secure = forceSecure || (isReqSecure && !forceInsecure) || (isProd && !forceInsecure && !req);
  return {
    httpOnly: true,
    sameSite: secure ? 'none' : 'lax',
    secure: !!secure,
  };
}

// ຮູ້ວ່າ request ມາຈາກໜ້າໃດ: ຈາກ header x-area / ?area= ກ່ອນ, ຖ້າບໍ່ມີກໍເບິ່ງ path ຂອງ Referer
function getArea(req) {
  const hint = String(req.get('x-area') || (req.query && req.query.area) || '').toLowerCase();
  if (hint === 'kitchen' || hint === 'admin') return hint;

  const ref = req.get('referer');
  if (ref) {
    try {
      const p = new URL(ref).pathname;
      if (p === '/kitchen' || p.startsWith('/kitchen/') || p.startsWith('/app/kitchen')) return 'kitchen';
      if (p === '/admin' || p.startsWith('/admin/') || p.startsWith('/app/admin')) return 'admin';
    } catch (e) {
      // Referer ບໍ່ຖືກຮູບແບບ → ຂ້າມ
    }
  }
  return null;
}

// ເລືອກວ່າຈະໃຊ້ cookie ຊື່ໃດ
function pickCookieName(req) {
  const cookies = req.cookies || {};
  const area = getArea(req);
  if (area === 'kitchen') return KITCHEN_COOKIE;
  if (area === 'admin') return ADMIN_COOKIE;
  // ບໍ່ຮູ້ວ່າມາຈາກໜ້າໃດ: ໃຫ້ admin ມາກ່ອນ, ຖ້າບໍ່ມີກໍໃຊ້ຂອງຄົວ
  if (cookies[ADMIN_COOKIE]) return ADMIN_COOKIE;
  if (cookies[KITCHEN_COOKIE]) return KITCHEN_COOKIE;
  return ADMIN_COOKIE;
}

function getToken(req) {
  return (req.cookies && req.cookies[pickCookieName(req)]) || null;
}

module.exports = {
  ADMIN_COOKIE,
  KITCHEN_COOKIE,
  cookieOptions,
  getArea,
  pickCookieName,
  getToken,
};