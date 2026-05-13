import { describe, it, expect, vi, afterEach } from "vitest";
import { handleRestore } from "../handler.js";
import { connections } from "../../../shared/connections.js";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

vi.mock("node:util", () => ({
  promisify: (fn: any) => fn,
}));

import { execFile } from "node:child_process";
const mockExecFile = vi.mocked(execFile as any);

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

describe("handleRestore", () => {
  afterEach(() => {
    connections.clear();
    vi.restoreAllMocks();
  });

  it("returns error when schemaOnly and dataOnly are both true", async () => {
    const result = await handleRestore(makeInput({ schemaOnly: true, dataOnly: true }));
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("mutually exclusive");
  });

  it("returns error when connection not found", async () => {
    const result = await handleRestore(makeInput({ connectionId: "nope" }));
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  it("returns success on successful restore", async () => {
    connections.set("test", {
      pool: {} as any,
      readOnly: false,
      config: { host: "localhost", database: "mydb" },
    });
    mockExecFile.mockResolvedValue({ stdout: "", stderr: "" });

    const result = await handleRestore(makeInput());
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("restored successfully");
  });

  it("includes output from stderr", async () => {
    connections.set("test", {
      pool: {} as any,
      readOnly: false,
      config: {},
    });
    mockExecFile.mockResolvedValue({ stdout: "", stderr: "restoring table users" });

    const result = await handleRestore(makeInput());
    expect(result.content[0].text).toContain("restoring table users");
  });

  it("sets PGPASSWORD env var when password is configured", async () => {
    connections.set("test", {
      pool: {} as any,
      readOnly: false,
      config: { password: "secret" },
    });

    let capturedEnv: Record<string, string> | undefined;
    mockExecFile.mockImplementation((...args: unknown[]) => {
      const opts = args.find((a) => typeof a === "object" && a !== null && "env" in a) as any;
      capturedEnv = opts?.env;
      return Promise.resolve({ stdout: "", stderr: "" });
    });

    await handleRestore(makeInput());
    expect(capturedEnv?.PGPASSWORD).toBe("secret");
  });

  it("returns ENOENT error when pg_restore not installed", async () => {
    connections.set("test", {
      pool: {} as any,
      readOnly: false,
      config: {},
    });
    mockExecFile.mockRejectedValue({ code: "ENOENT" });

    const result = await handleRestore(makeInput());
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("pg_restore not found");
  });

  it("returns stderr on other errors", async () => {
    connections.set("test", {
      pool: {} as any,
      readOnly: false,
      config: {},
    });
    mockExecFile.mockRejectedValue({ stderr: "invalid archive" });

    const result = await handleRestore(makeInput());
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("invalid archive");
  });
});
