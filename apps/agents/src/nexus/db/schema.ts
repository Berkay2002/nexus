import { sqliteTable, text, integer, blob } from "drizzle-orm/sqlite-core";

/**
 * LangGraph checkpointer and StoreBackend manage their own schemas.
 * SqliteSaver.fromConnString() handles checkpointer tables.
 * SqliteStore handles store tables.
 * Custom tables go here if needed later.
 */
export {};
