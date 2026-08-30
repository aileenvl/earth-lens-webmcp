#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const baseIndex = process.argv.indexOf("--base");
const base = baseIndex >= 0 ? process.argv[baseIndex + 1] : "origin/main";

function git(args) {
  try {
    return execFileSync("git", args, { encoding: "utf8" });
  } catch {
    return null;
  }
}

const mergeBase = git(["merge-base", base, "HEAD"])?.trim();
if (!mergeBase) {
  console.error(`floor-guard: no merge base against ${base}`);
  process.exit(2);
}

const tracked = git(["diff", "--unified=0", mergeBase, "--"]) ?? "";
const untrackedFiles = (git(["ls-files", "--others", "--exclude-standard"]) ?? "")
  .split("\n")
  .filter(Boolean);

const added = [];
const removed = [];
let file = "";
for (const line of tracked.split("\n")) {
  if (line.startsWith("+++ ")) file = line.slice(6);
  else if (line.startsWith("+") && !line.startsWith("+++")) added.push({ file, text: line.slice(1) });
  else if (line.startsWith("-") && !line.startsWith("---")) removed.push({ file, text: line.slice(1) });
}
for (const untrackedFile of untrackedFiles) {
  const content = readFileSync(untrackedFile, "utf8");
  for (const line of content.split("\n")) added.push({ file: untrackedFile, text: line });
}

const findings = [];
const flag = (rule, location, value) => findings.push({
  rule,
  file: location,
  text: value.trim().slice(0, 120),
});
const suppressions = /@ts-ignore|@ts-nocheck|eslint-disable|istanbul ignore|nosemgrep|gitleaks:allow|Stryker disable/;
const stubs = /throw new (Error|NotImplemented).*[Nn]ot implemented|catch\s*\(\w*\)\s*\{\s*\}|catch\s*\{\s*\}/;
const skips = /\.(skip|todo)\b|\bxit\(|\bxdescribe\(/;

for (const line of added) {
  const isCode = /\.(c|cjs|js|jsx|mjs|py|ts|tsx)$/.test(line.file)
    && line.file !== "tools/floor-guard.mjs";
  if (isCode && suppressions.test(line.text)) flag("silenced-checker", line.file, line.text);
  if (isCode && stubs.test(line.text)) flag("unfinished-work", line.file, line.text);
  if (isCode && skips.test(line.text)) flag("test-made-easier", line.file, line.text);
  if (/CONSTRAINTS\.md$/.test(line.file) && /^\| *(W|E)\d+ *\|/.test(line.text)) {
    flag("new-exception", line.file, line.text);
  }
}

for (const line of removed) {
  if (/\.(test|spec)\.|_test\.|test_/.test(line.file) && /\b(expect|assert|should)\b/.test(line.text)) {
    flag("assertion-removed", line.file, line.text);
  }
}

const numbers = (value) => (value.match(/\d+(\.\d+)?/g) ?? []).map(Number);
const removedConstraints = removed.filter((line) => /CONSTRAINTS\.md$/.test(line.file));
const addedConstraints = added.filter((line) => /CONSTRAINTS\.md$/.test(line.file));
for (const previous of removedConstraints) {
  const next = addedConstraints.find(
    (candidate) => candidate.text.split(/[|:]/)[0] === previous.text.split(/[|:]/)[0],
  );
  if (next && numbers(next.text).some(
    (value, index) => numbers(previous.text)[index] !== undefined && value < numbers(previous.text)[index],
  )) {
    flag("threshold-lowered", previous.file, `${previous.text} -> ${next.text}`);
  }
}

if (findings.length === 0) {
  console.log("floor-guard: clean");
  process.exit(0);
}

console.error(`floor-guard: ${findings.length} floor violation(s):`);
for (const finding of findings) {
  console.error(`  [${finding.rule}] ${finding.file}: ${finding.text}`);
}
console.error("Fix the change or route it through a separately reviewed exception.");
process.exit(1);
