export const BLOCKED_PATTERNS = [
    // DML (Data Manipulation)
    /^\s*INSERT\s+/i,
    /^\s*UPDATE\s+/i,
    /^\s*DELETE\s+/i,
    /^\s*TRUNCATE\s+/i,
    /^\s*MERGE\s+/i,
    // DDL (Data Definition)
    /^\s*CREATE\s+/i,
    /^\s*ALTER\s+/i,
    /^\s*DROP\s+/i,
    /^\s*RENAME\s+/i,
    // DCL (Data Control)
    /^\s*GRANT\s+/i,
    /^\s*REVOKE\s+/i,
    // Other dangerous operations
    /^\s*COPY\s+/i,
    /^\s*VACUUM\s+/i,
    /^\s*REINDEX\s+/i,
    /^\s*CLUSTER\s+/i,
    /^\s*COMMENT\s+/i,
];
export function isBlockedQuery(sql) {
    return BLOCKED_PATTERNS.some(pattern => pattern.test(sql));
}
