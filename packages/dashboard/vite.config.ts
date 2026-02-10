import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "fs";
import { resolve } from "path";

// Read root package.json for version (works in both local dev and Docker)
const rootPkgPath = resolve(__dirname, "../../package.json");
const pkg = JSON.parse(readFileSync(rootPkgPath, "utf-8"));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "../..", "");

  return {
    plugins: [react()],
    base: "/admin/",
    define: {
      __AUTH0_DOMAIN__: JSON.stringify(env.AUTH0_DOMAIN),
      __AUTH0_CLIENT_ID__: JSON.stringify(env.AUTH0_CLIENT_ID),
      __AUTH0_AUDIENCE__: JSON.stringify(env.AUTH0_AUDIENCE),
      __APP_VERSION__: JSON.stringify(pkg.version),
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
