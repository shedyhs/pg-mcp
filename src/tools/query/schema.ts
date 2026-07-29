import { z } from "zod";

export const QuerySchema = z.object({
  connectionId: z
    .string()
    .default("default")
    .describe("Connection ID to use (defaults to the auto-connected 'default')"),
  sql: z.string().describe("SQL query to execute"),
  params: z.array(z.unknown()).optional().describe("Query parameters"),
});

export const queryDescription =
  "Run a SQL statement on PostgreSQL and get structured rows back. Prefer this over calling psql through Bash for any query, including one-off checks. Uses the auto-connected 'default' database when connectionId is omitted. Pass values through params instead of interpolating them into the SQL. Read-only mode blocks INSERT/UPDATE/DELETE/DDL by default.";
