/** Per-client sliding-window limiter plus a global concurrency gate.
 *  In-memory on purpose: one container, no paid state store. */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(
    private max: number,
    private windowMs: number,
  ) {}

  /** Returns seconds to wait, or 0 if allowed (and records the hit). */
  check(key: string, now = Date.now()): number {
    const list = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (list.length >= this.max) {
      this.hits.set(key, list);
      return Math.ceil((this.windowMs - (now - list[0])) / 1000);
    }
    list.push(now);
    this.hits.set(key, list);
    if (this.hits.size > 10_000) this.prune(now);
    return 0;
  }

  private prune(now: number) {
    for (const [k, v] of this.hits) if (!v.some((t) => now - t < this.windowMs)) this.hits.delete(k);
  }
}

export class Gate {
  private active = 0;
  private waiters: (() => void)[] = [];
  constructor(
    private concurrency: number,
    private maxQueue: number,
  ) {}

  get queued() {
    return this.waiters.length;
  }

  /** Resolves with a release function, or null if the queue is full. */
  async acquire(signal?: AbortSignal): Promise<(() => void) | null> {
    if (this.active < this.concurrency) {
      this.active++;
      return this.releaser();
    }
    if (this.waiters.length >= this.maxQueue) return null;
    await new Promise<void>((resolve, reject) => {
      const w = () => resolve();
      this.waiters.push(w);
      signal?.addEventListener('abort', () => {
        this.waiters = this.waiters.filter((x) => x !== w);
        reject(new Error('aborted'));
      });
    });
    this.active++;
    return this.releaser();
  }

  private releaser() {
    let done = false;
    return () => {
      if (done) return;
      done = true;
      this.active--;
      this.waiters.shift()?.();
    };
  }
}
