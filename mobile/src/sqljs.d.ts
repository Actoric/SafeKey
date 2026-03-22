declare module 'sql.js' {
  export interface QueryExecResult {
    columns: string[];
    values: unknown[][];
  }
  export interface Database {
    run(sql: string, params?: unknown[]): void;
    exec(sql: string): QueryExecResult[];
    prepare(sql: string): Statement;
    close(): void;
    export(): Uint8Array;
    getRowsModified?(): number;
  }
  export interface Statement {
    bind(values?: unknown[] | Record<string, unknown>): void;
    step(): boolean;
    getAsObject(): Record<string, unknown>;
    free(): void;
  }
  export default function initSqlJs(options?: { locateFile?: (file: string) => string }): Promise<{
    Database: new (buffer?: Uint8Array) => Database;
  }>;
}
