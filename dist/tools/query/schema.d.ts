import { z } from "zod";
export declare const QuerySchema: z.ZodObject<{
    connectionId: z.ZodString;
    sql: z.ZodString;
    params: z.ZodOptional<z.ZodArray<z.ZodUnknown, "many">>;
}, "strip", z.ZodTypeAny, {
    connectionId: string;
    sql: string;
    params?: unknown[] | undefined;
}, {
    connectionId: string;
    sql: string;
    params?: unknown[] | undefined;
}>;
export declare const queryToolDefinition: {
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
};
