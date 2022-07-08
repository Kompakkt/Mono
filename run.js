const { existsSync, writeFile } = require('fs');
const { spawn } = require('child_process');
const { join } = require('path');
const mkcert = require('mkcert');
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
  MONGO_PORT,
  USE_DOCKER,
  SILENT_DOCKER,
  DOCKER_TAGS,
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

const getGitURL = repository => `https://github.com/Kompakkt/${repository}.git`;

// Helper method
const getSSLPair = () => {
  return {
    key: join(__dirname, 'key.pem'),
    cert: join(__dirname, 'cert.pem'),
  };
};

const SSL_ARGS = ['--ssl', 'true', '--ssl-cert', getSSLPair().cert, '--ssl-key', getSSLPair().key];

const sleep = delay =>
  new Promise((resolve, _) =>
    setTimeout(() => {
      resolve();
    }, delay),
  );

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
const checkOrCreateCert = async () => {
  const keyPath = join(__dirname, 'key.pem');
  const keyExists = existsSync(keyPath);
  const certPath = join(__dirname, 'cert.pem');
  const certExists = existsSync(certPath);
  const fullchainPath = join(__dirname, 'fullchain.pem');

  if (keyExists && certExists) {
    console.log(COLORS.FgMagenta, 'SSL key and cert already exist');
    return;
  }

  const ca = await mkcert.createCA({
    organization: 'Kompakkt.Mono Dev CA',
    countryCode: 'DE',
    state: 'NRW',
    locality: 'Cologne',
    validityDays: 365,
  });

  const cert = await mkcert.createCert({
    domains: ['127.0.0.1', 'localhost'],
    validityDays: 365,
    caKey: ca.key,
    caCert: ca.cert,
  });

  return await Promise.all([
    writeFileWrapper(keyPath, cert.key),
    writeFileWrapper(certPath, cert.cert),
    writeFileWrapper(fullchainPath, `${cert.cert}\n${ca.cert}`),
  ])
    .then(() => {
      console.log(COLORS.FgGreen, 'Created SSL key and cert');
    })
    .catch(err => {
      console.log(COLORS.FgRed, 'Failed creating SSL key and cert');
      console.log(err);
      process.exit(1);
    });
};

const checkRequirements = async () => {
  const check = cmd =>
    commandExists(cmd)
      .then(() => {})
      .catch(() => `Could not find '${cmd}'`);

  const commands = ['git', PACKAGE_MANAGER, 'node', 'docker', 'ng'];
  return (await Promise.all(commands.map(check))).filter(_ => _);
};

// Configuration files
const writeServerConfiguration = () => {
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
      Host: '0.0.0.0',
      Port: SERVER_PORT,
      PassportSecret: SESSION_SECRET,
      PublicIP: 'localhost',
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

  const path = join(__dirname, 'Server', 'src', 'config.json');
  return writeFileWrapper(path, JSON.stringify(config));
};

const writeViewerEnvironmentFile = () => {
  const server_url = SKIP_SERVER_INIT ? BACKEND_URL : `https://localhost:${SERVER_PORT}/`;

  const config = `
export const environment = {
  production: false,
  server_url: '${server_url}',
  version: require('../../package.json').version,
  repo_url: 'https://localhost:${REPO_PORT}/',
};`.trim();
  const path = join(__dirname, 'Viewer', 'src', 'environments', 'environment.ts');

  return writeFileWrapper(path, config);
};

const writeRepoEnvironmentFile = () => {
  const server_url = SKIP_SERVER_INIT ? BACKEND_URL : `https://localhost:${SERVER_PORT}/`;

  const config = `
  export const environment = {
    production: true,
    viewer_url: 'https://localhost:${VIEWER_PORT}/index.html',
    server_url: '${server_url}',
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
    command: PACKAGE_MANAGER,
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
  if (SKIP_SERVER_INIT) return undefined;
  const path = join(__dirname, 'Server');
  return execute({
    command: PACKAGE_MANAGER,
    args: ['run', 'dev'],
    name: 'SERVER',
    cwd: path,
    silent: false,
  });
};

// Example:
// docker run --name kompakkt-redis --rm -p "127.0.0.1:6379:6379" redis:6.2
const runRedis = () => {
  const tag = DOCKER_TAGS.REDIS;
  const args = `run --name kompakkt-redis --rm -p 127.0.0.1:${REDIS_PORT}:6379 redis:${tag}`;
  return execute({
    command: 'docker',
    args: args.split(' '),
    name: 'REDIS',
    silent: SILENT_DOCKER,
    shell: true,
  });
};

// Example
// docker run --name kompakkt-mongo --rm -v "$PWD/.mongo-data:/data/db" -p "127.0.0.1:27017:27017" mongo:4.4
const runMongo = () => {
  const tag = DOCKER_TAGS.MONGO;
  const args = `run --name kompakkt-mongo --rm -v "$PWD/.mongo-data:/data/db" -p 127.0.0.1:${MONGO_PORT ?? 27017}:27017 mongo:${tag} --quiet`;
  return execute({
    command: 'docker',
    args: args.split(' '),
    name: 'MONGO',
    silent: SILENT_DOCKER,
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

  await checkOrCreateCert();

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
    if (!SKIP_SERVER_INIT) {
      console.log(COLORS.FgCyan, 'Pulling docker images for Redis and MongoDB');
      await pullImages();
      console.log(COLORS.FgCyan, 'Starting Redis and MongoDB');
      Promise.all([runRedis(), runMongo()]).catch(error => {
        console.log(COLORS.FgRed, 'Execution failed');
        shutdownContainers().then(() => process.exit(1));
      });

      await sleep(10000);
    }

    console.log(COLORS.FgCyan, 'Starting Kompakkt services');

    await Promise.all([runRepo(), runViewer(), runServer()]).catch(error => {
      console.log(COLORS.FgRed, 'Execution failed');
      shutdownContainers().then(() => process.exit(1));
    });
  } else {
    console.log(COLORS.FgCyan, 'Running Kompakkt services without docker');
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
