import { resolve } from "node:path";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const projectDirectory = fileURLToPath(new URL(".", import.meta.url));
const sourceDirectory = resolve(projectDirectory, "src");

export default defineConfig({
  root: sourceDirectory,
  publicDir: resolve(projectDirectory, "public"),
  build: {
    outDir: resolve(projectDirectory, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        dock: resolve(sourceDirectory, "dock/dock.html"),
        serviceWorker: resolve(
          sourceDirectory,
          "background/service-worker.ts"
        )
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === "serviceWorker"
            ? "background/service-worker.js"
            : "assets/[name]-[hash].js"
      }
    }
  }
});