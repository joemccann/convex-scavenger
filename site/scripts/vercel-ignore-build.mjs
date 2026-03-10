#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function safeRevParse(ref) {
  try {
    return git(["rev-parse", ref]);
  } catch {
    return null;
  }
}

function main() {
  let repoRoot;
  try {
    repoRoot = git(["rev-parse", "--show-toplevel"]);
  } catch {
    console.log("Not running inside a git checkout. Continuing build.");
    process.exit(1);
  }

  const headSha = process.env.VERCEL_GIT_COMMIT_SHA?.trim() || safeRevParse("HEAD");
  const baseSha = process.env.VERCEL_GIT_PREVIOUS_SHA?.trim() || safeRevParse("HEAD^");

  if (!headSha || !baseSha) {
    console.log("No previous commit available. Continuing build.");
    process.exit(1);
  }

  const siteRoot = path.join(repoRoot, "site");
  const cwd = path.resolve(process.cwd());
  const diffPath = cwd === siteRoot ? "." : path.relative(cwd, siteRoot) || "site";
  const logPath = "site/";

  try {
    execFileSync("git", ["diff", "--quiet", baseSha, headSha, "--", diffPath], {
      stdio: "ignore",
    });
    console.log(`No changes detected under ${logPath}. Skipping Vercel build.`);
    process.exit(0);
  } catch (error) {
    if (error && typeof error === "object" && "status" in error && error.status === 1) {
      console.log(`Changes detected under ${logPath}. Continuing Vercel build.`);
      process.exit(1);
    }

    console.log("Unable to determine changed files. Continuing build.");
    process.exit(1);
  }
}

main();
