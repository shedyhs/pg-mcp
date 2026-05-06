import { z } from "zod";
export const ListSchemasSchema = z.object({
    connectionId: z.string().describe("Connection ID to use"),
});
export const listSchemasToolDefinition = {
    name: "pg_list_schemas",
    description: "List all schemas in the database",
    inputSchema: {
        type: "object",
        properties: {
            connectionId: {
                type: "string",
                description: "Connection ID to use",
            },
        },
        required: ["connectionId"],
    },
};
