import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadCredentials } from "../credentials.js";
import { applyCredentials, parseCredentialsDocument, withPassword } from "../credentials.js";
import type { ConnectionSpec } from "../parse.js";

const SOURCE = "credentials.json";

const spec = (id: string, url?: string): ConnectionSpec => ({
  id,
  url,
  readOnly: undefined,
  source: "test",
});

describe("withPassword", () => {
  it("injects a password into a URL that has none", () => {
    expect(withPassword("postgres://app@db:5432/shop", "s3cret")).toBe(
      "postgres://app:s3cret@db:5432/shop",
    );
  });

  it("escapes a password containing URL delimiters", () => {
    const url = withPassword("postgres://app@db:5432/shop", "p@ss/w#rd:x");

    const parsed = new URL(url);
    expect(parsed.hostname).toBe("db");
    expect(parsed.pathname).toBe("/shop");
    expect(decodeURIComponent(parsed.password)).toBe("p@ss/w#rd:x");
  });

  it("replaces a password already present in the URL", () => {
    expect(withPassword("postgres://app:old@db:5432/shop", "new")).toBe(
      "postgres://app:new@db:5432/shop",
    );
  });

  it.each([
    "simples",
    "p@ss/w#rd",
    "100%pure",
    "50%off%20now",
    "x%40evil",
    "back\\slash",
    "a b c",
    "'; DROP--",
  ])("round-trips %j through the URL unchanged", (password) => {
    const url = withPassword("postgres://app@db:5432/shop", password);

    // What the driver ends up using, after pg-connection-string decodes it.
    expect(decodeURIComponent(new URL(url).password)).toBe(password);
  });

  it.each([
    "x@evil.example.com:5432/evildb#",
    "x@evil.example.com/evil?",
    "x%40evil.example.com%2Fevil",
    "x?host=evil.example.com",
    "x#frag",
  ])("cannot repoint the connection with password %j", (password) => {
    const url = new URL(withPassword("postgres://app@good.example.com:5432/realdb", password));

    expect(url.hostname).toBe("good.example.com");
    expect(url.port).toBe("5432");
    expect(url.pathname).toBe("/realdb");
  });

  it("preserves query parameters such as sslmode", () => {
    const url = withPassword("postgres://app@db:5432/shop?sslmode=require", "s3cret");

    expect(new URL(url).searchParams.get("sslmode")).toBe("require");
  });
});

describe("parseCredentialsDocument", () => {
  it("reads an id-to-password map", () => {
    const result = parseCredentialsDocument('{"prod":"a","staging":"b"}', SOURCE);

    expect(result.errors).toEqual([]);
    expect([...result.credentials]).toEqual([
      ["prod", "a"],
      ["staging", "b"],
    ]);
  });

  it("reports invalid JSON without echoing the document, so passwords stay out of logs", () => {
    const result = parseCredentialsDocument('{"prod":"hunter2",}', SOURCE);

    expect(result.credentials.size).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).not.toContain("hunter2");
  });

  it("reports a non-string value without echoing it", () => {
    const result = parseCredentialsDocument('{"prod":{"password":"hunter2"}}', SOURCE);

    expect(result.credentials.size).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).not.toContain("hunter2");
  });

  it.each([
    ['["senha"]', "an array"],
    ["null", "null"],
    ['"texto"', "a bare string"],
    ["42", "a number"],
    ['{"prod":""}', "an empty password"],
    ['{"":"x"}', "an empty id"],
  ])("rejects %s (%s) rather than accepting it silently", (document) => {
    const result = parseCredentialsDocument(document, SOURCE);

    expect(result.credentials.size).toBe(0);
    expect(result.errors).toHaveLength(1);
  });

  it("returns nothing for an empty map", () => {
    const result = parseCredentialsDocument("{}", SOURCE);

    expect(result.credentials.size).toBe(0);
    expect(result.errors).toEqual([]);
  });
});

describe("applyCredentials", () => {
  it("applies a password to the connection with the matching id", () => {
    const result = applyCredentials([spec("prod", "postgres://app@db:5432/shop")], new Map([["prod", "s3cret"]]));

    expect(result.specs[0].url).toBe("postgres://app:s3cret@db:5432/shop");
    expect(result.errors).toEqual([]);
  });

  it("leaves connections without a credential untouched", () => {
    const original = spec("local", "postgres://dev:dev@localhost:5432/app");

    const result = applyCredentials([original], new Map([["prod", "s3cret"]]));

    expect(result.specs[0].url).toBe("postgres://dev:dev@localhost:5432/app");
  });

  it("does not mutate the specs it was given", () => {
    const original = spec("prod", "postgres://app@db:5432/shop");

    applyCredentials([original], new Map([["prod", "s3cret"]]));

    expect(original.url).toBe("postgres://app@db:5432/shop");
  });

  it("reports a credential whose id matches no connection, which is usually a typo", () => {
    const result = applyCredentials([spec("prod", "postgres://app@db/shop")], new Map([["prodd", "s3cret"]]));

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/prodd/);
    expect(result.errors[0]).not.toContain("s3cret");
  });

  it("reports a credential for a connection that has no URL to inject into", () => {
    const result = applyCredentials([spec("default", undefined)], new Map([["default", "s3cret"]]));

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/default/);
    expect(result.errors[0]).not.toContain("s3cret");
  });

  it("reports an unusable URL without leaking the password", () => {
    const result = applyCredentials([spec("prod", "not a url")], new Map([["prod", "s3cret"]]));

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).not.toContain("s3cret");
  });
});

describe("loadCredentials", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "pg-mcp-creds-"));
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("treats a missing file as no credentials, not an error", () => {
    const result = loadCredentials(join(dir, "absent.json"));

    expect(result.credentials.size).toBe(0);
    expect(result.errors).toEqual([]);
  });

  it("reports a path that cannot be read for a reason other than 'missing'", () => {
    // A directory is readable-but-not-a-file: an EISDIR, not an ENOENT.
    const result = loadCredentials(dir);

    expect(result.credentials.size).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/could not be read/);
  });

  it("reads a well-formed file", () => {
    const path = join(dir, "credentials.json");
    writeFileSync(path, JSON.stringify({ prod: "s3cret" }), { mode: 0o600 });

    const result = loadCredentials(path);

    expect(result.credentials.get("prod")).toBe("s3cret");
    expect(result.errors).toEqual([]);
  });
});
