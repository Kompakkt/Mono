#! /usr/bin/env bun
// Scans the @angular/* and @angular-devkit/* dependencies of every cloned project and lets you align
// each package to one version across all of them. Angular packages must move in lockstep, so a single
// outlier (e.g. a caret range that resolves to the next major) breaks the whole set.
/// <reference types="@types/bun" />

import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { createInterface, type Interface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { $ } from "bun";

const SECTIONS = ["dependencies", "devDependencies"] as const;
type Section = (typeof SECTIONS)[number];

const ANGULAR_DEP_PATTERN = /^@angular(-devkit)?\//;

const RANGE_MODES = ["preserve", "exact", "caret", "tilde"] as const;
type RangeMode = (typeof RANGE_MODES)[number];

const PREFIX_BY_MODE: Record<Exclude<RangeMode, "preserve">, string> = {
  exact: "",
  caret: "^",
  tilde: "~",
};

const USAGE = `
Aligns every @angular/* dependency across the cloned projects to one version per package.

Usage:
  bun align-angular-versions.ts [projects...] [options]

  Projects default to every subdirectory of this repo that declares @angular deps
  (Repo, Viewer, Komponents, Plugins). Pass names to restrict the scan.

Options:
  --check           Report mismatches without changing anything. Exits 1 if any differ.
  --dry-run         Print the plan that would be applied, then stop.
  --yes             Accept the suggested version for every mismatch (implies no prompts).
  --range <mode>    How to write versions: preserve (default), exact, caret, tilde.
                    preserve keeps each project's existing ^ / ~ / bare style.
  --install         Run \`bun install\` in every project that was modified.
  -h, --help        Show this message.

Exit codes:
  0  aligned, or changes applied
  1  --check found mismatches, or the run was aborted / failed
`.trim();

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface ProjectFile {
  readonly project: string;
  readonly path: string;
  readonly indent: string;
  readonly trailingNewline: boolean;
  readonly json: PackageJson;
}

interface Occurrence {
  readonly file: ProjectFile;
  readonly section: Section;
  readonly name: string;
  readonly raw: string;
  readonly version: string;
  readonly operator: string;
}

interface Candidate {
  readonly version: string;
  readonly occurrences: readonly Occurrence[];
}

interface Change {
  readonly occurrence: Occurrence;
  readonly next: string;
}

interface Choice {
  readonly version: string;
  readonly operator: string | null; // null: derive from --range, or the project's existing range
}

interface ParsedVersion {
  readonly numbers: readonly number[];
  readonly prerelease: readonly string[];
}

const readProjectFile = async (
  project: string,
  path: string,
): Promise<ProjectFile | null> => {
  const raw = await Bun.file(path)
    .text()
    .catch(() => null);
  if (raw === null) return null;
  try {
    const json = JSON.parse(raw) as PackageJson;
    return {
      project,
      path,
      json,
      indent: raw.match(/^\{\r?\n([ \t]+)"/)?.[1] ?? "  ",
      trailingNewline: raw.endsWith("\n"),
    };
  } catch {
    console.warn(`[${project}] Skipping unparseable package.json at ${path}`);
    return null;
  }
};

const discoverProjects = async (
  root: string,
  requested: readonly string[],
): Promise<string[]> => {
  if (requested.length > 0) return [...requested];
  const entries = await readdir(root, { withFileTypes: true });
  const names = entries
    .filter(
      (entry) =>
        entry.isDirectory() &&
        !entry.name.startsWith(".") &&
        entry.name !== "node_modules",
    )
    .map((entry) => entry.name)
    .sort();
  const matches: string[] = [];
  for (const name of names) {
    const file = await readProjectFile(name, join(root, name, "package.json"));
    if (file && countAngularDeps(file) > 0) matches.push(name);
  }
  return matches;
};

const countAngularDeps = (file: ProjectFile): number => {
  let count = 0;
  for (const section of SECTIONS) {
    for (const name of Object.keys(file.json[section] ?? {})) {
      if (ANGULAR_DEP_PATTERN.test(name)) count++;
    }
  }
  return count;
};

const splitRange = (raw: string): { operator: string; version: string } => {
  const match = raw.match(/^([\^~>=<]*)\s*(.*)$/);
  const operator = match?.[1] ?? "";
  const version = (match?.[2] ?? raw).trim();
  return { operator, version };
};

const parseVersion = (version: string): ParsedVersion | null => {
  const [core = "", ...rest] = version.split("-");
  const numbers = core.split(".").map((part) => Number.parseInt(part, 10));
  if (numbers.length === 0 || numbers.some((value) => Number.isNaN(value))) {
    return null;
  }
  return {
    numbers,
    prerelease: rest.join("-").split(".").filter(Boolean),
  };
};

const compareVersions = (a: string, b: string): number => {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) return a.localeCompare(b);
  const length = Math.max(left.numbers.length, right.numbers.length);
  for (let index = 0; index < length; index++) {
    const difference = (left.numbers[index] ?? 0) - (right.numbers[index] ?? 0);
    if (difference !== 0) return difference;
  }
  if (left.prerelease.length === 0 && right.prerelease.length === 0) return 0;
  if (left.prerelease.length === 0) return 1;
  if (right.prerelease.length === 0) return -1;
  const prereleaseLength = Math.max(
    left.prerelease.length,
    right.prerelease.length,
  );
  for (let index = 0; index < prereleaseLength; index++) {
    const leftPart = left.prerelease[index];
    const rightPart = right.prerelease[index];
    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;
    if (leftPart === rightPart) continue;
    const leftNumber = Number.parseInt(leftPart, 10);
    const rightNumber = Number.parseInt(rightPart, 10);
    if (Number.isNaN(leftNumber) || Number.isNaN(rightNumber)) {
      return leftPart.localeCompare(rightPart);
    }
    return leftNumber - rightNumber;
  }
  return 0;
};

const collectDeps = (files: readonly ProjectFile[]): Map<string, Occurrence[]> => {
  const matrix = new Map<string, Occurrence[]>();
  for (const file of files) {
    for (const section of SECTIONS) {
      for (const [name, raw] of Object.entries(file.json[section] ?? {})) {
        if (!ANGULAR_DEP_PATTERN.test(name) && name !== 'typescript') continue;
        const occurrences = matrix.get(name) ?? [];
        occurrences.push({
          file,
          section,
          name,
          raw,
          ...splitRange(raw),
        });
        matrix.set(name, occurrences);
      }
    }
  }
  return matrix;
};

const groupByVersion = (occurrences: readonly Occurrence[]): Candidate[] => {
  const byVersion = new Map<string, Occurrence[]>();
  for (const occurrence of occurrences) {
    const bucket = byVersion.get(occurrence.version) ?? [];
    bucket.push(occurrence);
    byVersion.set(occurrence.version, bucket);
  }
  return [...byVersion.entries()]
    .map(([version, group]) => ({ version, occurrences: group }))
    .sort(
      (a, b) =>
        b.occurrences.length - a.occurrences.length ||
        compareVersions(b.version, a.version),
    );
};

const pad = (value: string, width: number): string =>
  value.padEnd(width, " ");

const describe = (occurrence: Occurrence): string =>
  `${occurrence.file.project} (${occurrence.raw})`;

const renderMatrix = (matrix: Map<string, Occurrence[]>): void => {
  const nameWidth = Math.max(
    ...["Package", ...matrix.keys()].map((name) => name.length),
  );
  const versionWidth = Math.max(
    ...[0, ...[...matrix.values()].flat().map((entry) => entry.raw.length)],
  );
  console.log(
    `\n${pad("Package", nameWidth)}  ${pad("Versions", versionWidth)}  Projects`,
  );
  for (const [name, occurrences] of matrix) {
    const candidates = groupByVersion(occurrences);
    const flag = candidates.length > 1 ? "!" : " ";
    for (const [index, candidate] of candidates.entries()) {
      const label = index === 0 ? name : "";
      console.log(
        `${flag} ${pad(label, nameWidth)}  ${pad(candidate.version, versionWidth)}  ${candidate.occurrences
          .map((occurrence) => occurrence.file.project)
          .join(", ")}`,
      );
    }
  }
  console.log("");
};

const parseChoice = (answer: string): Choice | null => {
  const match = answer.trim().match(/^([\^~]?)\s*(\d[\w.\-+]*)$/);
  const version = match?.[2];
  if (!version || parseVersion(version) === null) return null;
  const operator = match?.[1] || null;
  return { version, operator };
};

const nextRange = (
  occurrence: Occurrence,
  choice: Choice,
  mode: RangeMode,
): string => {
  if (choice.operator !== null) return `${choice.operator}${choice.version}`;
  if (mode === "preserve") return `${occurrence.operator}${choice.version}`;
  return `${PREFIX_BY_MODE[mode]}${choice.version}`;
};

const promptForVersion = async (
  rl: Interface,
  name: string,
  candidates: readonly Candidate[],
): Promise<Choice | "abort" | null> => {
  const width = Math.max(...candidates.map(({ version }) => version.length));
  console.log(`\n${name} differs across projects:`);
  for (const [index, candidate] of candidates.entries()) {
    console.log(
      `  ${index + 1}) ${pad(candidate.version, width)}  ${candidate.occurrences
        .map(describe)
        .join(", ")}`,
    );
  }
  console.log(`  Picking a version here applies to every project above.`);
  const answer = await rl.question(
    `Choose 1-${candidates.length} [1], type a version, "s" to skip, "q" to abort: `,
  );
  const trimmed = answer.trim();
  if (trimmed === "q" || trimmed === "quit") return "abort";
  if (trimmed === "s" || trimmed === "skip") return null;
  const suggestion = candidates[0];
  if (trimmed.length === 0) {
    return suggestion ? { version: suggestion.version, operator: null } : null;
  }
  const index = Number.parseInt(trimmed, 10);
  const selected = String(index) === trimmed ? candidates[index - 1] : undefined;
  if (selected) return { version: selected.version, operator: null };
  const typed = parseChoice(trimmed);
  if (!typed) {
    console.warn(`"${trimmed}" is neither an index nor a version; skipping.`);
    return null;
  }
  return typed;
};

const planForPackage = (
  occurrences: readonly Occurrence[],
  choice: Choice,
  mode: RangeMode,
): Change[] => {
  const changes: Change[] = [];
  for (const occurrence of occurrences) {
    const next = nextRange(occurrence, choice, mode);
    if (next !== occurrence.raw) changes.push({ occurrence, next });
  }
  return changes;
};

const buildPlan = async (
  matrix: Map<string, Occurrence[]>,
  mode: RangeMode,
  rl: Interface | null,
): Promise<{ changes: Change[]; aborted: boolean }> => {
  const changes: Change[] = [];
  for (const name of [...matrix.keys()].sort()) {
    const occurrences = matrix.get(name) ?? [];
    const candidates = groupByVersion(occurrences);
    const suggested = candidates[0];
    if (candidates.length <= 1 || !suggested) continue;
    if (!rl) {
      changes.push(
        ...planForPackage(occurrences, { version: suggested.version, operator: null }, mode),
      );
      continue;
    }
    const choice = await promptForVersion(rl, name, candidates);
    if (choice === "abort") return { changes, aborted: true };
    if (choice === null) continue;
    changes.push(...planForPackage(occurrences, choice, mode));
  }
  return { changes, aborted: false };
};

const renderPlan = (changes: readonly Change[]): void => {
  const sectionWidth = Math.max(
    ...[0, ...changes.map(({ occurrence }) => occurrence.section.length)],
  );
  let currentProject = "";
  for (const { occurrence, next } of changes) {
    if (occurrence.file.project !== currentProject) {
      currentProject = occurrence.file.project;
      console.log(`\n${currentProject}`);
    }
    console.log(
      `  ${pad(occurrence.section, sectionWidth)}  ${occurrence.raw} -> ${next}`,
    );
  }
  const projects = new Set(
    changes.map(({ occurrence }) => occurrence.file.project),
  );
  console.log(`\n${changes.length} change(s) across ${projects.size} project(s).`);
};

const writeProjects = async (changes: readonly Change[]): Promise<void> => {
  const touched = new Map<string, { file: ProjectFile; changes: Change[] }>();
  for (const change of changes) {
    const { occurrence } = change;
    const entry = touched.get(occurrence.file.path) ?? {
      file: occurrence.file,
      changes: [],
    };
    entry.changes.push(change);
    touched.set(occurrence.file.path, entry);
  }
  for (const { file, changes: fileChanges } of touched.values()) {
    for (const { occurrence, next } of fileChanges) {
      const deps = file.json[occurrence.section];
      if (!deps) {
        throw new Error(
          `${file.path} has no ${occurrence.section} section for ${occurrence.name}`,
        );
      }
      deps[occurrence.name] = next;
    }
    const serialized = `${JSON.stringify(file.json, null, file.indent)}${
      file.trailingNewline ? "\n" : ""
    }`;
    await Bun.write(file.path, serialized);
    console.log(
      `Wrote ${file.path} (${fileChanges.length} change${fileChanges.length === 1 ? "" : "s"})`,
    );
  }
};

const installProjects = async (
  changes: readonly Change[],
): Promise<boolean> => {
  const directories = new Set(
    changes.map(({ occurrence }) => occurrence.file.path.replace(/\/package\.json$/, "")),
  );
  let ok = true;
  for (const directory of [...directories].sort()) {
    console.log(`\n$ bun install (${directory})`);
    const result = await $`bun install`.cwd(directory).nothrow().quiet();
    if (result.exitCode !== 0) {
      ok = false;
      console.error(result.stderr.toString().trim());
    } else {
      console.log(result.stdout.toString().trim() || "ok");
    }
  }
  return ok;
};

const main = async (): Promise<number> => {
  const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      check: { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
      yes: { type: "boolean", default: false },
      range: { type: "string", default: "preserve" },
      install: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: true,
  });

  if (values.help) {
    console.log(USAGE);
    return 0;
  }

  const mode = RANGE_MODES.find((candidate) => candidate === values.range);
  if (!mode) {
    console.error(
      `Unknown --range "${values.range}". Expected one of: ${RANGE_MODES.join(", ")}.`,
    );
    return 1;
  }

  const root = import.meta.dir;
  const projects = await discoverProjects(root, positionals);
  if (projects.length === 0) {
    console.error(
      `No project with @angular dependencies found in ${root}. Run \`./kompakkt.ts setup\` first.`,
    );
    return 1;
  }

  const files: ProjectFile[] = [];
  for (const project of projects) {
    const file = await readProjectFile(
      project,
      join(root, project, "package.json"),
    );
    if (file) files.push(file);
  }
  console.log(`Scanned ${files.map(({ project }) => project).join(", ")}.`);

  const matrix = collectDeps(files);
  if (matrix.size === 0) {
    console.log("No @angular dependencies found.");
    return 0;
  }
  renderMatrix(matrix);

  const mismatches = [...matrix.entries()].filter(
    ([, occurrences]) => groupByVersion(occurrences).length > 1,
  );
  if (mismatches.length === 0) {
    console.log("All @angular dependencies already use a single version.");
    return 0;
  }

  if (values.check) {
    console.log(`${mismatches.length} package(s) differ across projects:`);
    for (const [name, occurrences] of mismatches) {
      console.log(`  ${name}`);
      for (const candidate of groupByVersion(occurrences)) {
        console.log(
          `    ${candidate.version}  ${candidate.occurrences.map(describe).join(", ")}`,
        );
      }
    }
    return 1;
  }

  const interactive = process.stdin.isTTY === true && values.yes !== true;
  if (!interactive && !values.yes && !values["dry-run"]) {
    console.error(
      "stdin is not a TTY: pass --yes to accept the suggested versions, --dry-run to review, or --check to report.",
    );
    return 1;
  }

  const rl = interactive
    ? createInterface({ input: process.stdin, output: process.stdout })
    : null;
  let changes: Change[] = [];
  let aborted = false;
  try {
    const plan = await buildPlan(matrix, mode, rl);
    changes = plan.changes;
    aborted = plan.aborted;
  } finally {
    rl?.close();
  }

  if (aborted) {
    console.log("\nAborted, no files were written.");
    return 1;
  }
  if (changes.length === 0) {
    console.log("Nothing to change.");
    return 0;
  }

  renderPlan(changes);

  if (values["dry-run"]) {
    console.log("\nDry run, no files were written.");
    return 0;
  }

  if (!values.yes) {
    const confirmation = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const answer = await confirmation.question(
      "\nApply these changes? [y/N] ",
    );
    confirmation.close();
    if (!/^y(es)?$/i.test(answer.trim())) {
      console.log("Aborted, no files were written.");
      return 1;
    }
  }

  await writeProjects(changes);
  if (values.install) {
    const ok = await installProjects(changes);
    if (!ok) return 1;
  } else {
    console.log(
      "\nRun `bun install` in each project above (or re-run with --install) to update the lockfiles.",
    );
  }
  return 0;
};

process.exit(await main());
