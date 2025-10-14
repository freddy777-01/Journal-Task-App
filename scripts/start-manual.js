#!/usr/bin/env node

const { spawn } = require("child_process");

console.log("🚀 Manual Startup - Starting Vite first...\n");

// Start Vite and keep it running
const vite = spawn("npm", ["run", "dev:vite"], {
	stdio: "inherit",
	shell: true,
});

vite.on("error", (error) => {
	console.error("❌ Vite failed to start:", error);
});

// After 5 seconds, start Electron
setTimeout(() => {
	console.log("\n⚡ Starting Electron in 5 seconds...");
	console.log("📝 Make sure Vite shows 'Local: http://localhost:5173' first");

	setTimeout(() => {
		console.log("🚀 Launching Electron now...");
		const electron = spawn("npx", ["electron", "electron/main.js"], {
			stdio: "inherit",
			shell: true,
			env: { ...process.env, NODE_ENV: "development" },
		});

		electron.on("error", (error) => {
			console.error("❌ Electron failed to start:", error);
		});

		electron.on("exit", (code) => {
			console.log(`Electron exited with code ${code}`);
		});
	}, 5000);
}, 5000);

// Handle process termination
process.on("SIGINT", () => {
	console.log("\n🛑 Shutting down...");
	vite.kill();
	process.exit(0);
});

console.log("💡 This will start Vite, then Electron after 10 seconds");
console.log("💡 Press Ctrl+C to stop");
