const { spawn } = require('child_process');
const { join } = require('path');

const { installPackages, createConfigurationFiles } = require('./prepare');
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

const SSL_ARGS = ENABLE_HTTPS
  ? ['--ssl', 'true', '--ssl-cert', SSL_CERT_FILE, '--ssl-key', SSL_KEY_FILE]
  : [];

const runViewer = () => {
  const path = join(__dirname, 'Viewer');

  return new Promise((resolve, reject) => {
    const args = ['serve', '--port', VIEWER_PORT, '--disable-host-check', ...SSL_ARGS];
    const ps = spawn('ng', args, { cwd: path });
    ps.stdout.on('data', data => console.log(`${data}`));
    ps.stderr.on('data', data => console.log(`${data}`));
    ps.on('close', code => (code === 0 ? resolve('Success') : reject('Failure')));
  });
};

const runRepo = () => {
  const path = join(__dirname, 'Repo');

  return new Promise((resolve, reject) => {
    const args = ['serve', '--port', REPO_PORT, '--disable-host-check', ...SSL_ARGS];
    const ps = spawn('ng', args, { cwd: path });
    ps.stdout.on('data', data => console.log(`${data}`));
    ps.stderr.on('data', data => console.log(`${data}`));
    ps.on('close', code => (code === 0 ? resolve('Success') : reject('Failure')));
  });
};

const runServer = () => {
  const path = join(__dirname, 'Server');

  return new Promise((resolve, reject) => {
    const ps = spawn('npm', ['run', 'dev'], { cwd: path });
    ps.stdout.on('data', data => console.log(`${data}`));
    ps.stderr.on('data', data => console.log(`${data}`));
    ps.on('close', code => (code === 0 ? resolve('Success') : reject('Failure')));
  });
};

const pullImages = () => {
  return Promise.all([
    new Promise((resolve, reject) => {
      const ps = spawn('docker', ['pull', 'mongo:4.4'], { cwd: process.cwd() });
      ps.stdout.on('data', data => console.log(`${data}`));
      ps.stderr.on('data', data => console.log(`${data}`));
      ps.on('close', code => (code === 0 ? resolve('Success') : reject('Failure')));
    }),
    new Promise((resolve, reject) => {
      const ps = spawn('docker', ['pull', 'redis:6.2-alpine'], { cwd: process.cwd() });
      ps.stdout.on('data', data => console.log(`${data}`));
      ps.stderr.on('data', data => console.log(`${data}`));
      ps.on('close', code => (code === 0 ? resolve('Success') : reject('Failure')));
    }),
  ]);
};

const runDockerCompose = () => {
  return new Promise((resolve, reject) => {
    const ps = spawn('docker-compose', ['up'], { cwd: process.cwd() });
    ps.stdout.on('data', data => console.log(`${data}`));
    ps.stderr.on('data', data => console.log(`${data}`));
    ps.on('close', code => (code === 0 ? resolve('Success') : reject('Failure')));
  });
};

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
