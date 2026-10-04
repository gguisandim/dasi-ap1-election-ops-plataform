import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { checkRepository } from "./check-spec-traceability.mjs";

const repositories = [];

function git(cwd, args, input) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    input,
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}

function createRepository() {
  const cwd = mkdtempSync(path.join(tmpdir(), "eops-spec-check-"));
  repositories.push(cwd);
  git(cwd, ["init", "--quiet"]);
  git(cwd, ["config", "user.name", "Spec Check"]);
  git(cwd, ["config", "user.email", "spec-check@example.invalid"]);
  write(cwd, "README.md", "fixture\n");
  commit(cwd, "docs: initialize fixture");
  return cwd;
}

function write(cwd, relativePath, content) {
  const target = path.join(cwd, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content, "utf8");
}

function commit(cwd, message) {
  git(cwd, ["add", "--all"]);
  git(cwd, ["commit", "--quiet", "--file", "-"], `${message}\n`);
  return git(cwd, ["rev-parse", "HEAD"]);
}

function addSpec(cwd, name = "feature.md") {
  const specPath = `SPEC/${name}`;
  write(cwd, specPath, "# Fixture SPEC\n");
  commit(cwd, `docs(spec): add ${name}`);
  return specPath;
}

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(
    repositories
      .splice(0)
      .map((repository) => rm(repository, { recursive: true, force: true })),
  );
});

describe("check-spec-traceability", { timeout: 15_000 }, () => {
  it("accepts a required commit whose SPEC exists in its parent", () => {
    const cwd = createRepository();
    const specPath = addSpec(cwd);
    write(cwd, "feature.txt", "implemented\n");
    commit(
      cwd,
      `feat(core): add fixture\n\nAgent: codex/gpt-5\nSpec: ${specPath}`,
    );

    expect(checkRepository({ cwd })).toMatchObject({
      ok: true,
      checked: 1,
      violations: [],
    });
  });

  it("rejects a SPEC introduced in the implementation commit", () => {
    const cwd = createRepository();
    write(cwd, "SPEC/feature.md", "# Fixture SPEC\n");
    write(cwd, "feature.txt", "implemented\n");
    commit(
      cwd,
      "feat(core): add fixture\n\nAgent: codex/gpt-5\nSpec: SPEC/feature.md",
    );

    const result = checkRepository({ cwd });
    expect(result.ok).toBe(false);
    expect(
      result.violations.some(({ message }) =>
        message.includes("did not exist in the first parent"),
      ),
    ).toBe(true);
  });

  it("accepts a docs(spec) commit that introduces its referenced SPEC", () => {
    const cwd = createRepository();
    write(cwd, "SPEC/workforce.md", "# Workforce SPEC\n");
    commit(
      cwd,
      "docs(spec): define workforce\n\nAgent: codex/gpt-5\nSpec: SPEC/workforce.md",
    );

    expect(checkRepository({ cwd })).toMatchObject({
      ok: true,
      checked: 1,
      violations: [],
    });
  });

  it("rejects a required commit without Agent", () => {
    const cwd = createRepository();
    const specPath = addSpec(cwd);
    write(cwd, "feature.txt", "implemented\n");
    commit(cwd, `fix(core): repair fixture\n\nSpec: ${specPath}`);

    const result = checkRepository({ cwd });
    expect(
      result.violations.some(({ message }) =>
        message.includes("Agent trailer"),
      ),
    ).toBe(true);
  });

  it("requires a reason for Spec: EXEMPT", () => {
    const cwd = createRepository();
    write(cwd, "feature.txt", "implemented\n");
    commit(cwd, "refactor(core): adjust fixture\n\nAgent: human\nSpec: EXEMPT");

    const result = checkRepository({ cwd });
    expect(
      result.violations.some(({ message }) =>
        message.includes("Spec-Exempt-Reason"),
      ),
    ).toBe(true);
  });

  it("accepts a justified exemption", () => {
    const cwd = createRepository();
    write(cwd, "feature.txt", "implemented\n");
    commit(
      cwd,
      "perf(core): tune fixture\n\nAgent: opencode/deepseek\nSpec: EXEMPT\nSpec-Exempt-Reason: benchmark-only adjustment",
    );

    expect(checkRepository({ cwd }).ok).toBe(true);
  });

  it("accepts an optional commit without trailers", () => {
    const cwd = createRepository();
    write(cwd, "guide.md", "documentation\n");
    commit(cwd, "docs: update fixture guide");

    expect(checkRepository({ cwd }).ok).toBe(true);
  });

  it("rejects a declared SPEC outside SPEC/", () => {
    const cwd = createRepository();
    write(cwd, "docs/modules/feature.md", "# Not a SPEC\n");
    commit(cwd, "docs: add module document");
    write(cwd, "feature.txt", "implemented\n");
    commit(
      cwd,
      "feat(core): add fixture\n\nAgent: claude/sonnet\nSpec: docs/modules/feature.md",
    );

    const result = checkRepository({ cwd });
    expect(
      result.violations.some(({ message }) =>
        message.includes("invalid Spec path"),
      ),
    ).toBe(true);
  });

  it("rejects duplicate policy trailers", () => {
    const cwd = createRepository();
    const specPath = addSpec(cwd);
    write(cwd, "feature.txt", "implemented\n");
    commit(
      cwd,
      `feat(core): add fixture\n\nAgent: human\nAgent: codex/gpt-5\nSpec: ${specPath}`,
    );

    const result = checkRepository({ cwd });
    expect(
      result.violations.some(({ message }) =>
        message.includes("exactly one Agent trailer, found 2"),
      ),
    ).toBe(true);
  });

  it("exempts merge commits even when their title uses a required type", () => {
    const cwd = createRepository();
    const mainBranch = git(cwd, ["branch", "--show-current"]);
    git(cwd, ["checkout", "--quiet", "-b", "fixture-branch"]);
    write(cwd, "branch.txt", "branch\n");
    commit(cwd, "docs: update fixture branch");
    git(cwd, ["checkout", "--quiet", mainBranch]);
    write(cwd, "main.txt", "main\n");
    commit(cwd, "docs: update fixture main");
    git(cwd, [
      "merge",
      "--no-ff",
      "--quiet",
      "-m",
      "feat(core): merge fixture",
      "fixture-branch",
    ]);

    expect(checkRepository({ cwd })).toMatchObject({
      ok: true,
      checked: 1,
      violations: [],
    });
  });

  it("checks each commit in an explicit range", () => {
    const cwd = createRepository();
    const base = git(cwd, ["rev-parse", "HEAD"]);
    const specPath = addSpec(cwd, "range.md");
    write(cwd, "feature.txt", "implemented\n");
    commit(
      cwd,
      `feat(core): add range fixture\n\nAgent: human\nSpec: ${specPath}`,
    );

    const result = checkRepository({ cwd, revision: `${base}..HEAD` });
    expect(result).toMatchObject({ ok: true, checked: 2 });
  });
});
