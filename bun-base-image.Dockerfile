FROM docker.io/node:lts-slim
RUN apt-get update

# Make tools available to server
# FFmpeg and Chromium are needed for video preview generation
RUN apt-get install -y git jq zstd brotli pigz 7zip ffmpeg gnupg wget chromium

RUN npm install -g bun

# Fix for puppeteer
RUN CHROME_DIRS="/var/www/.local /var/www/.config /var/www/.cache /var/www/.pki" && \
    mkdir -p ${CHROME_DIRS} && \
    chown www-data ${CHROME_DIRS}
ENV XDG_CONFIG_HOME=/tmp/.chromium
ENV XDG_CACHE_HOME=/tmp/.chromium

CMD [ "tail", "-f", "/dev/null" ]
