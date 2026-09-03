import { describe, it, expect } from "vitest";
import { splitPassword } from "../connection-url.js";

describe("splitPassword", () => {
  it("takes the password out of the URL and returns it separately", () => {
    const result = splitPassword("postgres://app:s3cret@db:5432/shop");

    expect(result.url).not.toContain("s3cret");
    expect(result.password).toBe("s3cret");
  });

  it("keeps the user, host, port, database and query intact", () => {
    const { url } = splitPassword("postgres://app:s3cret@db:5432/shop?sslmode=require");

    const parsed = new URL(url);
    expect(parsed.username).toBe("app");
    expect(parsed.hostname).toBe("db");
    expect(parsed.port).toBe("5432");
    expect(parsed.pathname).toBe("/shop");
    expect(parsed.searchParams.get("sslmode")).toBe("require");
  });

  it("decodes a percent-encoded password back to its real value", () => {
    const result = splitPassword("postgres://app:p%40ss%2Fw%23rd@db:5432/shop");

    expect(result.password).toBe("p@ss/w#rd");
  });

  it("leaves a URL without a password untouched", () => {
    const raw = "postgres://app@db:5432/shop";

    expect(splitPassword(raw)).toEqual({ url: raw });
  });

  it("returns an unparseable value unchanged rather than throwing", () => {
    expect(splitPassword("not a url")).toEqual({ url: "not a url" });
  });
});
