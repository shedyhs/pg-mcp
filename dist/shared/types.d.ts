import type pg from "pg";
export interface ConnectionInfo {
    pool: pg.Pool;
    readOnly: boolean;
}
export interface ToolResponse {
    content: Array<{
        type: "text";
        text: string;
    }>;
    isError?: boolean;
    [key: string]: unknown;
}
