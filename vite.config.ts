import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The live site is https://lava-drop.github.io/ (the root of the site). The dev server keeps
// /lava-drop/ so the home-network preview link stays http://<pc>:5173/lava-drop/.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/' : '/lava-drop/',
  plugins: [react()],
}));
