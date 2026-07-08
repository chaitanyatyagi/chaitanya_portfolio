import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The dev server proxies /api requests to the Express backend on :3001,
// so the frontend can call the chatbot without CORS headaches.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
