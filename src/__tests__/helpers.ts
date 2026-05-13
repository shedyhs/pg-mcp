import pg from "pg";
import { inject } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../server.js";
import { connections } from "../shared/connections.js";

const { Pool } = pg;

export async function setupMcpClient() {
  const server = createServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);

  const client = new Client({ name: "test-client", version: "1.0.0" });
  await client.connect(clientTransport);

  return { client, server, cleanup: () => connections.clear() };
}

export function createRealPool() {
  return new Pool({
    host: inject("pgHost"),
    port: inject("pgPort"),
    database: inject("pgDatabase"),
    user: inject("pgUser"),
    password: inject("pgPassword"),
    max: 5,
  });
}

export function seedRealConnection(id: string, pool: pg.Pool, readOnly = false) {
  connections.set(id, {
    pool,
    readOnly,
    config: {
      host: inject("pgHost"),
      port: inject("pgPort"),
      database: inject("pgDatabase"),
      user: inject("pgUser"),
      password: inject("pgPassword"),
    },
  });
}

export function getTextContent(result: unknown): string {
  const r = result as { content: Array<{ type: string; text: string }> };
  return r.content[0].text;
}

export function isError(result: unknown): boolean {
  const r = result as { isError?: boolean };
  return r.isError === true;
}
