import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { handleQuery } from "../handler.js";
import { connections } from "../../../shared/connections.js";

function mockPool(queryFn: (...args: unknown[]) => unknown) {
  return { query: queryFn } as any;
}

describe("handleQuery", () => {
  afterEach(() => {
    connections.clear();
  });

  it("returns error when connection not found", async () => {
    const result = await handleQuery({ connectionId: "nope", sql: "SELECT 1" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  it("blocks write queries in read-only mode", async () => {
    connections.set("ro", {
      pool: mockPool(() => {}),
      readOnly: true,
      config: {},
    });

    const result = await handleQuery({ connectionId: "ro", sql: "DELETE FROM users" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("READ-ONLY");
  });

  it("allows write queries when not read-only", async () => {
    connections.set("rw", {
      pool: mockPool(() => ({ command: "DELETE", rowCount: 3 })),
      readOnly: false,
      config: {},
    });

    const result = await handleQuery({ connectionId: "rw", sql: "DELETE FROM users WHERE id = 1" });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Rows affected: 3");
  });

  it("returns rows and fields for SELECT", async () => {
    connections.set("test", {
      pool: mockPool(() => ({
        command: "SELECT",
        rows: [{ id: 1, name: "Alice" }],
        rowCount: 1,
        fields: [
          { name: "id", dataTypeID: 23 },
          { name: "name", dataTypeID: 25 },
        ],
      })),
      readOnly: true,
      config: {},
    });

    const result = await handleQuery({ connectionId: "test", sql: "SELECT * FROM users" });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.rows).toEqual([{ id: 1, name: "Alice" }]);
    expect(parsed.rowCount).toBe(1);
    expect(parsed.fields).toHaveLength(2);
  });

  it("returns command and rowCount for non-SELECT", async () => {
    connections.set("rw", {
      pool: mockPool(() => ({ command: "UPDATE", rowCount: 5 })),
      readOnly: false,
      config: {},
    });

    const result = await handleQuery({ connectionId: "rw", sql: "UPDATE users SET active = true" });
    expect(result.content[0].text).toContain("UPDATE");
    expect(result.content[0].text).toContain("5");
  });
});
