import { z } from "zod";

export const ListSchemasSchema = z.object({
  connectionId: z.string().describe("Connection ID to use"),
});

export const listSchemasDescription = "List all schemas in the database";
