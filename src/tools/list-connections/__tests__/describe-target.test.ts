import { describe, it, expect } from "vitest";
import { describeTarget } from "../handler.js";

describe("describeTarget", () => {
  it("reduces a connection string to host, port and database", () => {
    expect(describeTarget({ connectionString: "postgres://app:s3cret@db.example.com:5433/shop" })).toBe(
      "db.example.com:5433/shop",
    );
  });

  it("never leaks the user or the password from a connection string", () => {
    const target = describeTarget({ connectionString: "postgres://app:s3cret@db.example.com:5432/shop" });

    expect(target).not.toContain("s3cret");
    expect(target).not.toContain("app");
    expect(target).not.toContain("@");
  });

  it("assumes the default port when the connection string omits it", () => {
    expect(describeTarget({ connectionString: "postgres://u:p@localhost/app" })).toBe("localhost:5432/app");
  });

  it("describes individual parameters without the password", () => {
    const target = describeTarget({
      host: "localhost",
      port: 5432,
      database: "app",
      user: "dev",
      password: "hunter2",
    });

    expect(target).toBe("localhost:5432/app");
    expect(target).not.toContain("hunter2");
  });

  it("falls back to the default port for individual parameters", () => {
    expect(describeTarget({ host: "localhost", database: "app" })).toBe("localhost:5432/app");
  });

  it("reports libpq env vars when the config is empty", () => {
    expect(describeTarget({})).toBe("libpq env vars");
  });

  it("marks the database as unknown when the connection string carries no path", () => {
    expect(describeTarget({ connectionString: "postgres://u:p@localhost:5432" })).toBe("localhost:5432/?");
  });

  it("marks the host as unknown when only the database is configured", () => {
    expect(describeTarget({ database: "app" })).toBe("?:5432/app");
  });

  it("does not throw on an unparseable connection string", () => {
    expect(describeTarget({ connectionString: "not a url" })).toBe("unknown target");
  });
});
