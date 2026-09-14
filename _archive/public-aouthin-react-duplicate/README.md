# AOUTHIN — Frontend React (ແທນ Vanilla JS ເກົ່າ)

## ວິທີໃຊ້

1. **Backend (server เก่า) ต้องรันอยู่ก่อน** ที่ port 3000 (npm run dev ในโฟลเดอร์ project-aouthin เดิม)
2. เอาโฟลเดอร์ `aouthin-react` นี้ไปวางไว้แยกจาก backend (คนละโฟลเดอร์ก็ได้ เช่นข้างๆ `project-aouthin/`)
3. เปิด terminal ในโฟลเดอร์ `aouthin-react` แล้วรัน:
   ```
   npm install
   npm run dev
   ```
4. เปิด browser ไปที่ `http://localhost:5173/menu` (ฝั่งลูกค้า) หรือ `http://localhost:5173/admin` (ฝั่งหลังบ้าน)

Vite dev server จะ proxy คำขอ `/api` ทั้งหมดไปที่ backend `localhost:3000` ให้อัตโนมัติ (ตั้งค่าไว้ใน `vite.config.js`) — **ไม่ต้องแก้ backend เลย**

## โครงสร้างไฟล์

```
aouthin-react/
├── src/
│   ├── api.js              → รวมฟังก์ชันเรียก API ทั้งหมด
│   ├── main.jsx             → ตั้งค่า routing ทั้งหมด
│   ├── components/
│   │   └── AdminLayout.jsx  → auth guard + header/nav (แทน auth-guard.js)
│   ├── pages/
│   │   ├── menu/
│   │   │   ├── Menu.jsx     → หน้าเมนูลูกค้า
│   │   │   └── Bill.jsx     → หน้าบิลลูกค้า
│   │   └── admin/
│   │       ├── Login.jsx
│   │       ├── Products.jsx → จัดการเมนู
│   │       ├── Orders.jsx   → คำสั่งอาหาร
│   │       ├── Tables.jsx   → โต๊ะอาหาร
│   │       ├── Kitchen.jsx  → ครัว
│   │       ├── Bill.jsx     → ใบบิล
│   │       ├── QrCodePage.jsx
│   │       ├── Settings.jsx
│   │       ├── Dashboard.jsx
│   │       └── Staff.jsx
│   └── styles/
│       ├── menu.css
│       └── admin.css
├── index.html
├── package.json
└── vite.config.js
```

## Build ไปใช้งานจริง (Production)

```
npm run build
```

จะได้โฟลเดอร์ `dist/` — เอาไฟล์ในนี้ไปวางแทนที่ `public/` เดิมของ Express backend ได้เลย (หรือให้ Express serve static จากโฟลเดอร์นี้แทน)

## หมายเหตุสำคัญ

- **Backend ไม่ต้องแก้ไขอะไรเลย** — ทุก API endpoint เดิมยังใช้เหมือนเดิม 100%
- ทุกฟีเจอร์เดิมถูกย้ายมาครบ: กระตร้า, toast, popup ยืนยัน, เสียงแจ้งเตือน, filter วันที่, upload รูป, role owner/staff ฯลฯ
- ถ้าเจอ error ตอน `npm run dev` ครั้งแรก ให้ลองลบโฟลเดอร์ `node_modules` แล้ว `npm install` ใหม่
