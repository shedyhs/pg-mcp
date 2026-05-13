import { z } from "zod";

export const BackupQueryShape = {
  connectionId: z.string().describe("Connection ID to use"),
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
  "Backup specific rows from one or more tables by generating INSERT statements into a .sql file. Useful for creating a safety net before DELETE operations.";
