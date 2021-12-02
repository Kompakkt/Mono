const { existsSync, writeFile } = require('fs');
const { spawn } = require('child_process');
const { join } = require('path');
const commandExists = require('command-exists');

const Configuration = require('./configuration');

const COLORS = {
  FgBlack: '\x1b[30m',
  FgRed: '\x1b[31m',
  FgGreen: '\x1b[32m',
  FgYellow: '\x1b[33m',
  FgBlue: '\x1b[34m',
  FgMagenta: '\x1b[35m',
  FgCyan: '\x1b[36m',
  FgWhite: '\x1b[37m',
};

const {
  REDIS_HOST,
  REDIS_PORT,
  MONGO_URL,
  USE_DOCKER,
  DOCKER_TAGS,
  SERVER_PORT,
  VIEWER_PORT,
  REPO_PORT,
  SESSION_SECRET,
  ENABLE_HTTPS,
  PUBLIC_ADDRESS,
  SSL_KEY_FILE,
  SSL_CERT_FILE,
  MAIL_HOST,
  MAIL_PORT,
  MAIL_TARGETS,
  ENABLE_LDAP,
  LDAP,
} = Configuration;

const getGitURL = repository => `https://github.com/Kompakkt/${repository}.git`;

const SSL_ARGS = ENABLE_HTTPS
  ? ['--ssl', 'true', '--ssl-cert', SSL_CERT_FILE, '--ssl-key', SSL_KEY_FILE]
  : [];

// Helper method
const execute = options => {
  const defaultOpts = {
    command: '',
    args: [],
    name: 'PROCESS',
    silent: true,
    cwd: process.cwd(),
    shell: false,
  };
  const { command, cwd, args, name, silent, shell } = { ...defaultOpts, ...options };
  return new Promise((resolve, reject) => {
    const ps = spawn(command, args, { cwd, shell });
    if (!silent)
      ps.stdout.on('data', data =>
        console.log(COLORS.FgMagenta, `[${name}]`, COLORS.FgWhite, data.toString().trimEnd()),
      );
    ps.stderr.on('data', data =>
      console.log(COLORS.FgMagenta, `[${name}]`, COLORS.FgRed, data.toString().trimEnd()),
    );
    ps.on('close', code => {
      console.log(
        COLORS.FgMagenta,
        `[${name}]`,
        COLORS.FgYellow,
        `${command} with args [${args.join(',')}] closed with code ${code}`,
      );
      code === 0 || code === null ? resolve('Success') : reject('Failure');
    });
  });
};

const writeFileWrapper = (path, data) =>
  new Promise((resolve, reject) =>
    writeFile(path, data, err => {
      if (err) return reject(err);
      return resolve();
    }),
  );

// Requirements
const checkRequirements = async () => {
  const check = cmd =>
    commandExists(cmd)
      .then(() => {})
      .catch(() => `Could not find '${cmd}'`);

  const commands = ['git', 'npm', 'node', 'docker', 'ng'];
  return (await Promise.all(commands.map(check))).filter(_ => _);
};

// Configuration files
const writeServerConfiguration = () => {
  const config = {
    Mongo: {
      ClientURL: MONGO_URL,
    },
    Redis: {
      Hostname: REDIS_HOST,
      Port: REDIS_PORT,
    },
    Express: {
      Host: '0.0.0.0',
      Port: SERVER_PORT,
      PassportSecret: SESSION_SECRET,
      PublicIP: PUBLIC_ADDRESS,
      enableHTTPS: ENABLE_HTTPS,
      SSLPaths: ENABLE_HTTPS
        ? {
            PrivateKey: SSL_KEY_FILE,
            Certificate: SSL_CERT_FILE,
          }
        : undefined,
      LDAP: ENABLE_LDAP ? LDAP : undefined,
    },
    Mailer: {
      Host: MAIL_HOST,
      Port: MAIL_PORT,
      Target: MAIL_TARGETS,
    },
  };

  const path = join(__dirname, 'Server', 'src', 'config.json');
  return writeFileWrapper(path, JSON.stringify(config));
};

const writeViewerEnvironmentFile = () => {
  const config = `
export const environment = {
  production: false,
  server_url: '${ENABLE_HTTPS ? 'https' : 'http'}://${PUBLIC_ADDRESS}:${SERVER_PORT}/',
  version: require('../../package.json').version,
  repo_url: '${ENABLE_HTTPS ? 'https' : 'http'}://${PUBLIC_ADDRESS}:${REPO_PORT}/',
};`.trim();
  const path = join(__dirname, 'Viewer', 'src', 'environments', 'environment.ts');

  return writeFileWrapper(path, config);
};

const writeRepoEnvironmentFile = () => {
  const config = `
  export const environment = {
    production: true,
    viewer_url: '${ENABLE_HTTPS ? 'https' : 'http'}://${PUBLIC_ADDRESS}:${VIEWER_PORT}/index.html',
    server_url: '${ENABLE_HTTPS ? 'https' : 'http'}://${PUBLIC_ADDRESS}:${SERVER_PORT}/',
    tracking: false,
    tracking_url: '',
    tracking_id: 0,
  };`.trim();
  const path = join(__dirname, 'Repo', 'src', 'environments', 'environment.ts');

  return writeFileWrapper(path, config);
};

const cloneAndInstall = async repository => {
  const path = join(__dirname, repository);
  if (!existsSync(path)) {
    await execute({
      command: 'git',
      args: ['clone', '--recursive', getGitURL(repository), repository],
      name: 'installer',
    });
  }

  return execute({
    command: 'npm',
    args: ['install', '--no-optional', '--quiet', '--no-progress'],
    name: repository,
    cwd: path,
  });
};

const createConfigurationFiles = () => {
  return Promise.all([
    writeRepoEnvironmentFile(),
    writeServerConfiguration(),
    writeViewerEnvironmentFile(),
  ]);
};

const installPackages = () => {
  return Promise.all([
    cloneAndInstall('Viewer'),
    cloneAndInstall('Repo'),
    cloneAndInstall('Server'),
  ]);
};

// Run
const runViewer = () => {
  const path = join(__dirname, 'Viewer');
  const args = ['serve', '--port', VIEWER_PORT, '--disable-host-check', ...SSL_ARGS];
  return execute({
    command: 'ng',
    args,
    name: 'VIEWER',
    cwd: path,
    silent: false,
  });
};

const runRepo = () => {
  const path = join(__dirname, 'Repo');
  const args = ['serve', '--port', REPO_PORT, '--disable-host-check', ...SSL_ARGS];
  return execute({
    command: 'ng',
    args,
    name: 'REPO',
    cwd: path,
    silent: false,
  });
};

const runServer = () => {
  const path = join(__dirname, 'Server');
  return execute({
    command: 'npm',
    args: ['run', 'dev'],
    name: 'SERVER',
    cwd: path,
    silent: false,
  });
};

// Example:
// docker run --name kompakkt-redis --rm -p "127.0.0.1:6379:6379" redis:6.2
const runRedis = () => {
  // TODO: Configurable IP and Port?
  const tag = DOCKER_TAGS.REDIS;
  const args = `run --name kompakkt-redis --rm -p 127.0.0.1:6379:6379 redis:${tag}`;
  return execute({
    command: 'docker',
    args: args.split(' '),
    name: 'REDIS',
    silent: false,
    shell: true,
  });
};

// Example
// docker run --name kompakkt-mongo --rm -v "$PWD/.mongo-data:/data/db" -p "127.0.0.1:27017:27017" mongo:4.4
const runMongo = () => {
  // TODO: Configurable IP and Port?
  const tag = DOCKER_TAGS.MONGO;
  const args = `run --name kompakkt-mongo --rm -v "$PWD/.mongo-data:/data/db" -p 127.0.0.1:27017:27017 mongo:${tag}`;
  return execute({
    command: 'docker',
    args: args.split(' '),
    name: 'MONGO',
    silent: false,
    shell: true,
  });
};

const shutdownContainers = () => {
  return execute({
    command: 'docker',
    args: 'kill kompakkt-mongo kompakkt-redis'.split(' '),
    silent: false,
    name: 'KILL-CONTAINERS',
  });
};

const pullImages = () => {
  return Promise.all([
    execute({
      command: 'docker',
      args: ['pull', `mongo:${DOCKER_TAGS.MONGO}`],
      name: 'DOCKER-IMAGES',
      silent: false,
    }),
    execute({
      command: 'docker',
      args: ['pull', `redis:${DOCKER_TAGS.REDIS}`],
      name: 'DOCKER-IMAGES',
      silent: false,
    }),
  ]);
};

// Main
const main = async () => {
  console.log(COLORS.FgCyan, 'Starting Kompakkt Mono');

  console.log(COLORS.FgCyan, 'Checking system requirements');

  const missing = await checkRequirements();

  if (missing.length > 0) {
    console.log(COLORS.FgRed, 'The following requirements are not met:');
    console.log(COLORS.FgYellow, missing.join('\n'));
    console.log(COLORS.FgRed, 'Aborting');
    return;
  } else {
    console.log(COLORS.FgGreen, 'All requirements met');
  }

  console.log(
    COLORS.FgYellow,
    'Note: if the repositories have already been cloned, this does not pull the latest version',
  );

  console.log(COLORS.FgCyan, 'Cloning (if necessary) and installing all packages');
  await installPackages()
    .then(codes => console.log(COLORS.FgGreen, 'Success'))
    .catch(error => console.log(COLORS.FgRed, 'Failure', error));

  console.log(COLORS.FgCyan, 'Writing configuration and environment files');
  await createConfigurationFiles();

  if (USE_DOCKER) {
    console.log(COLORS.FgCyan, 'Pulling docker images for Redis and MongoDB');
    await pullImages();
    console.log(COLORS.FgCyan, 'Running kompakkt services and docker');
    await Promise.all([runRedis(), runMongo(), runRepo(), runViewer(), runServer()]).catch(
      error => {
        console.log(COLORS.FgRed, 'Execution failed');
        shutdownContainers().then(() => process.exit(1));
      },
    );
  } else {
    console.log(COLORS.FgCyan, 'Running kompakkt services without docker');
    await Promise.all([runRepo(), runViewer(), runServer()]).catch(error => {
      console.log(COLORS.FgRed, 'Execution failed');
    });
  }
};

process.on('SIGINT', () => {
  if (USE_DOCKER) {
    console.log(COLORS.FgYellow, 'Interrupt detected. Shutting down containers');
    shutdownContainers()
      .then(() => {})
      .catch(() => {});
  }
});

process.on('close', code => {
  console.log(COLOR.FgYellow, 'Exiting Kompakkt.Mono', code);
});

main();
