import { z } from "zod";

export const GetDdlSchema = z.object({
  connectionId: z.string().describe("Connection ID to use"),
  schema: z.string().optional().describe("Filter by schema (optional, returns all schemas if not specified)"),
});

export const getDdlToolDefinition = {
  name: "pg_get_ddl",
  description: "Get the complete DDL (Data Definition Language) of the database including CREATE TABLE statements, indexes, constraints, foreign keys, sequences, and views",
  inputSchema: {
    type: "object",
    properties: {
      connectionId: {
        type: "string",
        description: "Connection ID to use",
      },
      schema: {
        type: "string",
        description: "Filter by schema (optional, returns all user schemas if not specified)",
      },
    },
    required: ["connectionId"],
  },
} as const;
