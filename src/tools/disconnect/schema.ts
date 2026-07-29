import { z } from "zod";

export const DisconnectSchema = z.object({
  connectionId: z.string().describe("Connection ID to disconnect"),
});

export const disconnectDescription =
  "Close a PostgreSQL connection and release its pool. Only needed for connections opened with pg_connect; leave the auto-connected 'default' alone unless the user asks to drop it.";
