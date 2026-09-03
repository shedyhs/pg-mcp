import { describe, it, expect } from "vitest";
import { buildArgs } from "../handler.js";
import type { ConnectionConfig } from "../../../shared/types.js";

function makeInput(overrides: Record<string, unknown> = {}) {
  return {
    connectionId: "test",
    outputPath: "/tmp/dump.sql",
    format: "plain" as const,
    schemaOnly: false,
    dataOnly: false,
    clean: false,
    ifExists: false,
    noOwner: false,
    noPrivileges: false,
    ...overrides,
  };
}

describe("buildArgs", () => {
  it("uses connection string when provided", () => {
    const config: ConnectionConfig = { connectionString: "postgres://localhost/mydb" };
    const args = buildArgs(makeInput(), config);
    expect(args).toContain("-d");
    expect(args).toContain("postgres://localhost/mydb");
  });

  it("uses individual params when no connection string", () => {
    const config: ConnectionConfig = {
      host: "localhost",
      port: 5432,
      user: "admin",
      database: "mydb",
    };
    const args = buildArgs(makeInput(), config);
    expect(args).toEqual(
      expect.arrayContaining(["-h", "localhost", "-p", "5432", "-U", "admin", "-d", "mydb"])
    );
  });

  it("always includes --no-password, output path, and format", () => {
    const args = buildArgs(makeInput(), {});
    expect(args).toContain("--no-password");
    expect(args).toEqual(expect.arrayContaining(["-f", "/tmp/dump.sql"]));
    expect(args).toEqual(expect.arrayContaining(["-F", "p"]));
  });

  it("maps format to correct flag", () => {
    for (const [format, flag] of [
      ["plain", "p"],
      ["custom", "c"],
      ["directory", "d"],
      ["tar", "t"],
    ] as const) {
      const args = buildArgs(makeInput({ format }), {});
      expect(args).toContain(flag);
    }
  });

  it("adds --schema-only when schemaOnly is true", () => {
    const args = buildArgs(makeInput({ schemaOnly: true }), {});
    expect(args).toContain("--schema-only");
  });

  it("adds --data-only when dataOnly is true", () => {
    const args = buildArgs(makeInput({ dataOnly: true }), {});
    expect(args).toContain("--data-only");
  });

  it("adds --clean and --if-exists flags", () => {
    const args = buildArgs(makeInput({ clean: true, ifExists: true }), {});
    expect(args).toContain("--clean");
    expect(args).toContain("--if-exists");
  });

  it("adds --no-owner and --no-privileges", () => {
    const args = buildArgs(makeInput({ noOwner: true, noPrivileges: true }), {});
    expect(args).toContain("--no-owner");
    expect(args).toContain("--no-privileges");
  });

  it("adds --compress with level", () => {
    const args = buildArgs(makeInput({ compress: "9" }), {});
    expect(args).toEqual(expect.arrayContaining(["--compress", "9"]));
  });

  it("adds -n for schema filter", () => {
    const args = buildArgs(makeInput({ schema: "public" }), {});
    expect(args).toEqual(expect.arrayContaining(["-n", "public"]));
  });

  it("adds -t for each table", () => {
    const args = buildArgs(makeInput({ table: ["users", "orders"] }), {});
    const tFlags = args.filter((a, i) => a === "-t").length;
    expect(tFlags).toBe(2);
    expect(args).toContain("users");
    expect(args).toContain("orders");
  });

  it("adds -T for each excluded table", () => {
    const args = buildArgs(makeInput({ excludeTable: ["logs"] }), {});
    expect(args).toEqual(expect.arrayContaining(["-T", "logs"]));
  });
});

describe("password is never placed in argv", () => {
  it("strips the password from a connection string, since /proc/PID/cmdline is world-readable", () => {
    const config: ConnectionConfig = {
      connectionString: "postgres://app:s3cret@db:5432/shop?sslmode=require",
    };

    const args = buildArgs(makeInput(), config);

    expect(args.join(" ")).not.toContain("s3cret");
    const dbArg = args[args.indexOf("-d") + 1];
    expect(dbArg).toContain("db:5432/shop");
    expect(dbArg).toContain("sslmode=require");
  });

  it("keeps a password out of argv when it contains URL delimiters", () => {
    const config: ConnectionConfig = {
      connectionString: "postgres://app:p%40ss%2Fw%23rd@db:5432/shop",
    };

    const args = buildArgs(makeInput(), config);

    expect(args.join(" ")).not.toContain("p%40ss");
    expect(args.join(" ")).not.toContain("p@ss");
  });
});
