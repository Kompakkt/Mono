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
  // By default docker will be used to host MongoDB and Redis.
  // To change this behaviour, disable docker below and configure
  // Redis and MongoDB to connect to other instances.
  USE_DOCKER: true,
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
