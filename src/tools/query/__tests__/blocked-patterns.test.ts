import { describe, it, expect } from "vitest";
import { isBlockedQuery } from "../blocked-patterns.js";

describe("isBlockedQuery", () => {
  const blocked = [
    "INSERT INTO users VALUES (1)",
    "UPDATE users SET name = 'x'",
    "DELETE FROM users WHERE id = 1",
    "TRUNCATE TABLE users",
    "MERGE INTO users USING ...",
    "CREATE TABLE t (id int)",
    "ALTER TABLE t ADD COLUMN x int",
    "DROP TABLE t",
    "RENAME TABLE t TO t2",
    "GRANT SELECT ON t TO role",
    "REVOKE SELECT ON t FROM role",
    "COPY users TO '/tmp/out.csv'",
    "VACUUM users",
    "REINDEX TABLE users",
    "CLUSTER users USING idx",
    "COMMENT ON TABLE users IS 'x'",
  ];

  for (const sql of blocked) {
    it(`blocks: ${sql.slice(0, 40)}`, () => {
      expect(isBlockedQuery(sql)).toBe(true);
    });
  }

  it("blocks queries with leading whitespace", () => {
    expect(isBlockedQuery("  INSERT INTO t VALUES (1)")).toBe(true);
    expect(isBlockedQuery("\n\tDELETE FROM t")).toBe(true);
  });

  it("is case insensitive", () => {
    expect(isBlockedQuery("insert into t values (1)")).toBe(true);
    expect(isBlockedQuery("Delete From t")).toBe(true);
  });

  const allowed = [
    "SELECT * FROM users",
    "SELECT 1",
    "WITH cte AS (SELECT 1) SELECT * FROM cte",
    "EXPLAIN SELECT * FROM users",
    "SHOW server_version",
  ];

  for (const sql of allowed) {
    it(`allows: ${sql.slice(0, 40)}`, () => {
      expect(isBlockedQuery(sql)).toBe(false);
    });
  }
});
