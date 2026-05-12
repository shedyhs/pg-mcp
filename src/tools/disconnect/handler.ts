import type { z } from "zod";
import type { DisconnectSchema } from "./schema.js";
import { connections } from "../../shared/connections.js";
import type { ToolResponse } from "../../shared/types.js";

export async function handleDisconnect(input: z.infer<typeof DisconnectSchema>): Promise<ToolResponse> {

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
