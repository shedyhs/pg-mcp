import type { z } from "zod";
import type { ListSchemasSchema } from "./schema.js";
import { connections } from "../../shared/connections.js";
import type { ToolResponse } from "../../shared/types.js";

export async function handleListSchemas(input: z.infer<typeof ListSchemasSchema>): Promise<ToolResponse> {

  const conn = connections.get(input.connectionId);
  if (!conn) {
    return {
      content: [
        {
          type: "text",
          text: `Connection '${input.connectionId}' not found. Call pg_list_connections to see the open ones, or pg_connect to open a new one.`,
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
