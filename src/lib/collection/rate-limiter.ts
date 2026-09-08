export class HostRateLimiter {
  private readonly nextAllowed = new Map<string, number>();
  constructor(private readonly minimumIntervalMs = 1_000, private readonly now = () => Date.now()) {}

  claim(url: string) {
    const host = new URL(url).host;
    const current = this.now();
    const allowedAt = this.nextAllowed.get(host) ?? current;
    if (allowedAt > current) throw new Error("Source rate limit exceeded");
    this.nextAllowed.set(host, current + this.minimumIntervalMs);
  }
}
