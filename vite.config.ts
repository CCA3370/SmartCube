import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import mkcert from 'vite-plugin-mkcert';

// Test config lives in vitest.config.ts (kept separate so tests don't load mkcert).

/**
 * cubejs splits its Kociemba solver into a side-effect module (lib/solve.js)
 * compiled from CoffeeScript. Its line 6 is:
 *
 *     Cube = this.Cube || require('./cube');
 *
 * In CommonJS/Node, the file's IIFE runs with `this === module.exports` (an
 * object), so `this.Cube` is harmlessly undefined and the `require('./cube')`
 * fallback loads the modeling class. But when Vite/rolldown bundles solve.js
 * into the ESM solver worker, the IIFE is invoked with `this === undefined`
 * (ESM strict mode), so `this.Cube` throws "Cannot read properties of undefined
 * (reading 'Cube')" — BEFORE the `||` fallback can run. That crashes the worker
 * on load: init() never resolves and "Solve" hangs forever.
 *
 * This plugin rewrites that one line so it no longer reads `this`, letting the
 * already-correct `require('./cube')` fallback (which rolldown wires to the
 * bundled Cube module) take over. Every other `this` in the file — the cube
 * prototype methods, the trailing `.call(this)` — is untouched.
 */
function fixCubejsSolveThis(): Plugin {
  return {
    name: 'fix-cubejs-solve-this',
    enforce: 'pre',
    transform(code, id) {
      // Strip any query suffix (dev adds `?v=<hash>`; the build path has none).
      const clean = id.replace(/\\/g, '/').split('?')[0];
      if (!clean.endsWith('cubejs/lib/solve.js')) return null;
      // Tolerant of whitespace/quote style: rewrite the `this.Cube` read so it no
      // longer touches `this` (which is undefined in the ESM worker), letting the
      // `require('./cube')` fallback resolve the bundled Cube class.
      const patched = code.replace(
        /Cube\s*=\s*this\.Cube\s*\|\|\s*require\((['"])\.\/cube\1\)/,
        "Cube = (typeof this !== 'undefined' && this && this.Cube) || require('./cube')",
      );
      return patched === code ? null : { code: patched, map: null };
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  // mkcert generates a locally-trusted cert so getUserMedia + Web Workers run
  // over HTTPS (required on a secure context, including phones on the LAN).
  plugins: [fixCubejsSolveThis(), react(), mkcert()],
  server: {
    host: true, // bind 0.0.0.0 so a phone on the same network can connect
  },
  optimizeDeps: {
    // cubejs ships a CommonJS bundle (compiled from CoffeeScript); pre-bundle it
    // so the solver worker can `import Cube from 'cubejs'` cleanly.
    include: ['cubejs'],
  },
  worker: {
    format: 'es', // module workers (new Worker(new URL(...), { type: 'module' }))
    // The solver worker bundles cubejs/lib/solve.js, so the `this`-rewrite plugin
    // must run in the worker pipeline too (Vite bundles workers with a separate
    // plugin set; the top-level `plugins` array does not apply here).
    plugins: () => [fixCubejsSolveThis()],
  },
});
