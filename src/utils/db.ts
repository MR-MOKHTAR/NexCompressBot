import sqlite3 from "sqlite3";
import path from "path";
import fs from "fs";

const dbPath = path.join(process.cwd(), "bot.db");

export const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Error opening database " + err.message);
  }
});

export function initDb() {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      user_id INTEGER PRIMARY KEY,
      language TEXT NOT NULL
    )
  `);
}

export function getUserLang(userId: number): Promise<string | null> {
  return new Promise((resolve, reject) => {
    db.get("SELECT language FROM users WHERE user_id = ?", [userId], (err, row: any) => {
      if (err) reject(err);
      resolve(row ? row.language : null);
    });
  });
}

export function setUserLang(userId: number, language: string): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(
      "INSERT INTO users (user_id, language) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET language = excluded.language",
      [userId, language],
      (err) => {
        if (err) reject(err);
        resolve();
      }
    );
  });
}
