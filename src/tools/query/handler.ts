import type { z } from "zod";
import type { QuerySchema } from "./schema.js";
import { isBlockedQuery } from "./blocked-patterns.js";
import { connections } from "../../shared/connections.js";
import type { ToolResponse } from "../../shared/types.js";

export async function handleQuery(input: z.infer<typeof QuerySchema>): Promise<ToolResponse> {

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
  }

  return {
    content: [
      {
        type: "text",
        text: `Query executed successfully.\nCommand: ${result.command}\nRows affected: ${result.rowCount}`,
      },
    ],
  };
}
