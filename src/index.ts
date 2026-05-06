#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer, cleanupConnections } from "./server.js";

process.on("SIGINT", async () => {
  await cleanupConnections();
  process.exit(0);
});

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("PostgreSQL MCP server running on stdio");
}

main().catch(console.error);
