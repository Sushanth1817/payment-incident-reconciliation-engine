const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const databasePath =
  process.env.DB_PATH || "data/payment_engine.db";

const databaseDirectory = path.dirname(databasePath);

if (!fs.existsSync(databaseDirectory)) {
  fs.mkdirSync(databaseDirectory, {
    recursive: true
  });
}

const db = new Database(databasePath);

db.pragma("journal_mode = WAL");

const schemaPath = path.join(__dirname, "schema.sql");
const schema = fs.readFileSync(schemaPath, "utf8");

db.exec(schema);

console.log(`SQLite database connected: ${databasePath}`);

module.exports = db;