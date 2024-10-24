# Kompakkt Mono

<p align="center">
    <img src="https://github.com/Kompakkt/Assets/raw/main/mono-logo.png" alt="Kompakkt Mono Logo" width="600">
</p>

## A collection of scripts to get a Kompakkt development environment up and running

### General

[Kompakkt](https://github.com/Kompakkt/Kompakkt) is split up into multiple services, and getting all of them running locally can be a hassle. Mono tries to consolidate these services to get a development environment of Kompakkt running locally.

If the requirements are fulfilled, just 2 commands are required to get started with development:

```bash
npm install
npm start
```

### Requirements

- [NodeJS >= 14 and NPM >= 7](https://nodejs.org/en/download/) to run the scripts and the applications
  - Other package managers and runtimes may also work. See `configuration.ts` -> `PACKAGE_MANAGER`
- [Git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git) for automatically pulling the latest Kompakkt repositories
- [Docker](https://docs.docker.com/get-docker/)
  - Optional if MongoDB and Redis are provided (**\*See note at the end**)
  - Also optional if `SKIP_SERVER_INIT` is set to `true` in `configuration.ts`

### Getting started

Clone this repository:
`git clone https://github.com/Kompakkt/Mono.git Kompakkt.Mono`

Change in to the cloned directory `cd Kompakkt.Mono`.

Install required packages using `npm install`.

Open `configuration.ts` in your favorite editor and configure the variables.

Run everything using `npm start`.

### Note about SSL

Kompakkt.Mono uses [mkcert](https://www.npmjs.com/package/mkcert) to generate an SSL certificate for your localhost domain.

When trying to access your local Kompakkt environment at `https://localhost:4200/` you might get a browser warning about an untrusted certificate using this locally generated certificate.

Usually, you can proceed past this warning, but you can also add the generated `fullchain.pem` as a trusted certificate in your browser or your system.

### Note about Docker

Docker is not a hard requirement, as it can be disabled and replaced in the `configuration.ts` file, but, when disabled, Kompakkt expects instances of [MongoDB](https://www.mongodb.com/) and [Redis](https://redis.io/) to be available.
