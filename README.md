# Kompakkt Mono

## A collection of scripts to get a Kompakkt development environment up and running

### Requirements

- [NodeJS 14 and NPM 7](https://nodejs.org/en/download/) to run the scripts and the applications
- [Global Angular CLI](https://angular.io/cli#installing-angular-cli)
- [Git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)
- [Angular CLI](https://angular.io/cli#installing-angular-cli)

#### Either:

- [Docker](https://docs.docker.com/get-docker/)

#### Or:

- A [Redis](https://redis.io/) instance
- A [MongoDB](https://www.mongodb.com/) instance

### Getting started

Clone this repository recursively:
`git clone --recursive https://github.com/Kompakkt/Mono.git Kompakkt.Mono`

Change in to the cloned directory
`cd Kompakkt.Mono`

Install required pacakges using `npm install`

Open `configuration.js` in your favorite editor and configure the variables

Run everything using `node run.js`

### Note about SSL

Kompakkt.Mono uses [mkcert](https://www.npmjs.com/package/mkcert) to generate a SSL certificate for your localhost domain.

When trying to access your local Kompakkt environment at `https://localhost:4200/` you might get a browser warning about an untrusted certificate using this locally generated certificate.

Usually you can proceed past this warning, but you can also add the generated `fullchain.pem` as a trusted certificate in your browser or your system.
