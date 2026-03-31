type SyncSource = "automatic" | "manual";

interface SyncSchedulerOptions {
  getIntervalMs: () => number;
  runSync: (source: SyncSource) => Promise<void>;
}

export class SyncScheduler {
  private intervalId: number | null = null;
  private inFlight: Promise<void> | null = null;
  private paused = false;

  constructor(private readonly options: SyncSchedulerOptions) {}

  start(): void {
    this.stop();

    if (this.paused) {
      return;
    }

    this.intervalId = window.setInterval(() => {
      void this.run("automatic");
    }, this.options.getIntervalMs());
  }

  stop(): void {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  reconfigure(): void {
    if (!this.paused) {
      this.start();
    }
  }

  pause(): void {
    this.paused = true;
    this.stop();
  }

  resume(): void {
    this.paused = false;
    this.start();
  }

  isPaused(): boolean {
    return this.paused;
  }

  async triggerManual(): Promise<boolean> {
    return this.run("manual");
  }

  private async run(source: SyncSource): Promise<boolean> {
    if (this.inFlight) {
      return false;
    }

    this.inFlight = this.options.runSync(source)
      .finally(() => {
        this.inFlight = null;
      });

    await this.inFlight;
    return true;
  }
}
