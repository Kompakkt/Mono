FROM docker.io/node:lts-slim
RUN apt-get update && apt-get install -y git jq zstd brotli
RUN npm install -g bun
CMD [ "tail", "-f", "/dev/null" ]
