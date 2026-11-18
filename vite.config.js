import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The dev server proxies /api to the API. The port is read from server/.env
// (PORT) so the two can never disagree; API_PORT overrides, 3001 is the default.
function apiPort() {
  if (process.env.API_PORT) return process.env.API_PORT;
  try {
    const env = readFileSync(new URL('./server/.env', import.meta.url), 'utf8');
    const m = env.match(/^\s*PORT\s*=\s*(\d+)/m);
    if (m) return m[1];
  } catch { /* no server/.env yet */ }
  return '3001';
}
const apiTarget = `http://localhost:${apiPort()}`;

export default defineConfig({
  plugins: [react()],
  // just-bash (shell runner) imports node:zlib for gzip/zcat; give the browser a shim.
  resolve: { alias: { 'node:zlib': fileURLToPath(new URL('./src/shims/zlib.js', import.meta.url)) } },
  // The code-runner worker is an ES module (it imports Pyodide from the CDN).
  worker: { format: 'es' },
  server: {
    port: 5173,
    proxy: { '/api': apiTarget },
  },
  preview: {
    proxy: { '/api': apiTarget },
  },
});
