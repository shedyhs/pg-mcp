import { describe, it, expect, vi, afterEach } from "vitest";
import { handleDump } from "../handler.js";
import { connections } from "../../../shared/connections.js";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

vi.mock("node:util", () => ({
  promisify: (fn: any) => fn,
}));

import { execFile } from "node:child_process";
const mockExecFile = vi.mocked(execFile as any);

describe("handleDump", () => {
  afterEach(() => {
    connections.clear();
    vi.restoreAllMocks();
  });

  it("returns error when schemaOnly and dataOnly are both true", async () => {
    const result = await handleDump({
      connectionId: "test",
      outputPath: "/tmp/x.sql",
      format: "plain",
      schemaOnly: true,
      dataOnly: true,
      clean: false,
      ifExists: false,
      noOwner: false,
      noPrivileges: false,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("mutually exclusive");
  });

  it("returns error when connection not found", async () => {
    const result = await handleDump({
      connectionId: "nope",
      outputPath: "/tmp/x.sql",
      format: "plain",
      schemaOnly: false,
      dataOnly: false,
      clean: false,
      ifExists: false,
      noOwner: false,
      noPrivileges: false,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  it("returns success on successful dump", async () => {
    connections.set("test", {
      pool: {} as any,
      readOnly: true,
      config: { host: "localhost", database: "mydb" },
    });
    mockExecFile.mockResolvedValue({ stdout: "", stderr: "" });

    const result = await handleDump({
      connectionId: "test",
      outputPath: "/tmp/dump.sql",
      format: "plain",
      schemaOnly: false,
      dataOnly: false,
      clean: false,
      ifExists: false,
      noOwner: false,
      noPrivileges: false,
    });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Dump saved to /tmp/dump.sql");
  });

  it("includes warnings from stderr", async () => {
    connections.set("test", {
      pool: {} as any,
      readOnly: true,
      config: {},
    });
    mockExecFile.mockResolvedValue({ stdout: "", stderr: "some warning" });

    const result = await handleDump({
      connectionId: "test",
      outputPath: "/tmp/dump.sql",
      format: "plain",
      schemaOnly: false,
      dataOnly: false,
      clean: false,
      ifExists: false,
      noOwner: false,
      noPrivileges: false,
    });
    expect(result.content[0].text).toContain("Warnings:");
    expect(result.content[0].text).toContain("some warning");
  });

  it("sets PGPASSWORD env var when password is configured", async () => {
    connections.set("test", {
      pool: {} as any,
      readOnly: true,
      config: { password: "secret123" },
    });

    let capturedEnv: Record<string, string> | undefined;
    mockExecFile.mockImplementation((...args: unknown[]) => {
      const opts = args.find((a) => typeof a === "object" && a !== null && "env" in a) as any;
      capturedEnv = opts?.env;
      return Promise.resolve({ stdout: "", stderr: "" });
    });

    await handleDump({
      connectionId: "test",
      outputPath: "/tmp/dump.sql",
      format: "plain",
      schemaOnly: false,
      dataOnly: false,
      clean: false,
      ifExists: false,
      noOwner: false,
      noPrivileges: false,
    });

    expect(capturedEnv?.PGPASSWORD).toBe("secret123");
  });

  it("returns ENOENT error when pg_dump not installed", async () => {
    connections.set("test", {
      pool: {} as any,
      readOnly: true,
      config: {},
    });
    mockExecFile.mockRejectedValue({ code: "ENOENT" });

    const result = await handleDump({
      connectionId: "test",
      outputPath: "/tmp/dump.sql",
      format: "plain",
      schemaOnly: false,
      dataOnly: false,
      clean: false,
      ifExists: false,
      noOwner: false,
      noPrivileges: false,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("pg_dump not found");
  });

  it("returns stderr on other errors", async () => {
    connections.set("test", {
      pool: {} as any,
      readOnly: true,
      config: {},
    });
    mockExecFile.mockRejectedValue({ stderr: "permission denied" });

    const result = await handleDump({
      connectionId: "test",
      outputPath: "/tmp/dump.sql",
      format: "plain",
      schemaOnly: false,
      dataOnly: false,
      clean: false,
      ifExists: false,
      noOwner: false,
      noPrivileges: false,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("permission denied");
  });
});
