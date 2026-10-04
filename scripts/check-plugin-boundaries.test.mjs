import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { checkBoundaries } from "./check-plugin-boundaries.mjs";

const fixtures = [];

function write(root, relativePath, content) {
  const target = path.join(root, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content, "utf8");
  return target;
}

function writePackage(root, relativeRoot, name, exports) {
  write(
    root,
    `${relativeRoot}/package.json`,
    `${JSON.stringify({ name, version: "0.1.0", private: true, exports }, null, 2)}\n`,
  );
}

function createFixture() {
  const root = mkdtempSync(path.join(tmpdir(), "eops-boundaries-"));
  fixtures.push(root);

  writePackage(root, "apps/api", "@eops/api");
  writePackage(root, "apps/web", "@eops/web");
  writePackage(root, "packages/database", "@eops/database", { ".": "./src/index.ts" });
  writePackage(root, "packages/event-bus", "@eops/event-bus", { ".": "./src/index.ts" });
  writePackage(root, "packages/security", "@eops/security", { ".": "./src/index.ts" });
  writePackage(root, "plugins/operations/source", "@eops/plugin-source", {
    ".": "./src/index.ts",
    "./server": "./src/server/index.ts",
  });
  writePackage(root, "plugins/operations/target", "@eops/plugin-target", {
    ".": "./src/index.ts",
    "./server": "./src/server/index.ts",
  });

  write(root, "packages/database/src/index.ts", "export const database = true;\n");
  write(root, "packages/event-bus/src/index.ts", "export const eventBus = true;\n");
  write(root, "packages/security/src/index.ts", "export const security = true;\n");
  write(root, "plugins/operations/target/src/server/index.ts", "export const TargetModule = true;\n");
  return root;
}

function relativeSpecifier(fromFile, target) {
  const relative = path.relative(path.dirname(fromFile), target).split(path.sep).join("/");
  return relative.startsWith(".") ? relative : `./${relative}`;
}

async function checkImport({ source, target, specifier }) {
  const root = createFixture();
  const sourceFile = path.join(root, source);
  const importPath = specifier ?? relativeSpecifier(sourceFile, path.join(root, target));
  write(root, source, `import value from ${JSON.stringify(importPath)};\nvoid value;\n`);
  return checkBoundaries({ root });
}

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((fixture) => rm(fixture, { recursive: true, force: true })));
});

describe("workspace boundary checker", () => {
  it("rejects plugin -> plugin/src", async () => {
    const result = await checkImport({
      source: "plugins/operations/source/src/case.ts",
      target: "plugins/operations/target/src/server/index.ts",
    });
    expect(result.violations[0]?.reason).toContain("relative import crosses workspace boundary");
  });

  it("rejects plugin -> packages/*/src", async () => {
    const result = await checkImport({
      source: "plugins/operations/source/src/case.ts",
      target: "packages/database/src/index.ts",
    });
    expect(result.violations[0]?.reason).toContain("relative import crosses workspace boundary");
  });

  it("rejects app -> plugin/src", async () => {
    const result = await checkImport({
      source: "apps/api/src/case.ts",
      target: "plugins/operations/target/src/server/index.ts",
    });
    expect(result.violations[0]?.reason).toContain("relative import crosses workspace boundary");
  });

  it("rejects app -> package/src", async () => {
    const result = await checkImport({
      source: "apps/api/src/case.ts",
      target: "packages/database/src/index.ts",
    });
    expect(result.violations[0]?.reason).toContain("relative import crosses workspace boundary");
  });

  it("rejects package -> another package/src", async () => {
    const result = await checkImport({
      source: "packages/security/src/case.ts",
      target: "packages/database/src/index.ts",
    });
    expect(result.violations[0]?.reason).toContain("relative import crosses workspace boundary");
  });

  it.each(["@eops/database", "@eops/event-bus", "@eops/security"])("accepts public package import %s", async (specifier) => {
    const result = await checkImport({
      source: "plugins/operations/source/src/case.ts",
      specifier,
    });
    expect(result.violations).toEqual([]);
  });

  it("accepts plugin server public entrypoint from apps/api", async () => {
    const result = await checkImport({
      source: "apps/api/src/case.ts",
      specifier: "@eops/plugin-target/server",
    });
    expect(result.violations).toEqual([]);
  });

  it("rejects plugin server entrypoint outside apps/api", async () => {
    const result = await checkImport({
      source: "plugins/operations/source/src/case.ts",
      specifier: "@eops/plugin-target/server",
    });
    expect(result.violations[0]?.reason).toContain("not allowed");
  });
});
