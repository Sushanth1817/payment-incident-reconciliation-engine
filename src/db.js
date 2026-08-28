const Database = require("better-sqlite3");

const databasePath =
  process.env.DB_PATH || "data/payment_engine.db";

const db = new Database(databasePath);

db.pragma("journal_mode = WAL");

console.log(`SQLite database connected: ${databasePath}`);

module.exports = db;