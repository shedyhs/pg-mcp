import { z } from "zod";
import { interpolateEnv } from "./interpolate.js";
import { describeError } from "../shared/error-message.js";

export interface ConnectionSpec {
  id: string;
  /** Absent for libpq-driven connections, where `pg` reads PGHOST/PGUSER/... itself. */
  url?: string;
  /** Absent means "fall back to PG_MCP_READ_ONLY, then to read-only". */
  readOnly?: boolean;
  /** Where this spec came from, for error messages and startup logs. */
  source: string;
}

export interface ParseResult {
  specs: ConnectionSpec[];
  errors: string[];
}

/** A fresh result each time: a shared instance could be mutated by a caller. */
export function emptyResult(): ParseResult {
  return { specs: [], errors: [] };
}

// strict() on purpose: this is a hand-edited config file, and silently
// dropping a misspelled "raedOnly" would leave the connection read-only
// with no indication why.
const ConnectionEntrySchema = z
  .object({
    id: z.string().min(1),
    url: z.string().min(1),
    readOnly: z.boolean().optional(),
  })
  .strict();

const DocumentSchema = z.union([
  z.array(z.unknown()),
  z.object({ connections: z.array(z.unknown()) }).transform((doc) => doc.connections),
]);

/**
 * Node quotes the offending slice of the document in its JSON parse errors,
 * which would put a connection password on stderr. Keep the position, which is
 * what makes the error actionable, and drop the echoed text.
 */
function describeJsonError(error: unknown): string {
  const position = describeError(error).match(/at position \d+(?: \(line \d+ column \d+\))?/);
  return position ? `invalid JSON ${position[0]}` : "invalid JSON";
}

function describeIssues(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`).join("; ");
}

/**
 * Parses one connections document — the config file or PG_MCP_CONNECTIONS.
 * A bad entry is skipped and reported instead of failing the whole document,
 * so one stale connection never takes the others down with it.
 */
export function parseConnectionsDocument(
  text: string,
  source: string,
  env: NodeJS.ProcessEnv,
): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return { specs: [], errors: [`${source}: ${describeJsonError(error)}`] };
  }

  const document = DocumentSchema.safeParse(raw);
  if (!document.success) {
    return {
      specs: [],
      errors: [`${source}: expected an array of connections, or an object with a "connections" array`],
    };
  }

  const specs: ConnectionSpec[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  document.data.forEach((entry, index) => {
    const parsed = ConnectionEntrySchema.safeParse(entry);
    if (!parsed.success) {
      errors.push(`${source}: connection #${index + 1} is invalid (${describeIssues(parsed.error)})`);
      return;
    }

    const { id, url, readOnly } = parsed.data;

    if (seen.has(id)) {
      errors.push(`${source}: duplicate connection id '${id}', keeping the first one`);
      return;
    }

    try {
      const resolvedUrl = interpolateEnv(url, env);
      seen.add(id);
      specs.push({ id, url: resolvedUrl, readOnly, source });
    } catch (error) {
      errors.push(`${source}: connection '${id}' skipped - ${describeError(error)}`);
    }
  });

  return { specs, errors };
}
