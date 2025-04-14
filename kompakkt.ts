#! /usr/bin/env bun

import { $ } from "bun";
import { mkdir } from "node:fs/promises";
import { parseArgs } from "node:util";

const typedObjectEntries = <T extends Record<string, any>>(
  obj: T,
): [keyof T, T[keyof T]][] => {
  return Object.entries(obj) as [keyof T, T[keyof T]][];
};

const commandExists = async (command: string): Promise<boolean> => {
  try {
    const result = await $`whereis ${command}`.text();
    if (result.split(" ").length > 1) {
      return true;
    } else {
      return false;
    }
  } catch {
    return false;
  }
};

const checkDependencies = async (): Promise<void> => {
  const dependencies = ["git", "docker"];
  for (const dependency of dependencies) {
    const exists = await commandExists(dependency);
    if (!exists) {
      throw new Error(`Dependency ${dependency} not found`);
    }
  }
};

const setupRepos = async (): Promise<void> => {
  const repos = {
    Server: {
      branch: "test-bun-runtime",
      url: "https://github.com/Kompakkt/Server.git",
    },
    Repo: {
      branch: "debug-plugin-test",
      url: "https://github.com/Kompakkt/Repo.git",
    },
    Viewer: {
      branch: "debug-plugin-test",
      url: "https://github.com/Kompakkt/Viewer.git",
    },
  } as const;

  for (const [name, { url, branch }] of typedObjectEntries(repos)) {
    console.log(`Cloning ${name}...`);
    try {
      await $`git clone --recurse-submodules -j8 -b ${branch} ${url} ${name}`;
    } catch (error) {
      console.error(`Failed to clone ${name}: ${error}`);
    }
  }
};

const setupBaseImage = async (): Promise<void> => {
  console.log("Setting up base image...");
  try {
    await $`UID=$(id -u) GID=$(id -g) docker buildx build -t kompakkt/bun-base-image:latest -f bun-base-image.Dockerfile .`;
  } catch (error) {
    console.error(`Failed to build base image: ${error}`);
  }
};

const up = async (): Promise<void> => {
  console.log("Starting deployment...");
  try {
    await $`UID=$(id -u) GID=$(id -g) docker compose up --build -d`.env({
      COMPOSE_BAKE: "true",
    });
  } catch (error) {
    console.error(`Failed to start deployment: ${error}`);
  }
};

const down = async (): Promise<void> => {
  console.log("Stopping deployment...");
  try {
    await $`UID=$(id -u) GID=$(id -g) docker compose down`;
  } catch (error) {
    console.error(`Failed to stop deployment: ${error}`);
  }
};

const compose = async (args: string[]): Promise<void> => {
  console.log("Passing arguments to docker compose...");
  try {
    await $`UID=$(id -u) GID=$(id -g) docker compose ${args}`;
  } catch (error) {
    console.error(`Failed to pass arguments to docker compose: ${error}`);
  }
};

const printUsage = () => {
  console.log(
    `
Usage: kompakkt [command]
Commands:
- setup     Setup repos and build base image
- up        Start deployment
- down      Stop deployment
- compose   Pass arguments to docker compose
`
      .trim()
      .split("\n")
      .map((line) => line.trim())
      .join("\n"),
  );
};

const { tokens } = parseArgs({
  args: Bun.argv,
  options: {},
  strict: false,
  allowPositionals: true,
  tokens: true,
});

const positionalTokens = tokens.filter((t) => t.kind === "positional");
const positionalArgs = positionalTokens
  .slice(positionalTokens.findIndex((t) => t.value === import.meta.path) + 1)
  .map((t) => t.value);

if (positionalArgs.length === 0) {
  console.error("No positional arguments provided");
  printUsage();
  process.exit(1);
} else {
  await checkDependencies();

  const firstArg = positionalArgs[0];
  switch (firstArg) {
    case "setup":
      await Promise.all([
        mkdir("uploads/", { recursive: true }),
        setupBaseImage(),
        setupRepos(),
      ]);
      break;
    case "up":
      await up();
      break;
    case "down":
      await down();
      break;
    case "compose":
      await compose(positionalArgs.slice(1));
      break;
    default:
      console.error(`Unknown command: ${firstArg}`);
      printUsage();
      process.exit(1);
  }
}
