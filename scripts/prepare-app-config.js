#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const apiKeyDir = path.join(root, "src", "api-key");
const targetDir = path.join(root, "electron");
const targetFile = path.join(targetDir, "app-config.json");

function safeParse(json) {
	try {
		return JSON.parse(json);
	} catch (e) {
		return null;
	}
}

function findFiles(dir) {
	try {
		return fs.existsSync(dir)
			? fs.readdirSync(dir).map((f) => path.join(dir, f))
			: [];
	} catch (e) {
		return [];
	}
}

function pickGoogleBlock(parsed) {
	if (!parsed) return null;
	if (parsed.installed || parsed.web)
		return { installed: parsed.installed, web: parsed.web };
	// Some exports might be the installed block directly
	if (parsed.client_id && parsed.client_secret) return { installed: parsed };
	return null;
}

function pickDropboxBlock(parsed) {
	if (!parsed) return null;
	// Prefer OAuth appKey configuration (safe to embed)
	if (parsed.appKey || parsed.app_key)
		return {
			appKey: parsed.appKey || parsed.app_key,
			redirect: parsed.redirect || parsed.redirect_uri || parsed.redirectUri,
		};
	// If a token-only file is found, do NOT embed into app-config; it should live in user OAuth dir
	if (parsed.accessToken || parsed.access_token) {
		console.log(
			"prepare-app-config: found dropbox token file; will not embed accessToken in app-config (use user OAuth folder instead)"
		);
		return null;
	}
	return null;
}

function buildFromApiKeyFolder() {
	const out = {};
	const files = findFiles(apiKeyDir);
	for (const f of files) {
		if (!f.toLowerCase().endsWith(".json")) continue;
		let raw;
		try {
			raw = fs.readFileSync(f, "utf8");
		} catch (e) {
			continue;
		}
		const parsed = safeParse(raw);
		if (!parsed) continue;

		// Try google
		const g = pickGoogleBlock(parsed);
		if (g && !out.google) {
			out.google = g;
			continue;
		}

		// Try dropbox (only appKey/redirect accepted for embedding)
		const d = pickDropboxBlock(parsed);
		if (d && !out.dropbox) {
			out.dropbox = d;
			continue;
		}
	}
	return out;
}

function main() {
	try {
		if (fs.existsSync(targetFile)) {
			console.log(
				"prepare-app-config: electron/app-config.json already exists — skipping"
			);
			return;
		}

		const built = buildFromApiKeyFolder();
		if (!built || Object.keys(built).length === 0) {
			console.log(
				"prepare-app-config: no credentials found in src/api-key — nothing to do"
			);
			return;
		}

		if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
		fs.writeFileSync(targetFile, JSON.stringify(built, null, 2), "utf8");
		console.log(
			"prepare-app-config: wrote electron/app-config.json from src/api-key"
		);
	} catch (e) {
		console.warn("prepare-app-config: unexpected error —", e?.message || e);
	}
}

if (require.main === module) main();
