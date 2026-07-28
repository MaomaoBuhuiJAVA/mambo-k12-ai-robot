export type PointerPoint = {
  x: number;
  y: number;
};

export type PointerCommandSender = (point: PointerPoint) => Promise<boolean | void>;

type PointerBarrier = {
  cancelled: boolean;
  point: PointerPoint;
  resolve: (moved: boolean) => void;
};

export class LatestPointerCommand {
  private disposed = false;
  private inFlight = false;
  private pending: PointerPoint | undefined;
  private idleResolvers: Array<() => void> = [];
  private barrier: PointerBarrier | undefined;

  constructor(private readonly sender: PointerCommandSender) {}

  submit(point: PointerPoint): void {
    if (this.disposed || this.barrier !== undefined) {
      return;
    }

    if (this.inFlight) {
      this.pending = point;
      return;
    }

    this.send(point);
  }

  async moveThenRun(point: PointerPoint, action: () => Promise<void>): Promise<boolean> {
    if (this.disposed || this.barrier !== undefined) return false;

    let barrier!: PointerBarrier;
    const moved = await new Promise<boolean>((resolve) => {
      barrier = { cancelled: false, point, resolve };
      this.barrier = barrier;
      if (this.inFlight) {
        this.pending = point;
        return;
      }
      this.pending = undefined;
      this.send(point);
    });

    if (!moved || this.disposed || barrier.cancelled) {
      if (this.barrier === barrier) this.barrier = undefined;
      return false;
    }

    try {
      await action();
      return true;
    } catch {
      return false;
    } finally {
      if (this.barrier === barrier) this.barrier = undefined;
    }
  }

  cancelBarrier(): void {
    const barrier = this.barrier;
    if (!barrier) return;
    barrier.cancelled = true;
    this.pending = undefined;
    if (!this.inFlight) barrier.resolve(false);
  }

  idle(): Promise<void> {
    if (!this.inFlight) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.idleResolvers.push(resolve);
    });
  }

  dispose(): void {
    this.disposed = true;
    this.pending = undefined;
    this.cancelBarrier();
  }

  private send(point: PointerPoint): void {
    this.inFlight = true;

    try {
      void this.sender(point).then(
        (succeeded) => this.finish(point, succeeded !== false),
        () => this.finish(point, false),
      );
    } catch {
      this.finish(point, false);
    }
  }

  private finish(point: PointerPoint, succeeded: boolean): void {
    this.inFlight = false;
    const barrier = this.barrier;
    if (barrier?.cancelled) {
      barrier.resolve(false);
      this.resolveIdle();
      return;
    }
    if (this.disposed && barrier !== undefined) {
      barrier.resolve(false);
      this.resolveIdle();
      return;
    }
    if (barrier?.point === point) {
      barrier.resolve(succeeded);
      this.resolveIdle();
      return;
    }

    const next = this.pending;
    this.pending = undefined;

    if (!this.disposed && next !== undefined) {
      this.send(next);
      return;
    }

    this.resolveIdle();
  }

  private resolveIdle(): void {
    const resolvers = this.idleResolvers;
    this.idleResolvers = [];
    resolvers.forEach((resolve) => resolve());
  }
}
