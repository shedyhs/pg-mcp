import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveConnectionSpecs, type ResolveOptions } from "../resolve.js";

describe("resolveConnectionSpecs", () => {
  let dir: string;
  let configPath: string;
  let credentialsPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "pg-mcp-config-"));
    configPath = join(dir, "connections.json");
    // Pinned to the temp dir so the suite never reads the real credentials file.
    credentialsPath = join(dir, "credentials.json");
  });

  const resolve = (options: Omit<ResolveOptions, "credentialsPath">) =>
    resolveConnectionSpecs({ ...options, credentialsPath });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const writeConfig = (doc: unknown) => writeFileSync(configPath, JSON.stringify(doc));

  it("returns nothing when there is no config file and no env", () => {
    const result = resolve({ env: {}, configPath });

    expect(result.specs).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("does not report a missing config file as an error", () => {
    const result = resolve({ env: {}, configPath: join(dir, "nope.json") });

    expect(result.errors).toEqual([]);
  });

  it("builds a 'default' spec from DATABASE_URL", () => {
    const result = resolve({
      env: { DATABASE_URL: "postgres://u:p@localhost:5432/app" },
      configPath,
    });

    expect(result.specs).toEqual([
      {
        id: "default",
        url: "postgres://u:p@localhost:5432/app",
        readOnly: undefined,
        source: "DATABASE_URL",
      },
    ]);
  });

  it("builds a urlless 'default' spec from libpq vars so pg reads them itself", () => {
    const result = resolve({ env: { PGHOST: "localhost", PGDATABASE: "app" }, configPath });

    expect(result.specs).toHaveLength(1);
    expect(result.specs[0].id).toBe("default");
    expect(result.specs[0].url).toBeUndefined();
  });

  it("does not build a 'default' spec from PGUSER/PGPASSWORD alone", () => {
    const result = resolve({ env: { PGUSER: "u", PGPASSWORD: "p" }, configPath });

    expect(result.specs).toEqual([]);
  });

  it("reads named connections from the config file", () => {
    writeConfig({
      connections: [
        { id: "prod", url: "postgres://u:p@prod:5432/app", readOnly: true },
        { id: "local", url: "postgres://dev:dev@localhost:5432/app", readOnly: false },
      ],
    });

    const result = resolve({ env: {}, configPath });

    expect(result.specs.map((s) => s.id)).toEqual(["prod", "local"]);
    expect(result.specs[0].readOnly).toBe(true);
  });

  it("interpolates config file urls from the env", () => {
    writeConfig({ connections: [{ id: "prod", url: "postgres://app:${PROD_PW}@prod:5432/app" }] });

    const result = resolve({ env: { PROD_PW: "s3cret" }, configPath });

    expect(result.specs[0].url).toBe("postgres://app:s3cret@prod:5432/app");
  });

  it("reads named connections from PG_MCP_CONNECTIONS", () => {
    const result = resolve({
      env: {
        PG_MCP_CONNECTIONS: JSON.stringify([{ id: "staging", url: "postgres://u:p@stg:5432/app" }]),
      },
      configPath,
    });

    expect(result.specs.map((s) => s.id)).toEqual(["staging"]);
  });

  it("lets PG_MCP_CONNECTIONS override a same-id entry from the file, keeping file order", () => {
    writeConfig({
      connections: [
        { id: "prod", url: "postgres://from-file@h/db", readOnly: true },
        { id: "local", url: "postgres://local@h/db" },
      ],
    });

    const result = resolve({
      env: {
        PG_MCP_CONNECTIONS: JSON.stringify([{ id: "prod", url: "postgres://from-env@h/db", readOnly: false }]),
      },
      configPath,
    });

    expect(result.specs.map((s) => s.id)).toEqual(["prod", "local"]);
    expect(result.specs[0].url).toBe("postgres://from-env@h/db");
    expect(result.specs[0].readOnly).toBe(false);
  });

  it("lets DATABASE_URL override a 'default' entry defined in the file", () => {
    writeConfig({ connections: [{ id: "default", url: "postgres://from-file@h/db" }] });

    const result = resolve({
      env: { DATABASE_URL: "postgres://from-env@h/db" },
      configPath,
    });

    expect(result.specs).toHaveLength(1);
    expect(result.specs[0].url).toBe("postgres://from-env@h/db");
  });

  it("merges file, PG_MCP_CONNECTIONS and DATABASE_URL together", () => {
    writeConfig({ connections: [{ id: "prod", url: "postgres://prod@h/db" }] });

    const result = resolve({
      env: {
        PG_MCP_CONNECTIONS: JSON.stringify([{ id: "staging", url: "postgres://stg@h/db" }]),
        DATABASE_URL: "postgres://dev@h/db",
      },
      configPath,
    });

    expect(result.specs.map((s) => s.id)).toEqual(["prod", "staging", "default"]);
  });

  it("collects errors from a malformed config file without losing env connections", () => {
    writeFileSync(configPath, "{ not json");

    const result = resolve({
      env: { DATABASE_URL: "postgres://dev@h/db" },
      configPath,
    });

    expect(result.specs.map((s) => s.id)).toEqual(["default"]);
    expect(result.errors).toHaveLength(1);
  });

  it("warns about a world-writable config file, which anyone could repoint", () => {
    writeConfig({ connections: [{ id: "prod", url: "postgres://prod@h/db" }] });
    chmodSync(configPath, 0o666);

    const result = resolve({ env: {}, configPath });

    expect(result.specs.map((s) => s.id)).toEqual(["prod"]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/world-writable/);
  });

  it("stays quiet about a config file that only the owner can write", () => {
    writeConfig({ connections: [{ id: "prod", url: "postgres://prod@h/db" }] });
    chmodSync(configPath, 0o600);

    expect(resolve({ env: {}, configPath }).errors).toEqual([]);
  });

  it("reports when a higher-precedence source overrides a connection id", () => {
    writeConfig({ connections: [{ id: "default", url: "postgres://from-file@h/db" }] });

    const result = resolve({ env: { DATABASE_URL: "postgres://from-env@h/db" }, configPath });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/DATABASE_URL/);
    expect(result.errors[0]).toMatch(/overrides/);
  });

  it("rejects an entry with an unknown key instead of silently dropping it", () => {
    writeConfig({ connections: [{ id: "prod", url: "postgres://prod@h/db", raedOnly: true }] });

    const result = resolve({ env: {}, configPath });

    expect(result.specs).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/raedOnly/);
  });

  it("fills the password from credentials.json into a URL that has none", () => {
    writeConfig({ connections: [{ id: "prod", url: "postgres://app@db:5432/shop" }] });
    writeFileSync(credentialsPath, JSON.stringify({ prod: "s3cret" }));
    chmodSync(credentialsPath, 0o600);

    const result = resolve({ env: {}, configPath });

    expect(result.errors).toEqual([]);
    expect(result.specs[0].url).toBe("postgres://app:s3cret@db:5432/shop");
  });

  it("applies a credential to a connection that came from DATABASE_URL", () => {
    writeFileSync(credentialsPath, JSON.stringify({ default: "s3cret" }));
    chmodSync(credentialsPath, 0o600);

    const result = resolve({ env: { DATABASE_URL: "postgres://app@db:5432/shop" }, configPath });

    expect(result.specs[0].url).toBe("postgres://app:s3cret@db:5432/shop");
  });

  it("warns when credentials.json is readable beyond its owner", () => {
    writeConfig({ connections: [{ id: "prod", url: "postgres://app@db:5432/shop" }] });
    writeFileSync(credentialsPath, JSON.stringify({ prod: "s3cret" }));
    chmodSync(credentialsPath, 0o644);

    const result = resolve({ env: {}, configPath });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/readable beyond its owner/);
    expect(result.errors[0]).not.toContain("s3cret");
    // The warning is advisory: the password is still applied.
    expect(result.specs[0].url).toContain("s3cret");
  });

  it("refuses to hand a file password to a connection whose id was claimed by an env source", () => {
    // The password is meant for the reviewed host in connections.json. An env
    // var claiming the same id must not be able to redirect it elsewhere.
    writeConfig({ connections: [{ id: "prod", url: "postgres://app@good.example.com:5432/app" }] });
    writeFileSync(credentialsPath, JSON.stringify({ prod: "real-secret" }));
    chmodSync(credentialsPath, 0o600);

    const result = resolve({
      env: {
        PG_MCP_CONNECTIONS: JSON.stringify([{ id: "prod", url: "postgres://x@attacker.example:5432/x" }]),
      },
      configPath,
    });

    expect(result.specs[0].url).toBe("postgres://x@attacker.example:5432/x");
    expect(result.specs[0].url).not.toContain("real-secret");
    expect(result.errors.some((e) => /refusing the password for 'prod'/.test(e))).toBe(true);
    expect(result.errors.every((e) => !e.includes("real-secret"))).toBe(true);
  });

  it("refuses a credential for 'default' when DATABASE_URL contests an id from the file", () => {
    writeConfig({ connections: [{ id: "default", url: "postgres://app@good.example.com:5432/app" }] });
    writeFileSync(credentialsPath, JSON.stringify({ default: "real-secret" }));
    chmodSync(credentialsPath, 0o600);

    const result = resolve({ env: { DATABASE_URL: "postgres://x@attacker.example/x" }, configPath });

    expect(result.specs[0].url).not.toContain("real-secret");
    expect(result.errors.some((e) => /refusing the password/.test(e))).toBe(true);
  });

  it("still applies a credential to an uncontested id from an env source", () => {
    writeFileSync(credentialsPath, JSON.stringify({ default: "s3cret" }));
    chmodSync(credentialsPath, 0o600);

    const result = resolve({ env: { DATABASE_URL: "postgres://app@db:5432/shop" }, configPath });

    expect(result.specs[0].url).toBe("postgres://app:s3cret@db:5432/shop");
    expect(result.errors.filter((e) => /refusing/.test(e))).toEqual([]);
  });

  it("works with no credentials file at all", () => {
    writeConfig({ connections: [{ id: "prod", url: "postgres://app:inline@db:5432/shop" }] });

    const result = resolve({ env: {}, configPath });

    expect(result.errors).toEqual([]);
    expect(result.specs[0].url).toBe("postgres://app:inline@db:5432/shop");
  });

  it("reports a config path that cannot be read for a reason other than 'missing'", () => {
    // A directory is readable-but-not-a-file: an EISDIR, not an ENOENT.
    const result = resolve({ env: {}, configPath: dir });

    expect(result.specs).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(new RegExp(dir));
  });

  it("collects errors from a malformed PG_MCP_CONNECTIONS without losing file connections", () => {
    writeConfig({ connections: [{ id: "prod", url: "postgres://prod@h/db" }] });

    const result = resolve({ env: { PG_MCP_CONNECTIONS: "[oops" }, configPath });

    expect(result.specs.map((s) => s.id)).toEqual(["prod"]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/PG_MCP_CONNECTIONS/);
  });
});
