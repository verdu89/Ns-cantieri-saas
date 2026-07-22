import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  base: "/Ns-cantieri-saas/",
  appType: "spa",
  plugins: [react()],
  optimizeDeps: {
    entries: ["index.html"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          lucide: ["lucide-react"],
          motion: ["framer-motion"],
          recharts: ["recharts"],
        },
      },
    },
    chunkSizeWarningLimit: 1500,
  },
});
