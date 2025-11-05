const {
	app,
	BrowserWindow,
	ipcMain,
	dialog,
	shell,
	clipboard,
} = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const Database = require("./database.js");
const CloudService = require("./cloudService.js");
const fs = require("fs");

// Ensure a stable userData path in development so credentials/tokens persist across restarts
(function ensureStableUserDataPath() {
	try {
		const isDev = process.env.NODE_ENV === "development";
		const desiredName = isDev ? "Diary-Dev" : "Diary";
		const originalPath = app.getPath("userData");
		const desiredPath = path.join(app.getPath("appData"), desiredName);
		if (originalPath !== desiredPath) {
			// Attempt a light migration of important files if moving to new path
			try {
				if (!fs.existsSync(desiredPath))
					fs.mkdirSync(desiredPath, { recursive: true });
				const copyIfExists = (src, dst) => {
					try {
						if (fs.existsSync(src) && !fs.existsSync(dst)) {
							fs.copyFileSync(src, dst);
						}
					} catch {}
				};
				const copyDirIfExists = (srcDir, dstDir) => {
					try {
						if (!fs.existsSync(srcDir)) return;
						if (!fs.existsSync(dstDir))
							fs.mkdirSync(dstDir, { recursive: true });
						for (const name of fs.readdirSync(srcDir)) {
							const s = path.join(srcDir, name);
							const d = path.join(dstDir, name);
							const stat = fs.statSync(s);
							if (stat.isDirectory()) {
								copyDirIfExists(s, d);
							} else {
								if (!fs.existsSync(d)) fs.copyFileSync(s, d);
							}
						}
					} catch {}
				};
				// Known files/folders we use
				copyIfExists(
					path.join(originalPath, "cloud-config.json"),
					path.join(desiredPath, "cloud-config.json")
				);
				copyDirIfExists(
					path.join(originalPath, "oauth"),
					path.join(desiredPath, "oauth")
				);
			} catch (e) {
				console.warn("userData migration warning:", e?.message || e);
			}
			app.setPath("userData", desiredPath);
		}
	} catch (e) {
		console.warn("Could not set stable userData path:", e?.message || e);
	}
})();

let mainWindow = null;
let splashWindow = null;
let splashShownAt = 0;
let mainShown = false;
const SPLASH_MIN_MS = 2500; // keep splash visible at least 2.5s
// TEMP: Splash-only mode for visual verification. Set to false to restore normal startup.
const SPLASH_ONLY = false;
let db;
let cloudService;
let autoSyncInterval = null;
// Guard to prevent overlapping update checks
let isCheckingUpdates = false;

function createSplashWindow() {
	const isDev = process.env.NODE_ENV === "development";
	const splashPath = isDev
		? path.join(__dirname, "../public/splash.html")
		: path.join(__dirname, "../dist/splash.html");

	splashWindow = new BrowserWindow({
		width: 360,
		height: 300,
		resizable: false,
		movable: true,
		frame: false,
		show: false,
		transparent: false,
		alwaysOnTop: true,
		center: true,
		backgroundColor: "#00000000",
		webPreferences: {
			contextIsolation: true,
			nodeIntegration: false,
		},
	});

	splashWindow.once("ready-to-show", () => splashWindow?.show());
	splashWindow.once("ready-to-show", () => {
		splashShownAt = Date.now();
	});
	splashWindow.loadFile(splashPath).catch(() => splashWindow?.show());
}

const createWindow = () => {
	console.log("Creating Electron window...");

	// Detect system theme and choose appropriate icon
	const nativeTheme = require("electron").nativeTheme;
	const isDarkMode = nativeTheme.shouldUseDarkColors;
	const iconName = isDarkMode ? "logo-1-dark" : "logo-1-light";
	const iconPath =
		process.platform === "win32"
			? path.join(__dirname, `../public/${iconName}.ico`)
			: path.join(__dirname, `../public/${iconName}.png`);

	mainWindow = new BrowserWindow({
		width: 1200,
		height: 800,
		minWidth: 800,
		minHeight: 600,
		icon: iconPath, // Add this line
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
			preload: path.join(__dirname, "preload.js"),
		},
		titleBarStyle: "hiddenInset",
		frame: true,
		show: false,
	});

	if (process.env.NODE_ENV === "development") {
		const devUrl = process.env.DEV_SERVER_URL || "http://localhost:5173";
		console.log("Loading development URL:", devUrl);
		mainWindow.loadURL(devUrl);
		mainWindow.webContents.openDevTools();
	} else {
		console.log("Loading production file");
		mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
	}

	// Show the main window after content fully loads and after minimum splash time
	const showMainAfterMinDelay = () => {
		const elapsed = Date.now() - (splashShownAt || Date.now());
		const wait = Math.max(0, SPLASH_MIN_MS - elapsed);
		setTimeout(() => {
			if (!mainShown) {
				console.log("Showing main window");
				mainWindow?.show();
				mainShown = true;
			}
			if (splashWindow && !splashWindow.isDestroyed()) {
				splashWindow.close();
				splashWindow = null;
			}
		}, wait);
	};

	// Prefer did-finish-load to avoid flashing partially rendered UI
	mainWindow.webContents.once("did-finish-load", showMainAfterMinDelay);

	// Fallback: if load takes too long, show anyway after a timeout
	setTimeout(() => {
		if (!mainShown) {
			console.warn("did-finish-load timeout; showing main window");
			showMainAfterMinDelay();
		}
	}, 15000);

	mainWindow.on("closed", () => {
		console.log("Window closed");
		mainWindow = null;
	});

	// Add error handling
	mainWindow.webContents.on(
		"did-fail-load",
		(event, errorCode, errorDescription) => {
			console.error("Failed to load:", errorCode, errorDescription);
		}
	);
};

// Auto-sync functions
const performAutoSync = async () => {
	try {
		const status = cloudService.getCloudStatus();
		if (!status.autoSync) {
			return;
		}

		if (
			!status.googleDrive.enabled &&
			!status.oneDrive.enabled &&
			!status.dropbox?.enabled
		) {
			return;
		}

		console.log("Performing auto-sync...");
		const entries = db.getEntries();
		const results = await cloudService.syncToCloud(entries);

		// Persist sync results
		try {
			const meta = results.meta || {};
			if (results.googleDrive) {
				db.addSyncEvent({
					provider: "googleDrive",
					success: !!results.googleDrive.success,
					message: results.googleDrive.error || null,
					fileName: meta.fileName,
					entryCount: meta.entryCount,
				});
			}
			if (results.dropbox) {
				db.addSyncEvent({
					provider: "dropbox",
					success: !!results.dropbox.success,
					message: results.dropbox.error || null,
					fileName: meta.fileName,
					entryCount: meta.entryCount,
				});
			}
			if (results.oneDrive) {
				db.addSyncEvent({
					provider: "oneDrive",
					success: !!results.oneDrive.success,
					message: results.oneDrive.error || null,
					fileName: meta.fileName,
					entryCount: meta.entryCount,
				});
			}
		} catch (e) {
			console.warn("Failed to record auto-sync results:", e);
		}

		if (
			results.googleDrive?.success ||
			results.oneDrive?.success ||
			results.dropbox?.success
		) {
			console.log("Auto-sync completed successfully");
		} else {
			console.log("Auto-sync failed");
		}

		// Notify renderer about auto-sync result
		if (mainWindow && !mainWindow.isDestroyed()) {
			mainWindow.webContents.send("cloud-auto-sync-result", results);
		}
	} catch (error) {
		console.error("Auto-sync error:", error);
		if (mainWindow && !mainWindow.isDestroyed()) {
			mainWindow.webContents.send("cloud-auto-sync-result", {
				googleDrive: { success: false, error: String(error?.message || error) },
				oneDrive: { success: false, error: String(error?.message || error) },
				dropbox: { success: false, error: String(error?.message || error) },
			});
		}
	}
};

const startAutoSync = () => {
	const status = cloudService.getCloudStatus();
	if (status.autoSync) {
		// Sync every hour (3600000 ms)
		autoSyncInterval = setInterval(performAutoSync, 3600000);
		console.log("Auto-sync started");
	}
};

const stopAutoSync = () => {
	if (autoSyncInterval) {
		clearInterval(autoSyncInterval);
		autoSyncInterval = null;
		console.log("Auto-sync stopped");
	}
};

app.whenReady().then(() => {
	// Initialize database
	db = new Database();
	cloudService = new CloudService();

	// Start auto-sync if enabled
	startAutoSync();

	// Show splash first, then main window
	createSplashWindow();
	if (!SPLASH_ONLY) {
		createWindow();
	}

	// If an update was installed on the previous run, notify renderer after window loads
	try {
		const flagPath = path.join(
			app.getPath("userData"),
			"update-installed.flag"
		);
		if (fs.existsSync(flagPath)) {
			fs.unlinkSync(flagPath);
			if (mainWindow) {
				mainWindow.webContents.once("did-finish-load", () => {
					try {
						const version = app.getVersion ? app.getVersion() : undefined;
						mainWindow?.webContents.send("update-installed", version);
					} catch {}
				});
			}
		}
	} catch {}

	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createSplashWindow();
			if (!SPLASH_ONLY) {
				createWindow();
			}
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

// Settings IPC handlers
ipcMain.handle("get-setting", async (_, key) => {
	return db.getSetting(key);
});

ipcMain.handle("set-setting", async (_, key, value) => {
	return db.setSetting(key, value);
});

// File operations for cloud backup
ipcMain.handle("export-entries", async (_, format = "json") => {
	if (!mainWindow) return null;

	const filters =
		format === "html"
			? [{ name: "HTML Files", extensions: ["html"] }]
			: [{ name: "JSON Files", extensions: ["json"] }];

	const defaultPath =
		format === "html" ? "diary-backup.html" : "diary-backup.json";

	const result = await dialog.showSaveDialog(mainWindow, {
		title: "Export Journal Entries",
		defaultPath,
		filters,
	});

	if (!result.canceled && result.filePath) {
		const entries = db.getEntries();
		const fs = require("fs");

		console.log(`Exporting ${entries.length} entries in ${format} format`);

		if (entries.length === 0) {
			console.warn("No entries to export");
			return null;
		}

		if (format === "html") {
			// Export as HTML with embedded images
			let htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Journal Backup</title>
    <style>
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 20px;
            line-height: 1.6;
            color: #333;
        }
        .entry {
            margin-bottom: 60px;
            padding-bottom: 40px;
            border-bottom: 2px solid #e0e0e0;
        }
        .entry:last-child {
            border-bottom: none;
        }
        .entry-header {
            margin-bottom: 20px;
        }
        .entry-title {
            font-size: 28px;
            font-weight: 600;
            margin-bottom: 10px;
            color: #1a1a1a;
        }
        .entry-meta {
            display: flex;
            gap: 20px;
            font-size: 14px;
            color: #666;
            margin-bottom: 10px;
        }
        .entry-tags {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            margin-top: 10px;
        }
        .tag {
            background-color: #BB86FC;
            color: white;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
        }
        .entry-content {
            margin-top: 20px;
            font-size: 16px;
        }
        .entry-content img {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            margin: 10px 0;
        }
        @media print {
            .entry {
                page-break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <h1>Journal Backup</h1>
    <p>Exported on ${new Date().toLocaleDateString("en-US", {
			weekday: "long",
			year: "numeric",
			month: "long",
			day: "numeric",
		})}</p>
    <hr style="margin: 30px 0;">
`;

			entries.forEach((entry) => {
				const date = new Date(entry.date);
				const formattedDate = date.toLocaleDateString("en-US", {
					weekday: "long",
					year: "numeric",
					month: "long",
					day: "numeric",
				});
				const formattedTime = date.toLocaleTimeString("en-US", {
					hour: "2-digit",
					minute: "2-digit",
				});

				htmlContent += `
    <div class="entry">
        <div class="entry-header">
            <h2 class="entry-title">${entry.title || "Untitled"}</h2>
            <div class="entry-meta">
                <span>📅 ${formattedDate}</span>
                <span>🕐 ${formattedTime}</span>
                ${entry.mood ? `<span>💖 ${entry.mood}</span>` : ""}
            </div>
            ${
							entry.tags && entry.tags.length > 0
								? `
            <div class="entry-tags">
                ${entry.tags
									.map((tag) => `<span class="tag">${tag}</span>`)
									.join("")}
            </div>
            `
								: ""
						}
        </div>
        <div class="entry-content">
            ${entry.content}
        </div>
    </div>
`;
			});

			htmlContent += `
</body>
</html>`;

			fs.writeFileSync(result.filePath, htmlContent, "utf8");
		} else {
			// Export as JSON with all data including images (base64 encoded in content)
			fs.writeFileSync(
				result.filePath,
				JSON.stringify(entries, null, 2),
				"utf8"
			);
		}

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
if (process.env.NODE_ENV === "production" && process.platform !== "darwin") {
	autoUpdater.checkForUpdatesAndNotify();
}

autoUpdater.on("update-available", () => {
	// Release update check lock
	isCheckingUpdates = false;
	if (mainWindow) {
		mainWindow.webContents.send("update-available");
	}
});

autoUpdater.on("update-downloaded", () => {
	// Release update check lock
	isCheckingUpdates = false;
	if (mainWindow) {
		mainWindow.webContents.send("update-downloaded");
	}
});

// Forward additional update events
autoUpdater.on("update-not-available", () => {
	// Release update check lock
	isCheckingUpdates = false;
	if (mainWindow) {
		mainWindow.webContents.send("update-not-available");
	}
});

autoUpdater.on("download-progress", (progressObj) => {
	if (mainWindow) {
		mainWindow.webContents.send("update-download-progress", progressObj);
	}
});

autoUpdater.on("error", (err) => {
	console.error("AutoUpdater error:", err);
	// Release update check lock
	isCheckingUpdates = false;
	if (mainWindow) {
		mainWindow.webContents.send("update-error", String(err?.message || err));
	}
});

ipcMain.handle("restart-app", () => {
	try {
		const flagPath = path.join(
			app.getPath("userData"),
			"update-installed.flag"
		);
		fs.writeFileSync(flagPath, String(Date.now()));
	} catch {}
	autoUpdater.quitAndInstall();
});

// Allow renderer to manually trigger a check
ipcMain.handle("check-for-updates", async () => {
	// Disable manual update checks on macOS when unsigned to avoid user confusion
	if (process.platform === "darwin") {
		try {
			if (mainWindow) {
				mainWindow.webContents.send("update-not-available");
			}
		} catch {}
		return false;
	}
	try {
		if (isCheckingUpdates) {
			return true; // ignore concurrent clicks
		}
		isCheckingUpdates = true;
		await autoUpdater.checkForUpdates();
		return true;
	} catch (e) {
		console.error("checkForUpdates failed:", e);
		isCheckingUpdates = false;
		return false;
	}
});

// ==================== CLOUD SYNC IPC HANDLERS ====================

// Get cloud sync status
ipcMain.handle("cloud-get-status", async () => {
	return cloudService.getCloudStatus();
});

// Google Drive authentication
ipcMain.handle("cloud-google-init", async (_, credentials) => {
	const ok = await cloudService.initGoogleDrive(credentials);
	try {
		console.log("[main] cloud-google-init =>", ok);
	} catch {}
	return ok;
});

// Helper endpoints for automatic credentials discovery
ipcMain.handle("cloud-google-has-creds", async () => {
	const has = cloudService.hasGoogleCredentialsFile();
	try {
		console.log("[main] cloud-google-has-creds =>", has);
	} catch {}
	return has;
});

ipcMain.handle("cloud-google-creds-dir", async () => {
	const dir = cloudService.getGoogleCredentialsDir();
	try {
		console.log("[main] cloud-google-creds-dir =>", dir);
	} catch {}
	return dir;
});

ipcMain.handle("cloud-google-open-creds-dir", async () => {
	const dir = cloudService.getGoogleCredentialsDir();
	await shell.openPath(dir);
	return dir;
});

// Attempt to bootstrap credentials from src/api-key into the OAuth folder
ipcMain.handle("cloud-google-bootstrap-creds", async () => {
	try {
		return cloudService.bootstrapGoogleCredentialsFromRepo();
	} catch (e) {
		console.error("Error bootstrapping Google credentials:", e);
		return false;
	}
});

ipcMain.handle("cloud-google-get-auth-url", async () => {
	try {
		return cloudService.getGoogleAuthUrl();
	} catch (error) {
		console.error("Error getting Google auth URL:", error);
		return null;
	}
});

// Start loopback auth server and return auth URL
ipcMain.handle("cloud-google-start-loopback-auth", async () => {
	try {
		console.log(
			"[main] cloud-google-start-loopback-auth: calling startGoogleLoopbackAuth"
		);
		const url = await cloudService.startGoogleLoopbackAuth();
		console.log("[main] cloud-google-start-loopback-auth: got URL:", url);
		return url;
	} catch (error) {
		console.error("Error starting Google loopback auth:", error);
		return null;
	}
});

// Wait for loopback auth to complete (resolve true/false)
ipcMain.handle("cloud-google-wait-loopback", async () => {
	try {
		return await cloudService.waitGoogleLoopbackAuthComplete();
	} catch (error) {
		console.error("Error waiting for Google loopback auth:", error);
		return false;
	}
});

ipcMain.handle("cloud-google-set-auth-code", async (_, code) => {
	return await cloudService.setGoogleAuthCode(code);
});

ipcMain.handle("cloud-google-disconnect", async () => {
	cloudService.disconnectGoogleDrive();
	return true;
});

// Return where Google credentials come from: 'embedded', 'user', or 'none'
ipcMain.handle("cloud-google-credentials-source", async () => {
	try {
		const src = cloudService.getGoogleCredentialsSource();
		try {
			console.log("[main] cloud-google-credentials-source =>", src);
		} catch {}
		return src;
	} catch (e) {
		console.error("Error getting credentials source:", e);
		return "none";
	}
});

// OneDrive authentication
ipcMain.handle("cloud-onedrive-init", async (_, clientId) => {
	return await cloudService.initOneDrive(clientId);
});

// OneDrive loopback auth start
ipcMain.handle("cloud-onedrive-start-loopback-auth", async () => {
	try {
		const url = await cloudService.startOneDriveLoopbackAuth();
		return url;
	} catch (error) {
		console.error("Error starting OneDrive loopback auth:", error);
		return null;
	}
});

// OneDrive loopback wait
ipcMain.handle("cloud-onedrive-wait-loopback", async () => {
	try {
		return await cloudService.waitOneDriveLoopbackAuthComplete();
	} catch (error) {
		console.error("Error waiting for OneDrive loopback auth:", error);
		return false;
	}
});

ipcMain.handle("cloud-onedrive-get-auth-url", async () => {
	try {
		return await cloudService.getOneDriveAuthUrl();
	} catch (error) {
		console.error("Error getting OneDrive auth URL:", error);
		return null;
	}
});

ipcMain.handle("cloud-onedrive-set-auth-code", async (_, code) => {
	return await cloudService.setOneDriveAuthCode(code);
});

ipcMain.handle("cloud-onedrive-disconnect", async () => {
	cloudService.disconnectOneDrive();
	return true;
});

// Dropbox authentication via access token file
ipcMain.handle("cloud-dropbox-init", async (_, token) => {
	return await cloudService.initDropbox(token);
});

ipcMain.handle("cloud-dropbox-has-token", async () => {
	return cloudService.hasDropboxTokenFile();
});

ipcMain.handle("cloud-dropbox-token-dir", async () => {
	return cloudService.getDropboxTokenDir();
});

ipcMain.handle("cloud-dropbox-open-token-dir", async () => {
	const dir = cloudService.getDropboxTokenDir();
	await shell.openPath(dir);
	return dir;
});

ipcMain.handle("cloud-dropbox-bootstrap-token", async () => {
	try {
		return cloudService.bootstrapDropboxTokenFromRepo();
	} catch (e) {
		console.error("Error bootstrapping Dropbox token:", e);
		return false;
	}
});

ipcMain.handle("cloud-dropbox-disconnect", async () => {
	cloudService.disconnectDropbox();
	return true;
});

// Dropbox OAuth (PKCE) using embedded app config
ipcMain.handle("cloud-dropbox-credentials-source", async () => {
	try {
		return cloudService.getDropboxCredentialsSource?.() || "none";
	} catch (e) {
		console.error("Error getting Dropbox credentials source:", e);
		return "none";
	}
});

ipcMain.handle("cloud-dropbox-start-loopback-auth", async () => {
	try {
		return await cloudService.startDropboxLoopbackAuth?.();
	} catch (e) {
		console.error("Error starting Dropbox loopback auth:", e);
		return null;
	}
});

ipcMain.handle("cloud-dropbox-wait-loopback", async () => {
	try {
		return await cloudService.waitDropboxLoopbackAuthComplete?.();
	} catch (e) {
		console.error("Error waiting for Dropbox loopback auth:", e);
		return false;
	}
});

// Sync operations
ipcMain.handle("cloud-sync-now", async () => {
	try {
		const entries = db.getEntries();
		const results = await cloudService.syncToCloud(entries);

		// Persist sync results
		try {
			const meta = results.meta || {};
			if (results.googleDrive) {
				db.addSyncEvent({
					provider: "googleDrive",
					success: !!results.googleDrive.success,
					message: results.googleDrive.error || null,
					fileName: meta.fileName,
					entryCount: meta.entryCount,
				});
			}
			if (results.dropbox) {
				db.addSyncEvent({
					provider: "dropbox",
					success: !!results.dropbox.success,
					message: results.dropbox.error || null,
					fileName: meta.fileName,
					entryCount: meta.entryCount,
				});
			}
			if (results.oneDrive) {
				db.addSyncEvent({
					provider: "oneDrive",
					success: !!results.oneDrive.success,
					message: results.oneDrive.error || null,
					fileName: meta.fileName,
					entryCount: meta.entryCount,
				});
			}
		} catch (e) {
			console.warn("Failed to record manual sync results:", e);
		}
		return results;
	} catch (error) {
		console.error("Error syncing to cloud:", error);
		return {
			googleDrive: { success: false, error: error.message },
			oneDrive: { success: false, error: error.message },
			dropbox: { success: false, error: error.message },
		};
	}
});

ipcMain.handle("cloud-set-auto-sync", async (_, enabled) => {
	cloudService.setAutoSync(enabled);

	// Restart auto-sync timer
	stopAutoSync();
	if (enabled) {
		startAutoSync();
	}

	return true;
});

// Open external URLs for OAuth
ipcMain.handle("open-external-url", async (_, url) => {
	try {
		console.log("[main] open-external-url invoked:", url);
	} catch {}
	await shell.openExternal(url);
	return true;
});

// Clipboard write for copy-link operations
ipcMain.handle("clipboard-write", async (_evt, text) => {
	try {
		console.log("[main] clipboard-write invoked, length:", (text || "").length);
		clipboard.writeText(String(text || ""));
		return true;
	} catch (e) {
		console.error("clipboard-write failed:", e);
		return false;
	}
});

// Fetch sync history
ipcMain.handle("cloud-get-sync-history", async (_evt, limit = 50) => {
	try {
		return db.getSyncHistory(limit);
	} catch (e) {
		console.error("Failed to get sync history:", e);
		return [];
	}
});
