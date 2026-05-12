import { z } from "zod";

export const DumpSchema = z
  .object({
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
  })
  .refine((data) => !(data.schemaOnly && data.dataOnly), {
    message: "schemaOnly and dataOnly are mutually exclusive",
  });

export const dumpToolDefinition = {
  name: "pg_dump",
  description:
    "Dump a PostgreSQL database to a file using pg_dump. Requires pg_dump to be installed on the host.",
  inputSchema: {
    type: "object",
    properties: {
      connectionId: {
        type: "string",
        description: "Connection ID to use",
      },
      outputPath: {
        type: "string",
        description: "File path to save the dump",
      },
      format: {
        type: "string",
        enum: ["plain", "custom", "directory", "tar"],
        description: "Output format (default: plain)",
      },
      schemaOnly: {
        type: "boolean",
        description: "Dump only schema, no data",
      },
      dataOnly: {
        type: "boolean",
        description: "Dump only data, no schema",
      },
      table: {
        type: "array",
        items: { type: "string" },
        description: "Tables to include (can specify multiple)",
      },
      schema: {
        type: "string",
        description: "Dump only this schema",
      },
      clean: {
        type: "boolean",
        description: "Add DROP statements before CREATE",
      },
      ifExists: {
        type: "boolean",
        description:
          "Use IF EXISTS with DROP statements (requires clean: true)",
      },
      noOwner: {
        type: "boolean",
        description: "Do not output commands to set ownership",
      },
      noPrivileges: {
        type: "boolean",
        description: "Do not output GRANT/REVOKE statements",
      },
      compress: {
        type: "string",
        description: "Compression level (0-9) or method[:detail]",
      },
      excludeTable: {
        type: "array",
        items: { type: "string" },
        description: "Tables to exclude (can specify multiple)",
      },
    },
    required: ["connectionId", "outputPath"],
  },
} as const;
