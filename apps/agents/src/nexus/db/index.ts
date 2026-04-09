import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = path.resolve(process.cwd(), "data", "nexus.db");

// Ensure data directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const sqlite = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite);
export const rawDb = sqlite;
export { DB_PATH };
