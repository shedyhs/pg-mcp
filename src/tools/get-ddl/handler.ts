import type pg from "pg";
import { GetDdlSchema } from "./schema.js";
import { connections } from "../../shared/connections.js";
import type { ToolResponse } from "../../shared/types.js";

export async function handleGetDdl(args: unknown): Promise<ToolResponse> {
  const input = GetDdlSchema.parse(args);

  const conn = connections.get(input.connectionId);
  if (!conn) {
    return {
      content: [
        {
          type: "text",
          text: `Connection '${input.connectionId}' not found. Connect first using pg_connect.`,
        },
      ],
      isError: true,
    };
  }

  const pool = conn.pool;
  const schemaFilter = input.schema
    ? `AND n.nspname = '${input.schema}'`
    : `AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')`;

  const ddlParts: string[] = [];

  await extractEnums(pool, schemaFilter, ddlParts);
  await extractSequences(pool, input.schema, ddlParts);
  await extractTables(pool, schemaFilter, ddlParts);
  await extractForeignKeys(pool, input.schema, ddlParts);
  await extractUniqueConstraints(pool, schemaFilter, ddlParts);
  await extractIndexes(pool, schemaFilter, ddlParts);
  await extractViews(pool, input.schema, ddlParts);

  return {
    content: [
      {
        type: "text",
        text: ddlParts.join("\n"),
      },
    ],
  };
}

async function extractEnums(pool: pg.Pool, schemaFilter: string, ddlParts: string[]): Promise<void> {
  const result = await pool.query(`
    SELECT n.nspname AS schema,
           t.typname AS name,
           ARRAY_AGG(e.enumlabel ORDER BY e.enumsortorder) AS values
    FROM pg_type t
    JOIN pg_namespace n ON t.typnamespace = n.oid
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typtype = 'e'
      ${schemaFilter}
    GROUP BY n.nspname, t.typname
    ORDER BY n.nspname, t.typname
  `);

  for (const row of result.rows) {
    const values = row.values.map((v: string) => `'${v}'`).join(", ");
    ddlParts.push(`-- ENUM: ${row.schema}.${row.name}`);
    ddlParts.push(`CREATE TYPE ${row.schema}.${row.name} AS ENUM (${values});\n`);
  }
}

async function extractSequences(pool: pg.Pool, schema: string | undefined, ddlParts: string[]): Promise<void> {
  const result = await pool.query(`
    SELECT schemaname AS schema,
           sequencename AS name,
           start_value,
           increment_by,
           min_value,
           max_value,
           cycle
    FROM pg_sequences
    WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      ${schema ? `AND schemaname = '${schema}'` : ""}
    ORDER BY schemaname, sequencename
  `);

  for (const seq of result.rows) {
    ddlParts.push(`-- SEQUENCE: ${seq.schema}.${seq.name}`);
    ddlParts.push(
      `CREATE SEQUENCE ${seq.schema}.${seq.name} START ${seq.start_value} INCREMENT ${seq.increment_by} MINVALUE ${seq.min_value} MAXVALUE ${seq.max_value}${seq.cycle ? " CYCLE" : ""};\n`
    );
  }
}

async function extractTables(pool: pg.Pool, schemaFilter: string, ddlParts: string[]): Promise<void> {
  const tablesResult = await pool.query(`
    SELECT n.nspname AS schema,
           c.relname AS table_name,
           c.oid AS table_oid
    FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE c.relkind = 'r'
      ${schemaFilter}
    ORDER BY n.nspname, c.relname
  `);

  for (const table of tablesResult.rows) {
    const columnsResult = await pool.query(
      `
      SELECT a.attname AS column_name,
             pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
             a.attnotnull AS not_null,
             pg_get_expr(d.adbin, d.adrelid) AS default_value
      FROM pg_attribute a
      LEFT JOIN pg_attrdef d ON a.attrelid = d.adrelid AND a.attnum = d.adnum
      WHERE a.attrelid = $1
        AND a.attnum > 0
        AND NOT a.attisdropped
      ORDER BY a.attnum
    `,
      [table.table_oid]
    );

    const columns = columnsResult.rows.map((col) => {
      let def = `  ${col.column_name} ${col.data_type}`;
      if (col.default_value) def += ` DEFAULT ${col.default_value}`;
      if (col.not_null) def += " NOT NULL";
      return def;
    });

    const pkResult = await pool.query(
      `
      SELECT a.attname AS column_name
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = $1 AND i.indisprimary
      ORDER BY array_position(i.indkey, a.attnum)
    `,
      [table.table_oid]
    );

    if (pkResult.rows.length > 0) {
      const pkCols = pkResult.rows.map((r) => r.column_name).join(", ");
      columns.push(`  PRIMARY KEY (${pkCols})`);
    }

    ddlParts.push(`-- TABLE: ${table.schema}.${table.table_name}`);
    ddlParts.push(
      `CREATE TABLE ${table.schema}.${table.table_name} (\n${columns.join(",\n")}\n);\n`
    );
  }
}

async function extractForeignKeys(pool: pg.Pool, schema: string | undefined, ddlParts: string[]): Promise<void> {
  const result = await pool.query(`
    SELECT
      tc.table_schema AS schema,
      tc.table_name,
      tc.constraint_name,
      kcu.column_name,
      ccu.table_schema AS foreign_schema,
      ccu.table_name AS foreign_table,
      ccu.column_name AS foreign_column,
      rc.update_rule,
      rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints rc
      ON tc.constraint_name = rc.constraint_name AND tc.table_schema = rc.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      ${schema ? `AND tc.table_schema = '${schema}'` : `AND tc.table_schema NOT IN ('pg_catalog', 'information_schema')`}
    ORDER BY tc.table_schema, tc.table_name, tc.constraint_name
  `);

  for (const fk of result.rows) {
    ddlParts.push(`-- FK: ${fk.constraint_name}`);
    ddlParts.push(
      `ALTER TABLE ${fk.schema}.${fk.table_name} ADD CONSTRAINT ${fk.constraint_name} FOREIGN KEY (${fk.column_name}) REFERENCES ${fk.foreign_schema}.${fk.foreign_table}(${fk.foreign_column}) ON UPDATE ${fk.update_rule} ON DELETE ${fk.delete_rule};\n`
    );
  }
}

async function extractUniqueConstraints(pool: pg.Pool, schemaFilter: string, ddlParts: string[]): Promise<void> {
  const result = await pool.query(`
    SELECT
      n.nspname AS schema,
      t.relname AS table_name,
      i.relname AS constraint_name,
      ARRAY_AGG(a.attname ORDER BY array_position(ix.indkey, a.attnum)) AS columns
    FROM pg_index ix
    JOIN pg_class t ON t.oid = ix.indrelid
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
    WHERE ix.indisunique AND NOT ix.indisprimary
      ${schemaFilter}
    GROUP BY n.nspname, t.relname, i.relname
    ORDER BY n.nspname, t.relname
  `);

  for (const uq of result.rows) {
    const columns = Array.isArray(uq.columns)
      ? uq.columns
      : uq.columns.replace(/[{}]/g, '').split(',');
    const cols = columns.join(", ");
    ddlParts.push(`-- UNIQUE: ${uq.constraint_name}`);
    ddlParts.push(
      `ALTER TABLE ${uq.schema}.${uq.table_name} ADD CONSTRAINT ${uq.constraint_name} UNIQUE (${cols});\n`
    );
  }
}

async function extractIndexes(pool: pg.Pool, schemaFilter: string, ddlParts: string[]): Promise<void> {
  const result = await pool.query(`
    SELECT
      n.nspname AS schema,
      t.relname AS table_name,
      i.relname AS index_name,
      pg_get_indexdef(ix.indexrelid) AS index_def
    FROM pg_index ix
    JOIN pg_class t ON t.oid = ix.indrelid
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE NOT ix.indisunique AND NOT ix.indisprimary
      ${schemaFilter}
    ORDER BY n.nspname, t.relname, i.relname
  `);

  for (const idx of result.rows) {
    ddlParts.push(`-- INDEX: ${idx.index_name}`);
    ddlParts.push(`${idx.index_def};\n`);
  }
}

async function extractViews(pool: pg.Pool, schema: string | undefined, ddlParts: string[]): Promise<void> {
  const result = await pool.query(`
    SELECT schemaname AS schema,
           viewname AS name,
           definition
    FROM pg_views
    WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      ${schema ? `AND schemaname = '${schema}'` : ""}
    ORDER BY schemaname, viewname
  `);

  for (const view of result.rows) {
    ddlParts.push(`-- VIEW: ${view.schema}.${view.name}`);
    ddlParts.push(`CREATE VIEW ${view.schema}.${view.name} AS\n${view.definition}\n`);
  }
}
