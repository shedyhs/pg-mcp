import { describe, it, expect, beforeEach, afterEach, inject } from "vitest";
import { createServer, type Server, type Socket } from "node:net";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { autoConnect, whenConnectionsReady } from "../auto-connect.js";
import { connections } from "../shared/connections.js";
import { cleanupConnections } from "../server.js";

const UNREACHABLE_URL = "postgres://nobody:nobody@127.0.0.1:1/nowhere";

describe("autoConnect integration", () => {
  let dir: string;
  let configPath: string;
  let credentialsPath: string;
  let uri: string;
  const originalReadOnly = process.env.PG_MCP_READ_ONLY;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "pg-mcp-auto-"));
    configPath = join(dir, "connections.json");
    // Pinned to the temp dir so the suite never reads the real credentials file.
    credentialsPath = join(dir, "credentials.json");
    uri = inject("postgresUri");
    delete process.env.PG_MCP_READ_ONLY;
  });

  afterEach(async () => {
    await cleanupConnections();
    connections.clear();
    rmSync(dir, { recursive: true, force: true });
    if (originalReadOnly === undefined) {
      delete process.env.PG_MCP_READ_ONLY;
    } else {
      process.env.PG_MCP_READ_ONLY = originalReadOnly;
    }
  });

  const writeConfig = (doc: unknown) => writeFileSync(configPath, JSON.stringify(doc));

  it("opens every named connection from the config file", async () => {
    writeConfig({
      connections: [
        { id: "primary", url: uri, readOnly: true },
        { id: "secondary", url: uri, readOnly: false },
      ],
    });

    await autoConnect({ env: {}, configPath, credentialsPath });

    expect([...connections.keys()]).toEqual(["primary", "secondary"]);
    expect(connections.get("primary")?.readOnly).toBe(true);
    expect(connections.get("secondary")?.readOnly).toBe(false);
  });

  it("opens named connections from PG_MCP_CONNECTIONS", async () => {
    await autoConnect({
      env: { PG_MCP_CONNECTIONS: JSON.stringify([{ id: "staging", url: uri }]) },
      configPath,
      credentialsPath,
    });

    expect([...connections.keys()]).toEqual(["staging"]);
  });

  it("expands ${VAR} in a config file url", async () => {
    writeConfig({ connections: [{ id: "prod", url: "${SECRET_URL}" }] });

    await autoConnect({ env: { SECRET_URL: uri }, configPath, credentialsPath });

    expect(connections.has("prod")).toBe(true);
  });

  it("still opens 'default' from DATABASE_URL", async () => {
    await autoConnect({ env: { DATABASE_URL: uri }, configPath, credentialsPath });

    expect([...connections.keys()]).toEqual(["default"]);
  });

  it("defaults an entry without readOnly to PG_MCP_READ_ONLY", async () => {
    writeConfig({ connections: [{ id: "prod", url: uri }] });

    await autoConnect({ env: { PG_MCP_READ_ONLY: "false" }, configPath, credentialsPath });

    expect(connections.get("prod")?.readOnly).toBe(false);
  });

  it("defaults an entry without readOnly to read-only when nothing says otherwise", async () => {
    writeConfig({ connections: [{ id: "prod", url: uri }] });

    await autoConnect({ env: {}, configPath, credentialsPath });

    expect(connections.get("prod")?.readOnly).toBe(true);
  });

  it("keeps the healthy connections when one of them fails to open", async () => {
    writeConfig({
      connections: [
        { id: "broken", url: UNREACHABLE_URL },
        { id: "healthy", url: uri },
      ],
    });

    await autoConnect({ env: {}, configPath, credentialsPath });

    expect(connections.has("broken")).toBe(false);
    expect(connections.has("healthy")).toBe(true);
  });

  it("skips an entry whose ${VAR} is missing and opens the rest", async () => {
    writeConfig({
      connections: [
        { id: "prod", url: "postgres://app:${MISSING_PW}@prod:5432/app" },
        { id: "local", url: uri },
      ],
    });

    await autoConnect({ env: {}, configPath, credentialsPath });

    expect([...connections.keys()]).toEqual(["local"]);
  });

  it("makes a tool call wait for startup connections instead of seeing an empty registry", async () => {
    writeConfig({ connections: [{ id: "prod", url: uri }] });

    // Mirrors index.ts: autoConnect is started but not awaited before the
    // transport accepts calls, so a caller must be able to await readiness.
    void autoConnect({ env: {}, configPath, credentialsPath });
    expect(connections.size).toBe(0);

    await whenConnectionsReady();

    expect(connections.has("prod")).toBe(true);
  });

  it("gives up on a host that accepts TCP but never answers, without stalling the healthy ones", async () => {
    // A silent listener: the TCP connect succeeds and nothing ever answers, so
    // only the explicit health-check bound can end the attempt.
    const accepted: Socket[] = [];
    const silent: Server = createServer((socket) => void accepted.push(socket));
    await new Promise<void>((resolve) => silent.listen(0, "127.0.0.1", resolve));
    const port = (silent.address() as { port: number }).port;

    try {
      writeConfig({
        connections: [
          { id: "silent", url: `postgres://u:p@127.0.0.1:${port}/db` },
          { id: "healthy", url: uri },
        ],
      });

      const startedAt = Date.now();
      await autoConnect({ env: {}, configPath, credentialsPath, healthCheckTimeoutMs: 300 });
      const elapsed = Date.now() - startedAt;

      expect(connections.has("silent")).toBe(false);
      expect(connections.has("healthy")).toBe(true);
      expect(elapsed).toBeLessThan(5_000);
    } finally {
      // close() waits on live sockets, and the abandoned pool still holds one.
      for (const socket of accepted) socket.destroy();
      await new Promise<void>((resolve) => silent.close(() => resolve()));
    }
  });

  it("does nothing when there is no config file and no env", async () => {
    await autoConnect({ env: {}, configPath, credentialsPath });

    expect(connections.size).toBe(0);
  });
});
