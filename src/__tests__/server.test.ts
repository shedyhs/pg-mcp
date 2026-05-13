import { describe, it, expect, afterEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer, cleanupConnections } from "../server.js";
import { connections } from "../shared/connections.js";

describe("createServer", () => {
  afterEach(async () => {
    connections.clear();
  });

  async function setupClient() {
    const server = createServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    await client.connect(clientTransport);
    return { client, server };
  }

  it("registers all expected tools", async () => {
    const { client } = await setupClient();
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);

    expect(names).toContain("pg_connect");
    expect(names).toContain("pg_disconnect");
    expect(names).toContain("pg_query");
    expect(names).toContain("pg_list_schemas");
    expect(names).toContain("pg_get_ddl");
    expect(names).toContain("pg_dump");
    expect(names).toContain("pg_restore");
    expect(names).toContain("pg_backup_query");
    expect(names).toHaveLength(8);
  });

  it("can call pg_query tool and get connection error", async () => {
    const { client } = await setupClient();
    const result = await client.callTool({
      name: "pg_query",
      arguments: { connectionId: "nonexistent", sql: "SELECT 1" },
    });
    expect(result.isError).toBe(true);
    const text = (result.content as any)[0].text;
    expect(text).toContain("not found");
  });

  it("can call pg_backup_query tool and get connection error", async () => {
    const { client } = await setupClient();
    const result = await client.callTool({
      name: "pg_backup_query",
      arguments: {
        connectionId: "nonexistent",
        outputPath: "/tmp/backup.sql",
        targets: [{ table: "users", where: "id = 1" }],
      },
    });
    expect(result.isError).toBe(true);
    const text = (result.content as any)[0].text;
    expect(text).toContain("not found");
  });

  it("can call pg_disconnect tool and get connection error", async () => {
    const { client } = await setupClient();
    const result = await client.callTool({
      name: "pg_disconnect",
      arguments: { connectionId: "nonexistent" },
    });
    expect(result.isError).toBe(true);
  });
});

describe("cleanupConnections", () => {
  it("ends all pools and clears the map", async () => {
    const pools: { ended: boolean }[] = [];
    for (const id of ["a", "b", "c"]) {
      const pool = { ended: false, end: async function () { this.ended = true; } };
      pools.push(pool);
      connections.set(id, { pool: pool as any, readOnly: true, config: {} });
    }

    await cleanupConnections();
    for (const pool of pools) {
      expect(pool.ended).toBe(true);
    }
  });
});
