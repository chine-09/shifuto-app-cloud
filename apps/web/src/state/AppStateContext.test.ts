import { describe, expect, it } from "vitest";
import { asPlanId } from "@shifuto/shared-core";
import { historyReducer, type History } from "./AppStateContext";
import { createInitialState } from "./types";

function initialHistory(): History {
  return { present: createInitialState(), past: [] };
}

describe("historyReducer (元に戻す)", () => {
  it("restores the previous state on UNDO", () => {
    let history = initialHistory();
    history = historyReducer(history, { type: "UPDATE_STORE_NAME", name: "テスト店舗" });
    expect(history.present.meta.storeName).toBe("テスト店舗");

    history = historyReducer(history, { type: "UNDO" });
    expect(history.present.meta.storeName).toBe("");
  });

  it("undoes a whole bulk action in a single step", () => {
    const planId = asPlanId("2026-09");
    let history = initialHistory();
    history = historyReducer(history, {
      type: "BULK_UPSERT_HEADCOUNT",
      requirements: [
        { id: "h1", planId, date: "2026-09-01", startTime: "09:00", endTime: "17:00", requiredCount: 4 },
        { id: "h2", planId, date: "2026-09-02", startTime: "09:00", endTime: "17:00", requiredCount: 4 },
      ],
    });
    expect(history.present.headcountRequirements).toHaveLength(2);

    history = historyReducer(history, { type: "UNDO" });
    expect(history.present.headcountRequirements).toHaveLength(0);
  });

  it("UNDO with no history is a no-op", () => {
    const history = initialHistory();
    expect(historyReducer(history, { type: "UNDO" })).toBe(history);
  });

  it("does not push a history entry for MARK_SAVED, so undo skips straight past it", () => {
    let history = initialHistory();
    history = historyReducer(history, { type: "UPDATE_STORE_NAME", name: "テスト店舗" });
    history = historyReducer(history, { type: "MARK_SAVED" });
    expect(history.present.meta.isDirty).toBe(false);

    history = historyReducer(history, { type: "UNDO" });
    expect(history.present.meta.storeName).toBe("");
  });

  it("caps history length so undo doesn't grow unbounded", () => {
    let history = initialHistory();
    for (let i = 0; i < 40; i++) {
      history = historyReducer(history, { type: "UPDATE_STORE_NAME", name: `店舗${i}` });
    }
    expect(history.past.length).toBeLessThanOrEqual(30);
  });
});
