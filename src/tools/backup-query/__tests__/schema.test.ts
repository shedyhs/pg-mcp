import { describe, it, expect } from "vitest";
import { BackupQuerySchema } from "../schema.js";

describe("BackupQuerySchema", () => {
  it("accepts valid input", () => {
    const result = BackupQuerySchema.safeParse({
      connectionId: "test",
      outputPath: "/tmp/backup.sql",
      targets: [{ table: "users", where: "id = 1" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty targets array", () => {
    const result = BackupQuerySchema.safeParse({
      connectionId: "test",
      outputPath: "/tmp/backup.sql",
      targets: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing table in target", () => {
    const result = BackupQuerySchema.safeParse({
      connectionId: "test",
      outputPath: "/tmp/backup.sql",
      targets: [{ where: "id = 1" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing where in target", () => {
    const result = BackupQuerySchema.safeParse({
      connectionId: "test",
      outputPath: "/tmp/backup.sql",
      targets: [{ table: "users" }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts multiple targets", () => {
    const result = BackupQuerySchema.safeParse({
      connectionId: "test",
      outputPath: "/tmp/backup.sql",
      targets: [
        { table: "orders", where: "user_id = 1" },
        { table: "users", where: "id = 1" },
      ],
    });
    expect(result.success).toBe(true);
  });
});
