import { describe, it, expect, afterEach } from "vitest";
import { handleDisconnect } from "../handler.js";
import { connections } from "../../../shared/connections.js";

describe("handleDisconnect", () => {
  afterEach(() => {
    connections.clear();
  });

  it("returns error when connection not found", async () => {
    const result = await handleDisconnect({ connectionId: "nope" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  it("disconnects and removes from map", async () => {
    let poolEnded = false;
    connections.set("test", {
      pool: { end: async () => { poolEnded = true; } } as any,
      readOnly: true,
      config: {},
    });

    const result = await handleDisconnect({ connectionId: "test" });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("successfully");
    expect(poolEnded).toBe(true);
    expect(connections.has("test")).toBe(false);
  });
});
