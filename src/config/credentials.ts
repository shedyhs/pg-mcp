import { readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import type { ConnectionSpec } from "./parse.js";
import { describeError } from "../shared/error-message.js";

export const CREDENTIALS_FILE = join(homedir(), ".config", "pg-mcp", "credentials.json");

/** Readable by group or others: this file is nothing but passwords. */
const GROUP_OR_OTHER_ACCESS = 0o077;

const CredentialsSchema = z.record(z.string().min(1), z.string().min(1));

export interface CredentialsResult {
  credentials: Map<string, string>;
  errors: string[];
}

export interface AppliedCredentials {
  specs: ConnectionSpec[];
  errors: string[];
}

/**
 * Puts a password into a connection URL. The pg driver ignores a `password`
 * option whenever a connection string is present, so the URL is the only place
 * it can go. The value is percent-encoded: a password containing `@`, `/` or
 * `#` would otherwise re-parse as a different host.
 */
export function withPassword(rawUrl: string, password: string): string {
  const url = new URL(rawUrl);
  url.password = encodeURIComponent(password);
  return url.toString();
}

/**
 * Parses the credentials file: a flat map of connection id to password. Errors
 * never quote the document, which is entirely secrets.
 */
export function parseCredentialsDocument(text: string, source: string): CredentialsResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { credentials: new Map(), errors: [`${source}: invalid JSON`] };
  }

  const parsed = CredentialsSchema.safeParse(raw);
  if (!parsed.success) {
    const ids = parsed.error.issues.map((issue) => issue.path.join(".")).filter(Boolean);
    const detail = ids.length > 0 ? ` (check: ${[...new Set(ids)].join(", ")})` : "";
    return {
      credentials: new Map(),
      errors: [`${source}: expected an object mapping connection id to a password string${detail}`],
    };
  }

  return { credentials: new Map(Object.entries(parsed.data)), errors: [] };
}

function checkPermissions(path: string): string[] {
  try {
    const { mode } = statSync(path);
    if (mode & GROUP_OR_OTHER_ACCESS) {
      const octal = (mode & 0o777).toString(8);
      return [`${path}: readable beyond its owner (mode ${octal}); it holds passwords - chmod 600 it`];
    }
  } catch {
    // Advisory only; a stat failure surfaces through the read below.
  }
  return [];
}

export function loadCredentials(path: string = CREDENTIALS_FILE): CredentialsResult {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    const missing = error instanceof Error && "code" in error && error.code === "ENOENT";
    if (missing) return { credentials: new Map(), errors: [] };
    return { credentials: new Map(), errors: [`${path}: could not be read (${describeError(error)})`] };
  }

  const parsed = parseCredentialsDocument(text, path);
  return { credentials: parsed.credentials, errors: [...checkPermissions(path), ...parsed.errors] };
}

/**
 * Returns new specs with passwords filled in from the credentials map. A
 * credential that cannot be applied is reported rather than dropped silently -
 * a typo in an id would otherwise look exactly like a wrong password.
 *
 * `contestedIds` names connections whose id was claimed by more than one
 * source. Their password is refused: credentials.json is a 0600 file, but an
 * environment variable can claim any id, and applying the password anyway would
 * hand a secret meant for one host to a URL chosen somewhere less trusted.
 */
export function applyCredentials(
  specs: ConnectionSpec[],
  credentials: Map<string, string>,
  contestedIds: ReadonlySet<string> = new Set(),
): AppliedCredentials {
  const errors: string[] = [];
  const byId = new Set(specs.map((spec) => spec.id));

  for (const id of credentials.keys()) {
    if (!byId.has(id)) {
      errors.push(`credentials: no connection named '${id}' - check the id against connections.json`);
    }
  }

  const updated = specs.map((spec) => {
    const password = credentials.get(spec.id);
    if (password === undefined) return spec;

    if (contestedIds.has(spec.id)) {
      errors.push(
        `credentials: refusing the password for '${spec.id}' - ${spec.source} claimed that id from another source, ` +
          `and the password would go to a URL declared there. Remove the duplicate or rename one of them.`,
      );
      return spec;
    }

    if (!spec.url) {
      errors.push(`credentials: connection '${spec.id}' has no URL to put a password into; use PGPASSWORD instead`);
      return spec;
    }

    try {
      return { ...spec, url: withPassword(spec.url, password) };
    } catch (error) {
      errors.push(`credentials: connection '${spec.id}' has a URL a password cannot be added to (${describeError(error)})`);
      return spec;
    }
  });

  return { specs: updated, errors };
}
