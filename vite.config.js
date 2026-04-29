import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function createSystemProxy() {
  return {
    target: "http://127.0.0.1:8787",
    changeOrigin: true,
    configure(proxy) {
      proxy.on("proxyReq", (proxyReq) => {
        proxyReq.setHeader("X-Tikpal-Local-Ui", "1");
      });
    },
  };
}

export default defineConfig({
  base: "/",
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 4173,
    proxy: {
      "/api/v1/system": createSystemProxy(),
      "/api/v1/flow": createSystemProxy(),
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
    proxy: {
      "/api/v1/system": createSystemProxy(),
      "/api/v1/flow": createSystemProxy(),
    },
  },
});
