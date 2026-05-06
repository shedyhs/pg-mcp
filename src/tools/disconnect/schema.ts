import { z } from "zod";

export const DisconnectSchema = z.object({
  connectionId: z.string().describe("Connection ID to disconnect"),
});

export const disconnectToolDefinition = {
  name: "pg_disconnect",
  description: "Disconnect from a PostgreSQL database",
  inputSchema: {
    type: "object",
    properties: {
      connectionId: {
        type: "string",
        description: "Connection ID to disconnect",
      },
    },
    required: ["connectionId"],
  },
} as const;
