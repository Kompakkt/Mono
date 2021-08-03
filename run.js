const { writeFileSync } = require('fs');
const { spawn } = require('child_process');
const { join } = require('path');

const Configuration = require('./configuration');

const {
  REDIS_HOST,
  REDIS_PORT,
  MONGO_URL,
  USE_COMPOSE,
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

const SSL_ARGS = ENABLE_HTTPS
  ? ['--ssl', 'true', '--ssl-cert', SSL_CERT_FILE, '--ssl-key', SSL_KEY_FILE]
  : [];

// Helper method
const execute = (command, args, options = { cwd: process.cwd() }, silent = true) => {
  return new Promise((resolve, reject) => {
    const ps = spawn(command, args, options);
    if (!silent) ps.stdout.on('data', data => console.log(`${data}`));
    ps.stderr.on('data', data => console.log(`${data}`));
    ps.on('close', code => {
      console.log(`${command} with args [${args.join(',')}] closed with code ${code}`);
      code === 0 ? resolve('Success') : reject('Failure');
    });
  });
};

// Prepare
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
  writeFileSync(path, JSON.stringify(config));
};

const writeViewerEnvironmentFile = () => {
  const config = `
export const environment = {
  production: false,
  express_server_url: '${ENABLE_HTTPS ? 'https' : 'http'}://${PUBLIC_ADDRESS}',
  express_server_port: ${SERVER_PORT},
  version: require('../../package.json').version,
  repository: '${ENABLE_HTTPS ? 'https' : 'http'}://${PUBLIC_ADDRESS}:${REPO_PORT}',
};`.trim();
  const path = join(__dirname, 'Viewer', 'src', 'environments', 'environment.ts');

  writeFileSync(path, config);
};

const writeRepoEnvironmentFile = () => {
  const config = `
  export const environment = {
    production: true,
    kompakkt_url: '${
      ENABLE_HTTPS ? 'https' : 'http'
    }://${PUBLIC_ADDRESS}:${VIEWER_PORT}/index.html',
    express_server_url: '${ENABLE_HTTPS ? 'https' : 'http'}://${PUBLIC_ADDRESS}',
    express_server_port: ${SERVER_PORT},
    tracking: false,
    tracking_url: '',
    tracking_id: 0,
  };`.trim();
  const path = join(__dirname, 'Repo', 'src', 'environments', 'environment.ts');

  writeFileSync(path, config);
};

const installViewerPackages = () => {
  const path = join(__dirname, 'Viewer');
  return execute('npm', ['install', '--no-optional'], { cwd: path });
};

const installRepoPackages = () => {
  const path = join(__dirname, 'Repo');
  return execute('npm', ['install', '--no-optional'], { cwd: path });
};

const installServerPackages = () => {
  const path = join(__dirname, 'Server');
  return execute('npm', ['install', '--no-optional'], { cwd: path });
};

const createConfigurationFiles = () => {
  writeRepoEnvironmentFile();
  writeServerConfiguration();
  writeViewerEnvironmentFile();
};

const installPackages = () => {
  return Promise.all([installViewerPackages(), installRepoPackages(), installServerPackages()]);
};

// Run
const runViewer = () => {
  const path = join(__dirname, 'Viewer');
  const args = ['serve', '--port', VIEWER_PORT, '--disable-host-check', ...SSL_ARGS];
  return execute('ng', args, { cwd: path }, false);
};

const runRepo = () => {
  const path = join(__dirname, 'Repo');
  const args = ['serve', '--port', REPO_PORT, '--disable-host-check', ...SSL_ARGS];
  return execute('ng', args, { cwd: path }, false);
};

const runServer = () => {
  const path = join(__dirname, 'Server');
  return execute('npm', ['run', 'dev'], { cwd: path }, false);
};

const pullImages = () => {
  return Promise.all([
    execute('docker', ['pull', 'mongo:4.4'], { cwd: process.cwd() }, false),
    execute('docker', ['pull', 'redis:6.2-alpine'], { cwd: process.cwd() }, false),
  ]);
};

const runDockerCompose = () => {
  return execute('docker-compose', ['up'], { cwd: process.cwd() }, false);
};

// Main
const main = async () => {
  console.log('Writing configuration and environment files');
  createConfigurationFiles();
  console.log('Installing all packages');
  await installPackages()
    .then(codes => console.log('Sucessfully installed all packages'))
    .catch(error => console.error);

  if (USE_COMPOSE) {
    console.log('Pulling docker images for Redis and MongoDB');
    await pullImages();
    console.log('Running all applications and docker-compose');
    await Promise.all([runDockerCompose(), runRepo(), runViewer(), runServer()]);
  } else {
    console.log('Running all applications');
    await Promise.all([runRepo(), runViewer(), runServer()]);
  }
};

main();
