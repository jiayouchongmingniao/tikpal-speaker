import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/flow/",
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 4173,
    proxy: {
      "/api/v1/system": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
      "/api/v1/flow": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
    },
  },
});
