import { app, BrowserWindow, ipcMain, dialog } from "electron";
import { autoUpdater } from "electron-updater";
import path from "path";
import { Database } from "./database";

let mainWindow: BrowserWindow | null = null;
let db: Database;

const createWindow = (): void => {
	mainWindow = new BrowserWindow({
		width: 1200,
		height: 800,
		minWidth: 800,
		minHeight: 600,
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
			preload: path.join(__dirname, "preload.js"),
		},
		titleBarStyle: "default",
		show: false,
	});

	if (process.env.NODE_ENV === "development") {
		mainWindow.loadURL("http://localhost:5173");
		mainWindow.webContents.openDevTools();
	} else {
		mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
	}

	mainWindow.once("ready-to-show", () => {
		mainWindow?.show();
	});

	mainWindow.on("closed", () => {
		mainWindow = null;
	});
};

app.whenReady().then(() => {
	// Initialize database
	db = new Database();

	createWindow();

	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow();
		}
	});
});

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit();
	}
});

// Database IPC handlers
ipcMain.handle("db-get-entries", async () => {
	return db.getEntries();
});

ipcMain.handle("db-save-entry", async (_, entry) => {
	return db.saveEntry(entry);
});

ipcMain.handle("db-delete-entry", async (_, id) => {
	return db.deleteEntry(id);
});

ipcMain.handle("db-get-entry", async (_, id) => {
	return db.getEntry(id);
});

// File operations for cloud backup
ipcMain.handle("export-entries", async () => {
	if (!mainWindow) return null;

	const result = await dialog.showSaveDialog(mainWindow, {
		title: "Export Journal Entries",
		defaultPath: "diary-backup.json",
		filters: [{ name: "JSON Files", extensions: ["json"] }],
	});

	if (!result.canceled && result.filePath) {
		const entries = db.getEntries();
		const fs = require("fs");
		fs.writeFileSync(result.filePath, JSON.stringify(entries, null, 2));
		return result.filePath;
	}

	return null;
});

ipcMain.handle("import-entries", async () => {
	if (!mainWindow) return null;

	const result = await dialog.showOpenDialog(mainWindow, {
		title: "Import Journal Entries",
		filters: [{ name: "JSON Files", extensions: ["json"] }],
		properties: ["openFile"],
	});

	if (!result.canceled && result.filePaths.length > 0) {
		const fs = require("fs");
		const data = fs.readFileSync(result.filePaths[0], "utf8");
		const entries = JSON.parse(data);

		// Import entries to database
		for (const entry of entries) {
			db.saveEntry(entry);
		}

		return entries.length;
	}

	return null;
});

// Auto-updater
if (process.env.NODE_ENV === "production") {
	autoUpdater.checkForUpdatesAndNotify();
}

autoUpdater.on("update-available", () => {
	if (mainWindow) {
		mainWindow.webContents.send("update-available");
	}
});

autoUpdater.on("update-downloaded", () => {
	if (mainWindow) {
		mainWindow.webContents.send("update-downloaded");
	}
});

ipcMain.handle("restart-app", () => {
	autoUpdater.quitAndInstall();
});
