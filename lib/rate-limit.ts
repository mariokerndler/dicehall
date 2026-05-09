export type RateLimitRule = {
  limit: number;
  windowMs: number;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

export class FixedWindowRateLimiter {
  private readonly buckets = new Map<string, RateLimitBucket>();

  constructor(private readonly now = Date.now) {}

  check(key: string, rule: RateLimitRule): boolean {
    const currentTime = this.now();
    const bucket = this.buckets.get(key);

    if (!bucket || currentTime >= bucket.resetAt) {
      this.buckets.set(key, {
        count: 1,
        resetAt: currentTime + rule.windowMs
      });
      return true;
    }

    if (bucket.count >= rule.limit) {
      return false;
    }

    bucket.count += 1;
    return true;
  }

  clear(): void {
    this.buckets.clear();
  }

  prune(): void {
    const currentTime = this.now();

    for (const [key, bucket] of this.buckets) {
      if (currentTime >= bucket.resetAt) {
        this.buckets.delete(key);
      }
    }
  }
}
