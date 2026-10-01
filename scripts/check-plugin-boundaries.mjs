import { promises as fs } from "node:fs";
import path from "node:path";

const root = process.cwd();
const pluginsRoot = path.join(root, "plugins");
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const importPattern = /(?:from\s+["']([^"']+)["']|import\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\))/g;

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else if (sourceExtensions.has(path.extname(entry.name))) files.push(full);
  }
  return files;
}

async function discoverPluginPackages() {
  const names = new Set();
  for (const category of await fs.readdir(pluginsRoot, { withFileTypes: true })) {
    if (!category.isDirectory()) continue;
    const categoryDir = path.join(pluginsRoot, category.name);
    for (const plugin of await fs.readdir(categoryDir, { withFileTypes: true })) {
      if (!plugin.isDirectory()) continue;
      try {
        const pkg = JSON.parse(await fs.readFile(path.join(categoryDir, plugin.name, "package.json"), "utf8"));
        if (pkg.name) names.add(pkg.name);
      } catch {}
    }
  }
  return names;
}

function pluginRootFor(file) {
  const rel = path.relative(pluginsRoot, file).split(path.sep);
  return path.join(pluginsRoot, rel[0], rel[1]);
}

const pluginPackageNames = await discoverPluginPackages();
const violations = [];
for (const file of await walk(pluginsRoot)) {
  const source = await fs.readFile(file, "utf8");
  const ownPlugin = pluginRootFor(file);
  const ownPackage = JSON.parse(await fs.readFile(path.join(ownPlugin, "package.json"), "utf8")).name;

  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1] ?? match[2] ?? match[3];
    if (!specifier) continue;

    if (pluginPackageNames.has(specifier) && specifier !== ownPackage) {
      violations.push({ file, specifier, reason: "plugin package import" });
      continue;
    }

    if (specifier.startsWith(".")) {
      const resolved = path.resolve(path.dirname(file), specifier);
      if (resolved.startsWith(pluginsRoot + path.sep) && !resolved.startsWith(ownPlugin + path.sep)) {
        violations.push({ file, specifier, reason: "relative import into another plugin" });
      }
    }
  }
}

if (violations.length) {
  console.error("Plugin boundary violations found:\n");
  for (const violation of violations) {
    console.error(`- ${path.relative(root, violation.file)} -> ${violation.specifier} (${violation.reason})`);
  }
  process.exitCode = 1;
} else {
  console.log("Plugin boundaries OK: no direct plugin-to-plugin implementation imports found.");
}
