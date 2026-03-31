type SyncSource = "automatic" | "manual";

interface SyncSchedulerOptions {
  getDelayMs: () => number;
  runSync: (source: SyncSource) => Promise<void>;
}

export class SyncScheduler {
  private timeoutId: number | null = null;
  private inFlight: Promise<void> | null = null;
  private paused = false;
  private started = false;
  private pendingAutomaticRun = false;

  constructor(private readonly options: SyncSchedulerOptions) {}

  start(): void {
    this.started = true;

    if (this.paused) {
      return;
    }

    this.scheduleAutomaticRun();
  }

  stop(): void {
    this.started = false;
    this.pendingAutomaticRun = false;

    if (this.timeoutId !== null) {
      window.clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  reconfigure(): void {
    if (this.started && !this.paused) {
      this.scheduleAutomaticRun();
    }
  }

  pause(): void {
    this.paused = true;
    this.pendingAutomaticRun = false;

    if (this.timeoutId !== null) {
      window.clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  resume(): void {
    this.paused = false;
    if (this.started) {
      this.scheduleAutomaticRun();
    }
  }

  isPaused(): boolean {
    return this.paused;
  }

  noteActivity(): void {
    if (!this.started || this.paused) {
      return;
    }

    if (this.inFlight) {
      this.pendingAutomaticRun = true;
      return;
    }

    this.scheduleAutomaticRun();
  }

  async triggerManual(): Promise<boolean> {
    this.clearScheduledRun();
    return this.run("manual");
  }

  private async run(source: SyncSource): Promise<boolean> {
    if (this.inFlight) {
      if (source === "automatic") {
        this.pendingAutomaticRun = true;
      }
      return false;
    }

    this.inFlight = this.options.runSync(source)
      .finally(() => {
        this.inFlight = null;

        if (this.pendingAutomaticRun && this.started && !this.paused) {
          this.pendingAutomaticRun = false;
          this.scheduleAutomaticRun();
        }
      });

    await this.inFlight;
    return true;
  }

  private scheduleAutomaticRun(): void {
    this.clearScheduledRun();

    this.timeoutId = window.setTimeout(() => {
      this.timeoutId = null;
      void this.run("automatic");
    }, this.options.getDelayMs());
  }

  private clearScheduledRun(): void {
    if (this.timeoutId !== null) {
      window.clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}
