import { z } from "zod";

export const DisconnectSchema = z.object({
  connectionId: z.string().describe("Connection ID to disconnect"),
});

export const disconnectDescription = "Disconnect from a PostgreSQL database";
