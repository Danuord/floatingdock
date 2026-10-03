import { resolve } from "node:path";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import hotReloadExtension from "hot-reload-extension-vite";

const projectDirectory = fileURLToPath(new URL(".", import.meta.url));
const sourceDirectory = resolve(projectDirectory, "src");

export default defineConfig({
  plugins: [
    hotReloadExtension({
      log: true,
      backgroundPath: "background/service-worker.js",
    }),
  ],
  root: sourceDirectory,
  publicDir: resolve(projectDirectory, "public"),
  build: {
    outDir: resolve(projectDirectory, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        dock: resolve(sourceDirectory, "dock/dock.html"),
        scanner: resolve(sourceDirectory, "dock/scanner.html"),
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