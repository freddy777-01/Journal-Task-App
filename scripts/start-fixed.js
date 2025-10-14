#!/usr/bin/env node

const { spawn } = require("child_process");
const http = require("http");

console.log("🚀 Starting Diary App (Fixed Mode)...\n");

let viteProcess = null;
let electronProcess = null;
let didStartVite = false;
let devServerUrl = "";

// Function to check if Vite server is running
function checkViteServer(url = "http://localhost:5173") {
	return new Promise((resolve) => {
		try {
			const req = http.get(url, (res) => {
				resolve(true);
			});
			req.on("error", () => {
				resolve(false);
			});
			req.setTimeout(2000, () => {
				req.destroy();
				resolve(false);
			});
		} catch (e) {
			resolve(false);
		}
	});
}

async function ensureViteAndLaunch() {
	console.log("📦 Starting Vite dev server...");
	didStartVite = true;
	viteProcess = spawn("npm", ["run", "dev:vite"], {
		stdio: "pipe",
		shell: true,
	});

	let viteReady = false;

	viteProcess.stdout.on("data", (data) => {
		const output = data.toString();
		// Only log important messages to avoid spam
		if (output.includes("Local:") || output.toLowerCase().includes("ready")) {
			console.log("Vite:", output.trim());
		}

		// Attempt to read the Local server URL from Vite output
		const matchLocal = output.match(/Local:\s+(https?:\/\/[^\s]+)/i);
		const matchAny = output.match(/https?:\/\/(localhost|127\.0\.0\.1):\d+/i);
		if (matchLocal && matchLocal[1]) {
			devServerUrl = matchLocal[1].replace(/\/$/, "");
		} else if (matchAny && matchAny[0]) {
			devServerUrl = matchAny[0].replace(/\/$/, "");
		}

		// Trigger when Local URL line appears OR when we see the generic ready line
		if (
			(output.includes("Local:") || output.toLowerCase().includes("ready")) &&
			!viteReady
		) {
			viteReady = true;
			console.log(
				"✅ Vite server is ready!",
				devServerUrl || "(parsing URL...)"
			);
			startElectronWithWait();
		}
	});

	viteProcess.stderr.on("data", (data) => {
		const error = data.toString();
		// Filter out the CJS deprecation warning
		if (!error.includes("CJS build of Vite's Node API is deprecated")) {
			console.error("Vite Error:", error);
		}
		// If port is in use, Vite will auto-pick another port; we keep waiting
	});

	viteProcess.on("exit", (code) => {
		if (code !== 0) {
			console.log(`❌ Vite exited with code ${code}`);
		}
	});
}

async function startElectronWithWait() {
	// Retry until Vite answers or timeout ~20s
	const start = Date.now();
	const timeoutMs = 20000;
	const urlToCheck = devServerUrl || "http://localhost:5173";
	let ready = await checkViteServer(urlToCheck);
	while (!ready && Date.now() - start < timeoutMs) {
		console.log("⏳ Waiting for Vite to respond...");
		await new Promise((r) => setTimeout(r, 1000));
		ready = await checkViteServer(urlToCheck);
	}
	if (!ready) {
		console.log("❌ Vite did not become ready in time.");
	}
	console.log("🚀 Launching Electron window...", urlToCheck);
	startElectron(urlToCheck);
}

function startElectron(url) {
	electronProcess = spawn("npx", ["electron", "electron/main.js"], {
		stdio: "inherit",
		shell: true,
		env: { ...process.env, NODE_ENV: "development", DEV_SERVER_URL: url },
	});

	electronProcess.on("error", (error) => {
		console.error("❌ Electron failed to start:", error);
		console.log("\n🔧 Troubleshooting steps:");
		console.log("1. Make sure you have the latest Node.js installed");
		console.log("2. Try: npm install electron --save-dev");
		console.log("3. Check if the dev server port is available");
	});

	electronProcess.on("exit", (code) => {
		console.log(`Electron exited with code ${code}`);
		if (code !== 0) {
			console.log("❌ Electron crashed. Check the error messages above.");
		}
	});
}

// Handle process termination
process.on("SIGINT", () => {
	console.log("\n🛑 Shutting down...");
	if (electronProcess) {
		electronProcess.kill();
	}
	if (viteProcess) {
		viteProcess.kill();
	}
	process.exit(0);
});

process.on("SIGTERM", () => {
	console.log("\n🛑 Shutting down...");
	if (electronProcess) {
		electronProcess.kill();
	}
	if (viteProcess) {
		viteProcess.kill();
	}
	process.exit(0);
});

// Keep the process alive
console.log("💡 Press Ctrl+C to stop the application");

// Kick off
ensureViteAndLaunch().catch((e) => {
	console.error("Startup error:", e);
});
