import { z } from "zod";

export const ListSchemasSchema = z.object({
  connectionId: z
    .string()
    .default("default")
    .describe("Connection ID to use (defaults to the auto-connected 'default')"),
});

export const listSchemasDescription =
  "List all schemas in the database. Cheapest first call when exploring an unfamiliar database - run it before writing SQL against tables you have not inspected yet.";
