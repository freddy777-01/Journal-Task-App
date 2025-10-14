import Database from "better-sqlite3";
import path from "path";
import { app } from "electron";

export interface Entry {
	id?: number;
	title: string;
	content: string;
	date: string;
	mood?: string;
	tags?: string[];
	created_at?: string;
	updated_at?: string;
}

export class DatabaseManager {
	private db: Database.Database;

	constructor() {
		const userDataPath = app.getPath("userData");
		const dbPath = path.join(userDataPath, "diary.db");

		this.db = new Database(dbPath);
		this.initializeTables();
	}

	private initializeTables(): void {
		// Create entries table
		this.db.exec(`
      CREATE TABLE IF NOT EXISTS entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        date TEXT NOT NULL,
        mood TEXT,
        tags TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

		// Create settings table
		this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);
	}

	getEntries(): Entry[] {
		const stmt = this.db.prepare("SELECT * FROM entries ORDER BY date DESC");
		const rows = stmt.all() as any[];

		return rows.map((row) => ({
			...row,
			tags: row.tags ? JSON.parse(row.tags) : [],
		}));
	}

	getEntry(id: number): Entry | null {
		const stmt = this.db.prepare("SELECT * FROM entries WHERE id = ?");
		const row = stmt.get(id) as any;

		if (!row) return null;

		return {
			...row,
			tags: row.tags ? JSON.parse(row.tags) : [],
		};
	}

	saveEntry(entry: Entry): Entry {
		const { id, title, content, date, mood, tags } = entry;

		if (id) {
			// Update existing entry
			const stmt = this.db.prepare(`
        UPDATE entries 
        SET title = ?, content = ?, date = ?, mood = ?, tags = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

			stmt.run(title, content, date, mood, JSON.stringify(tags || []), id);

			return this.getEntry(id)!;
		} else {
			// Insert new entry
			const stmt = this.db.prepare(`
        INSERT INTO entries (title, content, date, mood, tags)
        VALUES (?, ?, ?, ?, ?)
      `);

			const result = stmt.run(
				title,
				content,
				date,
				mood,
				JSON.stringify(tags || [])
			);

			return this.getEntry(result.lastInsertRowid as number)!;
		}
	}

	deleteEntry(id: number): boolean {
		const stmt = this.db.prepare("DELETE FROM entries WHERE id = ?");
		const result = stmt.run(id);

		return result.changes > 0;
	}

	getSetting(key: string): string | null {
		const stmt = this.db.prepare("SELECT value FROM settings WHERE key = ?");
		const row = stmt.get(key) as any;

		return row ? row.value : null;
	}

	setSetting(key: string, value: string): void {
		const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO settings (key, value)
      VALUES (?, ?)
    `);

		stmt.run(key, value);
	}

	close(): void {
		this.db.close();
	}
}

export const Database = DatabaseManager;
