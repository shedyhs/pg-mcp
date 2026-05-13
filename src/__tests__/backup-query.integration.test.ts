import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import { setupMcpClient, createRealPool, seedRealConnection, getTextContent, isError } from "./helpers.js";
import { connections } from "../shared/connections.js";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";

describe("pg_backup_query integration", () => {
  let client: Client;
  let cleanup: () => void;
  let pool: pg.Pool;
  let tmpFile: string;

  beforeAll(async () => {
    const ctx = await setupMcpClient();
    client = ctx.client;
    cleanup = ctx.cleanup;
    pool = createRealPool();

    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        total NUMERIC(10,2) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id),
        amount NUMERIC(10,2) NOT NULL,
        method VARCHAR(50) NOT NULL
      )
    `);

    await pool.query("INSERT INTO orders (user_id, total) VALUES (42, 100.50), (42, 250.00), (99, 30.00)");
    await pool.query(`
      INSERT INTO payments (order_id, amount, method) VALUES
        (1, 100.50, 'credit_card'),
        (2, 250.00, 'pix')
    `);
  });

  afterAll(async () => {
    await pool.query("DROP TABLE IF EXISTS payments");
    await pool.query("DROP TABLE IF EXISTS orders");
    await pool.end();
    cleanup();
  });

  afterEach(async () => {
    connections.delete("test");
    try { await unlink(tmpFile); } catch {}
  });

  it("returns error when connection does not exist", async () => {
    tmpFile = join(tmpdir(), `pg-mcp-test-${Date.now()}.sql`);
    const result = await client.callTool({
      name: "pg_backup_query",
      arguments: {
        connectionId: "nope",
        outputPath: tmpFile,
        targets: [{ table: "orders", where: "id = 1" }],
      },
    });
    expect(isError(result)).toBe(true);
    expect(getTextContent(result)).toContain("not found");
  });

  it("generates INSERT statements from real data", async () => {
    tmpFile = join(tmpdir(), `pg-mcp-test-${Date.now()}.sql`);
    seedRealConnection("test", pool);

    const result = await client.callTool({
      name: "pg_backup_query",
      arguments: {
        connectionId: "test",
        outputPath: tmpFile,
        targets: [{ table: "orders", where: "user_id = 42" }],
      },
    });

    expect(isError(result)).toBeFalsy();
    expect(getTextContent(result)).toContain("Rows: 2");

    const content = await readFile(tmpFile, "utf-8");
    expect(content).toContain("BEGIN;");
    expect(content).toContain("COMMIT;");
    expect(content).toContain("INSERT INTO orders");
    expect(content).toContain("100.50");
    expect(content).toContain("250.00");
  });

  it("handles multiple targets across related tables", async () => {
    tmpFile = join(tmpdir(), `pg-mcp-test-${Date.now()}.sql`);
    seedRealConnection("test", pool);

    const result = await client.callTool({
      name: "pg_backup_query",
      arguments: {
        connectionId: "test",
        outputPath: tmpFile,
        targets: [
          { table: "orders", where: "user_id = 42" },
          { table: "payments", where: "order_id IN (SELECT id FROM orders WHERE user_id = 42)" },
        ],
      },
    });

    expect(isError(result)).toBeFalsy();
    expect(getTextContent(result)).toContain("Tables: 2");
    expect(getTextContent(result)).toContain("Rows: 4");

    const content = await readFile(tmpFile, "utf-8");
    expect(content).toContain("INSERT INTO orders");
    expect(content).toContain("INSERT INTO payments");
    expect(content).toContain("credit_card");
    expect(content).toContain("pix");
  });

  it("writes comment when no rows match", async () => {
    tmpFile = join(tmpdir(), `pg-mcp-test-${Date.now()}.sql`);
    seedRealConnection("test", pool);

    const result = await client.callTool({
      name: "pg_backup_query",
      arguments: {
        connectionId: "test",
        outputPath: tmpFile,
        targets: [{ table: "orders", where: "user_id = 999999" }],
      },
    });

    expect(isError(result)).toBeFalsy();
    expect(getTextContent(result)).toContain("Rows: 0");

    const content = await readFile(tmpFile, "utf-8");
    expect(content).toContain("no rows found");
  });

  it("returns error for invalid table", async () => {
    tmpFile = join(tmpdir(), `pg-mcp-test-${Date.now()}.sql`);
    seedRealConnection("test", pool);

    const result = await client.callTool({
      name: "pg_backup_query",
      arguments: {
        connectionId: "test",
        outputPath: tmpFile,
        targets: [{ table: "nonexistent_table", where: "1=1" }],
      },
    });

    expect(isError(result)).toBe(true);
    expect(getTextContent(result)).toContain("nonexistent_table");
  });

  it("generates valid SQL that can be re-executed", async () => {
    tmpFile = join(tmpdir(), `pg-mcp-test-${Date.now()}.sql`);
    seedRealConnection("test", pool);

    await client.callTool({
      name: "pg_backup_query",
      arguments: {
        connectionId: "test",
        outputPath: tmpFile,
        targets: [{ table: "orders", where: "user_id = 99" }],
      },
    });

    await pool.query("DELETE FROM orders WHERE user_id = 99");
    const before = await pool.query("SELECT * FROM orders WHERE user_id = 99");
    expect(before.rows).toHaveLength(0);

    const backupSql = await readFile(tmpFile, "utf-8");
    await pool.query(backupSql);

    const after = await pool.query("SELECT * FROM orders WHERE user_id = 99");
    expect(after.rows).toHaveLength(1);
    expect(Number(after.rows[0].total)).toBe(30);
  });
});
