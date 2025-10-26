import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
	Plus,
	Calendar,
	Search,
	Settings,
	FileText,
	Clock,
	Heart,
	ChevronLeft,
	ChevronRight,
} from "lucide-react";
import { Entry } from "../types";
import { useTheme } from "../hooks/useTheme";
import "./Sidebar.css";
// Images are served from the public/ folder; use Vite base to build URL at runtime

interface SidebarProps {
	entries: Entry[];
	selectedEntry: Entry | null;
	onSelectEntry: (entry: Entry) => void;
	onNewEntry: () => void;
	isLoading: boolean;
	isCollapsed: boolean;
	onToggleCollapse: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
	entries,
	selectedEntry,
	onSelectEntry,
	onNewEntry,
	isLoading,
	isCollapsed,
	onToggleCollapse,
}) => {
	const navigate = useNavigate();
	const location = useLocation();
	const [searchTerm, setSearchTerm] = useState("");
	const { resolvedTheme } = useTheme();

	// Build a base-aware logo URL that works in dev and production
	const baseUrl = (import.meta as any).env?.BASE_URL ?? "./";
	const logoSrc = `${baseUrl}logo-1-${
		resolvedTheme === "dark" ? "dark" : "light"
	}.png`;

	const filteredEntries = entries.filter(
		(entry) =>
			entry.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
			entry.content.toLowerCase().includes(searchTerm.toLowerCase())
	);

	const formatDate = (dateString: string) => {
		const date = new Date(dateString);
		const today = new Date();
		const yesterday = new Date(today);
		yesterday.setDate(yesterday.getDate() - 1);

		if (date.toDateString() === today.toDateString()) {
			return "Today";
		} else if (date.toDateString() === yesterday.toDateString()) {
			return "Yesterday";
		} else {
			return date.toLocaleDateString("en-US", {
				month: "short",
				day: "numeric",
				year:
					date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
			});
		}
	};

	const getEntryPreview = (content: string) => {
		const textContent = content.replace(/<[^>]*>/g, ""); // Remove HTML tags
		return textContent.length > 100
			? textContent.substring(0, 100) + "..."
			: textContent;
	};

	return (
		<div className={`sidebar ${isCollapsed ? "collapsed" : ""}`}>
			<div className="sidebar-header">
				<div className="logo">
					<img
						key={resolvedTheme}
						src={`${logoSrc}?v=${resolvedTheme}`}
						alt="Diary"
						width={24}
						height={24}
						style={{ display: "block" }}
					/>
					{!isCollapsed && <h1>Diary</h1>}
				</div>
				<button
					className="btn btn-primary new-entry-btn"
					onClick={onNewEntry}
					title={isCollapsed ? "New Journal" : ""}
				>
					<Plus size={16} />
					{!isCollapsed && "Journal"}
				</button>
			</div>

			<button
				className="sidebar-toggle"
				onClick={onToggleCollapse}
				title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
			>
				{isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
			</button>

			{!isCollapsed && (
				<div className="sidebar-search">
					<Search size={16} />
					<input
						type="text"
						placeholder="Search journals..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						className="search-input"
					/>
				</div>
			)}

			<nav className="sidebar-nav">
				<button
					className={`nav-item ${location.pathname === "/" ? "active" : ""}`}
					onClick={() => navigate("/")}
					title={isCollapsed ? "My Journals" : ""}
				>
					<FileText size={16} />
					{!isCollapsed && "My Journals"}
				</button>
				<button
					className={`nav-item ${
						location.pathname === "/calendar" ? "active" : ""
					}`}
					onClick={() => navigate("/calendar")}
					title={isCollapsed ? "Calendar" : ""}
				>
					<Calendar size={16} />
					{!isCollapsed && "Calendar"}
				</button>
				<button
					className={`nav-item ${
						location.pathname === "/settings" ? "active" : ""
					}`}
					onClick={() => navigate("/settings")}
					title={isCollapsed ? "Settings" : ""}
				>
					<Settings size={16} />
					{!isCollapsed && "Settings"}
				</button>
			</nav>

			{!isCollapsed && (
				<div className="entries-section">
					<div className="section-header">
						<h3>Recent Journals</h3>
						<span className="entry-count">{entries.length}</span>
					</div>

					<div className="entries-list">
						{isLoading ? (
							<div className="loading">Loading journals...</div>
						) : filteredEntries.length === 0 ? (
							<div className="empty-state">
								{searchTerm
									? "No journals found"
									: "No journals yet. Start writing!"}
							</div>
						) : (
							filteredEntries.map((entry) => (
								<div
									key={entry.id}
									className={`entry-item ${
										selectedEntry?.id === entry.id ? "selected" : ""
									}`}
									onClick={() => onSelectEntry(entry)}
								>
									<div className="entry-header">
										<h4 className="entry-title">{entry.title || "Untitled"}</h4>
										<div className="entry-meta">
											<Clock size={12} />
											<span>{formatDate(entry.date)}</span>
										</div>
									</div>
									<p className="entry-preview">
										{getEntryPreview(entry.content)}
									</p>
									{entry.mood && (
										<div className="entry-mood">
											<Heart size={12} />
											<span>{entry.mood}</span>
										</div>
									)}
								</div>
							))
						)}
					</div>
				</div>
			)}
		</div>
	);
};

export default Sidebar;
