import { promises as fs, watch } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDirectory, "..");
const apiDist = path.join(root, "apps", "api", "dist");
const commonJsMarker = `${JSON.stringify({ type: "commonjs" }, null, 2)}\n`;

async function copyCompiledDirectory(source, target, packageRoot, entrySource) {
  await fs.access(source);
  await fs.rm(target, { recursive: true, force: true });
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.cp(source, target, { recursive: true });

  if (entrySource) {
    const entry = await fs.readFile(entrySource, "utf8");
    const moduleSpecifier = entry.match(/from\s+["'](.+)["']/)?.[1];
    if (!moduleSpecifier?.startsWith("./")) {
      throw new Error(`Unsupported plugin server entrypoint: ${entrySource}`);
    }
    await fs.writeFile(path.join(target, "index.js"), `"use strict";\nmodule.exports = require(${JSON.stringify(moduleSpecifier)});\n`, "utf8");
  }

  await fs.mkdir(path.join(packageRoot, "dist"), { recursive: true });
  await fs.writeFile(path.join(packageRoot, "dist", "package.json"), commonJsMarker, "utf8");
}

async function discoverPluginTargets() {
  const targets = [];
  const pluginsRoot = path.join(root, "plugins");

  for (const category of await fs.readdir(pluginsRoot, { withFileTypes: true })) {
    if (!category.isDirectory()) continue;
    const categoryRoot = path.join(pluginsRoot, category.name);
    for (const plugin of await fs.readdir(categoryRoot, { withFileTypes: true })) {
      if (!plugin.isDirectory()) continue;
      const pluginRoot = path.join(categoryRoot, plugin.name);
      const packageJson = JSON.parse(await fs.readFile(path.join(pluginRoot, "package.json"), "utf8"));
      if (!packageJson.exports?.["./server"]) continue;

      targets.push({
        source: path.join(apiDist, "plugins", category.name, plugin.name, "src", "server"),
        target: path.join(pluginRoot, "dist", "server"),
        packageRoot: pluginRoot,
        entrySource: path.join(pluginRoot, "src", "server", "index.ts"),
      });
    }
  }

  return targets;
}

async function syncAll() {
  const packageTargets = ["database", "event-bus"].map((packageName) => {
    const packageRoot = path.join(root, "packages", packageName);
    return {
      source: path.join(apiDist, "packages", packageName, "src"),
      target: path.join(packageRoot, "dist"),
      packageRoot,
    };
  });
  const targets = [...packageTargets, ...(await discoverPluginTargets())];
  await Promise.all(
    targets.map(({ source, target, packageRoot, entrySource }) =>
      copyCompiledDirectory(source, target, packageRoot, entrySource),
    ),
  );
  console.log(`Server workspace exports synchronized: ${targets.length} target(s).`);
}

async function main() {
  await syncAll();
  if (!process.argv.includes("--watch")) return;

  let timer;
  const watcher = watch(apiDist, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      syncAll().catch((error) => console.error(`Server export sync failed: ${error.message}`));
    }, 150);
  });
  console.log("Watching API dist for server workspace export changes.");

  const close = () => {
    clearTimeout(timer);
    watcher.close();
    process.exit(0);
  };
  process.on("SIGINT", close);
  process.on("SIGTERM", close);
}

main().catch((error) => {
  console.error(`Server workspace export sync failed: ${error.message}`);
  process.exitCode = 1;
});
