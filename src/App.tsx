import { useState, useEffect } from "react";
import {
	BrowserRouter,
	MemoryRouter,
	Routes,
	Route,
	useNavigate,
} from "react-router-dom";
import Sidebar from "./components/Sidebar";
import JournalEditor from "./components/JournalEditor";
import JournalList from "./components/JournalList";
import JournalReader from "./components/JournalReader";
import Calendar from "./components/Calendar";
import Settings from "./components/Settings";
import { useTheme } from "./hooks/useTheme";
import { useSettings } from "./hooks/useSettings";
import { Entry } from "./types";
import "./App.css";
import Toast from "./components/Toast";

function AppContent() {
	const [entries, setEntries] = useState<Entry[]>([]);
	const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
	useTheme();
	const { settings, updateSidebarCollapsed } = useSettings();
	const navigate = useNavigate();
	const [toast, setToast] = useState<{
		message: string;
		type?: "info" | "success" | "error";
	} | null>(null);

	useEffect(() => {
		loadEntries();
	}, []);

	// On app open: on macOS, show a one-time toast guiding manual download; elsewhere, auto-check is handled in main (prod)
	useEffect(() => {
		const platform = (window as any)?.electronAPI?.system?.platform || "";
		if (platform === "darwin") {
			setTimeout(() => {
				setToast({
					message:
						"Updates on macOS require a fresh download from the website.",
					type: "info",
				});
			}, 800);
		}

		// Listen for update installed event (sent on next launch after installing)
		try {
			window.electronAPI?.update?.onUpdateInstalled?.((version?: string) => {
				setToast({
					message: `Update installed${version ? ` (v${version})` : ""}.`,
					type: "success",
				});
			});
		} catch {}
	}, []);

	// Load sidebar collapsed state from settings
	useEffect(() => {
		setIsSidebarCollapsed(settings.sidebarCollapsed);
	}, [settings.sidebarCollapsed]);

	// Apply font settings globally
	useEffect(() => {
		document.documentElement.style.setProperty(
			"--editor-font-size",
			`${settings.fontSize}px`
		);
		document.documentElement.style.setProperty(
			"--editor-font-family",
			settings.fontFamily
		);
	}, [settings.fontSize, settings.fontFamily]);

	const loadEntries = async () => {
		try {
			setIsLoading(true);
			const loadedEntries = await window.electronAPI.database.getEntries();
			setEntries(loadedEntries);
		} catch (error) {
			console.error("Failed to load entries:", error);
		} finally {
			setIsLoading(false);
		}
	};

	const handleSaveEntry = async (entry: Entry) => {
		try {
			const savedEntry = await window.electronAPI.database.saveEntry(entry);

			if (entry.id) {
				// Update existing entry
				setEntries((prev) =>
					prev.map((e) => (e.id === entry.id ? savedEntry : e))
				);
			} else {
				// Add new entry
				setEntries((prev) => [savedEntry, ...prev]);
			}

			setSelectedEntry(savedEntry);
			return savedEntry;
		} catch (error) {
			console.error("Failed to save entry:", error);
			throw error;
		}
	};

	const handleDeleteEntry = async (id: number) => {
		try {
			const success = await window.electronAPI.database.deleteEntry(id);
			if (success) {
				setEntries((prev) => prev.filter((e) => e.id !== id));
				if (selectedEntry?.id === id) {
					setSelectedEntry(null);
				}
			}
			return success;
		} catch (error) {
			console.error("Failed to delete entry:", error);
			return false;
		}
	};

	const handleSelectEntry = (entry: Entry) => {
		setSelectedEntry(entry);
		navigate("/reader");
	};

	const handleEditEntry = () => {
		navigate("/editor");
	};

	const handleNewEntry = () => {
		const newEntry = {
			title: "",
			content: "",
			date: new Date().toISOString().split("T")[0],
			mood: "",
			tags: [],
		};
		setSelectedEntry(newEntry);
		navigate("/editor");
	};

	const handleNewEntryForDate = (dateISO: string) => {
		const newEntry = {
			title: "",
			content: "",
			date: dateISO,
			mood: "",
			tags: [],
		};
		setSelectedEntry(newEntry);
		navigate("/editor");
	};

	return (
		<div className="app">
			<Sidebar
				entries={entries}
				selectedEntry={selectedEntry}
				onSelectEntry={handleSelectEntry}
				onNewEntry={handleNewEntry}
				isLoading={isLoading}
				isCollapsed={isSidebarCollapsed}
				onToggleCollapse={() => {
					const newState = !isSidebarCollapsed;
					setIsSidebarCollapsed(newState);
					updateSidebarCollapsed(newState);
				}}
			/>

			<main className="main-content">
				<Routes>
					<Route
						path="/"
						element={
							<JournalList
								entries={entries}
								onSelectEntry={handleSelectEntry}
								onDeleteEntry={handleDeleteEntry}
								onEditEntry={handleEditEntry}
								isLoading={isLoading}
							/>
						}
					/>
					<Route
						path="/reader"
						element={
							<JournalReader entry={selectedEntry} onEdit={handleEditEntry} />
						}
					/>
					<Route
						path="/editor"
						element={
							<JournalEditor
								entry={selectedEntry}
								onSave={handleSaveEntry}
								onDelete={handleDeleteEntry}
							/>
						}
					/>
					<Route
						path="/calendar"
						element={
							<Calendar
								entries={entries}
								onSelectEntry={handleSelectEntry}
								onNewEntryForDate={handleNewEntryForDate}
							/>
						}
					/>
					<Route path="/settings" element={<Settings />} />
				</Routes>
			</main>
			{toast && (
				<Toast
					message={toast.message}
					type={toast.type}
					onClose={() => setToast(null)}
				/>
			)}
		</div>
	);
}

function App() {
	const RouterImpl = (import.meta as any).env?.PROD
		? MemoryRouter
		: BrowserRouter;
	return (
		<RouterImpl>
			<AppContent />
		</RouterImpl>
	);
}

export default App;
