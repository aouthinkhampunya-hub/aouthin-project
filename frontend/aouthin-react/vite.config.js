import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite dev server ຈະ proxy ທຸກ request /api ໄປຫາ Express server ທີ່ localhost:3000
// (ຄື server ເກົ່າ backend ທີ່ໃຊ້ຢູ່ແລ້ວ, ບໍ່ຕ້ອງແກ້ໄຂຫຍັງ)
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist'
  }
});
