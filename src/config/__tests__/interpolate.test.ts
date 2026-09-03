import { describe, it, expect } from "vitest";
import { interpolateEnv } from "../interpolate.js";

describe("interpolateEnv", () => {
  it("returns the value unchanged when there is nothing to interpolate", () => {
    expect(interpolateEnv("postgres://dev:dev@localhost:5432/app", {})).toBe(
      "postgres://dev:dev@localhost:5432/app",
    );
  });

  it("expands a ${VAR} reference from the provided env", () => {
    const result = interpolateEnv("postgres://app:${PROD_PW}@prod:5432/app", { PROD_PW: "s3cret" });

    expect(result).toBe("postgres://app:s3cret@prod:5432/app");
  });

  it("expands multiple references, including repeated ones", () => {
    const result = interpolateEnv("postgres://${USER}:${PW}@${HOST}:5432/${USER}", {
      USER: "app",
      PW: "pw",
      HOST: "db.example.com",
    });

    expect(result).toBe("postgres://app:pw@db.example.com:5432/app");
  });

  it("escapes URL delimiters in an embedded value, so a var cannot span components", () => {
    // Consequence of the encoding rule: a var holding "host:port" gets its
    // separator escaped. Use two references, or a whole-value one, instead.
    expect(interpolateEnv("postgres://u:p@${HOST}/app", { HOST: "db:5432" })).toBe(
      "postgres://u:p@db%3A5432/app",
    );
  });

  it("throws when a referenced variable is not set", () => {
    expect(() => interpolateEnv("postgres://app:${MISSING}@h/db", {})).toThrowError(/MISSING/);
  });

  it("throws when a referenced variable is set to an empty string", () => {
    expect(() => interpolateEnv("postgres://app:${EMPTY}@h/db", { EMPTY: "" })).toThrowError(/EMPTY/);
  });

  it("percent-encodes an embedded value so it cannot re-parse as a new authority", () => {
    // A password containing '@' would otherwise end the userinfo section and
    // turn the rest of it into the host - silently redirecting the connection.
    const result = interpolateEnv("postgres://app:${PW}@10.0.0.5:5432/prod", {
      PW: "x@evilhost:5432/prod#",
    });

    expect(result).toBe("postgres://app:x%40evilhost%3A5432%2Fprod%23@10.0.0.5:5432/prod");
    expect(new URL(result).hostname).toBe("10.0.0.5");
    expect(new URL(result).password).toBe("x%40evilhost%3A5432%2Fprod%23");
  });

  it("keeps a slash or hash in a password from changing the database", () => {
    const result = interpolateEnv("postgres://app:${PW}@db:5432/app", { PW: "a/b#c" });

    const url = new URL(result);
    expect(url.hostname).toBe("db");
    expect(url.pathname).toBe("/app");
  });

  it("substitutes a whole-value reference verbatim, since it is a full URL", () => {
    const url = "postgres://app:p@ss@db.example.com:5432/app?sslmode=require";

    expect(interpolateEnv("${DATABASE_URL}", { DATABASE_URL: url })).toBe(url);
  });

  it("leaves a bare $VAR without braces untouched", () => {
    expect(interpolateEnv("literal $NOT_A_REF here", { NOT_A_REF: "x" })).toBe("literal $NOT_A_REF here");
  });
});
