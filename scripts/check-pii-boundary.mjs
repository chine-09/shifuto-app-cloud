#!/usr/bin/env node
// Fails the build if any file under a PII-forbidden boundary imports the
// PII-carrying types module. Stands in for `no-restricted-imports`, which
// oxlint (used by apps/web) doesn't support.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const FORBIDDEN_IMPORT_PATTERN = /from\s+["'][^"']*\/types\/pii["']/;
const BOUNDARIES = ["apps/api/src", "apps/web/src/lib/api"];

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, files);
    else if (/\.(ts|tsx)$/.test(entry)) files.push(full);
  }
  return files;
}

let violations = [];
for (const boundary of BOUNDARIES) {
  let files;
  try {
    files = walk(boundary);
  } catch {
    continue; // boundary doesn't exist yet, nothing to check
  }
  for (const file of files) {
    const content = readFileSync(file, "utf8");
    if (FORBIDDEN_IMPORT_PATTERN.test(content)) violations.push(file);
  }
}

if (violations.length > 0) {
  console.error("PII boundary violation: these files must not import types/pii:");
  for (const f of violations) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("PII boundary check passed.");
