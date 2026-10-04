#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

const REQUIRED_TYPES = new Set(["feat", "fix", "refactor", "perf"]);
const KNOWN_TRAILERS = new Set(["Agent", "Spec", "Spec-Exempt-Reason"]);
const AGENT_PATTERN = /^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)?$/;

function runGit(args, { cwd, input } = {}) {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      input,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (error) {
    const detail = String(error.stderr || error.message || error).trim();
    throw new Error(`git ${args.join(" ")} failed${detail ? `: ${detail}` : ""}`);
  }
}

function parseCommitType(subject) {
  return subject.match(/^([a-z][a-z0-9-]*)(?:\([^)]+\))?!?:\s+\S/)?.[1] ?? null;
}

function parseTrailers(message, cwd) {
  const parsed = runGit(["interpret-trailers", "--parse"], { cwd, input: message });
  const trailers = new Map();

  for (const line of parsed.split(/\r?\n/)) {
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim();
    if (!KNOWN_TRAILERS.has(key)) continue;
    const value = line.slice(separator + 1).trim();
    const values = trailers.get(key) ?? [];
    values.push(value);
    trailers.set(key, values);
  }

  return trailers;
}

function trailerValues(trailers, key) {
  return trailers.get(key) ?? [];
}

function isValidSpecPath(specPath) {
  if (!specPath.startsWith("SPEC/") || !specPath.endsWith(".md")) return false;
  if (specPath.includes("\\") || path.posix.isAbsolute(specPath)) return false;
  if (path.posix.normalize(specPath) !== specPath) return false;

  const segments = specPath.split("/");
  return segments.length >= 2 && segments.every((segment) => segment && segment !== "." && segment !== "..");
}

function objectExists(cwd, objectName) {
  try {
    execFileSync("git", ["cat-file", "-e", objectName], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "ignore", "ignore"],
    });
    return true;
  } catch {
    return false;
  }
}

function resolveCommits(cwd, revision) {
  if (revision.includes("..")) {
    const output = runGit(["rev-list", "--reverse", revision], { cwd }).trim();
    return output ? output.split(/\r?\n/) : [];
  }

  return [runGit(["rev-parse", "--verify", `${revision}^{commit}`], { cwd }).trim()];
}

function inspectCommit(cwd, commit) {
  const subject = runGit(["show", "-s", "--format=%s", commit], { cwd }).trim();
  const message = runGit(["show", "-s", "--format=%B", commit], { cwd });
  const parents = runGit(["show", "-s", "--format=%P", commit], { cwd }).trim().split(/\s+/).filter(Boolean);
  const type = parseCommitType(subject);
  const trailers = parseTrailers(message, cwd);
  const hasKnownTrailer = [...KNOWN_TRAILERS].some((key) => trailerValues(trailers, key).length > 0);
  const isMerge = parents.length > 1;
  const policyApplies = (REQUIRED_TYPES.has(type) && !isMerge) || hasKnownTrailer;
  const violations = [];

  if (!policyApplies) return { commit, subject, violations };

  const agentValues = trailerValues(trailers, "Agent");
  const specValues = trailerValues(trailers, "Spec");
  const reasonValues = trailerValues(trailers, "Spec-Exempt-Reason");

  if (agentValues.length !== 1) {
    violations.push(`expected exactly one Agent trailer, found ${agentValues.length}`);
  } else if (!AGENT_PATTERN.test(agentValues[0])) {
    violations.push(`invalid Agent trailer value: ${JSON.stringify(agentValues[0])}`);
  }

  if (specValues.length !== 1) {
    violations.push(`expected exactly one Spec trailer, found ${specValues.length}`);
    if (reasonValues.length > 0) {
      violations.push("Spec-Exempt-Reason requires Spec: EXEMPT");
    }
    return { commit, subject, violations };
  }

  const specValue = specValues[0];
  if (specValue === "EXEMPT") {
    if (reasonValues.length !== 1 || !reasonValues[0]?.trim()) {
      violations.push(`Spec: EXEMPT requires exactly one non-empty Spec-Exempt-Reason trailer`);
    }
    return { commit, subject, violations };
  }

  if (reasonValues.length > 0) {
    violations.push("Spec-Exempt-Reason is only allowed with Spec: EXEMPT");
  }

  if (!isValidSpecPath(specValue)) {
    violations.push(`invalid Spec path ${JSON.stringify(specValue)}; expected SPEC/<file>.md`);
    return { commit, subject, violations };
  }

  if (!objectExists(cwd, `${commit}:${specValue}`)) {
    violations.push(`referenced SPEC is not tracked in commit: ${specValue}`);
  }

  const firstParent = parents[0];
  if (!firstParent) {
    violations.push(`referenced SPEC has no prior commit: ${specValue}`);
  } else if (!objectExists(cwd, `${firstParent}:${specValue}`)) {
    violations.push(`referenced SPEC did not exist in the first parent: ${specValue}`);
  }

  return { commit, subject, violations };
}

export function checkRepository({ cwd = process.cwd(), revision = "HEAD" } = {}) {
  const insideWorkTree = runGit(["rev-parse", "--is-inside-work-tree"], { cwd }).trim();
  if (insideWorkTree !== "true") throw new Error("current directory is not inside a Git work tree");

  const commits = resolveCommits(cwd, revision);
  const results = commits.map((commit) => inspectCommit(cwd, commit));
  const violations = results.flatMap((result) =>
    result.violations.map((message) => ({
      commit: result.commit,
      subject: result.subject,
      message,
    })),
  );

  return { revision, checked: commits.length, violations, ok: violations.length === 0 };
}

function formatViolation(violation) {
  return `- ${violation.commit.slice(0, 12)} ${violation.subject}\n  ${violation.message}`;
}

export function main(argv = process.argv.slice(2)) {
  if (argv.length > 1) {
    console.error("Usage: npm run spec:check -- [<commit-or-range>]");
    return 2;
  }

  const revision = argv[0] ?? "HEAD";
  try {
    const result = checkRepository({ revision });
    if (!result.ok) {
      console.error(`SPEC traceability failed for ${result.revision}:`);
      console.error(result.violations.map(formatViolation).join("\n"));
      return 1;
    }

    console.log(`SPEC traceability OK: ${result.checked} commit(s) checked for ${result.revision}.`);
    return 0;
  } catch (error) {
    console.error(`SPEC traceability could not run: ${error.message}`);
    return 2;
  }
}

const entryPoint = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (entryPoint === import.meta.url) {
  process.exitCode = main();
}
