// Note: there is no point in running this file by itself,,
// as it only sets environment variables for the main script file

export const Configuration = {
  // ############
  // ## SYSTEM ##
  // ############
  // Configure which package manager you would like to use.
  // Possible values could be f.e. 'npm', 'pnpm' or 'yarn'.
  PACKAGE_MANAGER: "npm",

  // #############
  // ## GENERAL ##
  // #############
  // By default, a local backend (Server, MongoDB & Redis) would be used to
  // run Kompakkt. If you want to use Mono against your own backend, you can
  // set the following option to 'true' and change the backend address
  SKIP_SERVER_INIT: true,
  BACKEND_URL: "https://kompakkt.de/server/",

  // Configure the ports of the kompakkt services below
  SERVER_PORT: 8080,
  VIEWER_PORT: 8100,
  REPO_PORT: 4200,

  // Change the session secret used for creating user sessions
  SESSION_SECRET: "changeme",
  // The session secret could also be pulled from an environment variable
  // or a file.
  // Example for environment variable based secret:
  // SESSION_SECRET: process.env['KOMPAKKT_SESSION_SECRET'],
  // Example for file based secret:
  // SESSION_SECRET: require('fs').readFileSync('/path/to/secret.txt').toString(),

  // ######################################
  // ## Docker: MongoDB, Redis & MailHog ##
  // ######################################
  // By default docker will be used to host MongoDB, Redis and MailHog
  // To change this behaviour, disable docker below and configure
  // Redis and MongoDB to connect to other instances.
  USE_DOCKER: true,
  // Disable console output of docker containers
  SILENT_DOCKER: true,

  DOCKER_IMAGES: {
    REDIS_IMAGE: "docker.dragonflydb.io/dragonflydb/dragonfly:latest",
    MONGO_IMAGE: "docker.io/mongo:8-noble",
    MAILHOG_IMAGE: "docker.io/mailhog/mailhog:v1.0.1",
  },

  // Configure how to connect to a redis instance.
  // No need for configuration when using docker.
  REDIS_HOST: "localhost",
  REDIS_PORT: 6379,

  // Configure how to connect to MongoDB.
  // No need for configuration when using docker.
  MONGO_URL: "mongodb://localhost:27017",
  // Change this if you want to use a non-default port
  // for the MongoDB docker container.
  // Otherwise, no need for configuration.
  MONGO_PORT: null,

  // Configure the MailHog SMTP server.
  // If you intend to change this, make sure to
  // double check your SMTP settings in the MAIL-section below
  MAILHOG_SMTP: 1025,
  // Configure the port with which you can reach
  // the MailHog web interface
  MAILHOG_HTTP: 8025,

  // ##########
  // ## MAIL ##
  // ##########
  // This section is configured to use MailHog by default.
  // You can change this to use your own SMTP Server
  MAIL_HOST: "localhost",
  MAIL_PORT: 1025,
  MAIL_TARGETS: {
    // Contact requests will be sent to:
    contact: "contact@example.com",
    // Upload requests will be sent to:
    upload: "upload@example.com",
    // Bug reports will be sent to:
    bugreport: "bugreport@example.com",
  },

  // ##########
  // ## LDAP ##
  // ##########
  // The server can use LDAP authentication via passport-ldapauth
  // https://www.npmjs.com/package/passport-ldapauth
  // Some of the settings can be configured below
  ENABLE_LDAP: false,
  LDAP: {
    DN: "",
    DNauthUID: false,
    Host: "",
    searchBase: "",
  },
};
