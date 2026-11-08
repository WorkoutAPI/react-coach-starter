import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return { plugins: [react()], server: { port: Number(env.PORT || 3000), strictPort: true, proxy: { '/api': `http://localhost:${env.API_PORT || 3001}` } } };
});
