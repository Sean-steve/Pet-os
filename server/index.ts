import { createServer } from 'node:http';
import { createApp } from './app';
import { loadServerConfig } from './config';
import { closeDatabase } from './db';
import { closeRedis } from './redis';

const config = loadServerConfig();
const app = createApp(config);
const server = createServer(app);

server.listen(config.port, '0.0.0.0', () => {
  console.log(`Pet OS API listening on :${config.port}`);
});

let stopping = false;
async function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  console.log(`Received ${signal}; shutting down`);
  server.close(async () => {
    await Promise.allSettled([closeDatabase(), closeRedis()]);
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
