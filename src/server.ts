import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { z } from "zod";
import { connections } from "./shared/connections.js";
import { whenConnectionsReady } from "./auto-connect.js";

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

import { BackupQuerySchema, backupQueryDescription } from "./tools/backup-query/schema.js";
import { handleBackupQuery } from "./tools/backup-query/handler.js";

import { ListConnectionsSchema, listConnectionsDescription } from "./tools/list-connections/schema.js";
import { handleListConnections } from "./tools/list-connections/handler.js";

function registerTool<T>(
  server: McpServer,
  name: string,
  description: string,
  shape: Record<string, unknown>,
  handler: (args: T) => Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }>,
) {
  server.registerTool(name, { description, inputSchema: shape as any }, async (args: any) => {
    // A tool call can arrive while startup connections are still opening.
    await whenConnectionsReady();
    return handler(args);
  });
}

const instructions = `Use these tools for ANY PostgreSQL work - exploring schemas, reading table structures, running queries, dumping and restoring - instead of shelling out to psql, pg_dump or pg_restore through Bash. They reuse a pooled connection, enforce read-only mode and return structured results.

Connection handling: named connections are opened automatically at startup from ~/.config/pg-mcp/connections.json, from the PG_MCP_CONNECTIONS env var, and from DATABASE_URL or PGHOST/PGDATABASE (which open the connection named "default"). Every tool defaults to connectionId "default", so it can be omitted when that one exists.

When you do not know which connectionId to use, or a tool reports that a connection was not found, call pg_list_connections - it returns the open ids with their host, database and read-only mode. Only call pg_connect for a database that is not configured at all.

Typical flow:
1. pg_list_connections - only when the connectionId is unknown
2. pg_list_schemas - see what the database contains
3. pg_get_ddl - read tables, columns, indexes and foreign keys before writing SQL, instead of guessing names
4. pg_query - run the statement

Safety: before any DELETE or UPDATE, call pg_backup_query to write the affected rows to a .sql file as INSERT statements. It is the undo button.

Read-only mode is on by default and rejects INSERT/UPDATE/DELETE/DDL. When a write is blocked, tell the user to set PG_MCP_READ_ONLY=false or to pass readOnly: false to pg_connect - never route around it with psql.`;

export function createServer(): McpServer {
  const server = new McpServer(
    {
      name: "pg-mcp",
      version: "1.1.0",
    },
    { instructions },
  );

  registerTool<z.infer<typeof ListConnectionsSchema>>(server, "pg_list_connections", listConnectionsDescription, ListConnectionsSchema.shape, handleListConnections);
  registerTool<z.infer<typeof ConnectSchema>>(server, "pg_connect", connectDescription, ConnectSchema.shape, handleConnect);
  registerTool<z.infer<typeof DisconnectSchema>>(server, "pg_disconnect", disconnectDescription, DisconnectSchema.shape, handleDisconnect);
  registerTool<z.infer<typeof QuerySchema>>(server, "pg_query", queryDescription, QuerySchema.shape, handleQuery);
  registerTool<z.infer<typeof ListSchemasSchema>>(server, "pg_list_schemas", listSchemasDescription, ListSchemasSchema.shape, handleListSchemas);
  registerTool<z.infer<typeof GetDdlSchema>>(server, "pg_get_ddl", getDdlDescription, GetDdlSchema.shape, handleGetDdl);
  registerTool<z.infer<typeof DumpSchema>>(server, "pg_dump", dumpDescription, DumpShape, handleDump);
  registerTool<z.infer<typeof RestoreSchema>>(server, "pg_restore", restoreDescription, RestoreShape, handleRestore);
  registerTool<z.infer<typeof BackupQuerySchema>>(server, "pg_backup_query", backupQueryDescription, BackupQuerySchema.shape, handleBackupQuery);

  return server;
}

export async function cleanupConnections(): Promise<void> {
  for (const [, conn] of connections) {
    await conn.pool.end();
  }
}
