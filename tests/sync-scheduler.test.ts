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

  it("runs once after the configured inactivity delay", async () => {
    const calls: string[] = [];
    const scheduler = new SyncScheduler({
      getDelayMs: () => 1_000,
      runSync: (source) => {
        calls.push(source);
        return Promise.resolve();
      },
    });

    scheduler.start();
    await vi.advanceTimersByTimeAsync(500);
    scheduler.noteActivity();
    await vi.advanceTimersByTimeAsync(500);
    expect(calls).toEqual([]);

    await vi.advanceTimersByTimeAsync(1_000);

    expect(calls).toEqual(["automatic"]);
  });

  it("prevents duplicate runs", async () => {
    let resolveRun: () => void = () => undefined;
    const scheduler = new SyncScheduler({
      getDelayMs: () => 1_000,
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

  it("pauses and resumes the inactivity timer", async () => {
    const calls: string[] = [];
    const scheduler = new SyncScheduler({
      getDelayMs: () => 1_000,
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

  it("queues another automatic run when changes arrive during a sync", async () => {
    let resolveRun: () => void = () => undefined;
    const calls: string[] = [];
    const scheduler = new SyncScheduler({
      getDelayMs: () => 1_000,
      runSync: (source) => {
        calls.push(source);
        return new Promise<void>((resolve) => {
          resolveRun = resolve;
        });
      },
    });

    scheduler.start();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(calls).toEqual(["automatic"]);

    scheduler.noteActivity();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(calls).toEqual(["automatic"]);

    resolveRun();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(calls).toEqual(["automatic", "automatic"]);
  });
});
