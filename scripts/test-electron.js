#!/usr/bin/env node

const { spawn } = require("child_process");

console.log("🧪 Testing Electron startup...\n");

// Test if we can start Electron directly
console.log("Starting Electron with test main file...");
const electron = spawn("npx", ["electron", "electron/test-main.js"], {
	stdio: "inherit",
	shell: true,
});

electron.on("error", (error) => {
	console.error("❌ Electron failed to start:", error);
	console.log("\nPossible solutions:");
	console.log("1. Make sure Vite is running on http://localhost:5173");
	console.log("2. Try: npm run dev:vite (in another terminal)");
	console.log("3. Then run this test again");
});

electron.on("exit", (code) => {
	console.log(`Electron exited with code ${code}`);
});

// Handle process termination
process.on("SIGINT", () => {
	console.log("\n🛑 Shutting down...");
	electron.kill();
	process.exit(0);
});
