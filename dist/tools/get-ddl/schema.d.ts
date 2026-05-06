import { z } from "zod";
export declare const GetDdlSchema: z.ZodObject<{
    connectionId: z.ZodString;
    schema: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    connectionId: string;
    schema?: string | undefined;
}, {
    connectionId: string;
    schema?: string | undefined;
}>;
export declare const getDdlToolDefinition: {
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
};
