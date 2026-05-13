import { describe, it, expect } from "vitest";
import { buildArgs } from "../handler.js";
import type { ConnectionConfig } from "../../../shared/types.js";

function makeInput(overrides: Record<string, unknown> = {}) {
  return {
    connectionId: "test",
    inputPath: "/tmp/dump.custom",
    schemaOnly: false,
    dataOnly: false,
    clean: false,
    ifExists: false,
    noOwner: false,
    noPrivileges: false,
    create: false,
    exitOnError: false,
    singleTransaction: false,
    verbose: false,
    ...overrides,
  };
}

describe("restore buildArgs", () => {
  it("uses connection string when provided", () => {
    const config: ConnectionConfig = { connectionString: "postgres://localhost/mydb" };
    const args = buildArgs(makeInput(), config);
    expect(args).toContain("-d");
    expect(args).toContain("postgres://localhost/mydb");
  });

  it("uses individual params when no connection string", () => {
    const config: ConnectionConfig = {
      host: "db.host",
      port: 5433,
      user: "admin",
      database: "mydb",
    };
    const args = buildArgs(makeInput(), config);
    expect(args).toEqual(
      expect.arrayContaining(["-h", "db.host", "-p", "5433", "-U", "admin", "-d", "mydb"])
    );
  });

  it("always includes --no-password and input path as last arg", () => {
    const args = buildArgs(makeInput(), {});
    expect(args).toContain("--no-password");
    expect(args[args.length - 1]).toBe("/tmp/dump.custom");
  });

  it("adds --schema-only", () => {
    const args = buildArgs(makeInput({ schemaOnly: true }), {});
    expect(args).toContain("--schema-only");
  });

  it("adds --data-only", () => {
    const args = buildArgs(makeInput({ dataOnly: true }), {});
    expect(args).toContain("--data-only");
  });

  it("adds --clean and --if-exists", () => {
    const args = buildArgs(makeInput({ clean: true, ifExists: true }), {});
    expect(args).toContain("--clean");
    expect(args).toContain("--if-exists");
  });

  it("adds --no-owner and --no-privileges", () => {
    const args = buildArgs(makeInput({ noOwner: true, noPrivileges: true }), {});
    expect(args).toContain("--no-owner");
    expect(args).toContain("--no-privileges");
  });

  it("adds --create", () => {
    const args = buildArgs(makeInput({ create: true }), {});
    expect(args).toContain("--create");
  });

  it("adds --exit-on-error", () => {
    const args = buildArgs(makeInput({ exitOnError: true }), {});
    expect(args).toContain("--exit-on-error");
  });

  it("adds --single-transaction", () => {
    const args = buildArgs(makeInput({ singleTransaction: true }), {});
    expect(args).toContain("--single-transaction");
  });

  it("adds --verbose", () => {
    const args = buildArgs(makeInput({ verbose: true }), {});
    expect(args).toContain("--verbose");
  });

  it("adds -j for parallel jobs", () => {
    const args = buildArgs(makeInput({ jobs: 4 }), {});
    expect(args).toEqual(expect.arrayContaining(["-j", "4"]));
  });

  it("adds -n for schema filter", () => {
    const args = buildArgs(makeInput({ schema: "public" }), {});
    expect(args).toEqual(expect.arrayContaining(["-n", "public"]));
  });

  it("adds -t for each table", () => {
    const args = buildArgs(makeInput({ table: ["users", "orders"] }), {});
    expect(args.filter((a) => a === "-t")).toHaveLength(2);
    expect(args).toContain("users");
    expect(args).toContain("orders");
  });
});
