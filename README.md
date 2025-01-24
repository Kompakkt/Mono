# Kompakkt Deployment with Plugins

## Cheat sheet

### Building the base image used

```bash
docker buildx build -t kompakkt/bun-base-image:latest -f bun-base-image.Dockerfile .
```

### Building the Plugins

This will run, build the plugins, and exit. The plugins will be located under:
- ./Plugins/dist/kompakkt/name-of-the-plugin
- ./Plugins/packages/name-of-the-plugin.tgz

The plugins in dist can be used for local testing via symlink from tsconfig, or by using `bun install path-to-plugin.tgz`.

```bash
UID=$(id -u) GID=$(id -g) docker compose up plugins
```
