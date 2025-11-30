import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    hmr: {
      clientPort: 443,
    },
    // Allow all hosts (needed for cloudflare/ngrok tunnels)
    allowedHosts: [
      'planned-herein-session-phones.trycloudflare.com',
      '.trycloudflare.com',
      '.ngrok-free.dev',
      '.loca.lt'
    ]
  }
});
