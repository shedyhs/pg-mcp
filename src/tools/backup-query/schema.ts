import { z } from "zod";

export const BackupQueryShape = {
  connectionId: z
    .string()
    .default("default")
    .describe("Connection ID to use (defaults to the auto-connected 'default')"),
  outputPath: z.string().describe("File path to save the backup (.sql)"),
  targets: z
    .array(
      z.object({
        table: z
          .string()
          .describe("Fully qualified table name (e.g. public.users)"),
        where: z.string().describe("WHERE clause without the WHERE keyword"),
      })
    )
    .min(1)
    .describe("Tables and conditions to backup"),
};

export const BackupQuerySchema = z.object(BackupQueryShape);

export const backupQueryDescription =
  "Back up specific rows from one or more tables into a .sql file of INSERT statements. Run this BEFORE any DELETE or UPDATE that touches real data - it is the undo button, and it is far cheaper than a full pg_dump because it only captures the rows matched by each WHERE clause.";
