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

		// Listen for app-wide theme changes triggered by other hook instances
		const handleAppThemeChanged = (ev: Event) => {
			try {
				const custom = ev as CustomEvent<"light" | "dark" | "system">;
				const newTheme = custom.detail;
				if (!newTheme) return;
				setTheme(newTheme);
				if (newTheme === "system") {
					setResolvedTheme(getSystemTheme());
				} else {
					setResolvedTheme(newTheme);
				}
			} catch {}
		};
		window.addEventListener(
			"app-theme-changed" as any,
			handleAppThemeChanged as any
		);

		return () => {
			mediaQuery.removeEventListener("change", handleSystemChange);
			window.removeEventListener(
				"app-theme-changed" as any,
				handleAppThemeChanged as any
			);
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

		// Broadcast to other hook instances so they update immediately
		try {
			window.dispatchEvent(
				new CustomEvent("app-theme-changed", { detail: newTheme })
			);
		} catch {}
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
