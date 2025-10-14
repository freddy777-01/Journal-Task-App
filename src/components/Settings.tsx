import React, { useState, useEffect } from "react";
import {
	Moon,
	Sun,
	Monitor,
	Download,
	Upload,
	RefreshCw,
	Palette,
	Database,
	Shield,
	Bell,
} from "lucide-react";
import { useTheme } from "../hooks/useTheme";
import { useSettings } from "../hooks/useSettings";
import CloudSync from "./CloudSync";
import "./Settings.css";

const Settings: React.FC = () => {
	const { theme, setThemeMode } = useTheme();
	const { settings, updateFontSize, updateFontFamily, updateAutoSave } =
		useSettings();
	const [isExporting, setIsExporting] = useState(false);
	const [isImporting, setIsImporting] = useState(false);
	const [updateAvailable, setUpdateAvailable] = useState(false);

	useEffect(() => {
		// Listen for update notifications
		if (window.electronAPI?.update) {
			window.electronAPI.update.onUpdateAvailable(() => {
				setUpdateAvailable(true);
			});
		}
	}, []);

	const handleExport = async (format: "json" | "html" = "json") => {
		setIsExporting(true);
		try {
			const filePath = await window.electronAPI.file.exportEntries(format);
			if (filePath) {
				const formatName = format === "html" ? "HTML" : "JSON";
				alert(
					`✅ Entries exported successfully as ${formatName}!\n\nSaved to: ${filePath}\n\nNote: All images are embedded in the export file.`
				);
			} else {
				alert(
					"⚠️ No entries to export.\n\nPlease create some journal entries first before exporting."
				);
			}
		} catch (error) {
			console.error("Export failed:", error);
			alert("❌ Export failed. Please try again.");
		} finally {
			setIsExporting(false);
		}
	};

	const handleImport = async () => {
		setIsImporting(true);
		try {
			const count = await window.electronAPI.file.importEntries();
			if (count !== null) {
				alert(`Successfully imported ${count} entries`);
				// Refresh the app to show imported entries
				window.location.reload();
			}
		} catch (error) {
			console.error("Import failed:", error);
			alert("Import failed. Please try again.");
		} finally {
			setIsImporting(false);
		}
	};

	const handleUpdate = async () => {
		if (window.electronAPI?.update) {
			await window.electronAPI.update.restartApp();
		}
	};

	const fontOptions = [
		"Inter",
		"Arial",
		"Helvetica",
		"Times New Roman",
		"Georgia",
		"Verdana",
		"Courier New",
		"Monaco",
	];

	return (
		<div className="settings">
			<div className="settings-header">
				<h1>Settings</h1>
				<p>Customize your journaling experience</p>
			</div>

			<div className="settings-content">
				<div className="settings-section">
					<div className="section-header">
						<Palette size={20} />
						<h2>Appearance</h2>
					</div>

					<div className="setting-item">
						<div className="setting-info">
							<h3>Theme</h3>
							<p>Choose your preferred color scheme</p>
						</div>
						<div className="theme-options">
							<button
								className={`theme-option ${theme === "light" ? "active" : ""}`}
								onClick={() => setThemeMode("light")}
							>
								<Sun size={16} />
								Light
							</button>
							<button
								className={`theme-option ${theme === "dark" ? "active" : ""}`}
								onClick={() => setThemeMode("dark")}
							>
								<Moon size={16} />
								Dark
							</button>
							<button
								className={`theme-option ${theme === "system" ? "active" : ""}`}
								onClick={() => setThemeMode("system")}
							>
								<Monitor size={16} />
								System
							</button>
						</div>
					</div>

					<div className="setting-item">
						<div className="setting-info">
							<h3>Font Size</h3>
							<p>Adjust the text size in your entries</p>
						</div>
						<div className="font-size-control">
							<input
								type="range"
								min="12"
								max="24"
								value={settings.fontSize}
								onChange={(e) => updateFontSize(Number(e.target.value))}
								className="font-size-slider"
							/>
							<span className="font-size-value">{settings.fontSize}px</span>
						</div>
					</div>

					<div className="setting-item">
						<div className="setting-info">
							<h3>Font Family</h3>
							<p>Choose your preferred font</p>
						</div>
						<select
							value={settings.fontFamily}
							onChange={(e) => updateFontFamily(e.target.value)}
							className="font-family-select"
						>
							{fontOptions.map((font) => (
								<option key={font} value={font}>
									{font}
								</option>
							))}
						</select>
					</div>
				</div>

				<div className="settings-section">
					<div className="section-header">
						<Database size={20} />
						<h2>Data & Backup</h2>
					</div>

					<div className="setting-item">
						<div className="setting-info">
							<h3>Auto-save</h3>
							<p>Automatically save your entries as you type</p>
						</div>
						<label className="toggle-switch">
							<input
								type="checkbox"
								checked={settings.autoSave}
								onChange={(e) => updateAutoSave(e.target.checked)}
							/>
							<span className="toggle-slider"></span>
						</label>
					</div>

					<div className="setting-item">
						<div className="setting-info">
							<h3>Export Entries</h3>
							<p>Download all your entries with images included</p>
						</div>
						<div style={{ display: "flex", gap: "10px" }}>
							<button
								className="btn btn-secondary"
								onClick={() => handleExport("json")}
								disabled={isExporting}
								title="Export as JSON (for backup and import)"
							>
								<Download size={16} />
								{isExporting ? "Exporting..." : "Export as JSON"}
							</button>
							<button
								className="btn btn-secondary"
								onClick={() => handleExport("html")}
								disabled={isExporting}
								title="Export as HTML (readable in any browser)"
							>
								<Download size={16} />
								{isExporting ? "Exporting..." : "Export as HTML"}
							</button>
						</div>
					</div>

					<div className="setting-item">
						<div className="setting-info">
							<h3>Import Entries</h3>
							<p>Import entries from a JSON backup file</p>
						</div>
						<button
							className="btn btn-secondary"
							onClick={handleImport}
							disabled={isImporting}
						>
							<Upload size={16} />
							{isImporting ? "Importing..." : "Import Entries"}
						</button>
					</div>
				</div>

				{/* Cloud Sync Section */}
				<div className="settings-section">
					<CloudSync />
				</div>

				<div className="settings-section">
					<div className="section-header">
						<Shield size={20} />
						<h2>Privacy & Security</h2>
					</div>

					<div className="setting-item">
						<div className="setting-info">
							<h3>Data Storage</h3>
							<p>Your entries are stored locally on your device</p>
						</div>
						<div className="info-badge">
							<Shield size={16} />
							Local Storage
						</div>
					</div>
				</div>

				<div className="settings-section">
					<div className="section-header">
						<Bell size={20} />
						<h2>Updates</h2>
					</div>

					<div className="setting-item">
						<div className="setting-info">
							<h3>App Updates</h3>
							<p>Keep your app up to date with the latest features</p>
						</div>
						{updateAvailable ? (
							<button className="btn btn-primary" onClick={handleUpdate}>
								<RefreshCw size={16} />
								Update Available
							</button>
						) : (
							<div className="info-badge">
								<RefreshCw size={16} />
								Up to date
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default Settings;
