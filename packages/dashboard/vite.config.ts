import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "../..", "");

  return {
    plugins: [react()],
    base: "/admin/",
    define: {
      __AUTH0_DOMAIN__: JSON.stringify(env.AUTH0_DOMAIN),
      __AUTH0_CLIENT_ID__: JSON.stringify(env.AUTH0_CLIENT_ID),
      __AUTH0_AUDIENCE__: JSON.stringify(env.AUTH0_AUDIENCE),
    },
    build: {
      outDir: "dist",
      emptyDirFirst: true,
    },
    server: {
      proxy: {
        "/api": "http://localhost:3000",
      },
    },
  };
});
