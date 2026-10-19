import type { Redis } from 'ioredis';

export interface LoginThrottle {
  /** Seconds the key remains locked; 0 when attempts are allowed. */
  lockedFor(key: string): Promise<number>;
  recordFailure(key: string): Promise<void>;
  reset(key: string): Promise<void>;
}

const FREE_ATTEMPTS = 5;
const BASE_LOCK_SECONDS = 30;
const MAX_LOCK_SECONDS = 15 * 60;
const WINDOW_SECONDS = 60 * 60;

function lockSeconds(failures: number): number {
  const exponent = Math.min(failures - FREE_ATTEMPTS, 10);
  return Math.min(BASE_LOCK_SECONDS * 2 ** exponent, MAX_LOCK_SECONDS);
}

export class RedisLoginThrottle implements LoginThrottle {
  constructor(private readonly redis: Redis) {}

  async lockedFor(key: string): Promise<number> {
    const ttl = await this.redis.ttl(`auth:lock:${key}`);
    return ttl > 0 ? ttl : 0;
  }

  async recordFailure(key: string): Promise<void> {
    const failures = await this.redis.incr(`auth:fail:${key}`);
    await this.redis.expire(`auth:fail:${key}`, WINDOW_SECONDS);
    if (failures >= FREE_ATTEMPTS) {
      await this.redis.set(`auth:lock:${key}`, '1', 'EX', lockSeconds(failures));
    }
  }

  async reset(key: string): Promise<void> {
    await this.redis.del(`auth:fail:${key}`, `auth:lock:${key}`);
  }
}

export class MemoryLoginThrottle implements LoginThrottle {
  private readonly failures = new Map<string, number>();
  private readonly locks = new Map<string, number>();

  lockedFor(key: string): Promise<number> {
    const until = this.locks.get(key) ?? 0;
    return Promise.resolve(Math.max(0, Math.ceil((until - Date.now()) / 1000)));
  }

  recordFailure(key: string): Promise<void> {
    const count = (this.failures.get(key) ?? 0) + 1;
    this.failures.set(key, count);
    if (count >= FREE_ATTEMPTS) this.locks.set(key, Date.now() + lockSeconds(count) * 1000);
    return Promise.resolve();
  }

  reset(key: string): Promise<void> {
    this.failures.delete(key);
    this.locks.delete(key);
    return Promise.resolve();
  }
}
