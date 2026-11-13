import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Two explicit targets (see docs/DEPLOYMENT.md):
//  default  -> Hugging Face Space: served at "/", tutor API on the same origin
//  "pages"  -> GitHub Pages: served at "/KCNA/", tutor API on the HF Space (CORS-allowed)
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: mode === 'pages' ? '/KCNA/' : '/',
    plugins: [react(), tailwindcss()],
    define: {
      __TUTOR_API__: JSON.stringify(mode === 'pages' ? (env.VITE_TUTOR_API ?? 'https://mhamdan-kcna.hf.space') : (env.VITE_TUTOR_API ?? '')),
      __DEPLOY_TARGET__: JSON.stringify(mode === 'pages' ? 'github-pages' : 'huggingface'),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },
    build: { outDir: mode === 'pages' ? 'dist-pages' : 'dist', chunkSizeWarningLimit: 1500 },
    server: { proxy: { '/api': 'http://localhost:7860' } },
  };
});
