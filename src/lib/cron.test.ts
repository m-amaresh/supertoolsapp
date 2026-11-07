import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseCron } from "./cron";

describe("cron", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T10:30:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns error for invalid field count", () => {
    const result = parseCron("* * * *");
    expect(result.error).toMatch(/Expected 5 fields/);
    expect(result.nextRuns).toHaveLength(0);
  });

  it("parses valid expressions and returns next runs", () => {
    const result = parseCron("*/15 * * * *");
    expect(result.error).toBeNull();
    expect(result.description).toMatch(/Every 15 minutes/);
    expect(result.nextRuns).toHaveLength(5);
    for (const run of result.nextRuns) {
      expect(run.getMinutes() % 15).toBe(0);
    }
  });

  it("can compute rare leap-day schedules", () => {
    const result = parseCron("0 0 29 2 *");
    expect(result.error).toBeNull();
    expect(result.nextRuns.length).toBeGreaterThan(0);
    const first = result.nextRuns[0];
    expect(first.getMonth()).toBe(1);
    expect(first.getDate()).toBe(29);
  });

  it("uses OR semantics when both day-of-month and day-of-week are restricted", () => {
    const result = parseCron("0 9 1 * 2");
    expect(result.error).toBeNull();
    expect(result.nextRuns).toHaveLength(5);

    // From 2026-01-15, first Tuesday is 2026-01-20; AND semantics would skip this.
    const first = result.nextRuns[0];
    expect(first.getMonth()).toBe(0);
    expect(first.getDate()).toBe(20);
  });

  it("accepts 7 as Sunday in day-of-week field", () => {
    const result = parseCron("0 12 * * 7");
    expect(result.error).toBeNull();
    expect(result.description).toMatch(/Sunday/);
    expect(result.nextRuns).toHaveLength(5);
    for (const run of result.nextRuns) {
      expect(run.getDay()).toBe(0);
    }
  });

  it("expands N/step from N to the field maximum", () => {
    const result = parseCron("5/15 * * * *");
    expect(result.error).toBeNull();
    expect(result.description).toBe("Every 15 minutes from minute 5 on");
    const minutes = result.nextRuns.slice(0, 4).map((run) => run.getMinutes());
    expect(minutes.sort((x, y) => x - y)).toEqual([5, 20, 35, 50]);
  });

  it("uses AND semantics when a day field starts with *", () => {
    // Only the 1st of a month that falls on Sun/Tue/Thu/Sat qualifies.
    const result = parseCron("0 0 1 * */2");
    expect(result.error).toBeNull();
    for (const run of result.nextRuns) {
      expect(run.getDate()).toBe(1);
      expect(run.getDay() % 2).toBe(0);
    }
  });

  it("describes stepped ranges in named fields", () => {
    expect(parseCron("0 9 * * 1-5/2").description).toBe(
      "At 09:00, every 2 days from Monday through Friday",
    );
    expect(parseCron("0 0 1 1-11/2 *").description).toBe(
      "At 00:00, on day 1 of the month, every 2 months from January through November",
    );
  });

  it("rejects non-numeric single values", () => {
    expect(parseCron("5x * * * *").error).toBe("Invalid minute field");
  });
});
