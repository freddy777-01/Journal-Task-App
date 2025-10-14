#!/usr/bin/env node

const { spawn } = require("child_process");
const { execSync } = require("child_process");

console.log("🚀 Starting Diary App in Debug Mode...\n");

// Start Vite dev server
console.log("📦 Starting Vite dev server...");
const vite = spawn("npm", ["run", "dev:vite"], {
	stdio: "inherit",
	shell: true,
});

vite.on("error", (error) => {
	console.error("❌ Vite failed to start:", error);
});

vite.on("exit", (code) => {
	console.log(`Vite exited with code ${code}`);
});

// Wait a bit then start Electron
setTimeout(() => {
	console.log("⚡ Starting Electron...");
	const electron = spawn("npm", ["run", "dev:electron"], {
		stdio: "inherit",
		shell: true,
	});

	electron.on("error", (error) => {
		console.error("❌ Electron failed to start:", error);
	});

	electron.on("exit", (code) => {
		console.log(`Electron exited with code ${code}`);
	});
}, 3000);

// Handle process termination
process.on("SIGINT", () => {
	console.log("\n🛑 Shutting down...");
	vite.kill();
	process.exit(0);
});
