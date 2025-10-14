#!/usr/bin/env node

const { execSync } = require("child_process");
const fs = require("fs");

console.log("🔄 Updating dependencies to latest versions...\n");

try {
	// Clean install to ensure latest versions
	console.log("🧹 Cleaning node_modules and package-lock.json...");
	if (fs.existsSync("node_modules")) {
		fs.rmSync("node_modules", { recursive: true, force: true });
	}
	if (fs.existsSync("package-lock.json")) {
		fs.unlinkSync("package-lock.json");
	}

	// Install latest dependencies
	console.log("📦 Installing latest dependencies...");
	execSync("npm install", { stdio: "inherit" });

	// Update electron-builder dependencies
	console.log("⚡ Installing electron-builder dependencies...");
	execSync("npm run postinstall", { stdio: "inherit" });

	console.log("\n✅ Dependencies updated successfully!");
	console.log("🚀 You can now run 'npm run dev' to start development");
} catch (error) {
	console.error("\n❌ Failed to update dependencies:", error.message);
	process.exit(1);
}
