import { z } from "zod";
export declare const DisconnectSchema: z.ZodObject<{
    connectionId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    connectionId: string;
}, {
    connectionId: string;
}>;
export declare const disconnectToolDefinition: {
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
};
