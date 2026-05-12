import { z } from "zod";

export const RestoreSchema = z
  .object({
    connectionId: z.string().describe("Connection ID to use"),
    inputPath: z.string().describe("File path of the dump to restore"),
    schemaOnly: z.boolean().default(false).describe("Restore only schema, no data"),
    dataOnly: z.boolean().default(false).describe("Restore only data, no schema"),
    table: z
      .array(z.string())
      .optional()
      .describe("Restore only these tables (can specify multiple)"),
    schema: z.string().optional().describe("Restore only this schema"),
    clean: z
      .boolean()
      .default(false)
      .describe("Drop objects before creating them"),
    ifExists: z
      .boolean()
      .default(false)
      .describe("Use IF EXISTS with DROP statements (requires clean: true)"),
    noOwner: z
      .boolean()
      .default(false)
      .describe("Do not restore ownership"),
    noPrivileges: z
      .boolean()
      .default(false)
      .describe("Do not restore GRANT/REVOKE statements"),
    create: z
      .boolean()
      .default(false)
      .describe("Create the database before restoring"),
    exitOnError: z
      .boolean()
      .default(false)
      .describe("Exit on error instead of continuing"),
    singleTransaction: z
      .boolean()
      .default(false)
      .describe("Wrap restore in a single transaction"),
    jobs: z
      .number()
      .optional()
      .describe("Number of parallel jobs for restore"),
    verbose: z.boolean().default(false).describe("Enable verbose output"),
  })
  .refine((data) => !(data.schemaOnly && data.dataOnly), {
    message: "schemaOnly and dataOnly are mutually exclusive",
  });

export const restoreToolDefinition = {
  name: "pg_restore",
  description:
    "Restore a PostgreSQL database from a dump file using pg_restore. Works with custom, directory, and tar formats. For plain SQL dumps, use pg_query instead. Requires pg_restore to be installed on the host.",
  inputSchema: {
    type: "object",
    properties: {
      connectionId: {
        type: "string",
        description: "Connection ID to use",
      },
      inputPath: {
        type: "string",
        description: "File path of the dump to restore",
      },
      schemaOnly: {
        type: "boolean",
        description: "Restore only schema, no data",
      },
      dataOnly: {
        type: "boolean",
        description: "Restore only data, no schema",
      },
      table: {
        type: "array",
        items: { type: "string" },
        description: "Restore only these tables (can specify multiple)",
      },
      schema: {
        type: "string",
        description: "Restore only this schema",
      },
      clean: {
        type: "boolean",
        description: "Drop objects before creating them",
      },
      ifExists: {
        type: "boolean",
        description:
          "Use IF EXISTS with DROP statements (requires clean: true)",
      },
      noOwner: {
        type: "boolean",
        description: "Do not restore ownership",
      },
      noPrivileges: {
        type: "boolean",
        description: "Do not restore GRANT/REVOKE statements",
      },
      create: {
        type: "boolean",
        description: "Create the database before restoring",
      },
      exitOnError: {
        type: "boolean",
        description: "Exit on error instead of continuing",
      },
      singleTransaction: {
        type: "boolean",
        description: "Wrap restore in a single transaction",
      },
      jobs: {
        type: "number",
        description: "Number of parallel jobs for restore",
      },
      verbose: {
        type: "boolean",
        description: "Enable verbose output",
      },
    },
    required: ["connectionId", "inputPath"],
  },
} as const;
