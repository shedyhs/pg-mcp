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

export const connectDescription = "Connect to a PostgreSQL database using a URL, individual parameters, or libpq env vars (PGHOST, PGDATABASE, PGUSER, PGPASSWORD). If DATABASE_URL or PGHOST/PGDATABASE are set, auto-connects as 'default' on startup.";
