#!/usr/bin/env node

const { spawn } = require("child_process");
const http = require("http");

console.log("🚀 Starting Diary App (Simple Mode)...\n");

// Function to check if Vite server is running
function checkViteServer() {
	return new Promise((resolve) => {
		const req = http.get("http://localhost:5173", (res) => {
			resolve(true);
		});
		req.on("error", () => {
			resolve(false);
		});
		req.setTimeout(1000, () => {
			req.destroy();
			resolve(false);
		});
	});
}

// Start Vite
console.log("📦 Starting Vite dev server...");
const vite = spawn("npm", ["run", "dev:vite"], {
	stdio: "pipe",
	shell: true,
});

let viteReady = false;

vite.stdout.on("data", (data) => {
	const output = data.toString();
	console.log("Vite:", output);

	if (output.includes("Local:") && !viteReady) {
		viteReady = true;
		console.log("✅ Vite server is ready!");

		// Wait a bit more then start Electron
		setTimeout(async () => {
			const isReady = await checkViteServer();
			if (isReady) {
				console.log("⚡ Starting Electron...");
				startElectron();
			} else {
				console.log("❌ Vite server not responding, retrying...");
				setTimeout(() => startElectron(), 2000);
			}
		}, 2000);
	}
});

vite.stderr.on("data", (data) => {
	console.error("Vite Error:", data.toString());
});

function startElectron() {
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
}

// Handle process termination
process.on("SIGINT", () => {
	console.log("\n🛑 Shutting down...");
	vite.kill();
	process.exit(0);
});
