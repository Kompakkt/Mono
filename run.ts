import { writeFile } from "node:fs/promises";

import { Configuration } from "./configuration";
import { join } from "node:path";
import commandExists from "command-exists";
import { execute, exists, sleep } from "./modules/utils";
import { COLORS } from "./modules/colors";
import { checkOrCreateCert } from "./modules/ssl";
import { waitForServices } from "./modules/healthcheck";

const {
  REDIS_HOST,
  REDIS_PORT,
  MONGO_URL,
  USE_COMPOSE,
  SERVER_PORT,
  VIEWER_PORT,
  REPO_PORT,
  SESSION_SECRET,
  MAIL_HOST,
  MAIL_PORT,
  MAIL_TARGETS,
  ENABLE_LDAP,
  LDAP,
  SKIP_SERVER_INIT,
  BACKEND_URL,
  PACKAGE_MANAGER,
} = Configuration;

const getGitURL = (repository: string) =>
  `https://github.com/Kompakkt/${repository}.git`;

// Helper method
const getSSLPair = () => {
  return {
    key: join(__dirname, "key.pem"),
    cert: join(__dirname, "cert.pem"),
  };
};

const SSL_ARGS = [
  "--ssl",
  "true",
  "--ssl-cert",
  getSSLPair().cert,
  "--ssl-key",
  getSSLPair().key,
];

// Requirements
const checkRequirements = async () => {
  const check = (cmd: string) =>
    commandExists(cmd)
      .then(() => {})
      .catch(() => `Could not find '${cmd}'`);
  const commands = ["git", PACKAGE_MANAGER];
  if (!SKIP_SERVER_INIT) {
    commands.push("docker");
  }
  return (await Promise.all(commands.map(check))).filter((_) => _);
};

// Configuration files
const writeServerConfiguration = () => {
  if (SKIP_SERVER_INIT) return Promise.resolve();

  const { key, cert } = getSSLPair();
  const config = {
    Mongo: {
      ClientURL: MONGO_URL,
    },
    Redis: {
      Hostname: REDIS_HOST,
      Port: REDIS_PORT,
    },
    Express: {
      Host: "0.0.0.0",
      Port: SERVER_PORT,
      PassportSecret: SESSION_SECRET,
      PublicIP: "localhost",
      enableHTTPS: true,
      SSLPaths: {
        PrivateKey: key,
        Certificate: cert,
      },
      LDAP: ENABLE_LDAP ? LDAP : undefined,
    },
    Mailer: {
      Host: MAIL_HOST,
      Port: MAIL_PORT,
      Target: MAIL_TARGETS,
    },
  };

  const path = join(__dirname, "Server", "src", "config.json");
  return writeFile(path, JSON.stringify(config));
};

const writeEnvironmentFiles = () => {
  const server_url = SKIP_SERVER_INIT
    ? BACKEND_URL
    : `https://localhost:${SERVER_PORT}/`;

  const config = `
  export const environment = {
    production: true,
    viewer_url: 'https://localhost:${VIEWER_PORT}/index.html',
    repo_url: 'https://localhost:${REPO_PORT}/',
    server_url: '${server_url}',
    tracking: false,
    tracking_url: '',
    tracking_id: 0,
  };`.trim();

  return Promise.all(
    ["Repo", "Viewer"]
      .map((dir) => join(__dirname, dir, "src", "environment.ts"))
      .map((path) => writeFile(path, config)),
  );
};

const cloneAndInstall = async (repository: string) => {
  const path = join(__dirname, repository);
  if (!(await exists(path))) {
    await execute({
      command: "git",
      args: ["clone", "--recursive", getGitURL(repository), repository],
      name: "installer",
    });
  }

  return execute({
    command: PACKAGE_MANAGER,
    args: ["install"].concat(
      PACKAGE_MANAGER === "npm"
        ? ["--no-optional", "--quiet", "--no-progress"]
        : [],
    ),
    name: repository,
    cwd: path,
  });
};

const createConfigurationFiles = () => {
  return Promise.all([writeEnvironmentFiles(), writeServerConfiguration()]);
};

const installPackages = async () => {
  const repos = ["Viewer", "Repo"];
  if (!SKIP_SERVER_INIT) {
    repos.push("Server");
  }
  return Promise.all(repos.map(cloneAndInstall))
    .then(() => true)
    .catch((err) => {
      console.error(err);
      return false;
    });
};

// Run
const runViewer = () => {
  const path = join(__dirname, "Viewer");
  const args = ["run", "ng", "--", "serve", "--port", VIEWER_PORT, ...SSL_ARGS];
  return execute({
    command: PACKAGE_MANAGER,
    args,
    name: "VIEWER",
    cwd: path,
    silent: false,
  });
};

const runRepo = () => {
  const path = join(__dirname, "Repo");
  const args = ["run", "ng", "--", "serve", "--port", REPO_PORT, ...SSL_ARGS];
  return execute({
    command: PACKAGE_MANAGER,
    args,
    name: "REPO",
    cwd: path,
    silent: false,
  });
};

const runServer = () => {
  if (SKIP_SERVER_INIT) return Promise.resolve();
  const path = join(__dirname, "Server");
  return execute({
    command: PACKAGE_MANAGER,
    args: ["start"],
    name: "SERVER",
    cwd: path,
    silent: false,
  });
};

const pullImages = () => {
  return execute({
    command: "docker-compose",
    args: ["pull"],
    name: "DOCKER-COMPOSE",
    silent: false,
  });
};

const runCompose = () => {
  return execute({
    command: "docker-compose",
    args: ["up", "-d"],
    name: "DOCKER-COMPOSE",
    silent: false,
  });
};

const convertConfigToEnv = () => {
  const config = {
    MONGO_URL: MONGO_URL,
    REDIS_IMAGE: Configuration.DOCKER_IMAGES.REDIS_IMAGE,
    MONGO_IMAGE: Configuration.DOCKER_IMAGES.MONGO_IMAGE,
    MAILHOG_IMAGE: Configuration.DOCKER_IMAGES.MAILHOG_IMAGE,
  };

  const configAsString = Object.entries(config)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  return writeFile(join(__dirname, ".env"), configAsString);
};

// Main
const main = async () => {
  console.log(COLORS.FgCyan, "Starting Kompakkt Mono");

  console.log(COLORS.FgCyan, "Checking system requirements");

  const missing = await checkRequirements();

  if (missing.length > 0) {
    console.log(COLORS.FgRed, "The following requirements are not met:");
    console.log(COLORS.FgYellow, missing.join("\n"));
    console.log(COLORS.FgRed, "Aborting");
    return;
  } else {
    console.log(COLORS.FgGreen, "All requirements met");
  }

  await checkOrCreateCert(__dirname);

  await convertConfigToEnv();

  console.log(
    COLORS.FgYellow,
    "Note: if the repositories have already been cloned, this does not pull the latest version",
  );

  console.log(
    COLORS.FgCyan,
    "Cloning (if necessary) and installing all packages",
  );
  await installPackages()
    .then((codes) => console.log(COLORS.FgGreen, "Success"))
    .catch((error) => console.log(COLORS.FgRed, "Failure", error));

  console.log(COLORS.FgCyan, "Writing configuration and environment files");
  await createConfigurationFiles();

  if (USE_COMPOSE) {
    if (!SKIP_SERVER_INIT) {
      console.log(
        COLORS.FgCyan,
        "Pulling docker images for MongoDB, Redis & MailHog",
      );
      await pullImages();
      console.log(COLORS.FgCyan, "Starting Docker Compose");
      await runCompose().catch((error) => {
        console.log(COLORS.FgRed, "Execution failed");
        process.exit(1);
      });

      try {
        await waitForServices();
      } catch (error) {
        console.log(COLORS.FgRed, "Services failed to start");
        process.exit(1);
      }
    }

    console.log(COLORS.FgCyan, "Starting Kompakkt services");

    await Promise.all([runRepo(), runViewer(), runServer()]).catch((error) => {
      console.log(COLORS.FgRed, "Execution failed");
      process.exit(1);
    });
  } else {
    console.log(COLORS.FgCyan, "Running Kompakkt services without docker");
    await Promise.all([runRepo(), runViewer(), runServer()]).catch((error) => {
      console.log(COLORS.FgRed, "Execution failed");
    });
  }
};

process.on("close", (code) => {
  console.log(COLORS.FgYellow, "Exiting Kompakkt.Mono", code);
});

main();
