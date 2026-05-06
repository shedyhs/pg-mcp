import { z } from "zod";
export declare const ConnectSchema: z.ZodObject<{
    connectionId: z.ZodString;
    url: z.ZodOptional<z.ZodString>;
    host: z.ZodOptional<z.ZodString>;
    port: z.ZodDefault<z.ZodNumber>;
    database: z.ZodOptional<z.ZodString>;
    user: z.ZodOptional<z.ZodString>;
    password: z.ZodOptional<z.ZodString>;
    ssl: z.ZodDefault<z.ZodBoolean>;
    readOnly: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    connectionId: string;
    port: number;
    ssl: boolean;
    readOnly: boolean;
    url?: string | undefined;
    host?: string | undefined;
    database?: string | undefined;
    user?: string | undefined;
    password?: string | undefined;
}, {
    connectionId: string;
    url?: string | undefined;
    host?: string | undefined;
    port?: number | undefined;
    database?: string | undefined;
    user?: string | undefined;
    password?: string | undefined;
    ssl?: boolean | undefined;
    readOnly?: boolean | undefined;
}>;
export declare const connectToolDefinition: {
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
};
