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

## Tools

| Tool | Description | Requires |
|------|-------------|----------|
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
