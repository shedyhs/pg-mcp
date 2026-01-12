# pg-mcp

MCP (Model Context Protocol) server for PostgreSQL databases. Enables Claude and other AI assistants to query databases, inspect schemas, and get DDL - with built-in read-only protection.

## Features

- **pg_connect** - Connect to PostgreSQL databases (URL or individual params)
- **pg_disconnect** - Disconnect from databases
- **pg_query** - Execute SQL queries
- **pg_list_schemas** - List all schemas
- **pg_get_ddl** - Get complete DDL (tables, indexes, constraints, foreign keys, views)
- **Read-only mode** - Blocks INSERT, UPDATE, DELETE, and DDL operations (enabled by default)

## Installation

### Using npx (recommended)

```bash
npx pg-mcp
```

### Global install

```bash
npm install -g pg-mcp
```

### From source

```bash
git clone https://github.com/shedyfreak/pg-mcp
cd pg-mcp
npm install
npm run build
```

## Configuration

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["pg-mcp"]
    }
  }
}
```

### Claude Code

Add to your `.claude/settings.json`:

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["pg-mcp"]
    }
  }
}
```

### With environment variable

You can set `DATABASE_URL` to auto-connect:

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["pg-mcp"],
      "env": {
        "DATABASE_URL": "postgres://user:pass@localhost:5432/mydb"
      }
    }
  }
}
```

## Usage

### Connect to database

```
pg_connect({
  connectionId: "main",
  url: "postgres://user:pass@localhost:5432/mydb"
})
```

Or with individual parameters:

```
pg_connect({
  connectionId: "main",
  host: "localhost",
  port: 5432,
  database: "mydb",
  user: "postgres",
  password: "secret"
})
```

### Read-only mode

By default, connections are read-only. This blocks:
- DML: INSERT, UPDATE, DELETE, TRUNCATE, MERGE
- DDL: CREATE, ALTER, DROP, RENAME
- DCL: GRANT, REVOKE

To disable (use with caution):

```
pg_connect({
  connectionId: "main",
  url: "postgres://...",
  readOnly: false
})
```

### Query examples

```sql
-- List tables
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- Query data
SELECT * FROM users LIMIT 10;

-- Get table structure
pg_get_ddl({ connectionId: "main", schema: "public" })
```

## Tools

| Tool | Description |
|------|-------------|
| `pg_connect` | Connect to a PostgreSQL database |
| `pg_disconnect` | Disconnect from a database |
| `pg_query` | Execute a SQL query |
| `pg_list_schemas` | List all schemas in the database |
| `pg_get_ddl` | Get complete DDL for the database |

## License

MIT
