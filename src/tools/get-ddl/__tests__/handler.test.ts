import { describe, it, expect, afterEach } from "vitest";
import { handleGetDdl } from "../handler.js";
import { connections } from "../../../shared/connections.js";

function createMockPool(queryResults: Record<string, { rows: any[] }>) {
  let callIndex = 0;
  const calls: string[] = [];
  return {
    pool: {
      query: async (sql: string, _params?: unknown[]) => {
        calls.push(sql);
        for (const [keyword, result] of Object.entries(queryResults)) {
          if (sql.includes(keyword)) return result;
        }
        return { rows: [] };
      },
    } as any,
    calls,
  };
}

describe("handleGetDdl", () => {
  afterEach(() => {
    connections.clear();
  });

  it("returns error when connection not found", async () => {
    const result = await handleGetDdl({ connectionId: "nope" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  it("generates DDL for enums", async () => {
    const { pool } = createMockPool({
      pg_enum: {
        rows: [{ schema: "public", name: "status", values: ["active", "inactive"] }],
      },
    });

    connections.set("test", { pool, readOnly: true, config: {} });
    const result = await handleGetDdl({ connectionId: "test" });
    expect(result.content[0].text).toContain("CREATE TYPE public.status AS ENUM");
    expect(result.content[0].text).toContain("'active'");
    expect(result.content[0].text).toContain("'inactive'");
  });

  it("generates DDL for sequences", async () => {
    const { pool } = createMockPool({
      pg_sequences: {
        rows: [{
          schema: "public",
          name: "users_id_seq",
          start_value: 1,
          increment_by: 1,
          min_value: 1,
          max_value: 9999,
          cycle: false,
        }],
      },
    });

    connections.set("test", { pool, readOnly: true, config: {} });
    const result = await handleGetDdl({ connectionId: "test" });
    expect(result.content[0].text).toContain("CREATE SEQUENCE public.users_id_seq");
    expect(result.content[0].text).toContain("START 1");
    expect(result.content[0].text).toContain("INCREMENT 1");
    expect(result.content[0].text).not.toContain("CYCLE");
  });

  it("generates DDL for sequences with CYCLE", async () => {
    const { pool } = createMockPool({
      pg_sequences: {
        rows: [{
          schema: "public",
          name: "cycled_seq",
          start_value: 1,
          increment_by: 10,
          min_value: 1,
          max_value: 100,
          cycle: true,
        }],
      },
    });

    connections.set("test", { pool, readOnly: true, config: {} });
    const result = await handleGetDdl({ connectionId: "test" });
    expect(result.content[0].text).toContain("CYCLE");
  });

  it("generates DDL for tables with columns and primary key", async () => {
    const { pool } = createMockPool({
      "c.relkind = 'r'": {
        rows: [{ schema: "public", table_name: "users", table_oid: 12345 }],
      },
      pg_attrdef: {
        rows: [
          { column_name: "id", data_type: "integer", not_null: true, default_value: "nextval('users_id_seq')" },
          { column_name: "name", data_type: "text", not_null: false, default_value: null },
        ],
      },
      "$1 AND i.indisprimary": {
        rows: [{ column_name: "id" }],
      },
    });

    connections.set("test", { pool, readOnly: true, config: {} });
    const result = await handleGetDdl({ connectionId: "test" });
    const text = result.content[0].text;
    expect(text).toContain("CREATE TABLE public.users");
    expect(text).toContain("id integer DEFAULT nextval('users_id_seq') NOT NULL");
    expect(text).toContain("name text");
    expect(text).toContain("PRIMARY KEY (id)");
  });

  it("generates DDL for table without primary key", async () => {
    const { pool } = createMockPool({
      "c.relkind = 'r'": {
        rows: [{ schema: "public", table_name: "logs", table_oid: 99999 }],
      },
      pg_attrdef: {
        rows: [
          { column_name: "message", data_type: "text", not_null: false, default_value: null },
        ],
      },
    });

    connections.set("test", { pool, readOnly: true, config: {} });
    const result = await handleGetDdl({ connectionId: "test" });
    const text = result.content[0].text;
    expect(text).toContain("CREATE TABLE public.logs");
    expect(text).toContain("message text");
    expect(text).not.toContain("PRIMARY KEY");
  });

  it("generates DDL for foreign keys", async () => {
    const { pool } = createMockPool({
      "FOREIGN KEY": {
        rows: [{
          schema: "public",
          table_name: "orders",
          constraint_name: "fk_user",
          column_name: "user_id",
          foreign_schema: "public",
          foreign_table: "users",
          foreign_column: "id",
          update_rule: "NO ACTION",
          delete_rule: "CASCADE",
        }],
      },
    });

    connections.set("test", { pool, readOnly: true, config: {} });
    const result = await handleGetDdl({ connectionId: "test" });
    const text = result.content[0].text;
    expect(text).toContain("ALTER TABLE public.orders ADD CONSTRAINT fk_user");
    expect(text).toContain("FOREIGN KEY (user_id)");
    expect(text).toContain("REFERENCES public.users(id)");
    expect(text).toContain("ON DELETE CASCADE");
  });

  it("generates DDL for unique constraints", async () => {
    const { pool } = createMockPool({
      "indisunique AND NOT ix.indisprimary": {
        rows: [{
          schema: "public",
          table_name: "users",
          constraint_name: "uq_email",
          columns: ["email"],
        }],
      },
    });

    connections.set("test", { pool, readOnly: true, config: {} });
    const result = await handleGetDdl({ connectionId: "test" });
    expect(result.content[0].text).toContain("ADD CONSTRAINT uq_email UNIQUE (email)");
  });

  it("generates DDL for indexes", async () => {
    const { pool } = createMockPool({
      "NOT ix.indisunique AND NOT ix.indisprimary": {
        rows: [{
          schema: "public",
          table_name: "users",
          index_name: "idx_name",
          index_def: "CREATE INDEX idx_name ON public.users USING btree (name)",
        }],
      },
    });

    connections.set("test", { pool, readOnly: true, config: {} });
    const result = await handleGetDdl({ connectionId: "test" });
    expect(result.content[0].text).toContain("CREATE INDEX idx_name ON public.users");
  });

  it("generates DDL for views", async () => {
    const { pool } = createMockPool({
      pg_views: {
        rows: [{
          schema: "public",
          name: "active_users",
          definition: "SELECT id, name FROM users WHERE active = true;",
        }],
      },
    });

    connections.set("test", { pool, readOnly: true, config: {} });
    const result = await handleGetDdl({ connectionId: "test" });
    expect(result.content[0].text).toContain("CREATE VIEW public.active_users AS");
    expect(result.content[0].text).toContain("SELECT id, name FROM users");
  });

  it("passes schema filter when schema is specified", async () => {
    const { pool, calls } = createMockPool({});
    connections.set("test", { pool, readOnly: true, config: {} });

    await handleGetDdl({ connectionId: "test", schema: "myschema" });
    const enumQuery = calls.find((q) => q.includes("pg_enum"));
    expect(enumQuery).toContain("n.nspname = 'myschema'");
  });

  it("returns empty DDL when database has no objects", async () => {
    const { pool } = createMockPool({});
    connections.set("test", { pool, readOnly: true, config: {} });

    const result = await handleGetDdl({ connectionId: "test" });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toBe("");
  });
});
