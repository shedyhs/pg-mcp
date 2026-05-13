import { describe, it, expect, vi } from "vitest";

vi.mock("pg", () => {
  class MockPool {
    opts: any;
    constructor(opts: any) {
      this.opts = opts;
    }
  }
  return { default: { Pool: MockPool } };
});

import { createPool } from "../handler.js";

describe("createPool", () => {
  it("creates pool with connection string when url provided", () => {
    const pool = createPool({ url: "postgres://localhost/mydb" }) as any;
    expect(pool.opts.connectionString).toBe("postgres://localhost/mydb");
    expect(pool.opts.max).toBe(5);
  });

  it("creates pool with individual params when host provided", () => {
    const pool = createPool({
      host: "localhost",
      port: 5432,
      database: "mydb",
      user: "admin",
      password: "secret",
    }) as any;
    expect(pool.opts.host).toBe("localhost");
    expect(pool.opts.port).toBe(5432);
    expect(pool.opts.database).toBe("mydb");
    expect(pool.opts.user).toBe("admin");
    expect(pool.opts.password).toBe("secret");
  });

  it("creates pool with individual params when database provided", () => {
    const pool = createPool({ database: "mydb" }) as any;
    expect(pool.opts.database).toBe("mydb");
  });

  it("enables ssl with rejectUnauthorized false", () => {
    const pool = createPool({ host: "db.host", ssl: true }) as any;
    expect(pool.opts.ssl).toEqual({ rejectUnauthorized: false });
  });

  it("disables ssl by default", () => {
    const pool = createPool({ host: "db.host" }) as any;
    expect(pool.opts.ssl).toBe(false);
  });

  it("creates pool with only pool options when no params", () => {
    const pool = createPool() as any;
    expect(pool.opts.max).toBe(5);
    expect(pool.opts.connectionString).toBeUndefined();
    expect(pool.opts.host).toBeUndefined();
  });

  it("always includes pool timeout settings", () => {
    const pool = createPool({ url: "postgres://localhost/db" }) as any;
    expect(pool.opts.idleTimeoutMillis).toBe(30000);
    expect(pool.opts.connectionTimeoutMillis).toBe(10000);
  });
});
