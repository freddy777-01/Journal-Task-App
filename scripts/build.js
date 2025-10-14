#!/usr/bin/env node

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

console.log("🚀 Starting build process...\n");

// Clean previous builds
console.log("🧹 Cleaning previous builds...");
if (fs.existsSync("dist")) {
	fs.rmSync("dist", { recursive: true, force: true });
}
if (fs.existsSync("dist-electron")) {
	fs.rmSync("dist-electron", { recursive: true, force: true });
}
if (fs.existsSync("release")) {
	fs.rmSync("release", { recursive: true, force: true });
}

try {
	// Build Vite
	console.log("📦 Building Vite application...");
	execSync("npm run build:vite", { stdio: "inherit" });

	// Build Electron
	console.log("⚡ Building Electron application...");
	execSync("npm run build:electron", { stdio: "inherit" });

	console.log("\n✅ Build completed successfully!");
	console.log("📁 Built applications are available in the release/ directory");
} catch (error) {
	console.error("\n❌ Build failed:", error.message);
	process.exit(1);
}
