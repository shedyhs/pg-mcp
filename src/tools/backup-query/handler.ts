import { writeFile } from "node:fs/promises";
import type { z } from "zod";
import type { BackupQuerySchema } from "./schema.js";
import { connections } from "../../shared/connections.js";
import type { ToolResponse } from "../../shared/types.js";

type BackupQueryInput = z.infer<typeof BackupQuerySchema>;

export function escapeValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") return String(value);
  if (value instanceof Date) return `'${value.toISOString()}'`;
  if (Buffer.isBuffer(value)) return `'\\x${value.toString("hex")}'`;
  if (Array.isArray(value)) {
    return `ARRAY[${value.map(escapeValue).join(", ")}]`;
  }
  if (typeof value === "object") {
    return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

export function buildInsert(table: string, columns: string[], row: Record<string, unknown>): string {
  const values = columns.map((col) => escapeValue(row[col]));
  return `INSERT INTO ${table} (${columns.map((c) => `"${c}"`).join(", ")}) VALUES (${values.join(", ")});`;
}

export async function handleBackupQuery(input: BackupQueryInput): Promise<ToolResponse> {
  const conn = connections.get(input.connectionId);
  if (!conn) {
    return {
      content: [
        {
          type: "text",
          text: `Connection '${input.connectionId}' not found. Call pg_list_connections to see the open ones, or pg_connect to open a new one.`,
        },
      ],
      isError: true,
    };
  }

  const lines: string[] = [
    `-- Backup generated at ${new Date().toISOString()}`,
    `-- Source: pg_backup_query`,
    "",
    "BEGIN;",
    "",
  ];

  let totalRows = 0;

  for (const target of input.targets) {
    const sql = `SELECT * FROM ${target.table} WHERE ${target.where}`;

    let result;
    try {
      result = await conn.pool.query(sql);
    } catch (error: unknown) {
      const err = error as { message?: string };
      return {
        content: [
          {
            type: "text",
            text: `Query failed for table ${target.table}: ${err.message || "Unknown error"}\nSQL: ${sql}`,
          },
        ],
        isError: true,
      };
    }

    if (result.rows.length === 0) {
      lines.push(`-- ${target.table} WHERE ${target.where}: no rows found`);
      lines.push("");
      continue;
    }

    const columns = result.fields.map((f: { name: string }) => f.name);

    lines.push(`-- ${target.table} WHERE ${target.where} (${result.rows.length} rows)`);
    for (const row of result.rows) {
      lines.push(buildInsert(target.table, columns, row));
    }
    lines.push("");

    totalRows += result.rows.length;
  }

  lines.push("COMMIT;");
  lines.push("");

  try {
    await writeFile(input.outputPath, lines.join("\n"), "utf-8");
  } catch (error: unknown) {
    const err = error as { message?: string };
    return {
      content: [
        {
          type: "text",
          text: `Failed to write backup file: ${err.message || "Unknown error"}`,
        },
      ],
      isError: true,
    };
  }

  return {
    content: [
      {
        type: "text",
        text: `Backup saved to ${input.outputPath}\nTables: ${input.targets.length} | Rows: ${totalRows}`,
      },
    ],
  };
}
