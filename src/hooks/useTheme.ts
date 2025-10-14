import { useState, useEffect } from "react";

export const useTheme = () => {
	const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
	const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");
	const [isLoaded, setIsLoaded] = useState(false);

	// Load theme from database on mount
	useEffect(() => {
		const loadTheme = async () => {
			try {
				const savedTheme = await window.electronAPI.settings.getSetting(
					"theme"
				);
				if (savedTheme) {
					setTheme(savedTheme as "light" | "dark" | "system");
				}
			} catch (error) {
				console.error("Failed to load theme:", error);
			} finally {
				setIsLoaded(true);
			}
		};

		loadTheme();
	}, []);

	useEffect(() => {
		const getSystemTheme = () => {
			return window.matchMedia("(prefers-color-scheme: dark)").matches
				? "dark"
				: "light";
		};

		const updateResolvedTheme = () => {
			if (theme === "system") {
				setResolvedTheme(getSystemTheme());
			} else {
				setResolvedTheme(theme);
			}
		};

		// Set initial resolved theme
		updateResolvedTheme();

		// Listen for system theme changes
		const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
		const handleSystemChange = () => {
			if (theme === "system") {
				updateResolvedTheme();
			}
		};

		mediaQuery.addEventListener("change", handleSystemChange);

		return () => {
			mediaQuery.removeEventListener("change", handleSystemChange);
		};
	}, [theme]);

	useEffect(() => {
		// Update the document theme when resolved theme changes
		document.documentElement.setAttribute("data-theme", resolvedTheme);
	}, [resolvedTheme]);

	const setThemeMode = async (newTheme: "light" | "dark" | "system") => {
		setTheme(newTheme);
		// Save to database
		try {
			await window.electronAPI.settings.setSetting("theme", newTheme);
		} catch (error) {
			console.error("Failed to save theme:", error);
		}
	};

	const toggleTheme = () => {
		const newTheme = theme === "light" ? "dark" : "light";
		setThemeMode(newTheme);
	};

	return {
		theme,
		resolvedTheme,
		setThemeMode,
		toggleTheme,
		isLoaded,
	};
};
