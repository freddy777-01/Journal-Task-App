// Lazy-load heavy SDKs to avoid startup crashes if some transitive deps are missing
const { Client } = require("@microsoft/microsoft-graph-client");
const { PublicClientApplication } = require("@azure/msal-node");
const { Dropbox } = require("dropbox");
const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const http = require("http");
const url = require("url");
// Optional secure keychain storage
let keytar = null;
try {
	keytar = require("keytar");
} catch {}

class CloudService {
	constructor() {
		// Feature flag: temporarily disable OneDrive integration
		this.ONEDRIVE_DISABLED = true;
		// Google
		this.googleAuth = null;
		this.googleClient = null; // { client_id, client_secret }
		this.googleCredsType = null; // 'installed' | 'web'
		this.googleAllowedRedirects = [];
		this._google = null; // lazy-loaded googleapis

		// OneDrive
		this.oneDriveClient = null;
		this.msalInstance = null;

		// Dropbox
		this.dropboxClient = null;

		// Paths
		this.userDataDir = app.getPath("userData");
		this.oauthRootDir = path.join(this.userDataDir, "oauth");
		this.googleOAuthDir = path.join(this.oauthRootDir, "google");
		this.googleCredentialsPath = path.join(
			this.googleOAuthDir,
			"credentials.json"
		);
		// Optional embedded application config packaged with the app
		// Maintainers can provide electron/app-config.json to ship a default OAuth client
		// Shape expected: { "google": { "installed": { client_id, client_secret, redirect_uris[] } } }
		this.embeddedConfigPath = path.join(__dirname, "app-config.json");
		this.dropboxOAuthDir = path.join(this.oauthRootDir, "dropbox");
		this.dropboxTokenPath = path.join(this.dropboxOAuthDir, "dropbox.json");
		this.configPath = path.join(this.userDataDir, "cloud-config.json");

		// Loopback holders (Google)
		this._loopbackServer = null;
		this._loopbackAuthPromise = null;
		this._resolveLoopbackAuth = null;
		this._expectedCallbackPath = "/";

		// Loopback holders (OneDrive)
		this._onedriveLoopbackServer = null;
		this._onedriveLoopbackPromise = null;
		this._resolveOnedriveLoopback = null;
		this._onedriveExpectedPath = "/auth/callback";
		this._onedriveRedirectUri = null;

		this.ensureOauthDirs();
		this.loadConfig();
	}

	// ---------- Keychain helpers (best-effort) ----------
	_getServiceName() {
		return "Diary";
	}

	async _keytarSet(account, value) {
		if (!keytar) return false;
		try {
			await keytar.setPassword(this._getServiceName(), account, value);
			return true;
		} catch (e) {
			console.warn("keytar set failed:", e?.message || e);
			return false;
		}
	}

	async _keytarGet(account) {
		if (!keytar) return null;
		try {
			return await keytar.getPassword(this._getServiceName(), account);
		} catch (e) {
			console.warn("keytar get failed:", e?.message || e);
			return null;
		}
	}

	async _keytarDelete(account) {
		if (!keytar) return false;
		try {
			return await keytar.deletePassword(this._getServiceName(), account);
		} catch (e) {
			console.warn("keytar delete failed:", e?.message || e);
			return false;
		}
	}

	// Ensure a dedicated Google Drive folder for backups, return its id
	async _ensureGoogleBackupFolder(drive) {
		const folderName = "DiaryBackup";
		// Try to find existing folder
		const list = await drive.files.list({
			q:
				"mimeType='application/vnd.google-apps.folder' and name='" +
				folderName +
				"' and trashed=false",
			fields: "files(id, name)",
			spaces: "drive",
		});
		if (list.data.files && list.data.files.length > 0) {
			return list.data.files[0].id;
		}
		// Create new folder
		const createResp = await drive.files.create({
			requestBody: {
				name: folderName,
				mimeType: "application/vnd.google-apps.folder",
			},
			fields: "id, name",
		});
		return createResp.data.id;
	}

	// Attempt to rebuild Google OAuth client from saved credentials/tokens when needed
	async _ensureGoogleAuthForSync() {
		try {
			const google = this._getGoogle();
			if (this.googleAuth && this.config?.googleDrive?.enabled) return true;
			let tokens = this.config?.googleDrive?.tokens;
			if (!tokens) {
				// Try keychain if config doesn't have tokens
				try {
					const fromKeychain = await this._keytarGet("googleDrive");
					if (fromKeychain) {
						tokens = JSON.parse(fromKeychain);
					}
				} catch {}
			}
			if (!tokens) return false;
			const creds = this.readGoogleCredentialsFromFile();
			if (!creds) return false;
			const clientBlock = creds.installed || creds.web;
			if (!clientBlock?.client_id || !clientBlock?.client_secret) return false;
			const { client_id, client_secret, redirect_uris } = clientBlock;
			this.googleClient = { client_id, client_secret };
			this.googleCredsType = creds.installed ? "installed" : "web";
			this.googleAllowedRedirects = Array.isArray(redirect_uris)
				? redirect_uris.slice()
				: [];
			const redirect =
				redirect_uris && redirect_uris[0]
					? redirect_uris[0]
					: "http://localhost:3000/oauth2callback";
			this.googleAuth = new google.auth.OAuth2(
				client_id,
				client_secret,
				redirect
			);
			this.googleAuth.setCredentials(tokens);
			return true;
		} catch (e) {
			console.warn("Failed to ensure Google auth for sync:", e?.message || e);
			return false;
		}
	}

	_getGoogle() {
		if (!this._google) {
			try {
				this._google = require("googleapis").google;
			} catch (e) {
				throw new Error(
					"Google API module is not available. Please reinstall the app or ensure dependencies are installed."
				);
			}
		}
		return this._google;
	}

	// Rebuild Dropbox client from stored token when needed
	async _ensureDropboxClientForSync() {
		try {
			if (this.dropboxClient && this.config?.dropbox?.enabled) return true;
			// 1) Try existing session token from config or legacy token file
			let accessToken =
				this.config?.dropbox?.token || this.readDropboxTokenFromFile();
			// 2) If none, try OS keychain refresh token and exchange for an access token
			if (!accessToken) {
				try {
					const refreshToken = await this._keytarGet("dropbox");
					if (refreshToken) {
						const token = await this._dropboxExchangeRefreshToken(refreshToken);
						if (token) {
							accessToken = token;
							// do NOT persist access token long-term; keep ephemeral
						}
					}
				} catch {}
			}

			if (!accessToken) return false;
			this.dropboxClient = new Dropbox({ accessToken });
			this.config.dropbox = this.config.dropbox || {
				enabled: false,
				token: null,
				lastSync: null,
			};
			// Maintain token in config only when coming from legacy file path
			if (this.readDropboxTokenFromFile()) {
				this.config.dropbox.token = accessToken;
			}
			return true;
		} catch (e) {
			console.warn(
				"Failed to ensure Dropbox client for sync:",
				e?.message || e
			);
			return false;
		}
	}

	// ---------- Utilities ----------
	ensureOauthDirs() {
		try {
			if (!fs.existsSync(this.oauthRootDir))
				fs.mkdirSync(this.oauthRootDir, { recursive: true });
			if (!fs.existsSync(this.googleOAuthDir))
				fs.mkdirSync(this.googleOAuthDir, { recursive: true });
			if (!fs.existsSync(this.dropboxOAuthDir))
				fs.mkdirSync(this.dropboxOAuthDir, { recursive: true });
		} catch (e) {
			console.error("Failed to ensure OAuth directories:", e);
		}
	}

	loadConfig() {
		try {
			if (fs.existsSync(this.configPath)) {
				const data = fs.readFileSync(this.configPath, "utf8");
				this.config = JSON.parse(data);
			} else {
				this.config = {
					googleDrive: { enabled: false, tokens: null, lastSync: null },
					oneDrive: { enabled: false, tokens: null, lastSync: null },
					dropbox: { enabled: false, token: null, lastSync: null },
					autoSync: false,
					syncInterval: 3600000,
				};
			}
		} catch (e) {
			console.error("Error loading cloud config:", e);
			this.config = {
				googleDrive: { enabled: false, tokens: null, lastSync: null },
				oneDrive: { enabled: false, tokens: null, lastSync: null },
				dropbox: { enabled: false, token: null, lastSync: null },
				autoSync: false,
				syncInterval: 3600000,
			};
		}
	}

	saveConfig() {
		try {
			fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
		} catch (e) {
			console.error("Error saving cloud config:", e);
		}
	}

	// Branded success HTML page used by both providers
	_renderSuccessHTML(serviceName = "") {
		const title = "All set!";
		const sub = "You can return to the Diary app. This tab can be closed.";
		const logoSvg = [
			'<svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">',
			'<rect x="3" y="3" width="18" height="18" rx="3" fill="#7C3AED"/>',
			'<path d="M8 7h8M8 11h8M8 15h5" stroke="white" stroke-width="1.6" stroke-linecap="round"/>',
			"</svg>",
		].join("");
		return [
			"<!doctype html>",
			'<html lang="en"><head>',
			'<meta charset="utf-8" />',
			'<meta name="viewport" content="width=device-width, initial-scale=1" />',
			`<title>${title}</title>`,
			"<style>",
			"*{box-sizing:border-box}body{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f8fafc;color:#0f172a}",
			".container{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}",
			".card{background:#fff;border:1px solid #e5e7eb;border-radius:16px;max-width:640px;width:100%;padding:28px;box-shadow:0 10px 24px rgba(0,0,0,.07)}",
			".header{display:flex;gap:16px;align-items:center;margin-bottom:4px}",
			".title{font-size:24px;font-weight:700;margin:0}",
			".meta{color:#475569;margin:6px 0 0 64px}",
			".badge{display:inline-flex;align-items:center;gap:8px;background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;border-radius:999px;padding:6px 12px;font-size:13px;margin-left:64px;margin-top:14px}",
			".check{width:18px;height:18px}",
			".footer{margin-top:18px;margin-left:64px;color:#64748b;font-size:13px}",
			"</style></head><body>",
			'<div class="container"><div class="card">',
			`<div class="header">${logoSvg}<h1 class="title">${title}</h1></div>`,
			`<p class="meta">${sub}</p>`,
			'<div class="badge"><svg class="check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg> ',
			`${serviceName ? serviceName + " connected" : "Connected"}</div>`,
			'<div class="footer">This window will try to close itself automatically.</div>',
			"</div></div>",
			"<script>window.close && window.close();</script>",
			"</body></html>",
		].join("");
	}

	// ---------- Google Drive ----------
	hasGoogleCredentialsFile() {
		// Strictly check if user-provided credentials.json exists
		try {
			return fs.existsSync(this.googleCredentialsPath);
		} catch {
			return false;
		}
	}

	getGoogleCredentialsDir() {
		try {
			this.ensureOauthDirs();
			return this.googleOAuthDir;
		} catch (e) {
			console.error("Failed to get Google credentials dir:", e);
			return this.googleOAuthDir;
		}
	}

	getGoogleCredentialsSource() {
		try {
			// Prefer explicit user file when present and valid
			if (fs.existsSync(this.googleCredentialsPath)) {
				try {
					const raw = fs.readFileSync(this.googleCredentialsPath, "utf8");
					const parsed = JSON.parse(raw);
					const block = parsed?.installed || parsed?.web ? parsed : null;
					const validInstalled = !!(
						block?.installed?.client_id &&
						block?.installed?.client_secret &&
						Array.isArray(block?.installed?.redirect_uris)
					);
					const validWeb = !!(
						block?.web?.client_id &&
						block?.web?.client_secret &&
						Array.isArray(block?.web?.redirect_uris)
					);
					if (validInstalled || validWeb) return "user";
				} catch {}
			}
			// Else check embedded app-config.json
			if (fs.existsSync(this.embeddedConfigPath)) {
				try {
					const raw = fs.readFileSync(this.embeddedConfigPath, "utf8");
					const parsed = JSON.parse(raw);
					const googleBlock = parsed.google || parsed;
					const validInstalled = !!(
						googleBlock?.installed?.client_id &&
						googleBlock?.installed?.client_secret &&
						Array.isArray(googleBlock?.installed?.redirect_uris)
					);
					const validWeb = !!(
						googleBlock?.web?.client_id &&
						googleBlock?.web?.client_secret &&
						Array.isArray(googleBlock?.web?.redirect_uris)
					);
					if (validInstalled || validWeb) return "embedded";
				} catch {}
			}
			return "none";
		} catch {
			return "none";
		}
	}

	readGoogleCredentialsFromFile() {
		// Prefer user-provided credentials file, else fall back to embedded app config
		try {
			const hasUserCreds = fs.existsSync(this.googleCredentialsPath);
			const hasEmbedded = fs.existsSync(this.embeddedConfigPath);
			let embedded = null;
			if (hasEmbedded) {
				try {
					const eraw = fs.readFileSync(this.embeddedConfigPath, "utf8");
					const eparsed = JSON.parse(eraw);
					const eblock = eparsed.google || eparsed;
					if (eblock?.installed || eblock?.web) {
						embedded = { installed: eblock.installed, web: eblock.web };
					}
				} catch {}
			}
			if (hasUserCreds) {
				const raw = fs.readFileSync(this.googleCredentialsPath, "utf8");
				const parsed = JSON.parse(raw);
				const ublock = parsed.installed || parsed.web ? parsed : null;
				if (ublock?.installed) {
					console.log(
						"[cloudService] Google creds: using user credentials file (installed)",
						this.googleCredentialsPath
					);
					return { installed: ublock.installed, web: ublock.web };
				}
				if (ublock?.web) {
					// Heuristic: if web client redirects include only default port (80) or no port, Windows likely can't bind.
					const redirects = Array.isArray(ublock.web.redirect_uris)
						? ublock.web.redirect_uris
						: [];
					const hasUsableLocalhost = redirects.some((u) =>
						/http:\/\/(localhost|127\.0\.0\.1):\d+/i.test(u)
					);
					if (!hasUsableLocalhost && embedded?.installed) {
						console.warn(
							"[cloudService] User web credentials lack a localhost port (e.g., :3000). Falling back to embedded installed client."
						);
						return embedded;
					}
					console.log(
						"[cloudService] Google creds: using user credentials file (web)",
						this.googleCredentialsPath
					);
					return { installed: ublock.installed, web: ublock.web };
				}
			}
			if (fs.existsSync(this.embeddedConfigPath)) {
				const raw = fs.readFileSync(this.embeddedConfigPath, "utf8");
				const parsed = JSON.parse(raw);
				// Support either { google: { installed|web } } or direct installed/web block
				const googleBlock = parsed.google || parsed;
				if (googleBlock?.installed || googleBlock?.web) {
					return { installed: googleBlock.installed, web: googleBlock.web };
				}
			}
			return null;
		} catch (e) {
			console.error("Failed to read Google credentials:", e);
			return null;
		}
	}

	attemptBootstrapGoogleCredentialsFromRepo() {
		try {
			const candidateDirs = [
				path.join(__dirname, "..", "src", "api-key"),
				path.join(process.cwd(), "src", "api-key"),
				path.join(__dirname, "..", "src", "api-keys"),
				path.join(process.cwd(), "src", "api-keys"),
				path.join(process.cwd(), "api-key"),
				path.join(process.cwd(), "api-keys"),
			];
			for (const dir of candidateDirs) {
				if (!dir) continue;
				if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
					const files = fs
						.readdirSync(dir)
						.filter((f) => f.endsWith(".json"))
						.sort();
					for (const file of files) {
						const full = path.join(dir, file);
						try {
							const raw = fs.readFileSync(full, "utf8");
							const parsed = JSON.parse(raw);
							const creds = parsed.installed || parsed.web;
							if (
								creds &&
								creds.client_id &&
								creds.client_secret &&
								Array.isArray(creds.redirect_uris)
							) {
								this.ensureOauthDirs();
								fs.writeFileSync(
									this.googleCredentialsPath,
									JSON.stringify(parsed, null, 2),
									"utf8"
								);
								console.log(
									`Bootstrapped Google credentials from ${full} to ${this.googleCredentialsPath}`
								);
								return true;
							}
						} catch {
							// ignore invalid json
						}
					}
				}
			}
		} catch (e) {
			console.warn("Bootstrap from src/api-key failed:", e?.message || e);
		}
		return false;
	}

	bootstrapGoogleCredentialsFromRepo() {
		return this.attemptBootstrapGoogleCredentialsFromRepo();
	}

	async initGoogleDrive(credentials) {
		try {
			const google = this._getGoogle();
			let creds = credentials || this.readGoogleCredentialsFromFile();
			if (!creds && this.attemptBootstrapGoogleCredentialsFromRepo()) {
				creds = this.readGoogleCredentialsFromFile();
			}
			if (!creds) {
				throw new Error(
					"Missing Google OAuth credentials. Place credentials.json in the OAuth folder or pass credentials."
				);
			}
			const clientBlock = creds.installed || creds.web;
			const { client_id, client_secret, redirect_uris } = clientBlock;
			this.googleClient = { client_id, client_secret };
			this.googleCredsType = creds.installed ? "installed" : "web";
			this.googleAllowedRedirects = Array.isArray(redirect_uris)
				? redirect_uris.slice()
				: [];

			// initial auth (redirect will be replaced for loopback)
			this.googleAuth = new google.auth.OAuth2(
				client_id,
				client_secret,
				redirect_uris && redirect_uris[0]
					? redirect_uris[0]
					: "http://localhost"
			);
			if (this.config.googleDrive.tokens) {
				this.googleAuth.setCredentials(this.config.googleDrive.tokens);
			}
			return true;
		} catch (e) {
			console.error("Error initializing Google Drive:", e);
			return false;
		}
	}

	getGoogleAuthUrl() {
		if (!this.googleAuth) throw new Error("Google Drive not initialized");
		return this.googleAuth.generateAuthUrl({
			access_type: "offline",
			scope: ["https://www.googleapis.com/auth/drive.file"],
		});
	}

	async startGoogleLoopbackAuth() {
		if (!this.googleClient) throw new Error("Google Drive not initialized");
		const google = this._getGoogle();

		this._loopbackAuthPromise = new Promise(
			(resolve) => (this._resolveLoopbackAuth = resolve)
		);

		let redirectUri;
		let expectedPath = "/"; // Installed apps: use root path to avoid redirect_uri mismatch
		let listenHost = "127.0.0.1"; // Prefer IPv4 loopback for reliability on Windows
		let listenPort = 0; // ephemeral by default

		if (this.googleCredsType === "web") {
			const pick = (this.googleAllowedRedirects || []).find((u) =>
				/^http:\/\/(localhost|127\.0\.0\.1)/i.test(u)
			);
			if (!pick) {
				console.error("No localhost redirect URI found in web credentials.");
				return null;
			}
			try {
				const parsed = new URL(pick);
				listenHost = parsed.hostname || "127.0.0.1";
				listenPort = parsed.port ? parseInt(parsed.port, 10) : 80;
				expectedPath = parsed.pathname || "/oauth2callback";
				redirectUri = pick; // must match exactly
			} catch (e) {
				console.error("Invalid redirect URI in credentials:", pick, e);
				return null;
			}
		}

		this._expectedCallbackPath = expectedPath;

		const createServer = () =>
			http.createServer(async (req, res) => {
				try {
					const parsed = url.parse(req.url, true);
					const pathOk =
						parsed.pathname === this._expectedCallbackPath ||
						parsed.pathname === "/" ||
						parsed.pathname === "";
					if (!pathOk) {
						res.writeHead(404, { "Content-Type": "text/plain" });
						res.end("Not found");
						return;
					}
					if (parsed.query && parsed.query.code) {
						const code = String(parsed.query.code);
						try {
							const { tokens } = await this.googleAuth.getToken(code);
							this.googleAuth.setCredentials(tokens);
							this.config.googleDrive.tokens = tokens;
							this.config.googleDrive.enabled = true;
							this.saveConfig();
							try {
								await this._keytarSet("googleDrive", JSON.stringify(tokens));
							} catch {}
							// Save to keychain when available
							try {
								await this._keytarSet("googleDrive", JSON.stringify(tokens));
							} catch {}
							res.writeHead(200, { "Content-Type": "text/html" });
							res.end(this._renderSuccessHTML("Google Drive"));
							this._resolveLoopbackAuth(true);
						} catch (e) {
							console.error("Token exchange failed:", e);
							res.writeHead(500, { "Content-Type": "text/html" });
							res.end(
								'<html><body style="font-family:sans-serif"><h2>Authentication failed</h2><p>Please return to the app and try again.</p></body></html>'
							);
							this._resolveLoopbackAuth(false);
						}
					} else {
						res.writeHead(400, { "Content-Type": "text/plain" });
						res.end("Missing code");
					}
				} finally {
					try {
						this._loopbackServer.close();
					} catch {}
					this._loopbackServer = null;
				}
			});

		const tryListen = (host) =>
			new Promise((resolve, reject) => {
				this._loopbackServer = createServer();
				const onError = (err) => {
					try {
						this._loopbackServer?.close();
					} catch {}
					this._loopbackServer = null;
					reject(err);
				};
				this._loopbackServer.once("error", onError);
				this._loopbackServer.listen(listenPort, host, () => {
					this._loopbackServer?.off("error", onError);
					resolve(true);
				});
			});

		const hostsToTry =
			this.googleCredsType === "web"
				? [listenHost]
				: ["127.0.0.1", "localhost"];
		let boundHost = null;
		for (const host of hostsToTry) {
			try {
				await tryListen(host);
				boundHost = host;
				break;
			} catch (e) {
				console.warn("Google loopback bind failed on", host, e?.message || e);
			}
		}
		// If not bound yet, attempt a common fixed port (3000) on each host
		if (!boundHost) {
			for (const host of hostsToTry) {
				try {
					this._loopbackServer = null;
					await new Promise((resolve, reject) => {
						this._loopbackServer = http.createServer(() => {});
						this._loopbackServer.once("error", reject);
						this._loopbackServer.listen(3000, host, resolve);
					});
					try {
						this._loopbackServer.close();
					} catch {}
					await tryListen(host);
					boundHost = host;
					break;
				} catch (e) {
					console.warn(
						"Google loopback bind on port 3000 failed for",
						host,
						e?.message || e
					);
				}
			}
		}
		if (!boundHost) {
			// Manual fallback for installed client: return an auth URL using a common localhost redirect.
			if (this.googleCredsType !== "web") {
				const manualRedirect = "http://127.0.0.1:3000/";
				this.googleAuth = new google.auth.OAuth2(
					this.googleClient.client_id,
					this.googleClient.client_secret,
					manualRedirect
				);
				const manualUrl = this.googleAuth.generateAuthUrl({
					access_type: "offline",
					prompt: "consent",
					scope: ["https://www.googleapis.com/auth/drive.file"],
					redirect_uri: manualRedirect,
				});
				console.warn(
					"Loopback server not bound; returning manual auth URL using redirect",
					manualRedirect
				);
				return manualUrl;
			}
			console.error("Unable to bind loopback server on any host");
			return null;
		}
		const address = this._loopbackServer.address();
		const actualPort =
			typeof address === "object" && address
				? address.port
				: listenPort || 3000;
		if (!redirectUri)
			redirectUri = `http://${boundHost}:${actualPort}${expectedPath}`;

		console.log("Google loopback auth listening:", {
			host: listenHost,
			port: actualPort,
			path: expectedPath,
			redirectUri,
			type: this.googleCredsType,
		});

		// Recreate client bound to chosen redirect
		this.googleAuth = new google.auth.OAuth2(
			this.googleClient.client_id,
			this.googleClient.client_secret,
			redirectUri
		);
		const authUrl = this.googleAuth.generateAuthUrl({
			access_type: "offline",
			prompt: "consent",
			scope: ["https://www.googleapis.com/auth/drive.file"],
			redirect_uri: redirectUri,
		});
		return authUrl;
	}

	waitGoogleLoopbackAuthComplete() {
		if (!this._loopbackAuthPromise) return Promise.resolve(false);
		const TIMEOUT_MS = 180000; // 3 minutes
		return Promise.race([
			this._loopbackAuthPromise,
			new Promise((resolve) =>
				setTimeout(() => {
					console.warn("Google loopback auth timed out");
					try {
						this._loopbackServer && this._loopbackServer.close();
					} catch {}
					this._loopbackServer = null;
					resolve(false);
				}, TIMEOUT_MS)
			),
		]);
	}

	async setGoogleAuthCode(code) {
		try {
			const { tokens } = await this.googleAuth.getToken(code);
			this.googleAuth.setCredentials(tokens);
			this.config.googleDrive.tokens = tokens;
			this.config.googleDrive.enabled = true;
			this.saveConfig();
			try {
				await this._keytarSet("googleDrive", JSON.stringify(tokens));
			} catch {}
			return true;
		} catch (e) {
			console.error("Error setting Google auth code:", e);
			return false;
		}
	}

	async uploadToGoogleDrive(
		fileName,
		fileContent,
		mimeType = "application/json"
	) {
		try {
			const google = this._getGoogle();
			if (!this.googleAuth) await this._ensureGoogleAuthForSync();
			if (!this.googleAuth || !this.config.googleDrive.enabled)
				throw new Error("Google Drive not authenticated");
			const drive = google.drive({ version: "v3", auth: this.googleAuth });
			// Ensure backup folder exists
			const folderId = await this._ensureGoogleBackupFolder(drive);
			// Search for file inside the folder
			const searchResponse = await drive.files.list({
				q: `name='${fileName}' and trashed=false and '${folderId}' in parents`,
				fields: "files(id, name)",
				spaces: "drive",
			});
			const media = { mimeType, body: fileContent };
			let response;
			if (searchResponse.data.files && searchResponse.data.files.length > 0) {
				// If duplicates exist, keep first and remove the rest
				const [first, ...dupes] = searchResponse.data.files;
				for (const d of dupes) {
					try {
						await drive.files.delete({ fileId: d.id });
					} catch {}
				}
				response = await drive.files.update({
					fileId: first.id,
					media,
					fields: "id, name, modifiedTime",
				});
			} else {
				response = await drive.files.create({
					requestBody: { name: fileName, parents: [folderId] },
					media,
					fields: "id, name, modifiedTime",
				});
			}
			this.config.googleDrive.lastSync = new Date().toISOString();
			this.saveConfig();
			return {
				success: true,
				fileId: response.data.id,
				fileName: response.data.name,
				modifiedTime: response.data.modifiedTime,
			};
		} catch (e) {
			console.error("Error uploading to Google Drive:", e);
			return { success: false, error: e.message };
		}
	}

	async downloadFromGoogleDrive(fileName) {
		try {
			const google = this._getGoogle();
			if (!this.googleAuth || !this.config.googleDrive.enabled)
				throw new Error("Google Drive not authenticated");
			const drive = google.drive({ version: "v3", auth: this.googleAuth });
			const folderId = await this._ensureGoogleBackupFolder(drive);
			const searchResponse = await drive.files.list({
				q: `name='${fileName}' and trashed=false and '${folderId}' in parents`,
				fields: "files(id, name)",
				spaces: "drive",
			});
			if (
				!searchResponse.data.files ||
				searchResponse.data.files.length === 0
			) {
				return { success: false, error: "File not found" };
			}
			const fileId = searchResponse.data.files[0].id;
			const response = await drive.files.get(
				{ fileId, alt: "media" },
				{ responseType: "text" }
			);
			return { success: true, content: response.data };
		} catch (e) {
			console.error("Error downloading from Google Drive:", e);
			return { success: false, error: e.message };
		}
	}

	disconnectGoogleDrive() {
		this.config.googleDrive.enabled = false;
		this.config.googleDrive.tokens = null;
		this.config.googleDrive.lastSync = null;
		this.saveConfig();
		this.googleAuth = null;
		try {
			this._keytarDelete("googleDrive");
		} catch {}
	}

	// ---------- OneDrive ----------
	async initOneDrive(clientId) {
		if (this.ONEDRIVE_DISABLED) {
			console.warn("OneDrive is currently disabled.");
			return false;
		}
		try {
			const msalConfig = {
				auth: {
					clientId,
					authority: "https://login.microsoftonline.com/common",
				},
			};
			this.msalInstance = new PublicClientApplication(msalConfig);
			this.config.oneDrive.clientId = clientId;
			this.saveConfig();
			return true;
		} catch (e) {
			console.error("Error initializing OneDrive:", e);
			return false;
		}
	}

	async startOneDriveLoopbackAuth() {
		if (!this.msalInstance) throw new Error("OneDrive not initialized");

		this._onedriveLoopbackPromise = new Promise(
			(resolve) => (this._resolveOnedriveLoopback = resolve)
		);

		let listenHost = "localhost";
		const expectedPath = "/";
		let listenPort = 0; // ephemeral

		this._onedriveExpectedPath = expectedPath;
		this._onedriveLoopbackServer = http.createServer(async (req, res) => {
			try {
				const parsed = url.parse(req.url, true);
				const pathOk =
					parsed.pathname === this._onedriveExpectedPath ||
					parsed.pathname === "/" ||
					parsed.pathname === "";
				if (!pathOk) {
					res.writeHead(404, { "Content-Type": "text/plain" });
					res.end("Not found");
					return;
				}
				if (parsed.query && parsed.query.code) {
					const code = String(parsed.query.code);
					try {
						const tokenRequest = {
							code,
							scopes: ["Files.ReadWrite", "User.Read"],
							redirectUri: this._onedriveRedirectUri,
						};
						const response = await this.msalInstance.acquireTokenByCode(
							tokenRequest
						);
						this.config.oneDrive.tokens = response;
						this.config.oneDrive.enabled = true;
						this.saveConfig();
						res.writeHead(200, { "Content-Type": "text/html" });
						res.end(this._renderSuccessHTML("OneDrive"));
						this._resolveOnedriveLoopback(true);
					} catch (e) {
						console.error("OneDrive token exchange failed:", e);
						res.writeHead(500, { "Content-Type": "text/html" });
						res.end(
							'<html><body style="font-family:sans-serif"><h2>Authentication failed</h2><p>Please return to the app and try again.</p></body></html>'
						);
						this._resolveOnedriveLoopback(false);
					}
				} else {
					res.writeHead(400, { "Content-Type": "text/plain" });
					res.end("Missing code");
				}
			} finally {
				try {
					this._onedriveLoopbackServer.close();
				} catch {}
				this._onedriveLoopbackServer = null;
			}
		});

		await new Promise((resolve, reject) => {
			try {
				this._onedriveLoopbackServer.listen(listenPort, listenHost, resolve);
			} catch (e) {
				reject(e);
			}
		});
		const addr = this._onedriveLoopbackServer.address();
		const port = typeof addr === "object" && addr ? addr.port : 3000;
		this._onedriveRedirectUri = `http://${listenHost}:${port}`;
		console.log("OneDrive loopback auth listening:", {
			host: listenHost,
			port,
			path: expectedPath,
			redirectUri: this._onedriveRedirectUri,
		});

		const authCodeUrlParameters = {
			scopes: ["Files.ReadWrite", "User.Read"],
			redirectUri: this._onedriveRedirectUri,
		};
		const authUrl = await this.msalInstance.getAuthCodeUrl(
			authCodeUrlParameters
		);
		return authUrl;
	}

	waitOneDriveLoopbackAuthComplete() {
		if (!this._onedriveLoopbackPromise) return Promise.resolve(false);
		const TIMEOUT_MS = 180000; // 3 minutes
		return Promise.race([
			this._onedriveLoopbackPromise,
			new Promise((resolve) =>
				setTimeout(() => {
					console.warn("OneDrive loopback auth timed out");
					try {
						this._onedriveLoopbackServer &&
							this._onedriveLoopbackServer.close();
					} catch {}
					this._onedriveLoopbackServer = null;
					resolve(false);
				}, TIMEOUT_MS)
			),
		]);
	}

	async getOneDriveAuthUrl() {
		try {
			if (!this.msalInstance) throw new Error("OneDrive not initialized");
			const authCodeUrlParameters = {
				scopes: ["Files.ReadWrite", "User.Read"],
				redirectUri: "http://localhost:3000/auth/callback",
			};
			const authUrl = await this.msalInstance.getAuthCodeUrl(
				authCodeUrlParameters
			);
			return authUrl;
		} catch (e) {
			console.error("Error getting OneDrive auth URL:", e);
			throw e;
		}
	}

	async setOneDriveAuthCode(code) {
		try {
			const tokenRequest = {
				code,
				scopes: ["Files.ReadWrite", "User.Read"],
				redirectUri: "http://localhost:3000/auth/callback",
			};
			const response = await this.msalInstance.acquireTokenByCode(tokenRequest);
			this.config.oneDrive.tokens = response;
			this.config.oneDrive.enabled = true;
			this.saveConfig();
			this.oneDriveClient = Client.init({
				authProvider: (done) => done(null, response.accessToken),
			});
			return true;
		} catch (e) {
			console.error("Error setting OneDrive auth code:", e);
			return false;
		}
	}

	async uploadToOneDrive(fileName, fileContent) {
		try {
			if (!this.oneDriveClient || !this.config.oneDrive.enabled) {
				if (this.config.oneDrive.tokens) {
					this.oneDriveClient = Client.init({
						authProvider: (done) =>
							done(null, this.config.oneDrive.tokens.accessToken),
					});
				} else {
					throw new Error("OneDrive not authenticated");
				}
			}
			const uploadPath = `/me/drive/root:/DiaryBackup/${fileName}:/content`;
			const response = await this.oneDriveClient
				.api(uploadPath)
				.put(fileContent);
			this.config.oneDrive.lastSync = new Date().toISOString();
			this.saveConfig();
			return {
				success: true,
				fileId: response.id,
				fileName: response.name,
				modifiedTime: response.lastModifiedDateTime,
			};
		} catch (e) {
			console.error("Error uploading to OneDrive:", e);
			return { success: false, error: e.message };
		}
	}

	async downloadFromOneDrive(fileName) {
		try {
			if (!this.oneDriveClient || !this.config.oneDrive.enabled) {
				if (this.config.oneDrive.tokens) {
					this.oneDriveClient = Client.init({
						authProvider: (done) =>
							done(null, this.config.oneDrive.tokens.accessToken),
					});
				} else {
					throw new Error("OneDrive not authenticated");
				}
			}
			const downloadPath = `/me/drive/root:/DiaryBackup/${fileName}:/content`;
			const response = await this.oneDriveClient.api(downloadPath).get();
			return { success: true, content: response };
		} catch (e) {
			console.error("Error downloading from OneDrive:", e);
			return { success: false, error: e.message };
		}
	}

	disconnectOneDrive() {
		this.config.oneDrive.enabled = false;
		this.config.oneDrive.tokens = null;
		this.config.oneDrive.lastSync = null;
		this.saveConfig();
		this.oneDriveClient = null;
		this.msalInstance = null;
	}

	// ---------- Common ----------
	getCloudStatus() {
		return {
			googleDrive: {
				enabled: this.config.googleDrive.enabled,
				lastSync: this.config.googleDrive.lastSync,
			},
			oneDrive: { enabled: false, lastSync: null },
			dropbox: {
				enabled: this.config.dropbox?.enabled || false,
				lastSync: this.config.dropbox?.lastSync || null,
			},
			autoSync: this.config.autoSync,
		};
	}

	setAutoSync(enabled) {
		this.config.autoSync = enabled;
		this.saveConfig();
	}

	async syncToCloud(entries) {
		const results = { googleDrive: null, oneDrive: null, dropbox: null };
		const backupData = JSON.stringify(entries, null, 2);
		const fileName = `diary-backup-${
			new Date().toISOString().split("T")[0]
		}.json`;
		if (this.config.googleDrive.enabled) {
			results.googleDrive = await this.uploadToGoogleDrive(
				fileName,
				backupData
			);
		}
		if (!this.ONEDRIVE_DISABLED && this.config.oneDrive.enabled) {
			results.oneDrive = await this.uploadToOneDrive(fileName, backupData);
		}
		if (this.config.dropbox?.enabled) {
			results.dropbox = await this.uploadToDropbox(fileName, backupData);
		}
		return {
			...results,
			meta: {
				fileName,
				entryCount: Array.isArray(entries) ? entries.length : 0,
			},
		};
	}

	// ---------- Dropbox ----------
	hasDropboxTokenFile() {
		return fs.existsSync(this.dropboxTokenPath);
	}

	getDropboxTokenDir() {
		return this.dropboxOAuthDir;
	}

	readDropboxTokenFromFile() {
		if (!this.hasDropboxTokenFile()) return null;
		try {
			const raw = fs.readFileSync(this.dropboxTokenPath, "utf8");
			const parsed = JSON.parse(raw);
			return parsed?.accessToken || null;
		} catch (e) {
			console.error("Failed to read Dropbox token file:", e);
			return null;
		}
	}

	attemptBootstrapDropboxTokenFromRepo() {
		try {
			const candidates = [
				path.join(__dirname, "..", "src", "api-key", "dropbox.json"),
				path.join(process.cwd(), "src", "api-key", "dropbox.json"),
				path.join(__dirname, "..", "src", "api-keys", "dropbox.json"),
				path.join(process.cwd(), "src", "api-keys", "dropbox.json"),
				path.join(process.cwd(), "api-key", "dropbox.json"),
				path.join(process.cwd(), "api-keys", "dropbox.json"),
			];
			for (const full of candidates) {
				if (fs.existsSync(full) && fs.statSync(full).isFile()) {
					try {
						const raw = fs.readFileSync(full, "utf8");
						const parsed = JSON.parse(raw);
						if (
							parsed &&
							typeof parsed.accessToken === "string" &&
							parsed.accessToken.length > 0
						) {
							this.ensureOauthDirs();
							fs.writeFileSync(
								this.dropboxTokenPath,
								JSON.stringify(parsed, null, 2),
								"utf8"
							);
							console.log(
								`Bootstrapped Dropbox token from ${full} to ${this.dropboxTokenPath}`
							);
							return true;
						}
					} catch {
						// ignore invalid json
					}
				}
			}
		} catch (e) {
			console.warn(
				"Bootstrap from src/api-key (Dropbox) failed:",
				e?.message || e
			);
		}
		return false;
	}

	bootstrapDropboxTokenFromRepo() {
		return this.attemptBootstrapDropboxTokenFromRepo();
	}

	_readEmbeddedDropboxConfig() {
		try {
			if (!fs.existsSync(this.embeddedConfigPath)) return null;
			const raw = fs.readFileSync(this.embeddedConfigPath, "utf8");
			const parsed = JSON.parse(raw);
			return parsed?.dropbox || null;
		} catch (e) {
			return null;
		}
	}

	getDropboxCredentialsSource() {
		try {
			if (this._readEmbeddedDropboxConfig()?.appKey) return "embedded";
			if (this.hasDropboxTokenFile()) return "file";
			return "none";
		} catch {
			return "none";
		}
	}

	async initDropbox(token) {
		try {
			let accessToken = token || this.readDropboxTokenFromFile();
			if (!accessToken && this.attemptBootstrapDropboxTokenFromRepo()) {
				accessToken = this.readDropboxTokenFromFile();
			}
			if (!accessToken) {
				throw new Error(
					"Missing Dropbox accessToken. Place dropbox.json with { accessToken } in the OAuth folder or connect via OAuth."
				);
			}
			this.dropboxClient = new Dropbox({ accessToken });
			this.config.dropbox = this.config.dropbox || {
				enabled: false,
				token: null,
				lastSync: null,
			};
			this.config.dropbox.token = accessToken;
			this.config.dropbox.enabled = true;
			this.saveConfig();
			return true;
		} catch (e) {
			console.error("Error initializing Dropbox:", e);
			return false;
		}
	}

	async startDropboxLoopbackAuth() {
		const cfg = this._readEmbeddedDropboxConfig();
		if (!cfg?.appKey) throw new Error("Dropbox appKey not configured");
		this._dropboxLoopbackPromise = new Promise(
			(resolve) => (this._resolveDropboxLoopback = resolve)
		);

		let listenHost = "127.0.0.1";
		const expectedPath = "/auth/callback";
		let listenPort = 0; // ephemeral

		const createServer = () =>
			http.createServer(async (req, res) => {
				try {
					const parsed = url.parse(req.url, true);
					const okPath =
						parsed.pathname === expectedPath ||
						parsed.pathname === "/" ||
						parsed.pathname === "";
					if (!okPath) {
						res.writeHead(404, { "Content-Type": "text/plain" });
						res.end("Not found");
						return;
					}
					if (parsed.query && parsed.query.code) {
						const code = String(parsed.query.code);
						try {
							const refresh = await this._dropboxExchangeAuthCode(
								cfg,
								code,
								this._dropboxCodeVerifier,
								this._dropboxRedirectUri
							);
							if (!refresh) throw new Error("No refresh token returned");
							await this._keytarSet("dropbox", refresh);
							this.config.dropbox = this.config.dropbox || {
								enabled: false,
								token: null,
								lastSync: null,
							};
							this.config.dropbox.enabled = true;
							this.saveConfig();
							res.writeHead(200, { "Content-Type": "text/html" });
							res.end(this._renderSuccessHTML("Dropbox"));
							this._resolveDropboxLoopback(true);
						} catch (e) {
							console.error("Dropbox token exchange failed:", e);
							res.writeHead(500, { "Content-Type": "text/html" });
							res.end(
								'<html><body style="font-family:sans-serif"><h2>Authentication failed</h2><p>Please return to the app and try again.</p></body></html>'
							);
							this._resolveDropboxLoopback(false);
						}
					} else {
						res.writeHead(400, { "Content-Type": "text/plain" });
						res.end("Missing code");
					}
				} finally {
					try {
						this._dropboxLoopbackServer.close();
					} catch {}
					this._dropboxLoopbackServer = null;
				}
			});

		const tryListen = (host, port) =>
			new Promise((resolve, reject) => {
				this._dropboxLoopbackServer = createServer();
				const onError = (err) => {
					try {
						this._dropboxLoopbackServer?.close();
					} catch {}
					this._dropboxLoopbackServer = null;
					reject(err);
				};
				this._dropboxLoopbackServer.once("error", onError);
				this._dropboxLoopbackServer.listen(port, host, () => {
					this._dropboxLoopbackServer?.off("error", onError);
					resolve(true);
				});
			});

		const hosts = ["127.0.0.1", "localhost"];
		let bound = null;
		for (const h of hosts) {
			try {
				await tryListen(h, listenPort);
				bound = h;
				break;
			} catch {}
			try {
				await tryListen(h, 3000);
				bound = h;
				listenPort = 3000;
				break;
			} catch (e) {
				console.warn("Dropbox loopback bind failed on", h, e?.message || e);
			}
		}
		if (!bound) return null;
		const addr = this._dropboxLoopbackServer.address();
		const port = typeof addr === "object" && addr ? addr.port : 3000;
		this._dropboxRedirectUri =
			cfg.redirect || `http://${bound}:${port}${expectedPath}`;

		// PKCE
		this._dropboxCodeVerifier = this._pkceVerifier();
		const codeChallenge = this._pkceChallenge(this._dropboxCodeVerifier);
		const params = new URLSearchParams({
			response_type: "code",
			client_id: cfg.appKey,
			redirect_uri: this._dropboxRedirectUri,
			token_access_type: "offline",
			code_challenge: codeChallenge,
			code_challenge_method: "S256",
		});
		return `https://www.dropbox.com/oauth2/authorize?${params.toString()}`;
	}

	waitDropboxLoopbackAuthComplete() {
		if (!this._dropboxLoopbackPromise) return Promise.resolve(false);
		const TIMEOUT_MS = 180000; // 3 minutes
		return Promise.race([
			this._dropboxLoopbackPromise,
			new Promise((resolve) =>
				setTimeout(() => {
					console.warn("Dropbox loopback auth timed out");
					try {
						this._dropboxLoopbackServer && this._dropboxLoopbackServer.close();
					} catch {}
					this._dropboxLoopbackServer = null;
					resolve(false);
				}, TIMEOUT_MS)
			),
		]);
	}

	_pkceVerifier() {
		const random = require("crypto").randomBytes(32);
		return random
			.toString("base64")
			.replace(/\+/g, "-")
			.replace(/\//g, "_")
			.replace(/=+$/, "");
	}

	_pkceChallenge(verifier) {
		const crypto = require("crypto");
		const hash = crypto.createHash("sha256").update(verifier).digest("base64");
		return hash.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
	}

	async _dropboxExchangeAuthCode(cfg, code, verifier, redirectUri) {
		const fetch = require("isomorphic-fetch");
		const body = new URLSearchParams({
			grant_type: "authorization_code",
			code,
			client_id: cfg.appKey,
			code_verifier: verifier,
			redirect_uri: redirectUri,
		});
		const resp = await fetch("https://api.dropboxapi.com/oauth2/token", {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body,
		});
		if (!resp.ok) {
			const text = await resp.text();
			throw new Error(`Dropbox token error: ${text}`);
		}
		const json = await resp.json();
		return json.refresh_token || null;
	}

	async _dropboxExchangeRefreshToken(refreshToken) {
		const cfg = this._readEmbeddedDropboxConfig();
		if (!cfg?.appKey) return null;
		const fetch = require("isomorphic-fetch");
		const body = new URLSearchParams({
			grant_type: "refresh_token",
			refresh_token: refreshToken,
			client_id: cfg.appKey,
		});
		const resp = await fetch("https://api.dropboxapi.com/oauth2/token", {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body,
		});
		if (!resp.ok) return null;
		const json = await resp.json();
		return json.access_token || null;
	}

	async uploadToDropbox(fileName, fileContent) {
		try {
			if (!this.dropboxClient) await this._ensureDropboxClientForSync();
			if (!this.dropboxClient || !this.config.dropbox?.enabled)
				throw new Error("Dropbox not authenticated");
			try {
				await this.dropboxClient.filesCreateFolderV2({
					path: "/DiaryBackup",
					autorename: false,
				});
			} catch (e) {
				// ignore if already exists
			}
			const response = await this.dropboxClient.filesUpload({
				path: `/DiaryBackup/${fileName}`,
				contents: Buffer.from(fileContent, "utf8"),
				mode: { ".tag": "overwrite" },
				mute: true,
			});
			this.config.dropbox.lastSync = new Date().toISOString();
			this.saveConfig();
			return {
				success: true,
				fileId: response?.result?.id || response?.id || null,
				fileName,
				modifiedTime: new Date().toISOString(),
			};
		} catch (e) {
			// Provide a more actionable error when missing required scopes
			let message = e?.message || "Dropbox upload failed";
			try {
				const raw = e?.error || e?.response?.error || e?.response?.text;
				const text = typeof raw === "string" ? raw : JSON.stringify(raw);
				if (text && text.includes("files.content.write")) {
					message =
						"Dropbox app is missing the 'files.content.write' scope. Enable it in Dropbox App Console → Permissions, then generate a new access token and update dropbox.json.";
				}
			} catch {}
			console.error("Error uploading to Dropbox:", e);
			return { success: false, error: message };
		}
	}

	async downloadFromDropbox(fileName) {
		try {
			if (!this.dropboxClient) await this._ensureDropboxClientForSync();
			if (!this.dropboxClient || !this.config.dropbox?.enabled)
				throw new Error("Dropbox not authenticated");
			const resp = await this.dropboxClient.filesDownload({
				path: `/DiaryBackup/${fileName}`,
			});
			const fileBinary = resp?.result?.fileBinary || resp?.fileBinary;
			const content = Buffer.isBuffer(fileBinary)
				? fileBinary.toString("utf8")
				: String(fileBinary || "");
			return { success: true, content };
		} catch (e) {
			console.error("Error downloading from Dropbox:", e);
			return { success: false, error: e.message };
		}
	}

	disconnectDropbox() {
		this.config.dropbox = { enabled: false, token: null, lastSync: null };
		this.saveConfig();
		this.dropboxClient = null;
		try {
			this._keytarDelete("dropbox");
		} catch {}
	}
}

module.exports = CloudService;
