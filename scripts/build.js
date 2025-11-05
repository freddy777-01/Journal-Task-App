#!/usr/bin/env node

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

console.log("🚀 Starting build process...\n");

// Clean previous builds
console.log("🧹 Cleaning previous builds...");

function safeRemove(targetPath) {
	if (!fs.existsSync(targetPath)) return;
	// Retry a few times in case of transient locks (Windows EBUSY)
	const retries = 3;
	for (let i = 0; i < retries; i++) {
		try {
			fs.rmSync(targetPath, { recursive: true, force: true });
			return;
		} catch (e) {
			const busy = e?.code === "EBUSY" || e?.code === "EPERM";
			if (i < retries - 1 && busy) {
				// Brief backoff
				Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 150);
				continue;
			}
			// Rename fallback so build can proceed
			if (busy) {
				// Try to terminate potential locking processes on Windows
				if (process.platform === "win32") {
					try {
						const { execSync } = require("child_process");
						execSync("taskkill /IM Diary.exe /F /T", { stdio: "ignore" });
					} catch {}
					try {
						const { execSync } = require("child_process");
						execSync("taskkill /IM electron.exe /F /T", { stdio: "ignore" });
					} catch {}
					Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200);
					try {
						fs.rmSync(targetPath, { recursive: true, force: true });
						return;
					} catch {}
				}
				const dir = path.dirname(targetPath);
				const base = path.basename(targetPath);
				const stamp = new Date().toISOString().replace(/[:.]/g, "-");
				const fallback = path.join(dir, `${base}-old-${stamp}`);
				try {
					fs.renameSync(targetPath, fallback);
					console.warn(
						`⚠️  Could not delete ${targetPath} (in use). Renamed to ${fallback}. Continuing...`
					);
					return;
				} catch (e2) {
					console.warn(
						`⚠️  Failed to clean ${targetPath}. Please close any running app using files in that folder. Will continue; electron-builder may still succeed.`
					);
					return;
				}
			}
			// Non-busy errors: rethrow
			throw e;
		}
	}
}

safeRemove("dist");
safeRemove("dist-electron");
safeRemove("release");

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
