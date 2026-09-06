import { describe, expect, it } from "vitest";
import { resolveDatesInRange, startOfWeekKey, toDateKey, fromDateKey } from "./date";

describe("resolveDatesInRange", () => {
  it("returns every date in an inclusive range with no weekday filter", () => {
    expect(resolveDatesInRange("2026-09-02", "2026-09-04")).toEqual([
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
    ]);
  });

  it("filters to the given weekdays only", () => {
    // 2026-09-01 is a Tuesday. Range covers Tue(9/1) - Mon(9/7).
    // Mon=1, Wed=3, Fri=5
    expect(resolveDatesInRange("2026-09-01", "2026-09-07", [1, 3, 5])).toEqual([
      "2026-09-02", // Wed
      "2026-09-04", // Fri
      "2026-09-07", // Mon
    ]);
  });

  it("returns a single date when start === end", () => {
    expect(resolveDatesInRange("2026-09-02", "2026-09-02")).toEqual(["2026-09-02"]);
  });

  it("returns an empty array when start is after end", () => {
    expect(resolveDatesInRange("2026-09-05", "2026-09-02")).toEqual([]);
  });

  it("returns an empty array when the weekday filter matches nothing in range", () => {
    // 2026-09-02 - 2026-09-02 is a Wednesday; filter only Sunday(0)
    expect(resolveDatesInRange("2026-09-02", "2026-09-02", [0])).toEqual([]);
  });
});

describe("startOfWeekKey", () => {
  it("returns the same Sunday for every day within that week", () => {
    // 2026-08-30 is a Sunday, 2026-09-05 is the following Saturday.
    expect(startOfWeekKey("2026-08-30")).toBe("2026-08-30");
    expect(startOfWeekKey("2026-09-02")).toBe("2026-08-30");
    expect(startOfWeekKey("2026-09-05")).toBe("2026-08-30");
  });

  it("rolls over to the next Sunday for the following week", () => {
    expect(startOfWeekKey("2026-09-06")).toBe("2026-09-06");
  });
});

describe("toDateKey / fromDateKey", () => {
  it("round-trips a date without timezone shift", () => {
    const key = "2026-01-31";
    expect(toDateKey(fromDateKey(key))).toBe(key);
  });
});
