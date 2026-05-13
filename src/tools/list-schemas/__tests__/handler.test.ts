import { describe, it, expect, afterEach } from "vitest";
import { handleListSchemas } from "../handler.js";
import { connections } from "../../../shared/connections.js";

describe("handleListSchemas", () => {
  afterEach(() => {
    connections.clear();
  });

  it("returns error when connection not found", async () => {
    const result = await handleListSchemas({ connectionId: "nope" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  it("returns schemas as JSON", async () => {
    const rows = [
      { schema_name: "public", schema_owner: "postgres" },
      { schema_name: "app", schema_owner: "admin" },
    ];
    connections.set("test", {
      pool: { query: async () => ({ rows }) } as any,
      readOnly: true,
      config: {},
    });

    const result = await handleListSchemas({ connectionId: "test" });
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].schema_name).toBe("public");
    expect(parsed[1].schema_name).toBe("app");
  });

  it("returns empty array when no schemas found", async () => {
    connections.set("test", {
      pool: { query: async () => ({ rows: [] }) } as any,
      readOnly: true,
      config: {},
    });

    const result = await handleListSchemas({ connectionId: "test" });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toEqual([]);
  });
});
