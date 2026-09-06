import { afterEach, describe, expect, it, vi } from "vitest";
import { saveCloudState, SaveConflictError } from "./cloudStateClient";

describe("saveCloudState", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the state and baseUpdatedAt, and returns the new updatedAt on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ updatedAt: "2026-09-06T00:00:00.000Z" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await saveCloudState("token", { foo: "bar" }, "2026-09-05T00:00:00.000Z");

    expect(result).toEqual({ updatedAt: "2026-09-06T00:00:00.000Z" });
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ state: { foo: "bar" }, baseUpdatedAt: "2026-09-05T00:00:00.000Z" });
  });

  it("throws SaveConflictError with the server's currentUpdatedAt on 409", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ error: "conflict", currentUpdatedAt: "2026-09-06T01:00:00.000Z" }),
      }),
    );

    await expect(saveCloudState("token", {}, "2026-09-05T00:00:00.000Z")).rejects.toMatchObject({
      currentUpdatedAt: "2026-09-06T01:00:00.000Z",
    });
    await expect(saveCloudState("token", {}, "2026-09-05T00:00:00.000Z")).rejects.toBeInstanceOf(SaveConflictError);
  });
});
