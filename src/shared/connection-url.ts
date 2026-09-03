export interface SplitConnectionUrl {
  /** The URL with the password removed, safe to pass as a process argument. */
  url: string;
  /** The password that was in it, if any. */
  password?: string;
}

/**
 * Separates the password from a connection URL.
 *
 * Process arguments are world-readable on Linux through /proc/PID/cmdline
 * (mode 444), so a password in `pg_dump -d <url>` is visible to every user on
 * the machine via `ps`. The environment is not: /proc/PID/environ is mode 600.
 * Callers pass the returned url in argv and the password through PGPASSWORD.
 */
export function splitPassword(rawUrl: string): SplitConnectionUrl {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { url: rawUrl };
  }

  if (!url.password) return { url: rawUrl };

  const password = decodeURIComponent(url.password);
  url.password = "";
  return { url: url.toString(), password };
}
