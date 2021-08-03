const { writeFileSync } = require('fs');
const { join } = require('path');
const { spawn } = require('child_process');

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
} = Configuration;

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

  return new Promise((resolve, reject) => {
    const ps = spawn('npm', ['install', '--no-optional'], { cwd: path });
    // ps.stdout.on('data', data => console.log(`${data}`));
    ps.stderr.on('data', data => console.log(`${data}`));
    ps.on('close', code => (code === 0 ? resolve('Success') : reject('Failure')));
  });
};

const installRepoPackages = () => {
  const path = join(__dirname, 'Repo');

  return new Promise((resolve, reject) => {
    const ps = spawn('npm', ['install', '--no-optional'], { cwd: path });
    // ps.stdout.on('data', data => console.log(`${data}`));
    ps.stderr.on('data', data => console.log(`${data}`));
    ps.on('close', code => (code === 0 ? resolve('Success') : reject('Failure')));
  });
};

const installServerPackages = () => {
  const path = join(__dirname, 'Server');

  return new Promise((resolve, reject) => {
    const ps = spawn('npm', ['install', '--no-optional'], { cwd: path });
    // ps.stdout.on('data', data => console.log(`${data}`));
    ps.stderr.on('data', data => console.log(`${data}`));
    ps.on('close', code => (code === 0 ? resolve('Success') : reject('Failure')));
  });
};

module.exports = {
  createConfigurationFiles: () => {
    writeRepoEnvironmentFile();
    writeServerConfiguration();
    writeViewerEnvironmentFile();
  },
  installPackages: () => {
    return Promise.all([installViewerPackages(), installRepoPackages(), installServerPackages()]);
  },
};
