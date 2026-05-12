import { z } from "zod";

export const DumpShape = {
  connectionId: z.string().describe("Connection ID to use"),
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
  "Dump a PostgreSQL database to a file using pg_dump. Requires pg_dump to be installed on the host.";
