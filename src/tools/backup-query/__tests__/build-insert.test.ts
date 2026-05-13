import { describe, it, expect } from "vitest";
import { buildInsert } from "../handler.js";

describe("buildInsert", () => {
  it("generates INSERT with quoted column names", () => {
    const result = buildInsert("users", ["id", "name"], { id: 1, name: "Alice" });
    expect(result).toBe(`INSERT INTO users ("id", "name") VALUES (1, 'Alice');`);
  });

  it("handles NULL values", () => {
    const result = buildInsert("users", ["id", "email"], { id: 1, email: null });
    expect(result).toBe(`INSERT INTO users ("id", "email") VALUES (1, NULL);`);
  });

  it("handles mixed types", () => {
    const result = buildInsert("events", ["id", "active", "data"], {
      id: 42,
      active: true,
      data: { foo: "bar" },
    });
    expect(result).toBe(
      `INSERT INTO events ("id", "active", "data") VALUES (42, TRUE, '{"foo":"bar"}'::jsonb);`
    );
  });

  it("uses fully qualified table name", () => {
    const result = buildInsert("public.orders", ["id"], { id: 1 });
    expect(result).toBe(`INSERT INTO public.orders ("id") VALUES (1);`);
  });

  it("handles missing column in row as NULL", () => {
    const result = buildInsert("t", ["a", "b"], { a: 1 });
    expect(result).toBe(`INSERT INTO t ("a", "b") VALUES (1, NULL);`);
  });
});
