import { createClient, type RedisClientType } from 'redis';
import type { ServerConfig } from './config';

let client: RedisClientType | undefined;

export async function getRedis(config: ServerConfig): Promise<RedisClientType> {
  if (!client) {
    client = createClient({ url: config.redisUrl });
    client.on('error', (error) => console.error('Redis client error', error));
    await client.connect();
  }
  return client;
}

export async function closeRedis(): Promise<void> {
  if (client?.isOpen) await client.quit();
  client = undefined;
}
