import { describe, it, expect } from "vitest";
import { DumpSchema } from "../schema.js";

describe("DumpSchema", () => {
  it("accepts valid minimal input", () => {
    const result = DumpSchema.safeParse({
      connectionId: "test",
      outputPath: "/tmp/dump.sql",
    });
    expect(result.success).toBe(true);
  });

  it("rejects schemaOnly + dataOnly", () => {
    const result = DumpSchema.safeParse({
      connectionId: "test",
      outputPath: "/tmp/dump.sql",
      schemaOnly: true,
      dataOnly: true,
    });
    expect(result.success).toBe(false);
  });

  it("defaults format to plain", () => {
    const result = DumpSchema.parse({
      connectionId: "test",
      outputPath: "/tmp/dump.sql",
    });
    expect(result.format).toBe("plain");
  });

  it("accepts all valid formats", () => {
    for (const format of ["plain", "custom", "directory", "tar"]) {
      const result = DumpSchema.safeParse({
        connectionId: "test",
        outputPath: "/tmp/dump",
        format,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid format", () => {
    const result = DumpSchema.safeParse({
      connectionId: "test",
      outputPath: "/tmp/dump",
      format: "xml",
    });
    expect(result.success).toBe(false);
  });

  it("accepts table and excludeTable arrays", () => {
    const result = DumpSchema.safeParse({
      connectionId: "test",
      outputPath: "/tmp/dump.sql",
      table: ["users", "orders"],
      excludeTable: ["logs"],
    });
    expect(result.success).toBe(true);
  });
});
