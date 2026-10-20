/** Unbounded single-consumer async queue used to bridge callbacks into `for await`. */
export class AsyncQueue<T> implements AsyncIterable<T> {
  private readonly items: T[] = [];
  private waiter: ((result: IteratorResult<T>) => void) | undefined;
  private done = false;

  push(item: T): void {
    if (this.done) return;
    if (this.waiter) {
      const resolve = this.waiter;
      this.waiter = undefined;
      resolve({ value: item, done: false });
    } else {
      this.items.push(item);
    }
  }

  end(): void {
    this.done = true;
    if (this.waiter) {
      const resolve = this.waiter;
      this.waiter = undefined;
      resolve({ value: undefined, done: true });
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: () => {
        const item = this.items.shift();
        if (item !== undefined) return Promise.resolve({ value: item, done: false });
        if (this.done) return Promise.resolve({ value: undefined, done: true });
        return new Promise<IteratorResult<T>>((resolve) => {
          this.waiter = resolve;
        });
      },
    };
  }
}
