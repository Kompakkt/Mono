# Kompakkt Mono

<p align="center">
    <img src="https://github.com/Kompakkt/Assets/raw/main/mono-logo.png" alt="Kompakkt Mono Logo" width="600">
</p>

A collection of scripts to get a Kompakkt development environment up and running

## General

[Kompakkt](https://github.com/Kompakkt/Kompakkt) is split up into multiple services, and getting all of them running locally can be a hassle. Mono tries to consolidate these services to get a development environment of Kompakkt running locally.

## Prerequisites

- [Docker](https://www.docker.com/get-started)
- [Docker Compose](https://docs.docker.com/compose/install/)
- [Bun](https://bun.sh)
- [Git](https://git-scm.com/)

## Getting Started

1. Clone this repository:
   ```bash
   git clone https://github.com/Kompakkt/Mono.git
   cd Mono
   ```

2. Make the script executable:
   ```bash
   chmod +x kompakkt.ts
   ```

3. Run the setup command to clone all repositories and build the base image:
   ```bash
   ./kompakkt.ts setup
   ```

4. Start the environment:
   ```bash
   ./kompakkt.ts up
   ```

## Available Commands

- `./kompakkt.ts setup` - Clone repositories, create uploads directory, and build base Docker image
- `./kompakkt.ts up` - Start the Kompakkt environment
- `./kompakkt.ts restart [services]` - Recreate and restart services (default: all services)
- `./kompakkt.ts down` - Stop the Kompakkt environment
- `./kompakkt.ts pull` - Pull the latest Docker images
- `./kompakkt.ts compose [args]` - Run Docker Compose with additional arguments

## Accessing Services

Once the environment is running, you can access the following services:

| Service | URL | Description |
|---------|-----|-------------|
| Kompakkt Repository | http://localhost:8080/ | Main repository interface |
| Kompakkt Viewer | http://localhost:8080/viewer/ | 3D viewer application |
| Kompakkt API | http://localhost:8080/server/ | Backend API |
| API Documentation | http://localhost:8080/server/swagger/ | Swagger API documentation |
| MailHog | http://localhost:8025/ | Email testing interface |
| MongoDB | localhost:37017 | MongoDB database (credentials in docker-compose.yml) |


## Development Workflow

The setup provides hot-reloading for the frontend applications:

- Repo code is mounted at `./Repo/`
- Viewer code is mounted at `./Viewer/`
- Server code is mounted at `./Server/`
- Files uploaded to the platform are stored in `./uploads/`

Any changes to the code in these directories will trigger automatic rebuilds thanks to the development servers.

## Plugins

The Repo and Viewer applications can be extended with custom plugins, which are registered in `repo.custom-plugins.ts` and `viewer.custom-plugins.ts` respectively.

### Enabling Semantic Kompakkt

[Semantic Kompakkt](https://nfdi4culture.de/services/details/semantic-kompakkt.html) adds linked open data (LOD) metadata to the Repo and Viewer applications by extending entities and annotations with references to [Wikibase](https://wikiba.se/) items. Enable it by adding the plugin to the custom plugins file(s) in which you want it active:

1. Import the plugin alongside the existing imports:
   ```ts
   import { SemanticKompakktMetadataPlugin } from '@kompakkt/plugins/semantic-kompakkt-metadata';
   ```

2. Create a new instance of the plugin in the exported plugins array:
   ```ts
   export default [new HelloWorldPlugin(), new SemanticKompakktMetadataPlugin()] satisfies ExtenderPlugin[];
   ```

> Note: Semantic Kompakkt requires a backend connected to a Wikibase instance. To deploy your own instance, you can refer to our partner project [wikibase4research](https://gitlab.com/nfdi4culture/wikibase4research/wikibase4research)

## Configuration

- Server configuration is provided via `server-config.json`
- Environment settings for Angular applications are in `shared-environment.ts`
- Routing is handled by Caddy as defined in the `Caddyfile`

## Troubleshooting

If you encounter any issues:

1. Check logs for a specific service:
   ```bash
   ./kompakkt.ts compose logs [service-name]
   ```

2. Restart a specific service:
   ```bash
   ./kompakkt.ts restart [service-name]
   ```

3. Rebuild a service:
   ```bash
   ./kompakkt.ts compose up -d --build [service-name]
   ```
