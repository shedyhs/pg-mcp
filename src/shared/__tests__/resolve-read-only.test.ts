import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolveReadOnly } from "../types.js";

describe("resolveReadOnly", () => {
  const originalEnv = process.env.PG_MCP_READ_ONLY;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.PG_MCP_READ_ONLY;
    } else {
      process.env.PG_MCP_READ_ONLY = originalEnv;
    }
  });

  it("returns explicit value when provided", () => {
    expect(resolveReadOnly(true)).toBe(true);
    expect(resolveReadOnly(false)).toBe(false);
  });

  it("reads PG_MCP_READ_ONLY env var", () => {
    process.env.PG_MCP_READ_ONLY = "false";
    expect(resolveReadOnly()).toBe(false);

    process.env.PG_MCP_READ_ONLY = "0";
    expect(resolveReadOnly()).toBe(false);

    process.env.PG_MCP_READ_ONLY = "true";
    expect(resolveReadOnly()).toBe(true);

    process.env.PG_MCP_READ_ONLY = "1";
    expect(resolveReadOnly()).toBe(true);
  });

  it("defaults to true when no explicit value and no env var", () => {
    delete process.env.PG_MCP_READ_ONLY;
    expect(resolveReadOnly()).toBe(true);
  });
});
