import React, { useState, useEffect } from "react";
import {
	Cloud,
	CloudOff,
	RefreshCw,
	Check,
	X,
	AlertCircle,
} from "lucide-react";
import "./CloudSync.css";

interface CloudStatus {
	googleDrive: { enabled: boolean; lastSync: string | null };
	oneDrive: { enabled: boolean; lastSync: string | null };
	dropbox: { enabled: boolean; lastSync: string | null };
	autoSync: boolean;
}

const CloudSync: React.FC = () => {
	const [cloudStatus, setCloudStatus] = useState<CloudStatus>({
		googleDrive: { enabled: false, lastSync: null },
		oneDrive: { enabled: false, lastSync: null },
		dropbox: { enabled: false, lastSync: null },
		autoSync: false,
	});
	const [isSyncing, setIsSyncing] = useState(false);
	const [syncMessage, setSyncMessage] = useState<{
		type: "success" | "error" | "info";
		text: string;
	} | null>(null);
	const [showGoogleSetup, setShowGoogleSetup] = useState(false);
	const [showOneDriveSetup, setShowOneDriveSetup] = useState(false);
	const [oneDriveClientId, setOneDriveClientId] = useState("");
	const [oneDriveStep, setOneDriveStep] = useState<"client" | "waiting">(
		"client"
	);
	const [oneDriveInProgress, setOneDriveInProgress] = useState(false);
	const [oneDriveSucceeded, setOneDriveSucceeded] = useState(false);
	// Dropbox UI state
	const [showDropboxSetup, setShowDropboxSetup] = useState(false);
	const [dropboxInProgress, setDropboxInProgress] = useState(false);
	const [dropboxSucceeded, setDropboxSucceeded] = useState(false);

	// Transient per-service "just synced" indicators
	const [justSynced, setJustSynced] = useState({
		googleDrive: false,
		oneDrive: false,
		dropbox: false,
	});

	// Google auth UI state
	const [authStep, setAuthStep] = useState<"credentials" | "waiting">(
		"credentials"
	);
	const [googleAuthInProgress, setGoogleAuthInProgress] = useState(false);
	const [googleAuthSucceeded, setGoogleAuthSucceeded] = useState(false);
	const isProduction = process.env.NODE_ENV !== "development";

	useEffect(() => {
		loadCloudStatus();
		// Listen for auto-sync results from main process
		const unsub =
			typeof window !== "undefined" &&
			window.electronAPI?.cloud?.onAutoSyncResult
				? window.electronAPI.cloud.onAutoSyncResult((results) => {
						const googleSuccess = !!results?.googleDrive?.success;
						const oneDriveSuccess = !!results?.oneDrive?.success;
						const dropboxSuccess = !!results?.dropbox?.success;
						if (googleSuccess || oneDriveSuccess || dropboxSuccess) {
							const services: string[] = [];
							if (googleSuccess) services.push("Google Drive");
							if (oneDriveSuccess) services.push("OneDrive");
							if (dropboxSuccess) services.push("Dropbox");
							setSyncMessage({
								type: "success",
								text: `✅ Automatically synced to ${services.join(" and ")}!`,
							});
							// Mark per-service just-synced badges
							if (googleSuccess) {
								setJustSynced((prev) => ({ ...prev, googleDrive: true }));
								setTimeout(
									() =>
										setJustSynced((prev) => ({ ...prev, googleDrive: false })),
									2500
								);
							}
							if (oneDriveSuccess) {
								setJustSynced((prev) => ({ ...prev, oneDrive: true }));
								setTimeout(
									() => setJustSynced((prev) => ({ ...prev, oneDrive: false })),
									2500
								);
							}
							if (dropboxSuccess) {
								setJustSynced((prev) => ({ ...prev, dropbox: true }));
								setTimeout(
									() => setJustSynced((prev) => ({ ...prev, dropbox: false })),
									2500
								);
							}
						} else {
							setSyncMessage({
								type: "error",
								text: "❌ Auto-sync failed. Check your connection and try again.",
							});
						}
						loadCloudStatus();
				  })
				: null;
		return () => {
			// No explicit unsubscribe needed since ipcRenderer.on isn't removed here;
			// acceptable for the lifetime of a single window. Left for clarity.
			void unsub;
		};
	}, []);

	const loadCloudStatus = async () => {
		try {
			const status = await window.electronAPI.cloud.getStatus();
			setCloudStatus(status);
		} catch (error) {
			console.error("Error loading cloud status:", error);
		}
	};

	const formatLastSync = (lastSync: string | null) => {
		if (!lastSync) return "Never";
		const date = new Date(lastSync);
		return date.toLocaleString("en-US", {
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	const handleSyncNow = async () => {
		setIsSyncing(true);
		setSyncMessage(null);
		try {
			const results = await window.electronAPI.cloud.syncNow();
			const googleSuccess = !!results?.googleDrive?.success;
			const oneDriveSuccess = !!results?.oneDrive?.success;
			const dropboxSuccess = !!results?.dropbox?.success;
			if (googleSuccess || oneDriveSuccess || dropboxSuccess) {
				const services: string[] = [];
				if (googleSuccess) services.push("Google Drive");
				if (oneDriveSuccess) services.push("OneDrive");
				if (dropboxSuccess) services.push("Dropbox");
				setSyncMessage({
					type: "success",
					text: `✅ Successfully synced to ${services.join(" and ")}!`,
				});
				// Mark per-service just-synced badges (clear after a short delay)
				if (googleSuccess) {
					setJustSynced((prev) => ({ ...prev, googleDrive: true }));
					setTimeout(
						() => setJustSynced((prev) => ({ ...prev, googleDrive: false })),
						2500
					);
				}
				if (oneDriveSuccess) {
					setJustSynced((prev) => ({ ...prev, oneDrive: true }));
					setTimeout(
						() => setJustSynced((prev) => ({ ...prev, oneDrive: false })),
						2500
					);
				}
				if (dropboxSuccess) {
					setJustSynced((prev) => ({ ...prev, dropbox: true }));
					setTimeout(
						() => setJustSynced((prev) => ({ ...prev, dropbox: false })),
						2500
					);
				}
			} else {
				const errs: string[] = [];
				if (results?.googleDrive?.error) errs.push(results.googleDrive.error);
				if (results?.dropbox?.error) errs.push(results.dropbox.error);
				if (results?.oneDrive?.error) errs.push(results.oneDrive.error);
				const detail = errs.filter(Boolean).join(" | ");
				setSyncMessage({
					type: "error",
					text: detail?.length
						? `❌ Sync failed: ${detail}`
						: "❌ Sync failed. Please check your connection and try again.",
				});
			}
			await loadCloudStatus();
		} catch (error) {
			console.error("Sync error:", error);
			setSyncMessage({
				type: "error",
				text: "❌ Sync failed. Please try again.",
			});
		} finally {
			setIsSyncing(false);
		}
	};

	const handleAutoSyncToggle = async (enabled: boolean) => {
		try {
			await window.electronAPI.cloud.setAutoSync(enabled);
			setCloudStatus((prev) => ({ ...prev, autoSync: enabled }));
		} catch (error) {
			console.error("Error toggling auto-sync:", error);
		}
	};

	// Google Drive Setup
	const startGoogleLoopbackFlow = async () => {
		// Initialize and start loopback auth, open URL, wait for completion
		await window.electronAPI.cloud.googleInit?.();
		const loopUrl = await window.electronAPI.cloud.googleStartLoopbackAuth?.();
		if (!loopUrl) {
			setSyncMessage({
				type: "error",
				text: "Couldn't start Google authorization. Check your credentials JSON redirect URIs and try again.",
			});
			setAuthStep("credentials");
			return false;
		}
		setAuthStep("waiting");
		setGoogleAuthInProgress(true);
		await window.electronAPI.cloud.openExternalUrl(loopUrl);
		const ok = await window.electronAPI.cloud.googleWaitLoopback?.();
		setGoogleAuthInProgress(false);
		if (ok) {
			setGoogleAuthSucceeded(true);
			setSyncMessage({
				type: "success",
				text: "✅ Google Drive connected successfully!",
			});
			await loadCloudStatus();
			setTimeout(() => {
				setShowGoogleSetup(false);
				setGoogleAuthSucceeded(false);
			}, 900);
			return true;
		}
		setSyncMessage({
			type: "error",
			text: "Authorization didn't complete. You can click Connect again to retry.",
		});
		return false;
	};

	const handleGoogleSetup = () => {
		setShowGoogleSetup(true);
		(async () => {
			try {
				let hasFile =
					await window.electronAPI.cloud.googleHasCredentialsFile?.();
				if (
					!hasFile &&
					!isProduction &&
					window.electronAPI.cloud.googleBootstrapCredentials
				) {
					hasFile = await window.electronAPI.cloud.googleBootstrapCredentials();
				}
				if (hasFile) {
					const ok = await startGoogleLoopbackFlow();
					if (!ok) {
						// If automatic flow didn't complete, keep waiting UI so user can click Connect again
						setAuthStep("waiting");
					}
					return;
				}
				setAuthStep("credentials");
			} catch {
				setAuthStep("credentials");
			}
		})();
	};

	const handleGoogleDisconnect = async () => {
		if (
			confirm(
				"Are you sure you want to disconnect Google Drive? Your journals will remain safe locally."
			)
		) {
			try {
				await window.electronAPI.cloud.googleDisconnect();
				setSyncMessage({ type: "info", text: "Google Drive disconnected." });
				await loadCloudStatus();
			} catch (error) {
				console.error("Error disconnecting Google Drive:", error);
			}
		}
	};

	// Dropbox: automatic connect using token file (no user input)
	const attemptDropboxConnect = async () => {
		try {
			setDropboxSucceeded(false);
			setDropboxInProgress(true);
			let hasFile = await window.electronAPI.cloud.dropboxHasTokenFile?.();
			if (
				!hasFile &&
				!isProduction &&
				window.electronAPI.cloud.dropboxBootstrapToken
			) {
				hasFile = await window.electronAPI.cloud.dropboxBootstrapToken();
			}
			let ok = false;
			if (hasFile) {
				ok = (await window.electronAPI.cloud.dropboxInit?.()) ?? false;
			}
			setDropboxInProgress(false);
			if (ok) {
				setDropboxSucceeded(true);
				setSyncMessage({
					type: "success",
					text: "✅ Dropbox connected successfully!",
				});
				await loadCloudStatus();
				setTimeout(() => {
					setShowDropboxSetup(false);
					setDropboxSucceeded(false);
				}, 900);
			} else {
				setSyncMessage({
					type: "error",
					text: "Couldn't connect to Dropbox. Ensure dropbox.json exists in the OAuth folder and try again.",
				});
			}
		} catch (e) {
			console.error(e);
			setDropboxInProgress(false);
			alert("Connection failed. Please try again.");
		}
	};

	const handleDropboxSetup = () => {
		setShowDropboxSetup(true);
		// Start automatic attempt once modal opens
		setTimeout(() => {
			attemptDropboxConnect();
		}, 0);
	};

	// OneDrive Setup (kept for potential future re-enable)
	const handleOneDriveCredentialsSubmit = async () => {
		try {
			const success = await window.electronAPI.cloud.oneDriveInit(
				oneDriveClientId
			);
			if (!success) {
				alert("Failed to initialize OneDrive. Please check your Client ID.");
				return;
			}
			// Start loopback flow
			const loopUrl =
				await window.electronAPI.cloud.oneDriveStartLoopbackAuth?.();
			if (!loopUrl) {
				setSyncMessage({
					type: "error",
					text: "Couldn't start OneDrive authorization. Check your Azure app redirect URI (http://localhost) and try again.",
				});
				setOneDriveStep("client");
				return;
			}
			setOneDriveStep("waiting");
			setOneDriveInProgress(true);
			await window.electronAPI.cloud.openExternalUrl(loopUrl);
			const ok = await window.electronAPI.cloud.oneDriveWaitLoopback?.();
			setOneDriveInProgress(false);
			if (ok) {
				setOneDriveSucceeded(true);
				setSyncMessage({
					type: "success",
					text: "✅ OneDrive connected successfully!",
				});
				await loadCloudStatus();
				setTimeout(() => {
					setShowOneDriveSetup(false);
					setOneDriveSucceeded(false);
					setOneDriveStep("client");
				}, 900);
			} else {
				setSyncMessage({
					type: "error",
					text: "OneDrive authorization didn't complete. You can click Connect again to retry.",
				});
			}
		} catch (error) {
			console.error("Error initializing OneDrive:", error);
			alert("Failed to initialize OneDrive. Please try again.");
		}
	};

	// Note: disconnect handler omitted while OneDrive UI is hidden

	return (
		<div className="cloud-sync">
			<div className="cloud-sync-header">
				<Cloud size={24} />
				<h2>Cloud Sync</h2>
			</div>

			{syncMessage && (
				<div className={`sync-message ${syncMessage.type}`}>
					{syncMessage.type === "success" && <Check size={16} />}
					{syncMessage.type === "error" && <X size={16} />}
					{syncMessage.type === "info" && <AlertCircle size={16} />}
					<span>{syncMessage.text}</span>
				</div>
			)}

			{/* Google Drive Section */}
			<div className="cloud-service">
				<div className="service-header">
					<div className="service-info">
						<h3>
							<span
								style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
							>
								<img
									src="/drive.svg"
									alt="Google Drive"
									width={20}
									height={20}
									style={{ display: "block" }}
									draggable={false}
								/>
								<span>Google Drive</span>
							</span>
						</h3>
						<p>
							{cloudStatus.googleDrive.enabled
								? `Last sync: ${formatLastSync(
										cloudStatus.googleDrive.lastSync
								  )}`
								: "Not connected"}
						</p>
					</div>
					<div className="service-status">
						{cloudStatus.googleDrive.enabled ? (
							<>
								<span className="status-badge connected">
									<Check size={14} />
									Connected
								</span>
								{justSynced.googleDrive && (
									<span className="status-badge just-synced">Just synced</span>
								)}
								<button
									className="btn btn-secondary btn-sm"
									onClick={handleGoogleDisconnect}
								>
									<CloudOff size={14} />
									Disconnect
								</button>
							</>
						) : (
							<button
								className="btn btn-primary btn-sm"
								onClick={handleGoogleSetup}
							>
								<Cloud size={14} />
								Connect
							</button>
						)}
					</div>
				</div>
			</div>

			{/* OneDrive Section hidden for now */}

			{/* Dropbox Section */}
			<div className="cloud-service">
				<div className="service-header">
					<div className="service-info">
						<h3>
							<span
								style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
							>
								<img
									src="/dropbox.svg"
									alt="Dropbox"
									width={20}
									height={20}
									style={{ display: "block" }}
									draggable={false}
								/>
								<span>Dropbox</span>
							</span>
						</h3>
						<p>
							{cloudStatus.dropbox.enabled
								? `Last sync: ${formatLastSync(cloudStatus.dropbox.lastSync)}`
								: "Not connected"}
						</p>
					</div>
					<div className="service-status">
						{cloudStatus.dropbox.enabled ? (
							<>
								<span className="status-badge connected">
									<Check size={14} />
									Connected
								</span>
								{justSynced.dropbox && (
									<span className="status-badge just-synced">Just synced</span>
								)}
								<button
									className="btn btn-secondary btn-sm"
									onClick={async () => {
										if (
											confirm(
												"Are you sure you want to disconnect Dropbox? Your journals will remain safe locally."
											)
										) {
											await window.electronAPI.cloud.dropboxDisconnect();
											setSyncMessage({
												type: "info",
												text: "Dropbox disconnected.",
											});
											await loadCloudStatus();
										}
									}}
								>
									<CloudOff size={14} />
									Disconnect
								</button>
							</>
						) : (
							<button
								className="btn btn-primary btn-sm"
								onClick={handleDropboxSetup}
							>
								<Cloud size={14} />
								Connect
							</button>
						)}
					</div>
				</div>
			</div>

			{/* Sync Controls */}
			<div className="sync-controls">
				<div className="setting-item">
					<div className="setting-info">
						<h3>Auto Sync</h3>
						<p>Automatically sync your journals every hour</p>
					</div>
					<label className="toggle-switch">
						<input
							type="checkbox"
							checked={cloudStatus.autoSync}
							onChange={(e) => handleAutoSyncToggle(e.target.checked)}
							disabled={
								!cloudStatus.googleDrive.enabled &&
								!cloudStatus.oneDrive.enabled &&
								!cloudStatus.dropbox.enabled
							}
						/>
						<span className="toggle-slider"></span>
					</label>
				</div>

				<button
					className="btn btn-primary sync-now-btn"
					onClick={handleSyncNow}
					disabled={
						isSyncing ||
						(!cloudStatus.googleDrive.enabled &&
							!cloudStatus.oneDrive.enabled &&
							!cloudStatus.dropbox.enabled)
					}
				>
					<RefreshCw size={16} className={isSyncing ? "spinning" : ""} />
					{isSyncing ? "Syncing..." : "Sync Now"}
				</button>
			</div>

			{/* Google Drive Setup Modal */}
			{showGoogleSetup && (
				<div
					className="modal-overlay"
					onClick={() => setShowGoogleSetup(false)}
				>
					<div className="modal-content" onClick={(e) => e.stopPropagation()}>
						<h3>Connect Google Drive</h3>

						{authStep === "credentials" && (
							<div className="setup-step">
								{!isProduction ? (
									<>
										<p>
											To connect Google Drive in development, place your OAuth
											client JSON inside <strong>src/api-key</strong> or{" "}
											<strong>src/api-keys</strong>. We'll detect it
											automatically.
										</p>
										<ol>
											<li>
												Create an OAuth 2.0 Client ID in Google Cloud Console
											</li>
											<li>Download the credentials JSON file</li>
											<li>Place the JSON file in the folder above</li>
											<li>Click Rescan</li>
										</ol>
									</>
								) : (
									<>
										<p>
											To connect Google Drive, copy your OAuth credentials JSON
											into the OAuth folder and click Rescan. We'll finish the
											setup automatically.
										</p>
										<ol>
											<li>Click "Open OAuth Folder"</li>
											<li>
												Place your credentials JSON as{" "}
												<code>credentials.json</code>
											</li>
											<li>Return here and click Rescan</li>
										</ol>
									</>
								)}
								<div className="modal-actions">
									<button
										className="btn btn-secondary"
										onClick={() => setShowGoogleSetup(false)}
									>
										Cancel
									</button>
									{isProduction && (
										<button
											className="btn btn-outline"
											onClick={async () => {
												try {
													// Reveal the OAuth directory so user can drop the file
													await window.electronAPI.cloud.googleOpenCredentialsDir();
												} catch (e) {
													console.error(e);
												}
											}}
										>
											Open OAuth Folder
										</button>
									)}
									<button
										className="btn btn-primary"
										onClick={async () => {
											try {
												let hasFile =
													await window.electronAPI.cloud.googleHasCredentialsFile?.();
												if (
													!hasFile &&
													!isProduction &&
													window.electronAPI.cloud.googleBootstrapCredentials
												) {
													hasFile =
														await window.electronAPI.cloud.googleBootstrapCredentials();
												}
												if (hasFile) {
													const ok = await startGoogleLoopbackFlow();
													if (!ok) setAuthStep("waiting");
												} else {
													alert(
														isProduction
															? "credentials.json not found in OAuth folder. Click Open OAuth Folder, add the file, then Rescan."
															: "Couldn't find credentials in src/api-key or src/api-keys. Ensure the JSON file exists and try again."
													);
												}
											} catch (e) {
												console.error(e);
												alert("Scan failed. Please try again.");
											}
										}}
									>
										Rescan
									</button>
								</div>
							</div>
						)}

						{authStep === "waiting" && (
							<div className="setup-step" style={{ textAlign: "center" }}>
								<p>
									A browser window should have opened for authorization. You can
									close that tab once it finishes. We'll complete the setup
									automatically.
								</p>
								<div style={{ margin: "16px 0" }}>
									{googleAuthSucceeded ? (
										<>
											<Check size={32} />
											<p>Connected!</p>
										</>
									) : (
										<>
											<RefreshCw size={24} className={"spinning"} />
											<p>Waiting for authorization…</p>
										</>
									)}
								</div>
								<div className="modal-actions">
									<button
										className="btn btn-secondary"
										onClick={() => setShowGoogleSetup(false)}
									>
										Cancel
									</button>
									<button
										className="btn btn-primary"
										onClick={startGoogleLoopbackFlow}
										disabled={googleAuthInProgress}
									>
										Connect
									</button>
								</div>
							</div>
						)}
					</div>
				</div>
			)}

			{/* Dropbox Setup Modal */}
			{showDropboxSetup && (
				<div
					className="modal-overlay"
					onClick={() => setShowDropboxSetup(false)}
				>
					<div className="modal-content" onClick={(e) => e.stopPropagation()}>
						<h3>Connect Dropbox</h3>
						<div className="setup-step" style={{ textAlign: "center" }}>
							<div style={{ margin: "16px 0" }}>
								{dropboxSucceeded ? (
									<>
										<Check size={32} />
										<p>Connected!</p>
									</>
								) : (
									<>
										<RefreshCw size={24} className={"spinning"} />
										<p>Connecting to Dropbox…</p>
									</>
								)}
							</div>
							<div className="modal-actions">
								<button
									className="btn btn-secondary"
									onClick={() => setShowDropboxSetup(false)}
								>
									Cancel
								</button>
								<button
									className="btn btn-primary"
									onClick={attemptDropboxConnect}
									disabled={dropboxInProgress}
								>
									Connect
								</button>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* OneDrive Setup Modal */}
			{showOneDriveSetup && (
				<div
					className="modal-overlay"
					onClick={() => setShowOneDriveSetup(false)}
				>
					<div className="modal-content" onClick={(e) => e.stopPropagation()}>
						<h3>Connect OneDrive</h3>
						{oneDriveStep === "client" && (
							<div className="setup-step">
								<p>To connect OneDrive, you need to register an application:</p>
								<ol>
									<li>
										Go to
										<a
											href="#"
											onClick={(e) => {
												e.preventDefault();
												window.electronAPI.cloud.openExternalUrl(
													"https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade"
												);
											}}
										>
											{" "}
											Azure App Registrations
										</a>
									</li>
									<li>Create a new registration</li>
									<li>
										Add redirect URI: http://localhost/auth/callback (or
										http://localhost:PORT/auth/callback)
									</li>
									<li>Copy the Application (client) ID</li>
									<li>Paste it below:</li>
								</ol>
								<input
									type="text"
									placeholder="Application (client) ID"
									value={oneDriveClientId}
									onChange={(e) => setOneDriveClientId(e.target.value)}
								/>
								<div className="modal-actions">
									<button
										className="btn btn-secondary"
										onClick={() => setShowOneDriveSetup(false)}
									>
										Cancel
									</button>
									<button
										className="btn btn-primary"
										onClick={handleOneDriveCredentialsSubmit}
										disabled={!oneDriveClientId}
									>
										Connect
									</button>
								</div>
							</div>
						)}

						{oneDriveStep === "waiting" && (
							<div className="setup-step" style={{ textAlign: "center" }}>
								<p>
									A browser window should have opened for authorization. You can
									close that tab once it finishes. We'll complete the setup
									automatically.
								</p>
								<div style={{ margin: "16px 0" }}>
									{oneDriveSucceeded ? (
										<>
											<Check size={32} />
											<p>Connected!</p>
										</>
									) : (
										<>
											<RefreshCw size={24} className={"spinning"} />
											<p>Waiting for authorization…</p>
										</>
									)}
								</div>
								<div className="modal-actions">
									<button
										className="btn btn-secondary"
										onClick={() => setShowOneDriveSetup(false)}
									>
										Cancel
									</button>
									<button
										className="btn btn-primary"
										onClick={handleOneDriveCredentialsSubmit}
										disabled={oneDriveInProgress}
									>
										Connect
									</button>
								</div>
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
};

export default CloudSync;
