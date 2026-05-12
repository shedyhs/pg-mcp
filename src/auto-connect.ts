import { connections } from "./shared/connections.js";
import { resolveReadOnly } from "./shared/types.js";
import { createPool } from "./tools/connect/handler.js";

const DEFAULT_CONNECTION_ID = "default";

function shouldAutoConnect(): boolean {
  return !!(process.env.DATABASE_URL || process.env.PGHOST || process.env.PGDATABASE);
}

export async function autoConnect(): Promise<void> {
  if (!shouldAutoConnect()) return;

  try {
    const pool = process.env.DATABASE_URL
      ? createPool({ url: process.env.DATABASE_URL })
      : createPool();

    const client = await pool.connect();
    const versionResult = await client.query("SELECT version()");
    client.release();

    const readOnly = resolveReadOnly();
    const config = process.env.DATABASE_URL
      ? { connectionString: process.env.DATABASE_URL }
      : {};

    connections.set(DEFAULT_CONNECTION_ID, { pool, readOnly, config });

    const modeText = readOnly ? " (read-only)" : "";
    console.error(`Auto-connected to PostgreSQL${modeText} as '${DEFAULT_CONNECTION_ID}': ${versionResult.rows[0].version}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`Auto-connect failed (server continues without default connection): ${msg}`);
  }
}
