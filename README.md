# pg-mcp

MCP server for PostgreSQL. Query databases, inspect schemas, backup data, and manage dumps — with built-in read-only protection.

## Quick Start

```bash
npm install -g @shedyhs/pg-mcp
```

Add to your AI provider config:

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@shedyhs/pg-mcp"],
      "env": {
        "DATABASE_URL": "postgres://user:pass@localhost:5432/mydb"
      }
    }
  }
}
```

With `DATABASE_URL` or `PGHOST`/`PGDATABASE` set, the server auto-connects as `"default"` on startup.

Set `PG_MCP_READ_ONLY=false` in `env` to allow write operations (read-only by default).

## Named Connections

To reach more than one database, give each connection a name. Every tool takes a `connectionId`, and `pg_list_connections` shows what is open.

### Connections file (recommended)

Create `~/.config/pg-mcp/connections.json`:

```json
{
  "connections": [
    { "id": "prod", "url": "postgres://app:${PROD_PW}@prod.example.com:5432/app", "readOnly": true },
    { "id": "staging", "url": "postgres://app:${STG_PW}@stg.example.com:5432/app", "readOnly": true },
    { "id": "local", "url": "postgres://dev:dev@localhost:5432/app", "readOnly": false }
  ]
}
```

The path is fixed — no env var is needed to point at it. Each entry takes:

| Field | Required | Meaning |
|-------|----------|---------|
| `id` | yes | Name to pass as `connectionId` |
| `url` | yes | PostgreSQL connection URL |
| `readOnly` | no | Falls back to `PG_MCP_READ_ONLY`, then to `true` |

Unknown keys are rejected rather than ignored, so a misspelled `raedOnly` fails loudly instead of silently leaving the connection read-only.

Since the file holds connection targets, `chmod 600 ~/.config/pg-mcp/connections.json` — the server warns on stderr if it is world-writable.

### `${VAR}` expansion

URLs expand `${VAR}` from the environment, so the file can be committed without the passwords in it:

```json
{ "id": "prod", "url": "postgres://app:${PROD_PW}@prod.example.com:5432/app" }
```

Two rules matter:

- **A reference inside a larger URL is percent-encoded.** A password containing `@`, `/` or `#` would otherwise close the userinfo section and re-parse as a *different host* — silently pointing the connection somewhere else. Escaping means a var cannot span URL components, so `"${HOST}"` holding `db:5432` becomes `db%3A5432`; use `"${HOST}:5432"` instead.
- **A reference that is the whole value is used verbatim**, because it stands for a complete URL:

  ```json
  { "id": "prod", "url": "${PROD_DATABASE_URL}" }
  ```

A variable that is unset or empty is an error: that one connection is skipped and reported on stderr, the others still open.

### Passwords in a separate file

`${VAR}` moves the password from the config file to the environment — but in an MCP setup that environment is usually the `env` block of your client config, which is plaintext all the same. To keep `connections.json` free of secrets, put the passwords in `~/.config/pg-mcp/credentials.json` instead — a flat map of connection id to password:

```json
{
  "prod": "the-real-password",
  "staging": "another-password"
}
```

```bash
chmod 600 ~/.config/pg-mcp/credentials.json
```

Then leave the password out of the URL entirely:

```json
{
  "connections": [
    { "id": "prod", "url": "postgres://app@prod.example.com:5432/app", "readOnly": true }
  ]
}
```

The password is injected into the URL at startup, percent-encoded, so `@`, `/`, `#` and `:` in a password are safe. It applies to connections from any source, so `{"default": "..."}` covers one declared through `DATABASE_URL` too.

Three cases get reported on stderr instead of looking like a wrong password:

- an id in `credentials.json` that matches no connection (a typo)
- a credential for a connection that has no URL to inject into
- **a contested id** — if two sources declare the same id, the password is *refused*, not applied. `credentials.json` is a `0600` file, but an environment variable can claim any id; applying the password anyway would hand a secret meant for one host to a URL declared somewhere less trusted. Rename one of them to resolve it.

`pg_dump` and `pg_restore` receive the password through `PGPASSWORD`, never as a command-line argument: on Linux `/proc/PID/cmdline` is world-readable (mode 444) so anything in `argv` shows up in `ps` for every user on the machine, while `/proc/PID/environ` is mode 600.

The file is still plaintext — this separates the secret from the config so the latter can be committed, it does not encrypt anything. The server warns if the file is readable beyond its owner, and `chmod 600` silences that. (libpq's `~/.pgpass` also still works, if you already keep passwords there: omit the password and the driver finds it.)

### Inline via env

The same list can go in a single `PG_MCP_CONNECTIONS` env var, as a JSON array:

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@shedyhs/pg-mcp"],
      "env": {
        "PG_MCP_CONNECTIONS": "[{\"id\":\"prod\",\"url\":\"postgres://app:${PROD_PW}@prod:5432/app\",\"readOnly\":true}]",
        "PROD_PW": "..."
      }
    }
  }
}
```

### Precedence

All three sources are merged by `id`, later ones winning:

1. `~/.config/pg-mcp/connections.json`
2. `PG_MCP_CONNECTIONS`
3. `DATABASE_URL`, or `PGHOST`/`PGDATABASE` — these always own the id `default`

Passwords from `credentials.json` are applied after the merge, to whichever connection ended up with each id.

Connections open concurrently at startup and are registered in declaration order. When a higher-precedence source takes over an id, the override is reported on stderr, so a stray `DATABASE_URL` repointing a reviewed connection is visible rather than silent.

A database being unreachable never stops the server: each attempt is bounded by a 10s timeout — covering both the connect and the health check, so a host that accepts TCP but never answers cannot stall startup — and the failure goes to stderr while the other connections stay usable.

## Tools

| Tool | Description | Requires |
|------|-------------|----------|
| `pg_list_connections` | List open connections with target and read-only mode (never returns credentials) | — |
| `pg_connect` | Connect to a PostgreSQL database (URL, params, or libpq env vars) | — |
| `pg_disconnect` | Disconnect from a database | — |
| `pg_query` | Execute SQL queries with read-only protection | — |
| `pg_list_schemas` | List all user schemas | — |
| `pg_get_ddl` | Get complete DDL (tables, indexes, constraints, FKs, sequences, enums, views) | — |
| `pg_backup_query` | Backup specific rows as INSERT statements before destructive operations | — |
| `pg_dump` | Dump a database or specific tables to a file | `pg_dump` CLI |
| `pg_restore` | Restore a database from a dump file (custom, directory, or tar format) | `pg_restore` CLI |

## Where to Put the Config

| Provider | Config file |
|----------|------------|
| Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) / `%APPDATA%\Claude\claude_desktop_config.json` (Windows) |
| Claude Code | `.claude/settings.json` or `~/.claude/settings.json` |
| Cursor | `.cursor/mcp.json` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |
| Codex | `codex.json` |

All providers above use the same JSON format from [Quick Start](#quick-start).

**GitHub Copilot (VS Code)** uses a slightly different format in `.vscode/mcp.json`:

```json
{
  "servers": {
    "postgres": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@shedyhs/pg-mcp"],
      "env": {
        "DATABASE_URL": "postgres://user:pass@localhost:5432/mydb"
      }
    }
  }
}
```

**From source** — replace `command`/`args` with `"command": "node", "args": ["/path/to/pg-mcp/dist/index.js"]`.

## Installing pg_dump & pg_restore

Only needed if you use `pg_dump` or `pg_restore`. All other tools work without external dependencies.

| OS | Command |
|----|---------|
| macOS | `brew install libpq` |
| Debian/Ubuntu | `sudo apt-get install postgresql-client-16` |
| RHEL/Fedora | `sudo dnf install postgresql16` |
| Windows | `winget install PostgreSQL.PostgreSQL.16` |

Verify with `pg_dump --version`.

## Installation from Source

```bash
git clone https://github.com/shedyhs/pg-mcp
cd pg-mcp
npm install && npm run build
```

## License

MIT
