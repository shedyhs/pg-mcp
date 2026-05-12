import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { z } from "zod";
import { connections } from "./shared/connections.js";

import { ConnectSchema, connectDescription } from "./tools/connect/schema.js";
import { handleConnect } from "./tools/connect/handler.js";

import { DisconnectSchema, disconnectDescription } from "./tools/disconnect/schema.js";
import { handleDisconnect } from "./tools/disconnect/handler.js";

import { QuerySchema, queryDescription } from "./tools/query/schema.js";
import { handleQuery } from "./tools/query/handler.js";

import { ListSchemasSchema, listSchemasDescription } from "./tools/list-schemas/schema.js";
import { handleListSchemas } from "./tools/list-schemas/handler.js";

import { GetDdlSchema, getDdlDescription } from "./tools/get-ddl/schema.js";
import { handleGetDdl } from "./tools/get-ddl/handler.js";

import { DumpShape, DumpSchema, dumpDescription } from "./tools/dump/schema.js";
import { handleDump } from "./tools/dump/handler.js";

import { RestoreShape, RestoreSchema, restoreDescription } from "./tools/restore/schema.js";
import { handleRestore } from "./tools/restore/handler.js";

function registerTool<T>(
  server: McpServer,
  name: string,
  description: string,
  shape: Record<string, unknown>,
  handler: (args: T) => Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }>,
) {
  server.registerTool(name, { description, inputSchema: shape as any }, async (args: any) => handler(args));
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: "pg-mcp",
    version: "1.0.0",
  });

  registerTool<z.infer<typeof ConnectSchema>>(server, "pg_connect", connectDescription, ConnectSchema.shape, handleConnect);
  registerTool<z.infer<typeof DisconnectSchema>>(server, "pg_disconnect", disconnectDescription, DisconnectSchema.shape, handleDisconnect);
  registerTool<z.infer<typeof QuerySchema>>(server, "pg_query", queryDescription, QuerySchema.shape, handleQuery);
  registerTool<z.infer<typeof ListSchemasSchema>>(server, "pg_list_schemas", listSchemasDescription, ListSchemasSchema.shape, handleListSchemas);
  registerTool<z.infer<typeof GetDdlSchema>>(server, "pg_get_ddl", getDdlDescription, GetDdlSchema.shape, handleGetDdl);
  registerTool<z.infer<typeof DumpSchema>>(server, "pg_dump", dumpDescription, DumpShape, handleDump);
  registerTool<z.infer<typeof RestoreSchema>>(server, "pg_restore", restoreDescription, RestoreShape, handleRestore);

  return server;
}

export async function cleanupConnections(): Promise<void> {
  for (const [, conn] of connections) {
    await conn.pool.end();
  }
}
