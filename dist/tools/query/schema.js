import { z } from "zod";
export const QuerySchema = z.object({
    connectionId: z.string().describe("Connection ID to use"),
    sql: z.string().describe("SQL query to execute"),
    params: z.array(z.unknown()).optional().describe("Query parameters"),
});
export const queryToolDefinition = {
    name: "pg_query",
    description: "Execute a SQL query on a PostgreSQL database",
    inputSchema: {
        type: "object",
        properties: {
            connectionId: {
                type: "string",
                description: "Connection ID to use",
            },
            sql: {
                type: "string",
                description: "SQL query to execute",
            },
            params: {
                type: "array",
                description: "Query parameters for prepared statements",
            },
        },
        required: ["connectionId", "sql"],
    },
};
