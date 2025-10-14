#!/usr/bin/env node

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

console.log("🔍 Troubleshooting Diary App...\n");

// Check if node_modules exists
if (!fs.existsSync("node_modules")) {
	console.log("❌ node_modules not found. Installing dependencies...");
	try {
		execSync("npm install", { stdio: "inherit" });
		console.log("✅ Dependencies installed successfully");
	} catch (error) {
		console.error("❌ Failed to install dependencies:", error.message);
		process.exit(1);
	}
}

// Check if electron is installed
try {
	const electronPath = require.resolve("electron");
	console.log("✅ Electron found at:", electronPath);
} catch (error) {
	console.log("❌ Electron not found. Installing...");
	try {
		execSync("npm install electron --save-dev", { stdio: "inherit" });
		console.log("✅ Electron installed successfully");
	} catch (error) {
		console.error("❌ Failed to install Electron:", error.message);
		process.exit(1);
	}
}

// Check if main.js exists
if (!fs.existsSync("electron/main.js")) {
	console.log("❌ electron/main.js not found");
	process.exit(1);
} else {
	console.log("✅ electron/main.js found");
}

// Check if preload.js exists
if (!fs.existsSync("electron/preload.js")) {
	console.log("❌ electron/preload.js not found");
	process.exit(1);
} else {
	console.log("✅ electron/preload.js found");
}

// Check if database.js exists
if (!fs.existsSync("electron/database.js")) {
	console.log("❌ electron/database.js not found");
	process.exit(1);
} else {
	console.log("✅ electron/database.js found");
}

// Check if better-sqlite3 is installed
try {
	require.resolve("better-sqlite3");
	console.log("✅ better-sqlite3 found");
} catch (error) {
	console.log("❌ better-sqlite3 not found. Installing...");
	try {
		execSync("npm install better-sqlite3", { stdio: "inherit" });
		console.log("✅ better-sqlite3 installed successfully");
	} catch (error) {
		console.error("❌ Failed to install better-sqlite3:", error.message);
		process.exit(1);
	}
}

console.log("\n🎉 All checks passed! You can now run:");
console.log("   npm run dev");
console.log("\nIf the app still doesn't open, try:");
console.log("   1. Close all terminal windows");
console.log("   2. Run: npm run dev");
console.log("   3. Wait for both Vite and Electron to start");
console.log("   4. The Electron window should open automatically");
