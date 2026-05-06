import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { toolDefinitions, toolHandlers } from "./tools/index.js";
import { connections } from "./shared/connections.js";
export function createServer() {
    const server = new Server({
        name: "pg-mcp",
        version: "1.0.0",
    }, {
        capabilities: {
            tools: {},
        },
    });
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        return { tools: toolDefinitions };
    });
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        try {
            const handler = toolHandlers[name];
            if (!handler) {
                return {
                    content: [{ type: "text", text: `Unknown tool: ${name}` }],
                    isError: true,
                };
            }
            return await handler(args);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                content: [{ type: "text", text: `Error: ${errorMessage}` }],
                isError: true,
            };
        }
    });
    return server;
}
export async function cleanupConnections() {
    for (const [, conn] of connections) {
        await conn.pool.end();
    }
}
