import { z } from "zod";

export const DumpShape = {
  connectionId: z
    .string()
    .default("default")
    .describe("Connection ID to use (defaults to the auto-connected 'default')"),
  outputPath: z.string().describe("File path to save the dump"),
  format: z
    .enum(["plain", "custom", "directory", "tar"])
    .default("plain")
    .describe("Output format (default: plain)"),
  schemaOnly: z.boolean().default(false).describe("Dump only schema, no data"),
  dataOnly: z.boolean().default(false).describe("Dump only data, no schema"),
  table: z
    .array(z.string())
    .optional()
    .describe("Tables to include (can specify multiple)"),
  schema: z.string().optional().describe("Dump only this schema"),
  clean: z
    .boolean()
    .default(false)
    .describe("Add DROP statements before CREATE"),
  ifExists: z
    .boolean()
    .default(false)
    .describe("Use IF EXISTS with DROP statements (requires clean: true)"),
  noOwner: z
    .boolean()
    .default(false)
    .describe("Do not output commands to set ownership"),
  noPrivileges: z
    .boolean()
    .default(false)
    .describe("Do not output GRANT/REVOKE statements"),
  compress: z
    .string()
    .optional()
    .describe("Compression level (0-9) or method[:detail]"),
  excludeTable: z
    .array(z.string())
    .optional()
    .describe("Tables to exclude (can specify multiple)"),
};

export const DumpSchema = z.object(DumpShape).refine(
  (data) => !(data.schemaOnly && data.dataOnly),
  { message: "schemaOnly and dataOnly are mutually exclusive" },
);

export const dumpDescription =
  "Dump a PostgreSQL database to a file with pg_dump. Prefer this over building a pg_dump command line in Bash: it reuses the stored connection credentials, so no password handling is needed. Use schemaOnly for a structure snapshot, table for a subset. To capture only a few rows, pg_backup_query is cheaper. Requires pg_dump on the host.";
