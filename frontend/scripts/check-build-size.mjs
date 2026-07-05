import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const outputDirectory = path.join(projectDirectory, "dist");
const largestJavaScriptBudget = 300 * 1024;
const totalAssetBudget = 500 * 1024;

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(directory, entry.name);
      return entry.isDirectory() ? collectFiles(absolutePath) : [absolutePath];
    }),
  );
  return nested.flat();
}

const files = await collectFiles(outputDirectory);
const assets = await Promise.all(
  files.map(async (file) => ({
    file: path.relative(outputDirectory, file),
    size: (await stat(file)).size,
  })),
);
const javascriptAssets = assets.filter(({ file }) => file.endsWith(".js"));
const largestJavaScript = Math.max(
  0,
  ...javascriptAssets.map(({ size }) => size),
);
const totalAssets = assets.reduce((total, { size }) => total + size, 0);

if (
  largestJavaScript > largestJavaScriptBudget ||
  totalAssets > totalAssetBudget
) {
  throw new Error(
    `Build exceeds its size budget: largest JS ${largestJavaScript} bytes ` +
      `(limit ${largestJavaScriptBudget}), total ${totalAssets} bytes ` +
      `(limit ${totalAssetBudget}).`,
  );
}

console.log(
  `Size budget passed: largest JS ${largestJavaScript} bytes; ` +
    `total build ${totalAssets} bytes.`,
);
