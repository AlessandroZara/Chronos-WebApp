import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// In locale le chiamate ad `/api.php` restano sullo stesso dominio del
// frontend — esattamente come in produzione, dove api.php sta accanto a
// index.html — e il proxy le gira al server PHP avviato da
// tools/serve.mjs (npm run dev / npm run preview:full).
const apiProxy = { '/api.php': 'http://127.0.0.1:8010' };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  server: { proxy: apiProxy },
  preview: { proxy: apiProxy },
});
