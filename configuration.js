// Note: there is no point in running this file by itself,,
// as it only sets environment variables for the main script file

module.exports = {
  // #############
  // ## GENERAL ##
  // #############
  // Configure the ports of the kompakkt services below
  SERVER_PORT: 8080,
  VIEWER_PORT: 8100,
  REPO_PORT: 4200,

  // Change the session secret used for creating user sessions
  SESSION_SECRET: 'changeme',
  // The session secret could also be pulled from an environment variable
  // or a file.
  // Example for environment variable based secret:
  // SESSION_SECRET: process.env['KOMPAKKT_SESSION_SECRET'],
  // Example for file based secret:
  // SESSION_SECRET: require('fs').readFileSync('/path/to/secret.txt').toString(),

  // #####################
  // ## MongoDB & Redis ##
  // #####################
  // Default: expects you to have your own redis and MongoDB instances.

  // If you have docker installed, you can enable this
  // option to run MongoDB and Redis using docker containers
  USE_DOCKER: false,
  // Docker version tags for MongoDB and Redis
  DOCKER_TAGS: {
    MONGO: '4.4',
    REDIS: '6.2',
  },

  // Configure how to connect to a redis instance.
  // No need for configuration when using docker.
  REDIS_HOST: 'localhost',
  REDIS_PORT: 6379,

  // Configure how to connect to MongoDB.
  // No need for configuration when using docker.
  MONGO_URL: 'mongodb://localhost:27017',

  // ###########
  // ## HTTPS ##
  // ###########
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
  PUBLIC_ADDRESS: 'localhost',

  SSL_KEY_FILE: '/path/to/privkey.pem',
  SSL_CERT_FILE: '/path/to/cert.pem',

  // ##########
  // ## MAIL ##
  // ##########
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

  // ##########
  // ## LDAP ##
  // ##########
  // The server can use LDAP authentication via passport-ldapauth
  // https://www.npmjs.com/package/passport-ldapauth
  // Some of the settings can be configured below
  LDAP: {
    DN: '',
    DNauthUID: false,
    Host: '',
    searchBase: '',
  }
};
