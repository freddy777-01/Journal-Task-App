const { app, BrowserWindow } = require("electron");
const path = require("path");

let mainWindow;

function createWindow() {
	console.log("Creating Electron window...");

	mainWindow = new BrowserWindow({
		width: 1200,
		height: 800,
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
		},
		show: false,
	});

	// Load the Vite dev server
	mainWindow.loadURL("http://localhost:5173");

	// Show window when ready
	mainWindow.once("ready-to-show", () => {
		console.log("Window ready to show");
		mainWindow.show();
	});

	// Open DevTools in development
	mainWindow.webContents.openDevTools();

	mainWindow.on("closed", () => {
		mainWindow = null;
	});
}

app.whenReady().then(() => {
	console.log("App ready, creating window...");
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

console.log("Electron main process started");
