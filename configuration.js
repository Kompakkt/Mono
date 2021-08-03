// Note: there is no point in running this file by itself,,
// as it only sets environment variables for the main script file

const Configuration = {
  //#############
  //## GENERAL ##
  //#############
  SERVER_PORT: 8080,
  VIEWER_PORT: 8100,
  REPO_PORT: 4200,
  SESSION_SECRET: 'changeme',

  //#####################
  //## MongoDB & Redis ##
  //#####################
  // Default: expects you to have your own redis and MongoDB instances
  USE_SELFHOSTED: true,

  // If you have docker-compose installed, you can enable this
  // option to run MongoDB and Redis using the provided compose file
  USE_COMPOSE: false,

  // If you have docker/podman installed, but not docker-compose,
  // you can enable this option to run MongoDB and Redis
  // inside of docker containers
  USE_DOCKER: false,

  // Note: If using Docker or Docker Compose,
  // only MongoDB and Redis will be run in containers
  // so these settings still need to be configured
  REDIS_HOST: 'localhost',
  REDIS_PORT: 6379,
  MONGO_URL: 'mongodb://localhost:27017',

  //###########
  //## HTTPS ##
  //###########
  // Note: HTTPS is basically required to have
  // secure session cookies working, so it's recommended
  // to generate a local certificate for development using
  // OpenSSL and redirecting localhost to a fake development
  // domain in yourhosts file or, if you're running on a server
  // behind a real domain, use your existing SSL certificate
  // or getting a new one using Let's Encrypt/ZeroSSL

  // The other options will be are ignored if HTTPS is disabled
  ENABLE_HTTPS: false,
  // This could be a fake domain in your hosts file or your real domain.
  // /etc/hosts example to redirect locally:
  // 127.0.0.1 local.dev localhost
  PUBLIC_ADDRESS: 'local.dev',

  SSL_KEY_FILE: '/path/to/privkey.pem',
  SSL_CERT_FILE: '/path/to/cert.pem',

  //##########
  //## MAIL ##
  //##########
  MAIL_HOST: 'smtp.example.com',
  MAIL_PORT: 25,
  MAIL_TARGETS: {
    // Contact requests will be sent to:
    contact: 'contact@example.com',
    // Upload requests will be sent to:
    upload: 'upload@example.com',
    // Bug reports will be sent to:
    bugreport: 'bugreport@example.com',
  },
};

module.exports = Configuration;
