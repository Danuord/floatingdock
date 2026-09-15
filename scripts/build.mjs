import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");

execSync("npx vite build", {
  cwd: projectRoot,
  stdio: "inherit"
});

const outputDirectory = resolve(projectRoot, "dist");

if (!existsSync(outputDirectory)) {
  mkdirSync(outputDirectory, { recursive: true });
}

copyFileSync(
  resolve(projectRoot, "manifest.json"),
  resolve(outputDirectory, "manifest.json")
);