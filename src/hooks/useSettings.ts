import { useState, useEffect } from "react";

export interface AppSettings {
	theme: "light" | "dark" | "system";
	fontSize: number;
	fontFamily: string;
	autoSave: boolean;
	sidebarCollapsed: boolean;
}

const defaultSettings: AppSettings = {
	theme: "system",
	fontSize: 16,
	fontFamily: "Inter",
	autoSave: true,
	sidebarCollapsed: false,
};

export const useSettings = () => {
	const [settings, setSettings] = useState<AppSettings>(defaultSettings);
	const [isLoading, setIsLoading] = useState(true);

	// Load settings from database on mount
	useEffect(() => {
		loadSettings();
	}, []);

	const loadSettings = async () => {
		try {
			setIsLoading(true);
			const theme = await window.electronAPI.settings.getSetting("theme");
			const fontSize = await window.electronAPI.settings.getSetting("fontSize");
			const fontFamily = await window.electronAPI.settings.getSetting(
				"fontFamily"
			);
			const autoSave = await window.electronAPI.settings.getSetting("autoSave");
			const sidebarCollapsed = await window.electronAPI.settings.getSetting(
				"sidebarCollapsed"
			);

			setSettings({
				theme: (theme as "light" | "dark" | "system") || defaultSettings.theme,
				fontSize: fontSize ? parseInt(fontSize) : defaultSettings.fontSize,
				fontFamily: fontFamily || defaultSettings.fontFamily,
				autoSave: autoSave ? autoSave === "true" : defaultSettings.autoSave,
				sidebarCollapsed: sidebarCollapsed
					? sidebarCollapsed === "true"
					: defaultSettings.sidebarCollapsed,
			});
		} catch (error) {
			console.error("Failed to load settings:", error);
		} finally {
			setIsLoading(false);
		}
	};

	const saveSetting = async (key: keyof AppSettings, value: any) => {
		try {
			await window.electronAPI.settings.setSetting(key, String(value));
		} catch (error) {
			console.error("Failed to save setting:", error);
		}
	};

	const updateTheme = (theme: "light" | "dark" | "system") => {
		setSettings((prev) => ({ ...prev, theme }));
		saveSetting("theme", theme);
	};

	const updateFontSize = (fontSize: number) => {
		setSettings((prev) => ({ ...prev, fontSize }));
		saveSetting("fontSize", fontSize);
	};

	const updateFontFamily = (fontFamily: string) => {
		setSettings((prev) => ({ ...prev, fontFamily }));
		saveSetting("fontFamily", fontFamily);
	};

	const updateAutoSave = (autoSave: boolean) => {
		setSettings((prev) => ({ ...prev, autoSave }));
		saveSetting("autoSave", autoSave);
	};

	const updateSidebarCollapsed = (sidebarCollapsed: boolean) => {
		setSettings((prev) => ({ ...prev, sidebarCollapsed }));
		saveSetting("sidebarCollapsed", sidebarCollapsed);
	};

	return {
		settings,
		isLoading,
		updateTheme,
		updateFontSize,
		updateFontFamily,
		updateAutoSave,
		updateSidebarCollapsed,
	};
};
