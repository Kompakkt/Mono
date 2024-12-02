import { COLORS } from "./colors";
import { sleep } from "./utils";

import {  Configuration} from '../configuration'

const { REDIS_PORT, MONGO_PORT, MAILHOG_HTTP } = Configuration;

export const waitForPort = async (port: number, host: string = '127.0.0.1'): Promise<boolean> => {
  const net = require('net');
  return new Promise((resolve) => {
    const client = new net.Socket();

    const onError = () => {
      client.destroy();
      resolve(false);
    };

    client.setTimeout(1000);
    client.once('error', onError);
    client.once('timeout', onError);

    client.connect(port, host, () => {
      client.end();
      resolve(true);
    });
  });
};

export const waitForServices = async (
  attempts: number = 30,
  interval: number = 1000
): Promise<void> => {
  console.log(COLORS.FgCyan, 'Waiting for services to be ready...');

  for (let i = 0; i < attempts; i++) {
    const [redisReady, mongoReady, mailhogReady] = await Promise.all([
      waitForPort(REDIS_PORT),
      waitForPort(MONGO_PORT ?? 27017),
      waitForPort(MAILHOG_HTTP)
    ]);

    if (redisReady && mongoReady && mailhogReady) {
      console.log(COLORS.FgGreen, 'All services are ready!');
      return;
    }

    await sleep(interval);
  }

  throw new Error('Services failed to start within the timeout period');
};
