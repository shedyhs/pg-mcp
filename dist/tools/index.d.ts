export { connectToolDefinition } from "./connect/schema.js";
export { handleConnect } from "./connect/handler.js";
export { disconnectToolDefinition } from "./disconnect/schema.js";
export { handleDisconnect } from "./disconnect/handler.js";
export { queryToolDefinition } from "./query/schema.js";
export { handleQuery } from "./query/handler.js";
export { listSchemasToolDefinition } from "./list-schemas/schema.js";
export { handleListSchemas } from "./list-schemas/handler.js";
export { getDdlToolDefinition } from "./get-ddl/schema.js";
export { handleGetDdl } from "./get-ddl/handler.js";
export declare const toolDefinitions: ({
    readonly name: "pg_connect";
    readonly description: "Connect to a PostgreSQL database using a URL or individual parameters";
    readonly inputSchema: {
        readonly type: "object";
        readonly properties: {
            readonly connectionId: {
                readonly type: "string";
                readonly description: "Unique identifier for this connection";
            };
            readonly url: {
                readonly type: "string";
                readonly description: "PostgreSQL connection URL (e.g., postgresql://user:pass@host:5432/dbname?ssl=true)";
            };
            readonly host: {
                readonly type: "string";
                readonly description: "PostgreSQL host (ignored if url is provided)";
            };
            readonly port: {
                readonly type: "number";
                readonly description: "PostgreSQL port (default: 5432, ignored if url is provided)";
            };
            readonly database: {
                readonly type: "string";
                readonly description: "Database name (ignored if url is provided)";
            };
            readonly user: {
                readonly type: "string";
                readonly description: "Username (ignored if url is provided)";
            };
            readonly password: {
                readonly type: "string";
                readonly description: "Password (ignored if url is provided)";
            };
            readonly ssl: {
                readonly type: "boolean";
                readonly description: "Use SSL connection (default: false, ignored if url is provided)";
            };
            readonly readOnly: {
                readonly type: "boolean";
                readonly description: "Enable read-only mode - blocks INSERT, UPDATE, DELETE, and DDL operations (default: true)";
            };
        };
        readonly required: readonly ["connectionId"];
    };
} | {
    readonly name: "pg_disconnect";
    readonly description: "Disconnect from a PostgreSQL database";
    readonly inputSchema: {
        readonly type: "object";
        readonly properties: {
            readonly connectionId: {
                readonly type: "string";
                readonly description: "Connection ID to disconnect";
            };
        };
        readonly required: readonly ["connectionId"];
    };
} | {
    readonly name: "pg_query";
    readonly description: "Execute a SQL query on a PostgreSQL database";
    readonly inputSchema: {
        readonly type: "object";
        readonly properties: {
            readonly connectionId: {
                readonly type: "string";
                readonly description: "Connection ID to use";
            };
            readonly sql: {
                readonly type: "string";
                readonly description: "SQL query to execute";
            };
            readonly params: {
                readonly type: "array";
                readonly description: "Query parameters for prepared statements";
            };
        };
        readonly required: readonly ["connectionId", "sql"];
    };
} | {
    readonly name: "pg_list_schemas";
    readonly description: "List all schemas in the database";
    readonly inputSchema: {
        readonly type: "object";
        readonly properties: {
            readonly connectionId: {
                readonly type: "string";
                readonly description: "Connection ID to use";
            };
        };
        readonly required: readonly ["connectionId"];
    };
} | {
    readonly name: "pg_get_ddl";
    readonly description: "Get the complete DDL (Data Definition Language) of the database including CREATE TABLE statements, indexes, constraints, foreign keys, sequences, and views";
    readonly inputSchema: {
        readonly type: "object";
        readonly properties: {
            readonly connectionId: {
                readonly type: "string";
                readonly description: "Connection ID to use";
            };
            readonly schema: {
                readonly type: "string";
                readonly description: "Filter by schema (optional, returns all user schemas if not specified)";
            };
        };
        readonly required: readonly ["connectionId"];
    };
})[];
export declare const toolHandlers: Record<string, (args: unknown) => Promise<import("../shared/types.js").ToolResponse>>;
