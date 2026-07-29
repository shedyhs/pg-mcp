import { z } from "zod";

export const ConnectSchema = z.object({
  connectionId: z.string().describe("Unique identifier for this connection"),
  url: z.string().optional().describe("PostgreSQL connection URL (e.g., postgresql://user:pass@host:5432/dbname?ssl=true)"),
  host: z.string().optional().describe("PostgreSQL host"),
  port: z.number().default(5432).describe("PostgreSQL port"),
  database: z.string().optional().describe("Database name"),
  user: z.string().optional().describe("Username"),
  password: z.string().optional().describe("Password"),
  ssl: z.boolean().default(false).describe("Use SSL connection"),
  readOnly: z.boolean().optional().describe("Enable read-only mode (blocks INSERT, UPDATE, DELETE, DDL). Default: true, or set PG_MCP_READ_ONLY env var"),
});

export const connectDescription =
  "Open a PostgreSQL connection from a URL, individual parameters, or libpq env vars (PGHOST, PGDATABASE, PGUSER, PGPASSWORD). Usually NOT needed: when DATABASE_URL or PGHOST/PGDATABASE are set, the server auto-connects as 'default' at startup and every tool uses it. Call this only to reach a second database, or when a tool reports that connection 'default' was not found.";
