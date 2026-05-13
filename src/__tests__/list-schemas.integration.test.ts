import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import pg from "pg";
import { setupMcpClient, createRealPool, seedRealConnection, getTextContent, isError } from "./helpers.js";
import { connections } from "../shared/connections.js";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";

describe("pg_list_schemas integration", () => {
  let client: Client;
  let cleanup: () => void;
  let pool: pg.Pool;

  beforeAll(async () => {
    const ctx = await setupMcpClient();
    client = ctx.client;
    cleanup = ctx.cleanup;
    pool = createRealPool();
  });

  afterAll(async () => {
    await pool.end();
    cleanup();
  });

  afterEach(() => {
    connections.delete("test");
  });

  it("returns error when connection does not exist", async () => {
    const result = await client.callTool({
      name: "pg_list_schemas",
      arguments: { connectionId: "nope" },
    });
    expect(isError(result)).toBe(true);
    expect(getTextContent(result)).toContain("not found");
  });

  it("returns public schema from real database", async () => {
    seedRealConnection("test", pool);

    const result = await client.callTool({
      name: "pg_list_schemas",
      arguments: { connectionId: "test" },
    });

    expect(isError(result)).toBeFalsy();
    const schemas = JSON.parse(getTextContent(result));
    const names = schemas.map((s: { schema_name: string }) => s.schema_name);
    expect(names).toContain("public");
  });
});
