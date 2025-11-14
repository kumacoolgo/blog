// lib/redis.js
import { Redis } from '@upstash/redis';

let client;
export function getRedis() {
  if (!client) {
    client = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return {
    async get(key) { return await client.get(key); },
    async set(key, val) { return await client.set(key, val); },
    async del(key) { return await client.del(key); },
    async lrange(key, s, e) { return await client.lrange(key, s, e); },
    async rpush(key, ...vals) { return await client.rpush(key, ...vals); },
    async lrem(key, c, val) { return await client.lrem(key, c, val); },
    async mget(...keys) { return await client.mget(...keys); },

    // 登录限速用
    async incr(key) { return await client.incr(key); },
    async expire(key, seconds) { return await client.expire(key, seconds); },
  };
}
