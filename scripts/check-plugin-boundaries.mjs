import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const IGNORED_DIRECTORIES = new Set(["node_modules", "dist", "build", "coverage", ".git"]);
const IMPORT_PATTERN =
  /(?:from\s+["']([^"']+)["']|import\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|require\s*\(\s*["']([^"']+)["']\s*\))/g;

function isWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(fullPath)));
    else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) files.push(fullPath);
  }

  return files;
}

async function readWorkspace(workspaceRoot, kind) {
  const packagePath = path.join(workspaceRoot, "package.json");
  try {
    const packageJson = JSON.parse(await fs.readFile(packagePath, "utf8"));
    return {
      root: workspaceRoot,
      kind,
      name: packageJson.name,
      exports: packageJson.exports,
    };
  } catch {
    return null;
  }
}

async function discoverWorkspaces(root) {
  const workspaces = [];
  const simpleGroups = [
    ["apps", "app"],
    ["packages", "package"],
  ];

  for (const [directoryName, kind] of simpleGroups) {
    const groupRoot = path.join(root, directoryName);
    for (const entry of await fs.readdir(groupRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const workspace = await readWorkspace(path.join(groupRoot, entry.name), kind);
      if (workspace) workspaces.push(workspace);
    }
  }

  const pluginsRoot = path.join(root, "plugins");
  for (const category of await fs.readdir(pluginsRoot, { withFileTypes: true })) {
    if (!category.isDirectory()) continue;
    const categoryRoot = path.join(pluginsRoot, category.name);
    for (const entry of await fs.readdir(categoryRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const workspace = await readWorkspace(path.join(categoryRoot, entry.name), "plugin");
      if (workspace) workspaces.push(workspace);
    }
  }

  return workspaces.sort((left, right) => right.root.length - left.root.length);
}

function workspaceForPath(workspaces, candidate) {
  return workspaces.find((workspace) => isWithin(workspace.root, candidate));
}

function targetForSpecifier(workspacesByName, specifier) {
  for (const [packageName, workspace] of workspacesByName) {
    if (specifier === packageName) return { workspace, subpath: "." };
    if (specifier.startsWith(`${packageName}/`)) {
      return { workspace, subpath: `./${specifier.slice(packageName.length + 1)}` };
    }
  }
  return null;
}

function declaredExport(workspace, subpath) {
  if (subpath === ".") return true;
  if (!workspace.exports || typeof workspace.exports !== "object" || Array.isArray(workspace.exports)) return false;
  return Object.prototype.hasOwnProperty.call(workspace.exports, subpath);
}

function inspectSpecifier({ sourceWorkspace, target, specifier, sourceFile }) {
  if (!target || target.workspace.root === sourceWorkspace.root) return null;

  const targetWorkspace = target.workspace;
  if (target.subpath === "./src" || target.subpath.startsWith("./src/")) {
    return "public import reaches another workspace's src internals";
  }

  if (targetWorkspace.kind === "plugin") {
    const relativeSource = path.relative(sourceWorkspace.root, sourceFile).split(path.sep).join("/");
    const isApiCompositionRoot =
      sourceWorkspace.name === "@eops/api" && sourceWorkspace.kind === "app" && target.subpath === "./server";
    const isWebPluginRoot =
      sourceWorkspace.name === "@eops/web" && sourceWorkspace.kind === "app" && target.subpath === ".";

    if (!isApiCompositionRoot && !isWebPluginRoot) {
      return `plugin entrypoint ${specifier} is not allowed from ${sourceWorkspace.name} (${relativeSource})`;
    }

    if (!declaredExport(targetWorkspace, target.subpath)) {
      return `plugin subpath is not declared in exports: ${specifier}`;
    }
  }

  if (targetWorkspace.kind === "package" && !declaredExport(targetWorkspace, target.subpath)) {
    return `package subpath is not declared in exports: ${specifier}`;
  }

  return null;
}

export async function checkBoundaries({ root = process.cwd() } = {}) {
  const absoluteRoot = path.resolve(root);
  const workspaces = await discoverWorkspaces(absoluteRoot);
  const workspacesByName = new Map(
    workspaces
      .filter((workspace) => workspace.name)
      .sort((left, right) => right.name.length - left.name.length)
      .map((workspace) => [workspace.name, workspace]),
  );
  const violations = [];

  for (const sourceWorkspace of workspaces) {
    for (const file of await walk(sourceWorkspace.root)) {
      const source = await fs.readFile(file, "utf8");

      for (const match of source.matchAll(IMPORT_PATTERN)) {
        const specifier = match[1] ?? match[2] ?? match[3] ?? match[4];
        if (!specifier) continue;

        if (specifier.startsWith(".")) {
          const resolved = path.resolve(path.dirname(file), specifier);
          const targetWorkspace = workspaceForPath(workspaces, resolved);
          if (targetWorkspace && targetWorkspace.root !== sourceWorkspace.root) {
            violations.push({
              file,
              specifier,
              reason: `relative import crosses workspace boundary into ${targetWorkspace.name}`,
            });
          }
          continue;
        }

        if (/^(?:apps|packages|plugins)[/\\].*[/\\]src(?:[/\\]|$)/.test(specifier)) {
          violations.push({ file, specifier, reason: "physical workspace src path is not a public API" });
          continue;
        }

        const target = targetForSpecifier(workspacesByName, specifier);
        const reason = inspectSpecifier({ sourceWorkspace, target, specifier, sourceFile: file });
        if (reason) violations.push({ file, specifier, reason });
      }
    }
  }

  return { root: absoluteRoot, workspaces, violations, ok: violations.length === 0 };
}

export async function main() {
  try {
    const result = await checkBoundaries();
    if (result.violations.length) {
      console.error("Workspace boundary violations found:\n");
      for (const violation of result.violations) {
        console.error(`- ${path.relative(result.root, violation.file)} -> ${violation.specifier} (${violation.reason})`);
      }
      return 1;
    }

    console.log(
      `Workspace boundaries OK: ${result.workspaces.length} workspace(s), no cross-workspace internal imports found.`,
    );
    return 0;
  } catch (error) {
    console.error(`Workspace boundary check could not run: ${error.message}`);
    return 2;
  }
}

const entryPoint = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (entryPoint === import.meta.url) {
  process.exitCode = await main();
}
