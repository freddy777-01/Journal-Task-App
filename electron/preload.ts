import { contextBridge, ipcRenderer } from "electron";

export interface Entry {
	id?: number;
	title: string;
	content: string;
	date: string;
	mood?: string;
	tags?: string[];
}

export interface DatabaseAPI {
	getEntries: () => Promise<Entry[]>;
	saveEntry: (entry: Entry) => Promise<Entry>;
	deleteEntry: (id: number) => Promise<boolean>;
	getEntry: (id: number) => Promise<Entry | null>;
}

export interface FileAPI {
	exportEntries: (format?: "json" | "html") => Promise<string | null>;
	importEntries: () => Promise<number | null>;
}

export interface UpdateAPI {
	onUpdateAvailable: (callback: () => void) => void;
	onUpdateDownloaded: (callback: () => void) => void;
	onUpdateInstalled?: (callback: (version?: string) => void) => void;
	restartApp: () => Promise<void>;
	checkForUpdates: () => Promise<boolean>;
	onUpdateNotAvailable: (callback: () => void) => void;
	onDownloadProgress: (
		callback: (progress: {
			percent?: number;
			transferred?: number;
			total?: number;
			bytesPerSecond?: number;
		}) => void
	) => void;
	onUpdateError: (callback: (message: string) => void) => void;
}

export interface SettingsAPI {
	getSetting: (key: string) => Promise<string | null>;
	setSetting: (key: string, value: string) => Promise<void>;
}

export interface SystemAPI {
	getPlatform: () => Promise<string>;
	openExternal: (url: string) => Promise<boolean>;
}

// Cloud Sync types
export interface CloudDriveStatus {
	enabled: boolean;
	lastSync: string | null;
}

export interface CloudStatus {
	googleDrive: CloudDriveStatus;
	oneDrive: CloudDriveStatus;
	dropbox: CloudDriveStatus;
	autoSync: boolean;
}

export interface CloudAPI {
	getStatus: () => Promise<CloudStatus>;
	getSyncHistory?: (limit?: number) => Promise<
		Array<{
			id: number;
			provider: string;
			success: boolean;
			message?: string | null;
			fileName?: string | null;
			entryCount?: number;
			createdAt: string;
		}>
	>;
	// Google Drive
	googleInit: (credentials?: unknown) => Promise<boolean>;
	googleGetAuthUrl: () => Promise<string | null>;
	googleStartLoopbackAuth: () => Promise<string | null>;
	googleWaitLoopback: () => Promise<boolean>;
	googleSetAuthCode: (code: string) => Promise<boolean>;
	googleDisconnect: () => Promise<boolean>;
	googleHasCredentialsFile: () => Promise<boolean>;
	googleCredentialsDir: () => Promise<string>;
	googleOpenCredentialsDir: () => Promise<string>;
	googleBootstrapCredentials: () => Promise<boolean>;
	// OneDrive
	oneDriveInit: (clientId: string) => Promise<boolean>;
	oneDriveStartLoopbackAuth: () => Promise<string | null>;
	oneDriveWaitLoopback: () => Promise<boolean>;
	oneDriveGetAuthUrl: () => Promise<string | null>;
	oneDriveSetAuthCode: (code: string) => Promise<boolean>;
	oneDriveDisconnect: () => Promise<boolean>;
	// Dropbox
	dropboxInit: (token?: string) => Promise<boolean>;
	dropboxHasTokenFile: () => Promise<boolean>;
	dropboxTokenDir: () => Promise<string>;
	dropboxOpenTokenDir: () => Promise<string>;
	dropboxBootstrapToken: () => Promise<boolean>;
	dropboxDisconnect: () => Promise<boolean>;
	// Sync
	syncNow: () => Promise<{
		googleDrive: { success?: boolean; error?: string } | null;
		oneDrive: { success?: boolean; error?: string } | null;
		dropbox: { success?: boolean; error?: string } | null;
	}>;
	setAutoSync: (enabled: boolean) => Promise<boolean>;
	// Events
	onAutoSyncResult?: (
		callback: (result: {
			googleDrive: { success?: boolean; error?: string } | null;
			oneDrive: { success?: boolean; error?: string } | null;
			dropbox: { success?: boolean; error?: string } | null;
		}) => void
	) => void;
	// External URLs
	openExternalUrl: (url: string) => Promise<boolean>;
}

const databaseAPI: DatabaseAPI = {
	getEntries: () => ipcRenderer.invoke("db-get-entries"),
	saveEntry: (entry: Entry) => ipcRenderer.invoke("db-save-entry", entry),
	deleteEntry: (id: number) => ipcRenderer.invoke("db-delete-entry", id),
	getEntry: (id: number) => ipcRenderer.invoke("db-get-entry", id),
};

const fileAPI: FileAPI = {
	exportEntries: (format?: "json" | "html") =>
		ipcRenderer.invoke("export-entries", format ?? "json"),
	importEntries: () => ipcRenderer.invoke("import-entries"),
};

const updateAPI: UpdateAPI = {
	onUpdateAvailable: (callback: () => void) => {
		ipcRenderer.on("update-available", callback);
	},
	onUpdateDownloaded: (callback: () => void) => {
		ipcRenderer.on("update-downloaded", callback);
	},
	onUpdateInstalled: (callback: (version?: string) => void) => {
		ipcRenderer.on("update-installed", (_evt, version) => callback?.(version));
	},
	restartApp: () => ipcRenderer.invoke("restart-app"),
	checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
	onUpdateNotAvailable: (callback: () => void) => {
		ipcRenderer.on("update-not-available", callback);
	},
	onDownloadProgress: (callback) => {
		ipcRenderer.on("update-download-progress", (_evt, payload) =>
			callback(payload)
		);
	},
	onUpdateError: (callback) => {
		ipcRenderer.on("update-error", (_evt, message) => callback(message));
	},
};

const settingsAPI: SettingsAPI = {
	getSetting: (key: string) => ipcRenderer.invoke("get-setting", key),
	setSetting: (key: string, value: string) =>
		ipcRenderer.invoke("set-setting", key, value),
};

const systemAPI: SystemAPI = {
	getPlatform: async () => {
		// Use a synchronous hint via userAgent when possible? Keep IPC for consistency
		return process.platform;
	},
	openExternal: (url: string) => ipcRenderer.invoke("open-external-url", url),
};

const cloudAPI: CloudAPI = {
	getStatus: () => ipcRenderer.invoke("cloud-get-status"),
	getSyncHistory: (limit?: number) =>
		ipcRenderer.invoke("cloud-get-sync-history", limit ?? 50),
	// Google Drive
	googleInit: (credentials: unknown) =>
		ipcRenderer.invoke("cloud-google-init", credentials),
	googleGetAuthUrl: () => ipcRenderer.invoke("cloud-google-get-auth-url"),
	googleStartLoopbackAuth: () =>
		ipcRenderer.invoke("cloud-google-start-loopback-auth"),
	googleWaitLoopback: () => ipcRenderer.invoke("cloud-google-wait-loopback"),
	googleSetAuthCode: (code: string) =>
		ipcRenderer.invoke("cloud-google-set-auth-code", code),
	googleDisconnect: () => ipcRenderer.invoke("cloud-google-disconnect"),
	googleHasCredentialsFile: () => ipcRenderer.invoke("cloud-google-has-creds"),
	googleCredentialsDir: () => ipcRenderer.invoke("cloud-google-creds-dir"),
	googleOpenCredentialsDir: () =>
		ipcRenderer.invoke("cloud-google-open-creds-dir"),
	googleBootstrapCredentials: () =>
		ipcRenderer.invoke("cloud-google-bootstrap-creds"),
	// OneDrive
	oneDriveInit: (clientId: string) =>
		ipcRenderer.invoke("cloud-onedrive-init", clientId),
	oneDriveStartLoopbackAuth: () =>
		ipcRenderer.invoke("cloud-onedrive-start-loopback-auth"),
	oneDriveWaitLoopback: () =>
		ipcRenderer.invoke("cloud-onedrive-wait-loopback"),
	oneDriveGetAuthUrl: () => ipcRenderer.invoke("cloud-onedrive-get-auth-url"),
	oneDriveSetAuthCode: (code: string) =>
		ipcRenderer.invoke("cloud-onedrive-set-auth-code", code),
	oneDriveDisconnect: () => ipcRenderer.invoke("cloud-onedrive-disconnect"),
	// Dropbox
	dropboxInit: (token?: string) =>
		ipcRenderer.invoke("cloud-dropbox-init", token),
	dropboxHasTokenFile: () => ipcRenderer.invoke("cloud-dropbox-has-token"),
	dropboxTokenDir: () => ipcRenderer.invoke("cloud-dropbox-token-dir"),
	dropboxOpenTokenDir: () => ipcRenderer.invoke("cloud-dropbox-open-token-dir"),
	dropboxBootstrapToken: () =>
		ipcRenderer.invoke("cloud-dropbox-bootstrap-token"),
	dropboxDisconnect: () => ipcRenderer.invoke("cloud-dropbox-disconnect"),
	// Sync
	syncNow: () => ipcRenderer.invoke("cloud-sync-now"),
	setAutoSync: (enabled: boolean) =>
		ipcRenderer.invoke("cloud-set-auto-sync", enabled),
	// Events
	onAutoSyncResult: (callback) => {
		ipcRenderer.on("cloud-auto-sync-result", (_evt, payload) => {
			callback?.(payload);
		});
	},
	// External URLs
	openExternalUrl: (url: string) =>
		ipcRenderer.invoke("open-external-url", url),
};

contextBridge.exposeInMainWorld("electronAPI", {
	database: databaseAPI,
	file: fileAPI,
	update: updateAPI,
	settings: settingsAPI,
	cloud: cloudAPI,
	system: systemAPI,
});

declare global {
	interface Window {
		electronAPI: {
			database: DatabaseAPI;
			file: FileAPI;
			update: UpdateAPI;
			settings: SettingsAPI;
			cloud: CloudAPI;
			system: SystemAPI;
		};
	}
}
