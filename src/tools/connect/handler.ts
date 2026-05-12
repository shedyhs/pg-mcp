import pg from "pg";
import { ConnectSchema } from "./schema.js";
import { connections } from "../../shared/connections.js";
import type { ConnectionConfig, ToolResponse } from "../../shared/types.js";

const { Pool } = pg;

export async function handleConnect(args: unknown): Promise<ToolResponse> {
  const input = ConnectSchema.parse(args);

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

  if (!connectionUrl && (!input.host || !input.database || !input.user || !input.password)) {
    return {
      content: [
        {
          type: "text",
          text: "Either 'url', DATABASE_URL environment variable, or all of 'host', 'database', 'user', 'password' must be provided.",
        },
      ],
      isError: true,
    };
  }

  let pool: pg.Pool;

  if (connectionUrl) {
    pool = new Pool({
      connectionString: connectionUrl,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  } else {
    pool = new Pool({
      host: input.host,
      port: input.port,
      database: input.database,
      user: input.user,
      password: input.password,
      ssl: input.ssl ? { rejectUnauthorized: false } : false,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }

  const client = await pool.connect();
  const versionResult = await client.query("SELECT version()");
  client.release();

  const config: ConnectionConfig = connectionUrl
    ? { connectionString: connectionUrl }
    : { host: input.host, port: input.port, database: input.database, user: input.user, password: input.password };

  connections.set(input.connectionId, { pool, readOnly: input.readOnly, config });

  const modeText = input.readOnly ? " (READ-ONLY MODE)" : "";
  return {
    content: [
      {
        type: "text",
        text: `Connected to PostgreSQL successfully!${modeText}\nConnection ID: ${input.connectionId}\nServer: ${versionResult.rows[0].version}`,
      },
    ],
  };
}
