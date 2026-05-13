import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupMcpClient, createRealPool, seedRealConnection, getTextContent, isError } from "./helpers.js";
import { connections } from "../shared/connections.js";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type pg from "pg";

describe("pg_disconnect integration", () => {
  let client: Client;
  let cleanup: () => void;

  beforeAll(async () => {
    const ctx = await setupMcpClient();
    client = ctx.client;
    cleanup = ctx.cleanup;
  });

  afterAll(() => cleanup());

  it("disconnects an existing connection", async () => {
    const pool = createRealPool();
    seedRealConnection("to-disconnect", pool);
    expect(connections.has("to-disconnect")).toBe(true);

    const result = await client.callTool({
      name: "pg_disconnect",
      arguments: { connectionId: "to-disconnect" },
    });

    expect(isError(result)).toBeFalsy();
    expect(getTextContent(result)).toContain("Disconnected");
    expect(connections.has("to-disconnect")).toBe(false);
  });

  it("returns error when disconnecting non-existent connection", async () => {
    const result = await client.callTool({
      name: "pg_disconnect",
      arguments: { connectionId: "nope" },
    });

    expect(isError(result)).toBe(true);
    expect(getTextContent(result)).toContain("not found");
  });
});
