import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { z } from "zod";
import type { DumpShape } from "./schema.js";
import { connections } from "../../shared/connections.js";
import type { ConnectionConfig, ToolResponse } from "../../shared/types.js";

const execFileAsync = promisify(execFile);

type DumpInput = z.objectOutputType<typeof DumpShape, z.ZodTypeAny>;

const FORMAT_FLAGS: Record<string, string> = {
  plain: "p",
  custom: "c",
  directory: "d",
  tar: "t",
};

export function buildArgs(
  input: DumpInput,
  config: ConnectionConfig
): string[] {
  const args: string[] = [];

  if (config.connectionString) {
    args.push("-d", config.connectionString);
  } else {
    if (config.host) args.push("-h", config.host);
    if (config.port) args.push("-p", String(config.port));
    if (config.user) args.push("-U", config.user);
    if (config.database) args.push("-d", config.database);
  }

  args.push("--no-password");

  args.push("-f", input.outputPath);
  args.push("-F", FORMAT_FLAGS[input.format]);

  if (input.schemaOnly) args.push("--schema-only");
  if (input.dataOnly) args.push("--data-only");
  if (input.clean) args.push("--clean");
  if (input.ifExists) args.push("--if-exists");
  if (input.noOwner) args.push("--no-owner");
  if (input.noPrivileges) args.push("--no-privileges");
  if (input.compress) args.push("--compress", input.compress);
  if (input.schema) args.push("-n", input.schema);

  if (input.table) {
    for (const t of input.table) args.push("-t", t);
  }
  if (input.excludeTable) {
    for (const t of input.excludeTable) args.push("-T", t);
  }

  return args;
}

export async function handleDump(input: DumpInput): Promise<ToolResponse> {
  if (input.schemaOnly && input.dataOnly) {
    return {
      content: [{ type: "text", text: "schemaOnly and dataOnly are mutually exclusive" }],
      isError: true,
    };
  }

  const conn = connections.get(input.connectionId);
  if (!conn) {
    return {
      content: [
        {
          type: "text",
          text: `Connection '${input.connectionId}' not found. Connect first using pg_connect.`,
        },
      ],
      isError: true,
    };
  }

  const pgDumpArgs = buildArgs(input, conn.config);

  const env: Record<string, string> = { ...process.env } as Record<
    string,
    string
  >;
  if (conn.config.password) {
    env.PGPASSWORD = conn.config.password;
  }

  try {
    const { stderr } = await execFileAsync("pg_dump", pgDumpArgs, { env });

    let message = `Dump saved to ${input.outputPath}`;
    if (stderr) message += `\nWarnings:\n${stderr}`;

    return { content: [{ type: "text", text: message }] };
  } catch (error: unknown) {
    const err = error as { code?: string; stderr?: string; message?: string };

    if (err.code === "ENOENT") {
      return {
        content: [
          {
            type: "text",
            text: "pg_dump not found. Ensure PostgreSQL client tools are installed on the host.",
          },
        ],
        isError: true,
      };
    }

    const errorMessage = err.stderr || err.message || "Unknown error";
    return {
      content: [{ type: "text", text: `pg_dump failed: ${errorMessage}` }],
      isError: true,
    };
  }
}
