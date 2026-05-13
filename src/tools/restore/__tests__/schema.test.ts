import { describe, it, expect } from "vitest";
import { RestoreSchema } from "../schema.js";

describe("RestoreSchema", () => {
  it("accepts valid minimal input", () => {
    const result = RestoreSchema.safeParse({
      connectionId: "test",
      inputPath: "/tmp/dump.custom",
    });
    expect(result.success).toBe(true);
  });

  it("rejects schemaOnly + dataOnly", () => {
    const result = RestoreSchema.safeParse({
      connectionId: "test",
      inputPath: "/tmp/dump.custom",
      schemaOnly: true,
      dataOnly: true,
    });
    expect(result.success).toBe(false);
  });

  it("defaults boolean fields to false", () => {
    const result = RestoreSchema.parse({
      connectionId: "test",
      inputPath: "/tmp/dump.custom",
    });
    expect(result.schemaOnly).toBe(false);
    expect(result.dataOnly).toBe(false);
    expect(result.clean).toBe(false);
    expect(result.create).toBe(false);
    expect(result.verbose).toBe(false);
  });

  it("accepts jobs as number", () => {
    const result = RestoreSchema.safeParse({
      connectionId: "test",
      inputPath: "/tmp/dump.custom",
      jobs: 4,
    });
    expect(result.success).toBe(true);
  });
});
