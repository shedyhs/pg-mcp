import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { connections } from "../../../shared/connections.js";

vi.mock("pg", () => {
  const mockClient = {
    query: vi.fn().mockResolvedValue({ rows: [{ version: "PostgreSQL 16.0" }] }),
    release: vi.fn(),
  };
  class MockPool {
    connect = vi.fn().mockResolvedValue(mockClient);
    end = vi.fn();
  }
  return { default: { Pool: MockPool } };
});

import { handleConnect } from "../handler.js";

describe("handleConnect", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.DATABASE_URL;
    delete process.env.PGHOST;
    delete process.env.PGDATABASE;
  });

  afterEach(() => {
    connections.clear();
    process.env = { ...originalEnv };
  });

  it("returns error when connection already exists", async () => {
    connections.set("existing", {
      pool: {} as any,
      readOnly: true,
      config: {},
    });

    const result = await handleConnect({
      connectionId: "existing",
      port: 5432,
      ssl: false,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("already exists");
  });

  it("returns error when no connection params provided", async () => {
    const result = await handleConnect({
      connectionId: "test",
      port: 5432,
      ssl: false,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Provide");
  });

  it("connects with url", async () => {
    const result = await handleConnect({
      connectionId: "test",
      url: "postgres://localhost/mydb",
      port: 5432,
      ssl: false,
    });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Connected");
    expect(result.content[0].text).toContain("READ-ONLY");
    expect(connections.has("test")).toBe(true);
  });

  it("connects with individual params", async () => {
    const result = await handleConnect({
      connectionId: "test",
      host: "localhost",
      database: "mydb",
      user: "admin",
      password: "secret",
      port: 5432,
      ssl: false,
    });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Connected");
    expect(connections.get("test")?.config.host).toBe("localhost");
  });

  it("connects via DATABASE_URL env var", async () => {
    process.env.DATABASE_URL = "postgres://localhost/envdb";
    const result = await handleConnect({
      connectionId: "test",
      port: 5432,
      ssl: false,
    });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Connected");
  });

  it("connects via PGHOST env var", async () => {
    process.env.PGHOST = "pghost.local";
    process.env.PGDATABASE = "pgdb";
    const result = await handleConnect({
      connectionId: "test",
      port: 5432,
      ssl: false,
    });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Connected");
  });

  it("respects explicit readOnly=false", async () => {
    const result = await handleConnect({
      connectionId: "rw",
      url: "postgres://localhost/mydb",
      port: 5432,
      ssl: false,
      readOnly: false,
    });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).not.toContain("READ-ONLY");
    expect(connections.get("rw")?.readOnly).toBe(false);
  });
});
