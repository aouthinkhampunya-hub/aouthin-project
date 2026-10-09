// ຕັ້ງຄ່າຄ່າສົ່ງ: ແກ້ຕົວເລກຢູ່ບ່ອນນີ້ບ່ອນດຽວ
const RESTAURANT = { lat: 17.9757, lng: 102.6331 }; // ⚠️ ປ່ຽນເປັນພິກັດຮ້ານຈິງ
const PER_KM = 2500;        // ຄ່າສົ່ງຕໍ່ 1 ກມ (ກີບ)
const MIN_KM = 1;           // ຄິດຢ່າງໜ້ອຍ 1 ກມ
const MAX_KM = 20;          // ໄກສຸດທີ່ຮັບສົ່ງ
const ROAD_FACTOR = 1.3;    // ເສັ້ນຊື່ → ໄລຍະຖະໜົນ (ປະມານ)

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

module.exports = { calcDelivery };