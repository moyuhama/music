/** A wall-clock deadline shared across songs and page changes. */
export class SleepTimer {
  private deadline: number | null = null;
  private timeout: ReturnType<typeof setTimeout> | undefined;
  private listeners = new Set<() => void>();
  private readonly onExpire: () => void;
  constructor(onExpire: () => void) { this.onExpire = onExpire; }
  snapshot = () => this.deadline;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private publish() { this.listeners.forEach((listener) => listener()); }
  start(minutes: number) {
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180) return false;
    clearTimeout(this.timeout);
    this.deadline = Date.now() + minutes * 60_000;
    this.timeout = setTimeout(this.check, minutes * 60_000);
    this.publish();
    return true;
  }
  cancel() {
    clearTimeout(this.timeout);
    this.timeout = undefined;
    this.deadline = null;
    this.publish();
  }
  // Also called on focus/visibility changes after browser suspension.
  check = () => {
    if (this.deadline === null) return;
    const remaining = this.deadline - Date.now();
    clearTimeout(this.timeout);
    if (remaining > 0) {
      this.timeout = setTimeout(this.check, remaining);
      return;
    }
    this.timeout = undefined;
    this.deadline = null;
    this.onExpire();
    this.publish();
  };
}
