import { z } from "zod";

export const GetDdlSchema = z.object({
  connectionId: z.string().describe("Connection ID to use"),
  schema: z.string().optional().describe("Filter by schema (optional, returns all schemas if not specified)"),
});

export const getDdlDescription = "Get the complete DDL (Data Definition Language) of the database including CREATE TABLE statements, indexes, constraints, foreign keys, sequences, and views";
