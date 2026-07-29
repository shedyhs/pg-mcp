import { z } from "zod";

export const GetDdlSchema = z.object({
  connectionId: z
    .string()
    .default("default")
    .describe("Connection ID to use (defaults to the auto-connected 'default')"),
  schema: z.string().optional().describe("Filter by schema (optional, returns all schemas if not specified)"),
});

export const getDdlDescription =
  "Get the complete DDL of the database: CREATE TABLE statements, indexes, constraints, foreign keys, sequences and views. Use this to learn real column names, types and relationships before writing SQL, migrations or ORM models - it beats guessing or grepping the codebase. Pass schema to narrow the output on large databases.";
