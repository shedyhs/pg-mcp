import { describe, it, expect } from "vitest";
import { parseConnectionsDocument } from "../parse.js";

const SOURCE = "test-source";

describe("parseConnectionsDocument", () => {
  it("parses the object form with a connections array", () => {
    const text = JSON.stringify({
      connections: [
        { id: "prod", url: "postgres://u:p@prod:5432/app", readOnly: true },
        { id: "local", url: "postgres://dev:dev@localhost:5432/app", readOnly: false },
      ],
    });

    const result = parseConnectionsDocument(text, SOURCE, {});

    expect(result.errors).toEqual([]);
    expect(result.specs).toEqual([
      { id: "prod", url: "postgres://u:p@prod:5432/app", readOnly: true, source: SOURCE },
      { id: "local", url: "postgres://dev:dev@localhost:5432/app", readOnly: false, source: SOURCE },
    ]);
  });

  it("parses the bare array form", () => {
    const text = JSON.stringify([{ id: "prod", url: "postgres://u:p@prod:5432/app" }]);

    const result = parseConnectionsDocument(text, SOURCE, {});

    expect(result.errors).toEqual([]);
    expect(result.specs).toEqual([
      { id: "prod", url: "postgres://u:p@prod:5432/app", readOnly: undefined, source: SOURCE },
    ]);
  });

  it("interpolates ${VAR} references in the url", () => {
    const text = JSON.stringify([{ id: "prod", url: "postgres://app:${PROD_PW}@prod:5432/app" }]);

    const result = parseConnectionsDocument(text, SOURCE, { PROD_PW: "s3cret" });

    expect(result.errors).toEqual([]);
    expect(result.specs[0].url).toBe("postgres://app:s3cret@prod:5432/app");
  });

  it("skips only the entry whose variable is missing and keeps the rest", () => {
    const text = JSON.stringify([
      { id: "prod", url: "postgres://app:${MISSING}@prod:5432/app" },
      { id: "local", url: "postgres://dev:dev@localhost:5432/app" },
    ]);

    const result = parseConnectionsDocument(text, SOURCE, {});

    expect(result.specs.map((s) => s.id)).toEqual(["local"]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/prod/);
    expect(result.errors[0]).toMatch(/MISSING/);
  });

  it("never echoes the document text in a JSON error, so passwords stay out of logs", () => {
    const truncated = '[{"id":"prod","url":"postgres://admin:hunter2@prod.example.com:5432/app"},]';

    const result = parseConnectionsDocument(truncated, SOURCE, {});

    expect(result.specs).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).not.toContain("hunter2");
    expect(result.errors[0]).not.toContain("prod.example.com");
    expect(result.errors[0]).toMatch(/invalid JSON/);
  });

  it("keeps the position in a JSON error, since that is what makes it actionable", () => {
    const result = parseConnectionsDocument('[{"id":"prod" "url":"postgres://u:p@h/db"}]', SOURCE, {});

    expect(result.errors[0]).toMatch(/at position \d+/);
  });

  it("reports invalid JSON without throwing", () => {
    const result = parseConnectionsDocument("{ not json", SOURCE, {});

    expect(result.specs).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(new RegExp(SOURCE));
  });

  it("reports a document that does not match the expected shape", () => {
    const result = parseConnectionsDocument(JSON.stringify({ foo: "bar" }), SOURCE, {});

    expect(result.specs).toEqual([]);
    expect(result.errors).toHaveLength(1);
  });

  it("rejects an entry with a missing id and keeps the valid ones", () => {
    const text = JSON.stringify([{ url: "postgres://u:p@h/db" }, { id: "ok", url: "postgres://u:p@h/db" }]);

    const result = parseConnectionsDocument(text, SOURCE, {});

    expect(result.specs.map((s) => s.id)).toEqual(["ok"]);
    expect(result.errors).toHaveLength(1);
  });

  it("rejects duplicate ids inside the same document, keeping the first", () => {
    const text = JSON.stringify([
      { id: "prod", url: "postgres://first@h/db" },
      { id: "prod", url: "postgres://second@h/db" },
    ]);

    const result = parseConnectionsDocument(text, SOURCE, {});

    expect(result.specs).toHaveLength(1);
    expect(result.specs[0].url).toBe("postgres://first@h/db");
    expect(result.errors[0]).toMatch(/prod/);
  });

  it("returns nothing for an empty connections list", () => {
    const result = parseConnectionsDocument(JSON.stringify({ connections: [] }), SOURCE, {});

    expect(result.specs).toEqual([]);
    expect(result.errors).toEqual([]);
  });
});
