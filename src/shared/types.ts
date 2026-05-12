import type pg from "pg";

export interface ConnectionConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
}

export interface ConnectionInfo {
  pool: pg.Pool;
  readOnly: boolean;
  config: ConnectionConfig;
}

export interface ToolResponse {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
  [key: string]: unknown;
}
