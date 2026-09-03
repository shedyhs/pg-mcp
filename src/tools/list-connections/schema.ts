import { z } from "zod";

export const ListConnectionsSchema = z.object({});

export const listConnectionsDescription =
  "List the PostgreSQL connections currently open, with their id, target host/database and read-only mode. Call this first when you do not know which connectionId to pass to the other tools, or to check whether a database is reachable before connecting again. Credentials are never returned.";
