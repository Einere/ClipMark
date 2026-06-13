#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const VERSION_FILES = [
  "package.json",
  "package-lock.json",
  "src-tauri/tauri.conf.json",
];

function usage() {
  console.error("Usage: npm run release:prepare -- <version>");
  console.error("Example: npm run release:prepare -- 0.1.2");
  console.error("Example: npm run release:prepare -- v0.1.2-beta.1");
}

function normalizeReleaseVersion(input) {
  const trimmedInput = input.trim();
  const version = trimmedInput.startsWith("v") ? trimmedInput.slice(1) : trimmedInput;

  if (!SEMVER_PATTERN.test(version)) {
    throw new Error(
      `Release version must look like 1.2.3, 1.2.3-beta.1, or 1.2.3+build.1. Received: ${input}`,
    );
  }

  return {
    tagName: `v${version}`,
    version,
  };
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
  });
}

function assertCleanWorkingTree() {
  const status = run("git", ["status", "--porcelain"]);
  if (status.trim()) {
    throw new Error("Working tree must be clean before preparing a release.");
  }
}

function assertTagDoesNotExist(tagName) {
  try {
    run("git", ["rev-parse", "--verify", "--quiet", `refs/tags/${tagName}`]);
  } catch {
    return;
  }

  throw new Error(`Tag already exists: ${tagName}`);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function writeJson(path, data) {
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`);
}

async function updateVersionFiles(version) {
  const packageJson = await readJson("package.json");
  const packageLockJson = await readJson("package-lock.json");
  const tauriConfig = await readJson("src-tauri/tauri.conf.json");

  packageJson.version = version;
  packageLockJson.version = version;

  if (packageLockJson.packages?.[""]) {
    packageLockJson.packages[""].version = version;
  }

  tauriConfig.version = version;

  await writeJson("package.json", packageJson);
  await writeJson("package-lock.json", packageLockJson);
  await writeJson("src-tauri/tauri.conf.json", tauriConfig);
}

function commitAndTag({ tagName, version }) {
  run("git", ["diff", "--check"], { stdio: "inherit" });
  run("git", ["add", ...VERSION_FILES], { stdio: "inherit" });

  const messagePath = join(mkdtempSync(join(tmpdir(), "clipmark-release-")), "commit-message.txt");
  writeFileSync(
    messagePath,
    [
      `chore(release): ${tagName}`,
      "",
      `Update package and Tauri versions to ${version}.`,
      "",
    ].join("\n"),
  );

  run("git", ["commit", "--file", messagePath], { stdio: "inherit" });
  run("git", ["tag", tagName], { stdio: "inherit" });
}

async function main() {
  const versionArg = process.argv[2];
  if (!versionArg || process.argv.includes("--help") || process.argv.includes("-h")) {
    usage();
    process.exit(versionArg ? 0 : 1);
  }

  const release = normalizeReleaseVersion(versionArg);
  assertCleanWorkingTree();
  assertTagDoesNotExist(release.tagName);
  await updateVersionFiles(release.version);
  commitAndTag(release);

  console.log("");
  console.log(`Prepared release ${release.tagName}.`);
  console.log(`Push with: git push origin HEAD ${release.tagName}`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
