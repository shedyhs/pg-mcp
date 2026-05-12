import pg from "pg";
import type { z } from "zod";
import type { ConnectSchema } from "./schema.js";
import { connections } from "../../shared/connections.js";
import { resolveReadOnly } from "../../shared/types.js";
import type { ConnectionConfig, ToolResponse } from "../../shared/types.js";

const { Pool } = pg;

const POOL_OPTIONS = {
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
} as const;

function hasLibpqEnvVars(): boolean {
  return !!(process.env.PGHOST || process.env.PGDATABASE);
}

export function createPool(options?: {
  url?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean;
}): pg.Pool {
  if (options?.url) {
    return new Pool({ connectionString: options.url, ...POOL_OPTIONS });
  }

  if (options?.host || options?.database) {
    return new Pool({
      host: options.host,
      port: options.port,
      database: options.database,
      user: options.user,
      password: options.password,
      ssl: options.ssl ? { rejectUnauthorized: false } : false,
      ...POOL_OPTIONS,
    });
  }

  return new Pool(POOL_OPTIONS);
}

export async function handleConnect(input: z.infer<typeof ConnectSchema>): Promise<ToolResponse> {

  if (connections.has(input.connectionId)) {
    return {
      content: [
        {
          type: "text",
          text: `Connection '${input.connectionId}' already exists. Disconnect first to reconnect.`,
        },
      ],
      isError: true,
    };
  }

  const connectionUrl = input.url || process.env.DATABASE_URL;
  const hasExplicitParams = !!(input.host || input.database || input.user || input.password);

  if (!connectionUrl && !hasExplicitParams && !hasLibpqEnvVars()) {
    return {
      content: [
        {
          type: "text",
          text: "Provide 'url', DATABASE_URL, individual parameters (host, database, user, password), or libpq env vars (PGHOST, PGDATABASE, PGUSER, PGPASSWORD).",
        },
      ],
      isError: true,
    };
  }

  const pool = createPool({
    url: connectionUrl,
    host: input.host,
    port: input.port,
    database: input.database,
    user: input.user,
    password: input.password,
    ssl: input.ssl,
  });

  const client = await pool.connect();
  const versionResult = await client.query("SELECT version()");
  client.release();

  const config: ConnectionConfig = connectionUrl
    ? { connectionString: connectionUrl }
    : hasExplicitParams
      ? { host: input.host, port: input.port, database: input.database, user: input.user, password: input.password }
      : {};

  const readOnly = resolveReadOnly(input.readOnly);
  connections.set(input.connectionId, { pool, readOnly, config });

  const modeText = readOnly ? " (READ-ONLY MODE)" : "";
  return {
    content: [
      {
        type: "text",
        text: `Connected to PostgreSQL successfully!${modeText}\nConnection ID: ${input.connectionId}\nServer: ${versionResult.rows[0].version}`,
      },
    ],
  };
}
