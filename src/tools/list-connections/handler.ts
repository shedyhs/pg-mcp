import { connections } from "../../shared/connections.js";
import type { ConnectionConfig, ToolResponse } from "../../shared/types.js";

const DEFAULT_PORT = 5432;

/**
 * Renders a connection target as host:port/database. Credentials are dropped on
 * purpose: this string is returned to the model, and a URL carries the password.
 */
export function describeTarget(config: ConnectionConfig): string {
  if (config.connectionString) {
    try {
      const url = new URL(config.connectionString);
      const port = url.port || String(DEFAULT_PORT);
      const database = url.pathname.replace(/^\//, "") || "?";
      return `${url.hostname}:${port}/${database}`;
    } catch {
      return "unknown target";
    }
  }

  if (config.host || config.database) {
    return `${config.host ?? "?"}:${config.port ?? DEFAULT_PORT}/${config.database ?? "?"}`;
  }

  return "libpq env vars";
}

export async function handleListConnections(): Promise<ToolResponse> {
  if (connections.size === 0) {
    return {
      content: [
        {
          type: "text",
          text: "No open connections. Use pg_connect to open one, or set DATABASE_URL / PG_MCP_CONNECTIONS / ~/.config/pg-mcp/connections.json so the server connects at startup.",
        },
      ],
    };
  }

  const lines = [...connections.entries()].map(
    ([id, conn]) => `  ${id} - ${describeTarget(conn.config)} (${conn.readOnly ? "read-only" : "read-write"})`,
  );

  return {
    content: [
      {
        type: "text",
        text: `${connections.size} open connection(s):\n${lines.join("\n")}`,
      },
    ],
  };
}
