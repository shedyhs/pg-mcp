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
export const toolDefinitions = [
    (await import("./connect/schema.js")).connectToolDefinition,
    (await import("./disconnect/schema.js")).disconnectToolDefinition,
    (await import("./query/schema.js")).queryToolDefinition,
    (await import("./list-schemas/schema.js")).listSchemasToolDefinition,
    (await import("./get-ddl/schema.js")).getDdlToolDefinition,
];
export const toolHandlers = {
    pg_connect: (await import("./connect/handler.js")).handleConnect,
    pg_disconnect: (await import("./disconnect/handler.js")).handleDisconnect,
    pg_query: (await import("./query/handler.js")).handleQuery,
    pg_list_schemas: (await import("./list-schemas/handler.js")).handleListSchemas,
    pg_get_ddl: (await import("./get-ddl/handler.js")).handleGetDdl,
};
