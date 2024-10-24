import { stat, writeFile } from "node:fs/promises";
import { spawn, SpawnOptions } from "node:child_process";
import { Configuration } from "./configuration";
import { join } from "node:path";
import mkcert from "mkcert";
import commandExists from "command-exists";

const COLORS = {
  FgBlack: "\x1b[30m",
  FgRed: "\x1b[31m",
  FgGreen: "\x1b[32m",
  FgYellow: "\x1b[33m",
  FgBlue: "\x1b[34m",
  FgMagenta: "\x1b[35m",
  FgCyan: "\x1b[36m",
  FgWhite: "\x1b[37m",
};

const {
  REDIS_HOST,
  REDIS_PORT,
  MONGO_URL,
  MONGO_PORT,
  USE_DOCKER,
  SILENT_DOCKER,
  DOCKER_TAGS,
  SERVER_PORT,
  VIEWER_PORT,
  REPO_PORT,
  SESSION_SECRET,
  MAILHOG_SMTP,
  MAILHOG_HTTP,
  MAIL_HOST,
  MAIL_PORT,
  MAIL_TARGETS,
  ENABLE_LDAP,
  LDAP,
  SKIP_SERVER_INIT,
  BACKEND_URL,
  PACKAGE_MANAGER,
} = Configuration;

const exists = async (path: string) =>
  stat(path)
    .then(() => true)
    .catch(() => false);

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

const sleep = (delay: number) =>
  new Promise<void>((resolve, _) => setTimeout(() => resolve(), delay));

type ExecuteOptions = {
  command: string;
  args: Array<string | number>;
  name: string;
  silent: boolean;
  cwd: string;
  shell: boolean;
};
const execute = (options: Partial<ExecuteOptions>) => {
  const defaultOpts: ExecuteOptions = {
    command: "",
    args: [],
    name: "PROCESS",
    silent: true,
    cwd: process.cwd(),
    shell: false,
  };
  const { command, cwd, args, name, silent, shell } = {
    ...defaultOpts,
    ...options,
  };
  return new Promise((resolve, reject) => {
    const stringArgs = args.map((arg) => String(arg));
    const spawnOptions: SpawnOptions = { cwd, shell };
    const ps = spawn(command, stringArgs, spawnOptions);
    if (!silent)
      ps.stdout?.on("data", (data) =>
        console.log(
          COLORS.FgMagenta,
          `[${name}]`,
          COLORS.FgWhite,
          data.toString().trimEnd(),
        ),
      );
    ps.stderr?.on("data", (data) =>
      console.log(
        COLORS.FgMagenta,
        `[${name}]`,
        COLORS.FgRed,
        data.toString().trimEnd(),
      ),
    );
    ps.on("close", (code) => {
      console.log(
        COLORS.FgMagenta,
        `[${name}]`,
        COLORS.FgYellow,
        `${command} with args [${args.join(",")}] closed with code ${code}`,
      );
      code === 0 || code === null ? resolve("Success") : reject("Failure");
    });
  });
};

// Requirements
const checkOrCreateCert = async () => {
  const keyPath = join(__dirname, "key.pem");
  const keyExists = await exists(keyPath);
  const certPath = join(__dirname, "cert.pem");
  const certExists = await exists(certPath);
  const fullchainPath = join(__dirname, "fullchain.pem");

  if (keyExists && certExists) {
    console.log(COLORS.FgMagenta, "SSL key and cert already exist");
    return;
  }

  const ca = await mkcert.createCA({
    organization: "Kompakkt.Mono Dev",
    countryCode: "DE",
    state: "NRW",
    locality: "Cologne",
    validity: 365,
  });

  const cert = await mkcert.createCert({
    domains: ["127.0.0.1", "localhost", "kompakkt.local"],
    validity: 365,
    ca: ca,
    organization: "Kompakkt.Mono Dev",
  });

  return await Promise.all([
    writeFile(keyPath, cert.key),
    writeFile(certPath, cert.cert),
    writeFile(fullchainPath, `${cert.cert}\n${ca.cert}`),
  ])
    .then(() => {
      console.log(COLORS.FgGreen, "Created SSL key and cert");
    })
    .catch((err) => {
      console.log(COLORS.FgRed, "Failed creating SSL key and cert");
      console.log(err);
      process.exit(1);
    });
};

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
      .map((dir) => join(__dirname, dir, "src", "environments.ts"))
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
  for (const repo of repos) await cloneAndInstall(repo);
  return true;
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
    args: ["run", "dev"],
    name: "SERVER",
    cwd: path,
    silent: false,
  });
};

const runRedis = () => {
  const tag = DOCKER_TAGS.REDIS;
  const args = `run --name kompakkt-redis --rm -p 127.0.0.1:${REDIS_PORT}:6379 redis:${tag}`;
  return execute({
    command: "docker",
    args: args.split(" "),
    name: "REDIS",
    silent: SILENT_DOCKER,
    shell: true,
  });
};

const runMongo = () => {
  const tag = DOCKER_TAGS.MONGO;
  const args = `run --name kompakkt-mongo --rm -v "$PWD/.mongo-data:/data/db" -p 127.0.0.1:${MONGO_PORT ?? 27017}:27017 mongo:${tag} --quiet`;
  return execute({
    command: "docker",
    args: args.split(" "),
    name: "MONGO",
    silent: SILENT_DOCKER,
    shell: true,
  });
};

const runMailHog = () => {
  const tag = DOCKER_TAGS.MAILHOG;
  const args = `run --name kompakkt-mailhog --rm -p 127.0.0.1:${MAILHOG_SMTP}:${MAILHOG_SMTP} -p 127.0.0.1:${MAILHOG_HTTP}:${MAILHOG_HTTP} mailhog/mailhog:${tag} -smtp-bind-addr :${MAILHOG_SMTP}`;
  return execute({
    command: "docker",
    args: args.split(" "),
    name: "MAILHOG",
    silent: SILENT_DOCKER,
    shell: true,
  });
};

const shutdownContainers = () => {
  return execute({
    command: "docker",
    args: "kill kompakkt-mongo kompakkt-redis kompakkt-mailhog".split(" "),
    silent: false,
    name: "KILL-CONTAINERS",
  }).catch(() => {});
};

const pullImages = () => {
  return Promise.all([
    execute({
      command: "docker",
      args: ["pull", `mongo:${DOCKER_TAGS.MONGO}`],
      name: "DOCKER-IMAGES",
      silent: false,
    }),
    execute({
      command: "docker",
      args: ["pull", `redis:${DOCKER_TAGS.REDIS}`],
      name: "DOCKER-IMAGES",
      silent: false,
    }),
    execute({
      command: "docker",
      args: ["pull", `mailhog/mailhog:${DOCKER_TAGS.MAILHOG}`],
      name: "DOCKER-IMAGES",
      silent: false,
    }),
  ]);
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

  await checkOrCreateCert();

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

  if (USE_DOCKER) {
    if (!SKIP_SERVER_INIT) {
      console.log(
        COLORS.FgCyan,
        "Pulling docker images for MongoDB, Redis & MailHog",
      );
      await pullImages();
      console.log(COLORS.FgCyan, "Starting MongoDB, Redis & MailHog");
      Promise.all([runRedis(), runMongo(), runMailHog()]).catch((error) => {
        console.log(COLORS.FgRed, "Execution failed");
        shutdownContainers().then(() => process.exit(1));
      });

      await sleep(10000);
    }

    console.log(COLORS.FgCyan, "Starting Kompakkt services");

    await Promise.all([runRepo(), runViewer(), runServer()]).catch((error) => {
      console.log(COLORS.FgRed, "Execution failed");
      shutdownContainers().then(() => process.exit(1));
    });
  } else {
    console.log(COLORS.FgCyan, "Running Kompakkt services without docker");
    await Promise.all([runRepo(), runViewer(), runServer()]).catch((error) => {
      console.log(COLORS.FgRed, "Execution failed");
    });
  }
};

process.on("SIGINT", () => {
  if (USE_DOCKER && !SKIP_SERVER_INIT) {
    console.log(
      COLORS.FgYellow,
      "Interrupt detected. Shutting down containers",
    );
    shutdownContainers()
      .then(() => {})
      .catch(() => {});
  }
});

process.on("close", (code) => {
  console.log(COLORS.FgYellow, "Exiting Kompakkt.Mono", code);
});

main();
