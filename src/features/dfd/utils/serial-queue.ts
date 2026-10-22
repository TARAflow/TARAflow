// ==================== SERIAL QUEUE ====================
// Runs async tasks strictly one after another, in the order they were
// added. A task that fails does not stop the queue; its caller gets the
// rejection. Replaces busy flags and polling loops (review finding 3).

export class SerialQueue {
  private tail: Promise<unknown> = Promise.resolve();
  private pending = 0;

  /** Adds a task; resolves with its result once it has run. */
  run<T>(task: () => Promise<T>): Promise<T> {
    this.pending++;
    const result = this.tail.then(task);
    this.tail = result.then(
      () => this.pending--,
      () => this.pending--,
    );
    return result;
  }

  /** Tasks added and not finished yet (running one included). */
  get size(): number {
    return this.pending;
  }

  /** Resolves once every task added so far has finished. */
  idle(): Promise<void> {
    return this.tail.then(() => undefined);
  }
}
