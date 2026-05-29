import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import mkcert from 'vite-plugin-mkcert';

// Test config lives in vitest.config.ts (kept separate so tests don't load mkcert).

// https://vite.dev/config/
export default defineConfig({
  // mkcert generates a locally-trusted cert so getUserMedia + Web Workers run
  // over HTTPS (required on a secure context, including phones on the LAN).
  plugins: [react(), mkcert()],
  server: {
    host: true, // bind 0.0.0.0 so a phone on the same network can connect
  },
  worker: {
    format: 'es', // module workers (new Worker(new URL(...), { type: 'module' }))
  },
  optimizeDeps: {
    // cubejs ships a CommonJS bundle (compiled from CoffeeScript); pre-bundle it
    // so the solver worker can `import Cube from 'cubejs'` cleanly.
    include: ['cubejs'],
  },
});
