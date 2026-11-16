/** Bounded per-view positions: a new page starts at zero, revisiting restores it. */
export class ScrollMemory {
  private entries = new Map<string, number>();
  private limit: number;
  constructor(limit = 30) {
    this.limit = limit;
  }
  read(key: string) {
    return this.entries.get(key) ?? 0;
  }
  save(key: string, position: number) {
    this.entries.delete(key);
    this.entries.set(key, Math.max(0, position));
    while (this.entries.size > this.limit)
      this.entries.delete(this.entries.keys().next().value!);
  }
}
