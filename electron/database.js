const Database = require("better-sqlite3");
const path = require("path");
const { app } = require("electron");

class DatabaseManager {
	constructor() {
		const userDataPath = app.getPath("userData");
		const dbPath = path.join(userDataPath, "diary.db");

		this.db = new Database(dbPath);
		this.initializeTables();
	}

	initializeTables() {
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

		// Create sync history table
		this.db.exec(`
			CREATE TABLE IF NOT EXISTS sync_history (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				provider TEXT NOT NULL, -- 'googleDrive' | 'dropbox' | 'oneDrive'
				success INTEGER NOT NULL, -- 0/1
				message TEXT,
				file_name TEXT,
				entry_count INTEGER,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP
			)
		`);
	}

	getEntries() {
		const stmt = this.db.prepare("SELECT * FROM entries ORDER BY date DESC");
		const rows = stmt.all();

		return rows.map((row) => ({
			...row,
			tags: row.tags ? JSON.parse(row.tags) : [],
		}));
	}

	getEntry(id) {
		const stmt = this.db.prepare("SELECT * FROM entries WHERE id = ?");
		const row = stmt.get(id);

		if (!row) return null;

		return {
			...row,
			tags: row.tags ? JSON.parse(row.tags) : [],
		};
	}

	saveEntry(entry) {
		const { id, title, content, date, mood, tags } = entry;

		if (id) {
			// Update existing entry
			const stmt = this.db.prepare(`
        UPDATE entries 
        SET title = ?, content = ?, date = ?, mood = ?, tags = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

			stmt.run(title, content, date, mood, JSON.stringify(tags || []), id);

			return this.getEntry(id);
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

			return this.getEntry(result.lastInsertRowid);
		}
	}

	deleteEntry(id) {
		const stmt = this.db.prepare("DELETE FROM entries WHERE id = ?");
		const result = stmt.run(id);

		return result.changes > 0;
	}

	getSetting(key) {
		const stmt = this.db.prepare("SELECT value FROM settings WHERE key = ?");
		const row = stmt.get(key);

		return row ? row.value : null;
	}

	setSetting(key, value) {
		const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO settings (key, value)
      VALUES (?, ?)
    `);

		stmt.run(key, value);
	}

	// -------- Sync history helpers --------
	addSyncEvent({ provider, success, message, fileName, entryCount }) {
		const stmt = this.db.prepare(
			`INSERT INTO sync_history (provider, success, message, file_name, entry_count) VALUES (?, ?, ?, ?, ?)`
		);
		stmt.run(
			provider,
			success ? 1 : 0,
			message || null,
			fileName || null,
			entryCount || 0
		);
	}

	getSyncHistory(limit = 50) {
		const stmt = this.db.prepare(
			`SELECT id, provider, success, message, file_name as fileName, entry_count as entryCount, created_at as createdAt
			 FROM sync_history ORDER BY created_at DESC LIMIT ?`
		);
		return stmt.all(limit).map((r) => ({ ...r, success: !!r.success }));
	}

	close() {
		this.db.close();
	}
}

module.exports = DatabaseManager;
