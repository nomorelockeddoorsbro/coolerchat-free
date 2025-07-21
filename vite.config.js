import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: '.',
  // This is often crucial for deployment environments to ensure relative asset resolution
  base: './',

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        // Tells Vite that index.html is your main entry point.
        // Vite will then look for script tags within this HTML file
        // to find your JavaScript entry point (e.g., main.js).
        main: path.resolve(__dirname, 'client/index.html')
      }
    }
  },
  server: {
    proxy: {
      // Proxy for WebSocket connections during development
      '/wss': {
        target: 'wss://localhost:3000', // Adjust if your WebSocket server is on a different port/host
        wss: true, // Enable WebSocket proxying
        secure: false, // Set to true if your target WSS is secure (uses HTTPS certificate)
        changeOrigin: true // Changes the origin of the host header to the target URL
      }
    }
  },
  envPrefix: 'VITE_' // Prefix for environment variables exposed to client-side code
});