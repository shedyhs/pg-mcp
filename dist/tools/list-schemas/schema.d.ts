import { z } from "zod";
export declare const ListSchemasSchema: z.ZodObject<{
    connectionId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    connectionId: string;
}, {
    connectionId: string;
}>;
export declare const listSchemasToolDefinition: {
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
};
