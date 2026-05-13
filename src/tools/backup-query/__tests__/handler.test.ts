import { describe, it, expect, afterEach } from "vitest";
import { readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleBackupQuery } from "../handler.js";
import { connections } from "../../../shared/connections.js";

function mockPool(results: Record<string, { rows: Record<string, unknown>[]; fields: { name: string }[] }>) {
  return {
    query: (sql: string) => {
      for (const [key, value] of Object.entries(results)) {
        if (sql.includes(key)) return value;
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  } as any;
}

describe("handleBackupQuery", () => {
  const tempFiles: string[] = [];

  function tempPath() {
    const p = join(tmpdir(), `pg-mcp-test-${Date.now()}-${Math.random().toString(36).slice(2)}.sql`);
    tempFiles.push(p);
    return p;
  }

  afterEach(async () => {
    connections.clear();
    for (const f of tempFiles) {
      await unlink(f).catch(() => {});
    }
    tempFiles.length = 0;
  });

  it("returns error when connection not found", async () => {
    const result = await handleBackupQuery({
      connectionId: "nope",
      outputPath: "/tmp/x.sql",
      targets: [{ table: "t", where: "1=1" }],
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  it("generates INSERT statements and writes file", async () => {
    const out = tempPath();
    connections.set("test", {
      pool: mockPool({
        users: {
          rows: [
            { id: 1, name: "Alice" },
            { id: 2, name: "Bob" },
          ],
          fields: [{ name: "id" }, { name: "name" }],
        },
      }),
      readOnly: true,
      config: {},
    });

    const result = await handleBackupQuery({
      connectionId: "test",
      outputPath: out,
      targets: [{ table: "users", where: "id IN (1, 2)" }],
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Rows: 2");

    const content = await readFile(out, "utf-8");
    expect(content).toContain("BEGIN;");
    expect(content).toContain("COMMIT;");
    expect(content).toContain('INSERT INTO users ("id", "name") VALUES (1, \'Alice\');');
    expect(content).toContain('INSERT INTO users ("id", "name") VALUES (2, \'Bob\');');
  });

  it("handles multiple targets", async () => {
    const out = tempPath();
    connections.set("test", {
      pool: mockPool({
        orders: {
          rows: [{ id: 10, user_id: 1 }],
          fields: [{ name: "id" }, { name: "user_id" }],
        },
        users: {
          rows: [{ id: 1, name: "Alice" }],
          fields: [{ name: "id" }, { name: "name" }],
        },
      }),
      readOnly: true,
      config: {},
    });

    const result = await handleBackupQuery({
      connectionId: "test",
      outputPath: out,
      targets: [
        { table: "orders", where: "user_id = 1" },
        { table: "users", where: "id = 1" },
      ],
    });

    expect(result.content[0].text).toContain("Tables: 2");
    expect(result.content[0].text).toContain("Rows: 2");

    const content = await readFile(out, "utf-8");
    expect(content).toContain("INSERT INTO orders");
    expect(content).toContain("INSERT INTO users");
  });

  it("adds comment when target returns no rows", async () => {
    const out = tempPath();
    connections.set("test", {
      pool: mockPool({
        empty: { rows: [], fields: [{ name: "id" }] },
      }),
      readOnly: true,
      config: {},
    });

    const result = await handleBackupQuery({
      connectionId: "test",
      outputPath: out,
      targets: [{ table: "empty", where: "1=0" }],
    });

    expect(result.content[0].text).toContain("Rows: 0");

    const content = await readFile(out, "utf-8");
    expect(content).toContain("no rows found");
    expect(content).not.toContain("INSERT");
  });

  it("returns error when query fails", async () => {
    connections.set("test", {
      pool: {
        query: () => {
          throw new Error("relation does not exist");
        },
      } as any,
      readOnly: true,
      config: {},
    });

    const result = await handleBackupQuery({
      connectionId: "test",
      outputPath: "/tmp/x.sql",
      targets: [{ table: "nonexistent", where: "1=1" }],
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("relation does not exist");
  });
});
