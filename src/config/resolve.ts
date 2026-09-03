import { readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { emptyResult, parseConnectionsDocument } from "./parse.js";
import type { ConnectionSpec, ParseResult } from "./parse.js";
import { describeError } from "../shared/error-message.js";
import { CREDENTIALS_FILE, applyCredentials, loadCredentials } from "./credentials.js";

export const CONNECTIONS_FILE = join(homedir(), ".config", "pg-mcp", "connections.json");
export const DEFAULT_CONNECTION_ID = "default";

const CONNECTIONS_ENV_VAR = "PG_MCP_CONNECTIONS";

/**
 * World-writable only. Group-writable is deliberately not flagged: with the
 * common umask 002 and per-user groups, files are born 664 and the warning
 * would fire for everyone, which is noise rather than signal.
 */
const WORLD_WRITABLE = 0o002;

export interface ResolveOptions {
  env?: NodeJS.ProcessEnv;
  configPath?: string;
  credentialsPath?: string;
}

function isNotFound(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

/**
 * Warns when the connections file can be rewritten by anyone on the machine.
 * It holds connection targets, so a world-writable file is a redirect waiting
 * to happen. Not fatal: reporting beats refusing to start.
 */
function checkFilePermissions(configPath: string): string[] {
  try {
    const { mode } = statSync(configPath);
    if (mode & WORLD_WRITABLE) {
      const octal = (mode & 0o777).toString(8);
      return [`${configPath}: world-writable (mode ${octal}); anyone could repoint a connection - chmod 600 it`];
    }
  } catch {
    // Permissions are advisory - a stat failure is reported by the read below.
  }
  return [];
}

function loadFromFile(configPath: string, env: NodeJS.ProcessEnv): ParseResult {
  let text: string;
  try {
    text = readFileSync(configPath, "utf8");
  } catch (error) {
    if (isNotFound(error)) return emptyResult();
    return { specs: [], errors: [`${configPath}: could not be read (${describeError(error)})`] };
  }

  const parsed = parseConnectionsDocument(text, configPath, env);
  return { specs: parsed.specs, errors: [...checkFilePermissions(configPath), ...parsed.errors] };
}

function loadFromEnvJson(env: NodeJS.ProcessEnv): ParseResult {
  const raw = env[CONNECTIONS_ENV_VAR];
  if (!raw?.trim()) return emptyResult();

  return parseConnectionsDocument(raw, CONNECTIONS_ENV_VAR, env);
}

function loadDefaultFromEnv(env: NodeJS.ProcessEnv): ParseResult {
  if (env.DATABASE_URL) {
    return {
      specs: [{ id: DEFAULT_CONNECTION_ID, url: env.DATABASE_URL, readOnly: undefined, source: "DATABASE_URL" }],
      errors: [],
    };
  }

  if (env.PGHOST || env.PGDATABASE) {
    return {
      specs: [{ id: DEFAULT_CONNECTION_ID, url: undefined, readOnly: undefined, source: "PGHOST/PGDATABASE" }],
      errors: [],
    };
  }

  return emptyResult();
}

/**
 * Merges every connection source by id, in increasing order of precedence:
 * the config file, then PG_MCP_CONNECTIONS, then DATABASE_URL/libpq vars
 * (which always own the id "default"). A spec keeps the position where its id
 * first appeared, so the file drives the listing order. Cross-source overrides
 * are reported: a stray DATABASE_URL silently repointing a reviewed connection
 * is exactly the kind of surprise that should show up in the startup log.
 *
 * Passwords from credentials.json are applied last, so a connection URL can be
 * kept free of secrets regardless of which source declared it.
 */
export function resolveConnectionSpecs(options: ResolveOptions = {}): ParseResult {
  const env = options.env ?? process.env;
  const configPath = options.configPath ?? CONNECTIONS_FILE;

  const sources = [loadFromFile(configPath, env), loadFromEnvJson(env), loadDefaultFromEnv(env)];

  const merged = new Map<string, ConnectionSpec>();
  const overrides: string[] = [];
  const contestedIds = new Set<string>();

  for (const source of sources) {
    for (const spec of source.specs) {
      const superseded = merged.get(spec.id);
      if (superseded) {
        overrides.push(`connection '${spec.id}' from ${spec.source} overrides the one from ${superseded.source}`);
        contestedIds.add(spec.id);
      }
      merged.set(spec.id, spec);
    }
  }

  const { credentials, errors: credentialErrors } = loadCredentials(
    options.credentialsPath ?? CREDENTIALS_FILE,
  );
  const applied = applyCredentials([...merged.values()], credentials, contestedIds);

  return {
    specs: applied.specs,
    errors: [
      ...sources.flatMap((source) => source.errors),
      ...overrides,
      ...credentialErrors,
      ...applied.errors,
    ],
  };
}
