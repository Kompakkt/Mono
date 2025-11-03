FROM docker.io/oven/bun:debian

# Make tools available to server
# FFmpeg is needed for video preview generation
RUN apt-get update && apt-get install -y git jq zstd brotli pigz 7zip ffmpeg gnupg wget

CMD [ "tail", "-f", "/dev/null" ]
