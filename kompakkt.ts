#! /usr/bin/env bun

import { $ } from "bun";
import { mkdir, rmdir } from "node:fs/promises";
import { parseArgs } from "node:util";

const BASE_IMAGE_TAG = "kompakkt/bun-base-image:latest";

const REPOS = {
  Server: {
    branch: "main",
    url: "https://github.com/Kompakkt/Server.git",
  },
  Repo: {
    branch: "sk-main",
    url: "https://github.com/Kompakkt/Repo.git",
  },
  Viewer: {
    branch: "sk-main",
    url: "https://github.com/Kompakkt/Viewer.git",
  },
} as const;

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

const baseImageExists = async (): Promise<boolean> => {
  try {
    const result = await $`docker images -q ${BASE_IMAGE_TAG}`.text();
    return result.trim().length > 0;
  } catch {
    return false;
  }
};

const getBaseImageAge = async (): Promise<number | null> => {
  try {
    const result =
      await $`docker inspect --format='{{.Created}}' ${BASE_IMAGE_TAG}`.text();
    const createdDate = new Date(result.trim());
    const now = new Date();
    const ageInDays =
      (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
    return ageInDays;
  } catch {
    return null;
  }
};

const isBaseImageOld = async (): Promise<boolean> => {
  const age = await getBaseImageAge();
  return age !== null && age > 7;
};

const shouldUpdateBaseImage = async (): Promise<boolean> => {
  const exists = await baseImageExists();
  if (!exists) {
    console.log("Base image doesn't exist, will build it...");
    return true;
  }

  const isOld = await isBaseImageOld();
  if (isOld) {
    console.log("Base image is older than 7 days, will update it...");
    return true;
  }

  return false;
};

const setupRepos = async (): Promise<void> => {
  for (const [name, { url, branch }] of typedObjectEntries(REPOS)) {
    console.log(`Cloning ${name}...`);
    try {
      await $`git clone --recurse-submodules -j8 -b ${branch} ${url} ${name}`;
    } catch (error) {
      console.error(`Failed to clone ${name}: ${error}`);
    }
  }
};

const updateRepos = async (): Promise<void> => {
  for (const [name, { url, branch }] of typedObjectEntries(REPOS)) {
    console.log(`Updating ${name}...`);
    try {
      await $`git -C ${name} pull`;
    } catch (error) {
      console.error(`Failed to update ${name}: ${error}`);
    }
  }
};

const updateBaseImage = async (reason = "Updating"): Promise<void> => {
  console.log(`${reason} base image...`);
  try {
    await $`UID=$(id -u) GID=$(id -g) docker buildx build --no-cache -t ${BASE_IMAGE_TAG} -f bun-base-image.Dockerfile .`.quiet();
  } catch (error) {
    console.error(`Failed ${reason.toLowerCase()} base image: ${error}`);
  }
};

const ensureEnvFile = async (): Promise<void> => {
  const envFileExists = await Bun.file(".env").exists();
  if (!envFileExists) {
    console.log("Creating .env file...");
    try {
      await Bun.file(".env").write(`# Kompakkt environment variables\n`);
    } catch (error) {
      console.error(`Failed to create .env file: ${error}`);
    }
  }

  const envContent = await Bun.file(".env").text();
  const lines = envContent.split("\n");
  if (!lines.some((line) => line.includes("CADDY_REPORTING_DOMAIN"))) {
    console.log("Adding CADDY_REPORTING_DOMAIN to .env file...");
    lines.push(
      "# Automatically added, change this to the actual domain you want to send CSP reports to",
      "CADDY_REPORTING_DOMAIN=https://kompakkt.de",
    );

    try {
      await Bun.file(".env").write(lines.join("\n") + "\n");
    } catch (error) {
      console.error(`Failed to update .env file: ${error}`);
    }
  }
};

const up = async (): Promise<void> => {
  console.log("Starting deployment...");
  try {
    await ensureEnvFile();

    if (await shouldUpdateBaseImage()) {
      await updateBaseImage("Setting up");
    }

    await $`UID=$(id -u) GID=$(id -g) docker compose --env-file .env up --build -d`.env(
      {
        COMPOSE_BAKE: "true",
      },
    );
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

const pull = async (): Promise<void> => {
  console.log("Pulling images...");
  const dockerComposeContent = await Bun.file("docker-compose.yml").text();
  const { services: serviceMap } = Bun.YAML.parse(dockerComposeContent) as {
    services: Record<string, { image?: string }>;
  };
  const serviceNames = Object.entries(serviceMap)
    .filter(
      ([key, value]) => !!value.image && !value.image.includes(BASE_IMAGE_TAG),
    )
    .map(([key]) => key);
  try {
    await $`UID=$(id -u) GID=$(id -g) docker pull docker.io/node:lts-slim`;
    await $`UID=$(id -u) GID=$(id -g) docker compose pull ${serviceNames}`;
  } catch (error) {
    console.error(`Failed to pull images: ${error}`);
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

const clean = async (): Promise<void> => {
  console.log(
    "Stopping deployment and removing cloned repositories and volumes...",
  );
  try {
    await $`UID=$(id -u) GID=$(id -g) docker compose down`;
    await $`UID=$(id -u) GID=$(id -g) docker compose rm -v`;
    for (const [name, { url, branch }] of typedObjectEntries(REPOS)) {
      await rmdir(`${name}`, { recursive: true });
    }
  } catch (error) {
    console.error(
      `Failed to stop deployment and remove cloned repositories and volumes: ${error}`,
    );
  }
};

const logs = async (services: string[]) => {
  await $`UID=$(id -u) GID=$(id -g) docker compose logs ${services} -f --no-log-prefix`;
};

const printUsage = () => {
  console.log(
    `
Usage: kompakkt [command]
Commands:
- setup               Setup repos and build base image
- update              Update repos and rebuild base image
- update-base-image   Update base image
- update-repos        Update repositories
- up                  Start deployment (auto-builds/updates base image if needed)
- down                Stop deployment
- pull                Pull docker images
- compose             Pass arguments to docker compose
- clean               Stop deployment and remove cloned repositories and volumes
- logs [services]     Follow logs of specified services (default: all services)
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
        updateBaseImage("Setting up"),
        setupRepos(),
      ]);
      break;
    case "update":
      await Promise.all([updateBaseImage(), updateRepos()]);
      break;
    case "update-base-image":
      await updateBaseImage();
      break;
    case "update-repos":
      await updateRepos();
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
    case "pull":
      await pull();
      break;
    case "clean":
      await clean();
      break;
    case "logs":
      const services = positionalArgs;
      await logs(services.slice(1));
      break;
    default:
      console.error(`Unknown command: ${firstArg}`);
      printUsage();
      process.exit(1);
  }
}
