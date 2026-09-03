#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer, cleanupConnections } from "./server.js";
import { autoConnect } from "./auto-connect.js";

process.on("SIGINT", async () => {
  await cleanupConnections();
  process.exit(0);
});

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();

  // Started before the transport so every tool call can await it, but not
  // awaited here: an unreachable database must not stall the MCP handshake.
  void autoConnect().catch((error) => console.error(`Auto-connect aborted: ${error}`));

  await server.connect(transport);
  console.error("PostgreSQL MCP server running on stdio");
}

main().catch(console.error);
