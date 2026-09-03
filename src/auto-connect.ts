import { connections } from "./shared/connections.js";
import { resolveReadOnly } from "./shared/types.js";
import type { ConnectionInfo } from "./shared/types.js";
import { createPool } from "./tools/connect/handler.js";
import { resolveConnectionSpecs, type ResolveOptions } from "./config/resolve.js";
import type { ConnectionSpec } from "./config/parse.js";
import { describeError } from "./shared/error-message.js";

/**
 * Bound on the startup health check. The pool's connectionTimeoutMillis only
 * covers the TCP/auth phase, so a host that accepts connections but never
 * answers a query would otherwise hang here forever.
 */
const HEALTH_CHECK_TIMEOUT_MS = 10_000;

/** Bound on how long a tool call waits for startup connections to settle. */
const READINESS_TIMEOUT_MS = 15_000;

export interface AutoConnectOptions extends ResolveOptions {
  /** Overrides the health-check bound; exists so tests need not wait 10s. */
  healthCheckTimeoutMs?: number;
}

function timeoutAfter(ms: number, message: string): { promise: Promise<never>; cancel: () => void } {
  let timer: NodeJS.Timeout;
  const promise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
    timer.unref();
  });
  return { promise, cancel: () => clearTimeout(timer) };
}

async function withTimeout<T>(work: Promise<T>, ms: number, message: string): Promise<T> {
  const timeout = timeoutAfter(ms, message);
  try {
    return await Promise.race([work, timeout.promise]);
  } finally {
    timeout.cancel();
  }
}

/**
 * Opens one spec without touching the connection registry, so callers stay in
 * control of registration order. Every step is bounded by a timeout and the
 * pool is destroyed on failure: an unreachable or unresponsive database at
 * startup must not leak a pool, nor stall the connections that are healthy.
 */
async function openConnection(
  spec: ConnectionSpec,
  env: NodeJS.ProcessEnv,
  timeoutMs: number,
): Promise<ConnectionInfo> {
  const pool = spec.url ? createPool({ url: spec.url }) : createPool();

  try {
    const client = await withTimeout(
      pool.connect(),
      timeoutMs,
      `timed out connecting to '${spec.id}'`,
    );

    try {
      await withTimeout(
        client.query("SELECT 1"),
        timeoutMs,
        `timed out running the health check on '${spec.id}'`,
      );
      client.release();
    } catch (error) {
      // Destroy rather than return to the pool: the query may still be in flight.
      client.release(true);
      throw error;
    }
  } catch (error) {
    // Not awaited: closing a pool with a stuck socket can itself hang.
    void pool.end().catch(() => {});
    throw error;
  }

  return {
    pool,
    readOnly: resolveReadOnly(spec.readOnly, env),
    config: spec.url ? { connectionString: spec.url } : {},
  };
}

/** In-flight startup connection work, awaited by tools before they run. */
let pendingAutoConnect: Promise<void> | null = null;

/**
 * Resolves once startup connections have settled, so a tool call that arrives
 * during the handshake does not see an empty registry. Resolves immediately
 * when autoConnect was never started, which is the case in unit tests.
 */
export async function whenConnectionsReady(): Promise<void> {
  if (!pendingAutoConnect) return;

  try {
    await withTimeout(
      pendingAutoConnect,
      READINESS_TIMEOUT_MS,
      "startup connections are still opening",
    );
  } catch {
    // Proceed anyway: a slow startup connection must not block a tool call for
    // the connections that are already open. The tool reports what it finds.
  }
}

/**
 * Opens every connection declared in the connections file, PG_MCP_CONNECTIONS
 * and DATABASE_URL/libpq vars. Connections are opened concurrently but
 * registered in declaration order, so listings match the config file. Failures
 * are reported on stderr and never stop the server: the remaining connections
 * stay usable and pg_connect still works.
 */
export function autoConnect(options: AutoConnectOptions = {}): Promise<void> {
  pendingAutoConnect = openDeclaredConnections(options);
  return pendingAutoConnect;
}

async function openDeclaredConnections(options: AutoConnectOptions): Promise<void> {
  const env = options.env ?? process.env;
  const timeoutMs = options.healthCheckTimeoutMs ?? HEALTH_CHECK_TIMEOUT_MS;
  const { specs, errors } = resolveConnectionSpecs({ ...options, env });

  for (const error of errors) {
    console.error(`Connections config: ${error}`);
  }

  if (specs.length === 0) return;

  const outcomes = await Promise.allSettled(specs.map((spec) => openConnection(spec, env, timeoutMs)));

  outcomes.forEach((outcome, index) => {
    const spec = specs[index];

    if (outcome.status === "rejected") {
      const reason = describeError(outcome.reason);
      console.error(`Auto-connect failed for '${spec.id}' (server continues without it): ${reason}`);
      return;
    }

    connections.set(spec.id, outcome.value);
    const modeText = outcome.value.readOnly ? " (read-only)" : "";
    console.error(`Auto-connected '${spec.id}'${modeText} from ${spec.source}`);
  });
}
