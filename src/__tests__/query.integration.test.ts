import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import pg from "pg";
import { setupMcpClient, createRealPool, seedRealConnection, getTextContent, isError } from "./helpers.js";
import { connections } from "../shared/connections.js";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";

describe("pg_query integration", () => {
  let client: Client;
  let cleanup: () => void;
  let pool: pg.Pool;

  beforeAll(async () => {
    const ctx = await setupMcpClient();
    client = ctx.client;
    cleanup = ctx.cleanup;
    pool = createRealPool();

    await pool.query(`
      CREATE TABLE IF NOT EXISTS test_users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100)
      )
    `);
    await pool.query("INSERT INTO test_users (name, email) VALUES ('Alice', 'alice@test.com')");
  });

  afterAll(async () => {
    await pool.query("DROP TABLE IF EXISTS test_users");
    await pool.end();
    cleanup();
  });

  afterEach(() => {
    connections.delete("test");
    connections.delete("readonly");
    connections.delete("writable");
  });

  it("returns error when connection does not exist", async () => {
    const result = await client.callTool({
      name: "pg_query",
      arguments: { connectionId: "nope", sql: "SELECT 1" },
    });
    expect(isError(result)).toBe(true);
    expect(getTextContent(result)).toContain("not found");
  });

  it("executes a SELECT and returns rows from real database", async () => {
    seedRealConnection("test", pool);

    const result = await client.callTool({
      name: "pg_query",
      arguments: { connectionId: "test", sql: "SELECT * FROM test_users WHERE name = 'Alice'" },
    });

    expect(isError(result)).toBeFalsy();
    const parsed = JSON.parse(getTextContent(result));
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].name).toBe("Alice");
    expect(parsed.rows[0].email).toBe("alice@test.com");
  });

  it("blocks INSERT on read-only connection", async () => {
    seedRealConnection("readonly", pool, true);

    const result = await client.callTool({
      name: "pg_query",
      arguments: { connectionId: "readonly", sql: "INSERT INTO test_users (name) VALUES ('Bob')" },
    });

    expect(isError(result)).toBe(true);
    expect(getTextContent(result)).toContain("READ-ONLY");
  });

  it("blocks DELETE on read-only connection", async () => {
    seedRealConnection("readonly", pool, true);

    const result = await client.callTool({
      name: "pg_query",
      arguments: { connectionId: "readonly", sql: "DELETE FROM test_users WHERE id = 1" },
    });

    expect(isError(result)).toBe(true);
    expect(getTextContent(result)).toContain("READ-ONLY");
  });

  it("blocks DDL on read-only connection", async () => {
    seedRealConnection("readonly", pool, true);

    for (const sql of [
      "DROP TABLE test_users",
      "CREATE TABLE temp_t (id int)",
      "TRUNCATE test_users",
    ]) {
      const result = await client.callTool({
        name: "pg_query",
        arguments: { connectionId: "readonly", sql },
      });
      expect(isError(result)).toBe(true);
      expect(getTextContent(result)).toContain("READ-ONLY");
    }
  });

  it("allows write operations on non-read-only connection and persists data", async () => {
    seedRealConnection("writable", pool, false);

    const insertResult = await client.callTool({
      name: "pg_query",
      arguments: {
        connectionId: "writable",
        sql: "INSERT INTO test_users (name, email) VALUES ('Charlie', 'charlie@test.com')",
      },
    });

    expect(isError(insertResult)).toBeFalsy();
    expect(getTextContent(insertResult)).toContain("Rows affected: 1");

    const selectResult = await client.callTool({
      name: "pg_query",
      arguments: {
        connectionId: "writable",
        sql: "SELECT * FROM test_users WHERE name = 'Charlie'",
      },
    });

    const parsed = JSON.parse(getTextContent(selectResult));
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].email).toBe("charlie@test.com");
  });
});
