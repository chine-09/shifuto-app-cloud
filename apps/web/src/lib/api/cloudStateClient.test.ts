import { afterEach, describe, expect, it, vi } from "vitest";
import { saveCloudState, SaveConflictError } from "./cloudStateClient";

describe("saveCloudState", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the records array, and returns the new updatedAt on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ updatedAt: "2026-09-06T00:00:00.000Z" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const records = [{ sk: "MASTER", data: { foo: "bar" }, baseUpdatedAt: "2026-09-05T00:00:00.000Z" }];
    const result = await saveCloudState("token", records);

    expect(result).toEqual({ updatedAt: "2026-09-06T00:00:00.000Z" });
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ records });
  });

  it("throws SaveConflictError with the server's current record set on 409", async () => {
    const conflictingRecords = [{ sk: "MASTER", data: {}, updatedAt: "2026-09-06T01:00:00.000Z" }];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ error: "conflict", records: conflictingRecords }),
      }),
    );

    const records = [{ sk: "MASTER", data: {}, baseUpdatedAt: "2026-09-05T00:00:00.000Z" }];
    await expect(saveCloudState("token", records)).rejects.toMatchObject({ records: conflictingRecords });
    await expect(saveCloudState("token", records)).rejects.toBeInstanceOf(SaveConflictError);
  });
});
