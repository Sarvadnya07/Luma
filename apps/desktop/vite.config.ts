import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: "esnext",
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    // ARCH-2: always emit maps. Without them a field crash in a bundled
    // desktop build cannot be symbolicated at all, which made the (previously
    // absent) error telemetry unusable even after it was added.
    sourcemap: true,
    rollupOptions: {
      output: {
        // Keep the eagerly loaded application shell separate from the lazily
        // loaded reader engines and feature screens so a cache-busting change in
        // one does not invalidate the other, and so the biggest third-party
        // dependency (pdf.js) never lands in the initial chunk.
        manualChunks: {
          "pdf-engine": ["pdfjs-dist"],
          "react-vendor": ["react", "react-dom"],
        },
      },
    },
  },
});
