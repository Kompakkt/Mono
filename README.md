# Kompakkt Mono

## A collection of scripts to get a Kompakkt development environment up and running

### Requirements

- [NodeJS 14 and NPM 7](https://nodejs.org/en/download/) to run the scripts and the applications
- [Global Angular CLI](https://angular.io/cli#installing-angular-cli)

#### Either:
- [Docker with Docker Compose](https://docs.docker.com/compose/install/)

#### Or:
- A [Redis](https://redis.io/) instance
- A [MongoDB](https://www.mongodb.com/) instance

### Getting started

Clone this repository recursively:
```git clone --recursive https://github.com/Kompakkt/Mono.git Kompakkt.Mono```

Change in to the cloned directory
```cd Kompakkt.Mono```

Open ```configuration.js``` in your favorite editor and configure the variables

Run everything using
```node run.js```

### Using HTTPS

HTTPS is highly recommended. If you're planning on only running it locally, you can still get HTTPS by generating a local SSL certificate using OpenSSL and setting a domain/redirect in your hosts file.

#### Enabling HTTPS

Inside of ```configuration.js```, set ```ENABLE_HTTPS``` to ```true``` and configure the file paths to the SSL private key and certificate.

**Note: passphrases are not supported in this environment due to 'ng serve' not supporting passphrases**

#### Hosts file

Inside of your systems hosts file, add a line with a redirect to ```127.0.0.1```. This could look something like this (on linux): ```127.0.0.1 local.dev localhost```

After saving and restarting, your localhost should be reachable under the domain ```local.dev```.

Now you can generate an SSL certificate for local.dev & localhost.

#### Generating a certificate

You can use a tool like [mkcert](https://github.com/FiloSottile/mkcert) to generate an SSL certificate for you using OpenSSL. Just make sure to not use a passphrase, as noted above!

mkcert example:
```mkcert local.dev```
