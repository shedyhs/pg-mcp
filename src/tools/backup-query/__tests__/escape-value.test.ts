import { describe, it, expect } from "vitest";
import { escapeValue } from "../handler.js";

describe("escapeValue", () => {
  it("returns NULL for null", () => {
    expect(escapeValue(null)).toBe("NULL");
  });

  it("returns NULL for undefined", () => {
    expect(escapeValue(undefined)).toBe("NULL");
  });

  it("returns TRUE/FALSE for booleans", () => {
    expect(escapeValue(true)).toBe("TRUE");
    expect(escapeValue(false)).toBe("FALSE");
  });

  it("returns number as string", () => {
    expect(escapeValue(42)).toBe("42");
    expect(escapeValue(3.14)).toBe("3.14");
    expect(escapeValue(0)).toBe("0");
    expect(escapeValue(-1)).toBe("-1");
  });

  it("wraps strings in single quotes", () => {
    expect(escapeValue("hello")).toBe("'hello'");
  });

  it("escapes single quotes in strings", () => {
    expect(escapeValue("it's")).toBe("'it''s'");
    expect(escapeValue("a''b")).toBe("'a''''b'");
  });

  it("formats Date as ISO string", () => {
    const date = new Date("2024-01-15T10:30:00.000Z");
    expect(escapeValue(date)).toBe("'2024-01-15T10:30:00.000Z'");
  });

  it("formats Buffer as hex", () => {
    const buf = Buffer.from([0xde, 0xad, 0xbe, 0xef]);
    expect(escapeValue(buf)).toBe("'\\xdeadbeef'");
  });

  it("formats arrays as ARRAY[]", () => {
    expect(escapeValue([1, 2, 3])).toBe("ARRAY[1, 2, 3]");
    expect(escapeValue(["a", "b"])).toBe("ARRAY['a', 'b']");
    expect(escapeValue([])).toBe("ARRAY[]");
  });

  it("formats objects as jsonb", () => {
    expect(escapeValue({ key: "value" })).toBe(`'{"key":"value"}'::jsonb`);
  });

  it("escapes single quotes inside JSON", () => {
    expect(escapeValue({ msg: "it's" })).toBe(`'{"msg":"it''s"}'::jsonb`);
  });
});
