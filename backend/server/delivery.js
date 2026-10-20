// ຕັ້ງຄ່າຄ່າສົ່ງ: ແກ້ຕົວເລກຢູ່ບ່ອນນີ້ບ່ອນດຽວ
const DEFAULT_LOCATION = { lat: 17.9757, lng: 102.6331 }; // ຄ່າເລີ່ມຕົ້ນ ຖ້າແອັດມິນຍັງບໍ່ໄດ້ປັກມຸດ
const PER_KM = 2500;        // ຄ່າສົ່ງຕໍ່ 1 ກມ (ກີບ)
const MIN_KM = 1;           // ຄິດຢ່າງໜ້ອຍ 1 ກມ
const DEFAULT_MAX_KM = 20;  // ໄກສຸດທີ່ຮັບສົ່ງ (ຄ່າເລີ່ມຕົ້ນ ຖ້າແອັດມິນຍັງບໍ່ໄດ້ຕັ້ງ)
const MAX_KM_LIMIT = 100;   // ແອັດມິນຕັ້ງໄດ້ສູງສຸດບໍ່ເກີນນີ້
const ROAD_FACTOR = 1.3;    // ເສັ້ນຊື່ → ໄລຍະຖະໜົນ (ປະມານ)

// ໄລຍະສົ່ງສູງສຸດປັດຈຸບັນ (ແອັດມິນປ່ຽນໄດ້ຜ່ານໜ້າ QR Code → ທີ່ຕັ້ງຮ້ານ)
let MAX_KM = DEFAULT_MAX_KM;

// ພິກັດຮ້ານປັດຈຸບັນ (ແອັດມິນປ່ຽນໄດ້ຜ່ານໜ້າ Settings)
let RESTAURANT = { lat: DEFAULT_LOCATION.lat, lng: DEFAULT_LOCATION.lng };
let usingDefault = true;

function setRestaurantLocation(lat, lng) {
  lat = Number(lat);
  lng = Number(lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  RESTAURANT = { lat, lng };
  usingDefault = false;
  return true;
}

// ຕັ້ງໄລຍະສົ່ງສູງສຸດ (ກມ) ຕ້ອງຢູ່ລະຫວ່າງ 1 ຫາ MAX_KM_LIMIT
function setMaxKm(km) {
  km = Number(km);
  if (!Number.isFinite(km) || km < 1 || km > MAX_KM_LIMIT) return false;
  MAX_KM = Math.round(km);
  return true;
}

function getRestaurantLocation() {
  return {
    lat: RESTAURANT.lat,
    lng: RESTAURANT.lng,
    isDefault: usingDefault,
    max_km: MAX_KM,
  };
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function calcDelivery(lat, lng) {
  lat = Number(lat);
  lng = Number(lng);

  // ພິກັດບໍ່ຖືກຕ້ອງ (ຫວ່າງ ຫຼື ບໍ່ແມ່ນຕົວເລກ) → ຖືວ່າສົ່ງບໍ່ໄດ້
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { km: null, fee: null, tooFar: true, max_km: MAX_KM, invalid: true };
  }

  const km =
    Math.round(
      haversineKm(RESTAURANT.lat, RESTAURANT.lng, lat, lng) * ROAD_FACTOR * 10
    ) / 10;

  if (km > MAX_KM) {
    return { km, fee: null, tooFar: true, max_km: MAX_KM };
  }

  // ປັດຂຶ້ນເປັນກມເຕັມ, ຂັ້ນຕ່ຳ 1 ກມ
  const billedKm = Math.max(MIN_KM, Math.ceil(km));
  return { km, fee: billedKm * PER_KM, tooFar: false, max_km: MAX_KM };
}

module.exports = {
  calcDelivery,
  setRestaurantLocation,
  getRestaurantLocation,
  setMaxKm,
  DEFAULT_LOCATION,
  DEFAULT_MAX_KM,
  MAX_KM_LIMIT,
};