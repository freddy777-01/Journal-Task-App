const { contextBridge, ipcRenderer } = require("electron");

const databaseAPI = {
	getEntries: () => ipcRenderer.invoke("db-get-entries"),
	saveEntry: (entry) => ipcRenderer.invoke("db-save-entry", entry),
	deleteEntry: (id) => ipcRenderer.invoke("db-delete-entry", id),
	getEntry: (id) => ipcRenderer.invoke("db-get-entry", id),
};

const fileAPI = {
	exportEntries: (format) => ipcRenderer.invoke("export-entries", format),
	importEntries: () => ipcRenderer.invoke("import-entries"),
};

const updateAPI = {
	onUpdateAvailable: (callback) => {
		ipcRenderer.on("update-available", callback);
	},
	onUpdateDownloaded: (callback) => {
		ipcRenderer.on("update-downloaded", callback);
	},
	// New: additional update bridge
	onUpdateNotAvailable: (callback) => {
		ipcRenderer.on("update-not-available", callback);
	},
	onDownloadProgress: (callback) => {
		ipcRenderer.on("update-download-progress", (_evt, payload) =>
			callback?.(payload)
		);
	},
	onUpdateError: (callback) => {
		ipcRenderer.on("update-error", (_evt, message) => callback?.(message));
	},
	checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
	restartApp: () => ipcRenderer.invoke("restart-app"),
};

const settingsAPI = {
	getSetting: (key) => ipcRenderer.invoke("get-setting", key),
	setSetting: (key, value) => ipcRenderer.invoke("set-setting", key, value),
};

const cloudAPI = {
	getStatus: () => ipcRenderer.invoke("cloud-get-status"),
	// Google Drive
	googleInit: (credentials) =>
		ipcRenderer.invoke("cloud-google-init", credentials),
	googleGetAuthUrl: () => ipcRenderer.invoke("cloud-google-get-auth-url"),
	googleStartLoopbackAuth: () =>
		ipcRenderer.invoke("cloud-google-start-loopback-auth"),
	googleWaitLoopback: () => ipcRenderer.invoke("cloud-google-wait-loopback"),
	googleSetAuthCode: (code) =>
		ipcRenderer.invoke("cloud-google-set-auth-code", code),
	googleDisconnect: () => ipcRenderer.invoke("cloud-google-disconnect"),
	googleHasCredentialsFile: () => ipcRenderer.invoke("cloud-google-has-creds"),
	googleCredentialsDir: () => ipcRenderer.invoke("cloud-google-creds-dir"),
	googleOpenCredentialsDir: () =>
		ipcRenderer.invoke("cloud-google-open-creds-dir"),
	googleBootstrapCredentials: () =>
		ipcRenderer.invoke("cloud-google-bootstrap-creds"),
	googleCredentialsSource: () =>
		ipcRenderer.invoke("cloud-google-credentials-source"),
	// OneDrive
	oneDriveInit: (clientId) =>
		ipcRenderer.invoke("cloud-onedrive-init", clientId),
	oneDriveGetAuthUrl: () => ipcRenderer.invoke("cloud-onedrive-get-auth-url"),
	oneDriveSetAuthCode: (code) =>
		ipcRenderer.invoke("cloud-onedrive-set-auth-code", code),
	oneDriveDisconnect: () => ipcRenderer.invoke("cloud-onedrive-disconnect"),
	// Dropbox
	dropboxInit: (token) => ipcRenderer.invoke("cloud-dropbox-init", token),
	dropboxHasTokenFile: () => ipcRenderer.invoke("cloud-dropbox-has-token"),
	dropboxTokenDir: () => ipcRenderer.invoke("cloud-dropbox-token-dir"),
	dropboxOpenTokenDir: () => ipcRenderer.invoke("cloud-dropbox-open-token-dir"),
	dropboxBootstrapToken: () =>
		ipcRenderer.invoke("cloud-dropbox-bootstrap-token"),
	dropboxDisconnect: () => ipcRenderer.invoke("cloud-dropbox-disconnect"),
	dropboxCredentialsSource: () =>
		ipcRenderer.invoke("cloud-dropbox-credentials-source"),
	dropboxStartLoopbackAuth: () =>
		ipcRenderer.invoke("cloud-dropbox-start-loopback-auth"),
	dropboxWaitLoopback: () => ipcRenderer.invoke("cloud-dropbox-wait-loopback"),
	// Sync
	syncNow: () => ipcRenderer.invoke("cloud-sync-now"),
	setAutoSync: (enabled) => ipcRenderer.invoke("cloud-set-auto-sync", enabled),
	// External URLs
	openExternalUrl: (url) => {
		console.log("[preload] open-external-url", url);
		return ipcRenderer.invoke("open-external-url", url);
	},
};

// Minimal system info for renderer without nodeIntegration
const systemAPI = {
	platform: process.platform,
	arch: process.arch,
	copyToClipboard: (text) => {
		console.log(
			"[preload] clipboard-write",
			text ? "(text present)" : "(empty)"
		);
		return ipcRenderer.invoke("clipboard-write", text);
	},
};

contextBridge.exposeInMainWorld("electronAPI", {
	database: databaseAPI,
	file: fileAPI,
	update: updateAPI,
	settings: settingsAPI,
	cloud: cloudAPI,
	system: systemAPI,
});
