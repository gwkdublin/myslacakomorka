import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";

// Certyfikaty deweloperskie Office (npm run certs) – PowerPoint wymaga HTTPS.
function httpsOptions() {
  const dir = resolve(homedir(), ".office-addin-dev-certs");
  const key = resolve(dir, "localhost.key");
  const cert = resolve(dir, "localhost.crt");
  if (existsSync(key) && existsSync(cert)) return { key: readFileSync(key), cert: readFileSync(cert) };
  return undefined;
}

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: "./",
  server: { port: 3000, https: command === "serve" ? httpsOptions() : undefined, strictPort: true },
  build: {
    rollupOptions: {
      input: {
        taskpane: resolve(import.meta.dirname, "taskpane.html"),
        commands: resolve(import.meta.dirname, "commands.html"),
      },
    },
  },
  test: { globals: true, environment: "node" },
}));
