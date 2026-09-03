import { describe, it, expect, afterEach } from "vitest";
import type pg from "pg";
import { handleListConnections } from "../handler.js";
import { connections } from "../../../shared/connections.js";

const FAKE_POOL = {} as pg.Pool;

function getText(result: { content: Array<{ text: string }> }): string {
  return result.content[0].text;
}

describe("handleListConnections", () => {
  afterEach(() => connections.clear());

  it("reports that there is nothing open and points at pg_connect", async () => {
    const result = await handleListConnections();

    expect(result.isError).toBeFalsy();
    expect(getText(result)).toMatch(/no open connections/i);
    expect(getText(result)).toContain("pg_connect");
  });

  it("lists each connection with its id, target and mode", async () => {
    connections.set("default", {
      pool: FAKE_POOL,
      readOnly: true,
      config: { connectionString: "postgres://u:p@localhost:5432/app" },
    });
    connections.set("staging", {
      pool: FAKE_POOL,
      readOnly: false,
      config: { host: "stg.example.com", port: 5433, database: "shop" },
    });

    const text = getText(await handleListConnections());

    expect(text).toContain("default");
    expect(text).toContain("localhost:5432/app");
    expect(text).toContain("read-only");
    expect(text).toContain("staging");
    expect(text).toContain("stg.example.com:5433/shop");
    expect(text).toContain("read-write");
  });

  it("never includes credentials in the listing", async () => {
    connections.set("prod", {
      pool: FAKE_POOL,
      readOnly: true,
      config: { connectionString: "postgres://admin:hunter2@prod.example.com:5432/app" },
    });

    const text = getText(await handleListConnections());

    expect(text).not.toContain("hunter2");
    expect(text).not.toContain("admin");
  });

  it("preserves registration order", async () => {
    connections.set("first", { pool: FAKE_POOL, readOnly: true, config: {} });
    connections.set("second", { pool: FAKE_POOL, readOnly: true, config: {} });

    const text = getText(await handleListConnections());

    expect(text.indexOf("first")).toBeLessThan(text.indexOf("second"));
  });
});
