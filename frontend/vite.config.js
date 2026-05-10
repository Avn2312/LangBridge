import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Proxy API requests to the backend during local development
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          if (id.includes("framer-motion")) {
            return "motion";
          }

          if (id.includes("@tanstack/react-query")) {
            return "query";
          }

          if (id.includes("react-router")) {
            return "router";
          }

          if (id.includes("react") || id.includes("react-dom")) {
            return "react-vendor";
          }
        },
      },
    },
  },
});
