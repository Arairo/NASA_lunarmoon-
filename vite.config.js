import { defineConfig } from 'vite';
import cesium from 'vite-plugin-cesium';

// vite-plugin-cesium adds the CesiumJS <script> and stylesheet to every page.
// Only the expert planner uses CesiumJS, so keep the guided page light.
const cesiumPlugin = cesium();
const injectCesium = cesiumPlugin.transformIndexHtml;
cesiumPlugin.transformIndexHtml = function (html, ctx) {
  const page = ctx?.filename || ctx?.path || '';
  return page.endsWith('planner.html') ? injectCesium.call(this, html, ctx) : undefined;
};

// BASE_PATH lets the GitHub Pages build serve the app from /<repository-name>/.
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [cesiumPlugin],
  server: { port: 5174, host: true },
  preview: { port: 4174 },
  build: {
    chunkSizeWarningLimit: 6000,
    // Two pages: the guided beginner flow (index.html) and the expert planner.
    rollupOptions: { input: { main: 'index.html', planner: 'planner.html' } },
  },
});
