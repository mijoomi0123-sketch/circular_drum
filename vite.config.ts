import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Local-only development setup. No deployment configuration on purpose.
export default defineConfig({
  // Relative asset paths so the build works from any folder.
  base: './',
  plugins: [react()],
  server: { host: 'localhost', port: 5173, open: false },
  preview: { host: 'localhost', port: 4173 },
});
