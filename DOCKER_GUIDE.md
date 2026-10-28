# ຄູ່ມືການນຳໃຊ້ Docker (Aouthin POS & Online System)

ລະບົບໄດ້ຖືກຕັ້ງຄ່າໃຫ້ແລ່ນຜ່ານ **Docker** ທັງ Backend (Node.js/Express) ແລະ Frontend (React Vite + Nginx) ພ້ອມໃຊ້ງານແລ້ວ.

---

## 🚀 ວິທີເລີ່ມຕົ້ນໃຊ້ງານ (How to Run)

### ວິທີທີ 1: ກົດໄຟລ໌ `.bat` (ງ່າຍສຸດ)
- **ເລີ່ມລະບົບ:** ດັບເບິ້ລຄລິກທີ່ໄຟລ໌ [`docker-start.bat`](file:///c:/Users/XP%20COM/Desktop/aouthin%20123/docker-start.bat)
- **ຢຸດລະບົບ:** ດັບເບິ້ລຄລິກທີ່ໄຟລ໌ [`docker-stop.bat`](file:///c:/Users/XP%20COM/Desktop/aouthin%20123/docker-stop.bat)
- **Rebuild ໃໝ່ (ເມື່ອມີການແກ້ໄຂໂຄ້ດ):** ດັບເບິ້ລຄລິກທີ່ໄຟລ໌ [`docker-restart.bat`](file:///c:/Users/XP%20COM/Desktop/aouthin%20123/docker-restart.bat)

### ວິທີທີ 2: ໃຊ້ຄຳສັ່ງ Terminal / PowerShell
```bash
# ເລີ່ມຕົ້ນ Container
docker compose up -d

# ເບິ່ງສະຖານະ Container
docker compose ps

# ເບິ່ງ Logs ຂອງ Backend
docker logs -f aouthin-backend

# ຢຸດ Container
docker compose down
```

---

## 🌐 ລິ້ງເຂົ້າໃຊ້ງານ (Access URLs)

- **Frontend (ໜ້າຮ້ານ, ໜ້າເມນູ, Admin, Kitchen):** [http://localhost:5173](http://localhost:5173)
  - ໜ້າເມນູ: [http://localhost:5173/menu](http://localhost:5173/menu)
  - ໜ້າ Admin: [http://localhost:5173/admin](http://localhost:5173/admin)
  - ໜ້າຄົວ (Kitchen): [http://localhost:5173/kitchen](http://localhost:5173/kitchen)
- **Backend API:** [http://localhost:3000](http://localhost:3000)
  - ກວດສອບສະຖານະ Server: [http://localhost:3000/api/health](http://localhost:3000/api/health)

---

## 🛠 ສະຖາປັດຕະຍະກຳ Docker (Architecture)

1. **Backend (`aouthin-backend`)**:
   - ແລ່ນເທິງ `node:20-slim`.
   - ພອດພາຍໃນ `3000`, ເຊື່ອມຕໍ່ກັບຖານຂໍ້ມູນ MySQL ທີ່ມີຢູ່ແລ້ວໃນເຄື່ອງຜ່ານ `host.docker.internal:3307`.
   - ຮູບພາບເມນູ ແລະ Slip ເກັບໄວ້ໃນ `backend/public/uploads` (Mount Volume ໄວ້ ເຮັດໃຫ້ຮູບພາບບໍ່ຫາຍເມື່ອຣີສະຕາດ Docker).
2. **Frontend (`aouthin-frontend`)**:
   - ບິວດ້ວຍ `vite build` ແລະໃຫ້ `nginx:alpine` ເປັນຕົວ serve ໄຟລ໌ static.
   - ຕັ້ງ Nginx Reverse Proxy ເສັ້ນທາງ `/api` ແລະ `/uploads` ໄປຫາ `backend:3000` ໂດຍກົງ (ບໍ່ມີບັນຫາ CORS).
   - ພອດ `5173` ພາຍນອກ mapped ເຂົ້າພອດ `80` ຂອງ Nginx.
3. **Database (MySQL)**:
   - ຕອນນີ້ລະບົບເຊື່ອມຕໍ່ກັບຖານຂໍ້ມູນ MySQL ໃນເຄື່ອງຂອງທ່ານ (Port 3307) ອັດຕະໂນມັດ ໂດຍບໍ່ເສຍຂໍ້ມູນເກົ່າ.
   - ຖ້າຕ້ອງການຣັນ MySQL ໃນ Docker ສາມາດຕັ້ງຄ່າໃນ [`.env`](file:///c:/Users/XP%20COM/Desktop/aouthin%20123/.env) ຫຼືຣັນ `docker compose --profile with-db up -d`.

---

## ⚙️ ໄຟລ໌ສຳຄັນທີ່ຖືກສ້າງຂຶ້ນ

- [`docker-compose.yml`](file:///c:/Users/XP%20COM/Desktop/aouthin%20123/docker-compose.yml) - ໄຟລ໌ກຳນົດ Service ທັງໝົດ
- [`.env`](file:///c:/Users/XP%20COM/Desktop/aouthin%20123/.env) - ໄຟລ໌ກຳນົດຄ່າ Database, Secret Key ແລະ Port
- [`backend/Dockerfile`](file:///c:/Users/XP%20COM/Desktop/aouthin%20123/backend/Dockerfile) - Dockerfile ສຳລັບ Node.js Backend
- [`frontend/aouthin-react/Dockerfile`](file:///c:/Users/XP%20COM/Desktop/aouthin%20123/frontend/aouthin-react/Dockerfile) - Dockerfile ສຳລັບ React Vite + Nginx
- [`frontend/aouthin-react/nginx.conf`](file:///c:/Users/XP%20COM/Desktop/aouthin%20123/frontend/aouthin-react/nginx.conf) - ຕັ້ງຄ່າ Nginx SPA & Reverse Proxy
