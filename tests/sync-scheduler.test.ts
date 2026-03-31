import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SyncScheduler } from "../src/sync-scheduler";

describe("sync scheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("window", globalThis);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("runs on the configured interval", async () => {
    const calls: string[] = [];
    const scheduler = new SyncScheduler({
      getIntervalMs: () => 1_000,
      runSync: (source) => {
        calls.push(source);
        return Promise.resolve();
      },
    });

    scheduler.start();
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.advanceTimersByTimeAsync(1_000);

    expect(calls).toEqual(["automatic", "automatic"]);
  });

  it("prevents duplicate runs", async () => {
    let resolveRun: () => void = () => undefined;
    const scheduler = new SyncScheduler({
      getIntervalMs: () => 1_000,
      runSync: () => new Promise<void>((resolve) => {
        resolveRun = resolve;
      }),
    });

    const firstRun = scheduler.triggerManual();
    const secondRun = scheduler.triggerManual();

    expect(await secondRun).toBe(false);
    resolveRun();
    expect(await firstRun).toBe(true);
  });

  it("pauses and resumes the interval", async () => {
    const calls: string[] = [];
    const scheduler = new SyncScheduler({
      getIntervalMs: () => 1_000,
      runSync: (source) => {
        calls.push(source);
        return Promise.resolve();
      },
    });

    scheduler.start();
    scheduler.pause();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(calls).toEqual([]);

    scheduler.resume();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(calls).toEqual(["automatic"]);
  });
});
