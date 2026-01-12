#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import pg from "pg";
import { z } from "zod";

const { Pool } = pg;

// Store active connections with metadata
interface ConnectionInfo {
  pool: pg.Pool;
  readOnly: boolean;
}
const connections = new Map<string, ConnectionInfo>();

// Read-only mode: blocked SQL patterns
const BLOCKED_PATTERNS = [
  // DML (Data Manipulation)
  /^\s*INSERT\s+/i,
  /^\s*UPDATE\s+/i,
  /^\s*DELETE\s+/i,
  /^\s*TRUNCATE\s+/i,
  /^\s*MERGE\s+/i,
  // DDL (Data Definition)
  /^\s*CREATE\s+/i,
  /^\s*ALTER\s+/i,
  /^\s*DROP\s+/i,
  /^\s*RENAME\s+/i,
  // DCL (Data Control)
  /^\s*GRANT\s+/i,
  /^\s*REVOKE\s+/i,
  // Other dangerous operations
  /^\s*COPY\s+/i,
  /^\s*VACUUM\s+/i,
  /^\s*REINDEX\s+/i,
  /^\s*CLUSTER\s+/i,
  /^\s*COMMENT\s+/i,
];

function isBlockedQuery(sql: string): boolean {
  return BLOCKED_PATTERNS.some(pattern => pattern.test(sql));
}

// Tool input schemas
const ConnectSchema = z.object({
  connectionId: z.string().describe("Unique identifier for this connection"),
  url: z.string().optional().describe("PostgreSQL connection URL (e.g., postgresql://user:pass@host:5432/dbname?ssl=true)"),
  host: z.string().optional().describe("PostgreSQL host"),
  port: z.number().default(5432).describe("PostgreSQL port"),
  database: z.string().optional().describe("Database name"),
  user: z.string().optional().describe("Username"),
  password: z.string().optional().describe("Password"),
  ssl: z.boolean().default(false).describe("Use SSL connection"),
  readOnly: z.boolean().default(true).describe("Enable read-only mode (blocks INSERT, UPDATE, DELETE, DDL). Default: true"),
});

const DisconnectSchema = z.object({
  connectionId: z.string().describe("Connection ID to disconnect"),
});

const QuerySchema = z.object({
  connectionId: z.string().describe("Connection ID to use"),
  sql: z.string().describe("SQL query to execute"),
  params: z.array(z.unknown()).optional().describe("Query parameters"),
});

const ListSchemasSchema = z.object({
  connectionId: z.string().describe("Connection ID to use"),
});

const GetDdlSchema = z.object({
  connectionId: z.string().describe("Connection ID to use"),
  schema: z.string().optional().describe("Filter by schema (optional, returns all schemas if not specified)"),
});

// Create server
const server = new Server(
  {
    name: "pg-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "pg_connect",
        description: "Connect to a PostgreSQL database using a URL or individual parameters",
        inputSchema: {
          type: "object",
          properties: {
            connectionId: {
              type: "string",
              description: "Unique identifier for this connection",
            },
            url: {
              type: "string",
              description: "PostgreSQL connection URL (e.g., postgresql://user:pass@host:5432/dbname?ssl=true)",
            },
            host: {
              type: "string",
              description: "PostgreSQL host (ignored if url is provided)",
            },
            port: {
              type: "number",
              description: "PostgreSQL port (default: 5432, ignored if url is provided)",
            },
            database: {
              type: "string",
              description: "Database name (ignored if url is provided)",
            },
            user: {
              type: "string",
              description: "Username (ignored if url is provided)",
            },
            password: {
              type: "string",
              description: "Password (ignored if url is provided)",
            },
            ssl: {
              type: "boolean",
              description: "Use SSL connection (default: false, ignored if url is provided)",
            },
            readOnly: {
              type: "boolean",
              description: "Enable read-only mode - blocks INSERT, UPDATE, DELETE, and DDL operations (default: true)",
            },
          },
          required: ["connectionId"],
        },
      },
      {
        name: "pg_disconnect",
        description: "Disconnect from a PostgreSQL database",
        inputSchema: {
          type: "object",
          properties: {
            connectionId: {
              type: "string",
              description: "Connection ID to disconnect",
            },
          },
          required: ["connectionId"],
        },
      },
      {
        name: "pg_query",
        description: "Execute a SQL query on a PostgreSQL database",
        inputSchema: {
          type: "object",
          properties: {
            connectionId: {
              type: "string",
              description: "Connection ID to use",
            },
            sql: {
              type: "string",
              description: "SQL query to execute",
            },
            params: {
              type: "array",
              description: "Query parameters for prepared statements",
            },
          },
          required: ["connectionId", "sql"],
        },
      },
      {
        name: "pg_list_schemas",
        description: "List all schemas in the database",
        inputSchema: {
          type: "object",
          properties: {
            connectionId: {
              type: "string",
              description: "Connection ID to use",
            },
          },
          required: ["connectionId"],
        },
      },
      {
        name: "pg_get_ddl",
        description: "Get the complete DDL (Data Definition Language) of the database including CREATE TABLE statements, indexes, constraints, foreign keys, sequences, and views",
        inputSchema: {
          type: "object",
          properties: {
            connectionId: {
              type: "string",
              description: "Connection ID to use",
            },
            schema: {
              type: "string",
              description: "Filter by schema (optional, returns all user schemas if not specified)",
            },
          },
          required: ["connectionId"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "pg_connect": {
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

        // Use URL from input, or fallback to DATABASE_URL env var
        const connectionUrl = input.url || process.env.DATABASE_URL;

        // Validate: either URL (input or env) or individual params must be provided
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
          // Use connection URL (from input or env)
          pool = new Pool({
            connectionString: connectionUrl,
            max: 5,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
          });
        } else {
          // Use individual parameters
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

        // Test the connection
        const client = await pool.connect();
        const versionResult = await client.query("SELECT version()");
        client.release();

        connections.set(input.connectionId, { pool, readOnly: input.readOnly });

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

      case "pg_disconnect": {
        const input = DisconnectSchema.parse(args);

        const conn = connections.get(input.connectionId);
        if (!conn) {
          return {
            content: [
              {
                type: "text",
                text: `Connection '${input.connectionId}' not found.`,
              },
            ],
            isError: true,
          };
        }

        await conn.pool.end();
        connections.delete(input.connectionId);

        return {
          content: [
            {
              type: "text",
              text: `Disconnected from '${input.connectionId}' successfully.`,
            },
          ],
        };
      }

      case "pg_query": {
        const input = QuerySchema.parse(args);

        const conn = connections.get(input.connectionId);
        if (!conn) {
          return {
            content: [
              {
                type: "text",
                text: `Connection '${input.connectionId}' not found. Connect first using pg_connect.`,
              },
            ],
            isError: true,
          };
        }

        // Check read-only mode
        if (conn.readOnly && isBlockedQuery(input.sql)) {
          return {
            content: [
              {
                type: "text",
                text: `Query blocked: Connection is in READ-ONLY mode. INSERT, UPDATE, DELETE, and DDL operations are not allowed.`,
              },
            ],
            isError: true,
          };
        }

        const result = await conn.pool.query(input.sql, input.params);

        // Format response based on query type
        if (result.command === "SELECT") {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    rows: result.rows,
                    rowCount: result.rowCount,
                    fields: result.fields.map((f) => ({
                      name: f.name,
                      dataTypeID: f.dataTypeID,
                    })),
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: "text",
                text: `Query executed successfully.\nCommand: ${result.command}\nRows affected: ${result.rowCount}`,
              },
            ],
          };
        }
      }

      case "pg_list_schemas": {
        const input = ListSchemasSchema.parse(args);

        const conn = connections.get(input.connectionId);
        if (!conn) {
          return {
            content: [
              {
                type: "text",
                text: `Connection '${input.connectionId}' not found. Connect first using pg_connect.`,
              },
            ],
            isError: true,
          };
        }

        const result = await conn.pool.query(`
          SELECT schema_name,
                 schema_owner
          FROM information_schema.schemata
          WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
          ORDER BY schema_name
        `);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result.rows, null, 2),
            },
          ],
        };
      }

      case "pg_get_ddl": {
        const input = GetDdlSchema.parse(args);

        const conn = connections.get(input.connectionId);
        if (!conn) {
          return {
            content: [
              {
                type: "text",
                text: `Connection '${input.connectionId}' not found. Connect first using pg_connect.`,
              },
            ],
            isError: true,
          };
        }

        const pool = conn.pool;
        const schemaFilter = input.schema
          ? `AND n.nspname = '${input.schema}'`
          : `AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')`;

        const ddlParts: string[] = [];

        // 1. Get ENUM types
        const enumsResult = await pool.query(`
          SELECT n.nspname AS schema,
                 t.typname AS name,
                 ARRAY_AGG(e.enumlabel ORDER BY e.enumsortorder) AS values
          FROM pg_type t
          JOIN pg_namespace n ON t.typnamespace = n.oid
          JOIN pg_enum e ON t.oid = e.enumtypid
          WHERE t.typtype = 'e'
            ${schemaFilter}
          GROUP BY n.nspname, t.typname
          ORDER BY n.nspname, t.typname
        `);

        for (const row of enumsResult.rows) {
          const values = row.values.map((v: string) => `'${v}'`).join(", ");
          ddlParts.push(`-- ENUM: ${row.schema}.${row.name}`);
          ddlParts.push(`CREATE TYPE ${row.schema}.${row.name} AS ENUM (${values});\n`);
        }

        // 2. Get sequences
        const sequencesResult = await pool.query(`
          SELECT schemaname AS schema,
                 sequencename AS name,
                 start_value,
                 increment_by,
                 min_value,
                 max_value,
                 cycle
          FROM pg_sequences
          WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
            ${input.schema ? `AND schemaname = '${input.schema}'` : ""}
          ORDER BY schemaname, sequencename
        `);

        for (const seq of sequencesResult.rows) {
          ddlParts.push(`-- SEQUENCE: ${seq.schema}.${seq.name}`);
          ddlParts.push(
            `CREATE SEQUENCE ${seq.schema}.${seq.name} START ${seq.start_value} INCREMENT ${seq.increment_by} MINVALUE ${seq.min_value} MAXVALUE ${seq.max_value}${seq.cycle ? " CYCLE" : ""};\n`
          );
        }

        // 3. Get tables with columns
        const tablesResult = await pool.query(`
          SELECT n.nspname AS schema,
                 c.relname AS table_name,
                 c.oid AS table_oid
          FROM pg_class c
          JOIN pg_namespace n ON c.relnamespace = n.oid
          WHERE c.relkind = 'r'
            ${schemaFilter}
          ORDER BY n.nspname, c.relname
        `);

        for (const table of tablesResult.rows) {
          const columnsResult = await pool.query(
            `
            SELECT a.attname AS column_name,
                   pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
                   a.attnotnull AS not_null,
                   pg_get_expr(d.adbin, d.adrelid) AS default_value
            FROM pg_attribute a
            LEFT JOIN pg_attrdef d ON a.attrelid = d.adrelid AND a.attnum = d.adnum
            WHERE a.attrelid = $1
              AND a.attnum > 0
              AND NOT a.attisdropped
            ORDER BY a.attnum
          `,
            [table.table_oid]
          );

          const columns = columnsResult.rows.map((col) => {
            let def = `  ${col.column_name} ${col.data_type}`;
            if (col.default_value) def += ` DEFAULT ${col.default_value}`;
            if (col.not_null) def += " NOT NULL";
            return def;
          });

          // Get primary key
          const pkResult = await pool.query(
            `
            SELECT a.attname AS column_name
            FROM pg_index i
            JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
            WHERE i.indrelid = $1 AND i.indisprimary
            ORDER BY array_position(i.indkey, a.attnum)
          `,
            [table.table_oid]
          );

          if (pkResult.rows.length > 0) {
            const pkCols = pkResult.rows.map((r) => r.column_name).join(", ");
            columns.push(`  PRIMARY KEY (${pkCols})`);
          }

          ddlParts.push(`-- TABLE: ${table.schema}.${table.table_name}`);
          ddlParts.push(
            `CREATE TABLE ${table.schema}.${table.table_name} (\n${columns.join(",\n")}\n);\n`
          );
        }

        // 4. Get foreign keys (after all tables)
        const fkResult = await pool.query(`
          SELECT
            tc.table_schema AS schema,
            tc.table_name,
            tc.constraint_name,
            kcu.column_name,
            ccu.table_schema AS foreign_schema,
            ccu.table_name AS foreign_table,
            ccu.column_name AS foreign_column,
            rc.update_rule,
            rc.delete_rule
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage ccu
            ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
          JOIN information_schema.referential_constraints rc
            ON tc.constraint_name = rc.constraint_name AND tc.table_schema = rc.constraint_schema
          WHERE tc.constraint_type = 'FOREIGN KEY'
            ${input.schema ? `AND tc.table_schema = '${input.schema}'` : `AND tc.table_schema NOT IN ('pg_catalog', 'information_schema')`}
          ORDER BY tc.table_schema, tc.table_name, tc.constraint_name
        `);

        for (const fk of fkResult.rows) {
          ddlParts.push(`-- FK: ${fk.constraint_name}`);
          ddlParts.push(
            `ALTER TABLE ${fk.schema}.${fk.table_name} ADD CONSTRAINT ${fk.constraint_name} FOREIGN KEY (${fk.column_name}) REFERENCES ${fk.foreign_schema}.${fk.foreign_table}(${fk.foreign_column}) ON UPDATE ${fk.update_rule} ON DELETE ${fk.delete_rule};\n`
          );
        }

        // 5. Get unique constraints
        const uniqueResult = await pool.query(`
          SELECT
            n.nspname AS schema,
            t.relname AS table_name,
            i.relname AS constraint_name,
            ARRAY_AGG(a.attname ORDER BY array_position(ix.indkey, a.attnum)) AS columns
          FROM pg_index ix
          JOIN pg_class t ON t.oid = ix.indrelid
          JOIN pg_class i ON i.oid = ix.indexrelid
          JOIN pg_namespace n ON n.oid = t.relnamespace
          JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
          WHERE ix.indisunique AND NOT ix.indisprimary
            ${schemaFilter}
          GROUP BY n.nspname, t.relname, i.relname
          ORDER BY n.nspname, t.relname
        `);

        for (const uq of uniqueResult.rows) {
          // Handle both array and string representation from PostgreSQL
          const columns = Array.isArray(uq.columns)
            ? uq.columns
            : uq.columns.replace(/[{}]/g, '').split(',');
          const cols = columns.join(", ");
          ddlParts.push(`-- UNIQUE: ${uq.constraint_name}`);
          ddlParts.push(
            `ALTER TABLE ${uq.schema}.${uq.table_name} ADD CONSTRAINT ${uq.constraint_name} UNIQUE (${cols});\n`
          );
        }

        // 6. Get indexes (non-unique, non-pk)
        const indexResult = await pool.query(`
          SELECT
            n.nspname AS schema,
            t.relname AS table_name,
            i.relname AS index_name,
            pg_get_indexdef(ix.indexrelid) AS index_def
          FROM pg_index ix
          JOIN pg_class t ON t.oid = ix.indrelid
          JOIN pg_class i ON i.oid = ix.indexrelid
          JOIN pg_namespace n ON n.oid = t.relnamespace
          WHERE NOT ix.indisunique AND NOT ix.indisprimary
            ${schemaFilter}
          ORDER BY n.nspname, t.relname, i.relname
        `);

        for (const idx of indexResult.rows) {
          ddlParts.push(`-- INDEX: ${idx.index_name}`);
          ddlParts.push(`${idx.index_def};\n`);
        }

        // 7. Get views
        const viewsResult = await pool.query(`
          SELECT schemaname AS schema,
                 viewname AS name,
                 definition
          FROM pg_views
          WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
            ${input.schema ? `AND schemaname = '${input.schema}'` : ""}
          ORDER BY schemaname, viewname
        `);

        for (const view of viewsResult.rows) {
          ddlParts.push(`-- VIEW: ${view.schema}.${view.name}`);
          ddlParts.push(`CREATE VIEW ${view.schema}.${view.name} AS\n${view.definition}\n`);
        }

        return {
          content: [
            {
              type: "text",
              text: ddlParts.join("\n"),
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: "text",
              text: `Unknown tool: ${name}`,
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// Cleanup on exit
process.on("SIGINT", async () => {
  for (const [id, conn] of connections) {
    await conn.pool.end();
  }
  process.exit(0);
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("PostgreSQL MCP server running on stdio");
}

main().catch(console.error);
