const VAR_REFERENCE = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;
const WHOLE_VALUE_REFERENCE = /^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/;

function readVar(env: NodeJS.ProcessEnv, name: string): string {
  const resolved = env[name];
  if (!resolved) {
    throw new Error(`environment variable '${name}' is referenced but not set`);
  }
  return resolved;
}

/**
 * Expands `${VAR}` references from `env` so a connections file can be committed
 * without the passwords in it. An unset or empty variable is an error rather
 * than an empty expansion, which would silently produce a broken URL.
 *
 * A reference that is the entire value stands for a whole connection URL and is
 * substituted verbatim. A reference embedded in a larger string stands for one
 * URL component and is percent-encoded: a password containing `@`, `/` or `#`
 * would otherwise re-parse as a new authority and silently point the connection
 * at a different host - a redirect, not just a broken credential.
 */
export function interpolateEnv(value: string, env: NodeJS.ProcessEnv): string {
  const wholeValue = value.match(WHOLE_VALUE_REFERENCE);
  if (wholeValue) {
    return readVar(env, wholeValue[1]);
  }

  return value.replace(VAR_REFERENCE, (_match, name: string) =>
    encodeURIComponent(readVar(env, name)),
  );
}
