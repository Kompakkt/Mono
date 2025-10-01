FROM docker.io/node:lts-slim
RUN apt-get update

# Make tools available to server
# FFmpeg is needed for video preview generation
RUN apt-get install -y git jq zstd brotli pigz 7zip ffmpeg gnupg wget

RUN npm install -g bun

CMD [ "tail", "-f", "/dev/null" ]
