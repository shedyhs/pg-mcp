import { z } from "zod";

export const QuerySchema = z.object({
  connectionId: z.string().describe("Connection ID to use"),
  sql: z.string().describe("SQL query to execute"),
  params: z.array(z.unknown()).optional().describe("Query parameters"),
});

export const queryDescription = "Execute a SQL query on a PostgreSQL database";
