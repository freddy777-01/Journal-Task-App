import React, { useState } from "react";
import {
	Calendar,
	Heart,
	Tag,
	Trash2,
	Edit3,
	Clock,
	Search,
	Filter,
	Eye,
} from "lucide-react";
import { Entry } from "../types";
import "./JournalList.css";

interface JournalListProps {
	entries: Entry[];
	onSelectEntry: (entry: Entry) => void;
	onDeleteEntry: (id: number) => Promise<boolean>;
	onEditEntry: (entry: Entry) => void;
	isLoading: boolean;
}

const JournalList: React.FC<JournalListProps> = ({
	entries,
	onSelectEntry,
	onDeleteEntry,
	onEditEntry,
	isLoading,
}) => {
	const [searchTerm, setSearchTerm] = useState("");
	const [filterMood, setFilterMood] = useState("");
	const [sortBy, setSortBy] = useState<"date" | "title">("date");
	const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

	const filteredEntries = entries
		.filter((entry) => {
			const matchesSearch =
				entry.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
				entry.content.toLowerCase().includes(searchTerm.toLowerCase());
			const matchesMood = !filterMood || entry.mood === filterMood;
			return matchesSearch && matchesMood;
		})
		.sort((a, b) => {
			let comparison = 0;

			if (sortBy === "date") {
				comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
			} else {
				comparison = a.title.localeCompare(b.title);
			}

			return sortOrder === "asc" ? comparison : -comparison;
		});

	const formatDate = (dateString: string) => {
		const date = new Date(dateString);
		return date.toLocaleDateString("en-US", {
			weekday: "long",
			year: "numeric",
			month: "long",
			day: "numeric",
		});
	};

	const formatTime = (dateString: string) => {
		const date = new Date(dateString);
		return date.toLocaleTimeString("en-US", {
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	const getEntryPreview = (content: string) => {
		const textContent = content.replace(/<[^>]*>/g, ""); // Remove HTML tags
		return textContent.length > 200
			? textContent.substring(0, 200) + "..."
			: textContent;
	};

	const handleDelete = async (id: number, e: React.MouseEvent) => {
		e.stopPropagation();
		if (window.confirm("Are you sure you want to delete this entry?")) {
			await onDeleteEntry(id);
		}
	};

	const uniqueMoods = Array.from(
		new Set(entries.map((entry) => entry.mood).filter(Boolean))
	);

	if (isLoading) {
		return (
			<div className="journal-list loading">
				<div className="loading-spinner">Loading entries...</div>
			</div>
		);
	}

	return (
		<div className="journal-list">
			<div className="list-header">
				<div className="header-content">
					<h1>My Journals</h1>
					<p>
						{filteredEntries.length}{" "}
						{filteredEntries.length === 1 ? "journal" : "journals"}
					</p>
				</div>

				<div className="list-controls">
					<div className="search-container">
						<Search size={16} />
						<input
							type="text"
							placeholder="Search journals..."
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							className="search-input"
						/>
					</div>

					<div className="filter-container">
						<Filter size={16} />
						<select
							value={filterMood}
							onChange={(e) => setFilterMood(e.target.value)}
							className="filter-select"
						>
							<option value="">All moods</option>
							{uniqueMoods.map((mood) => (
								<option key={mood} value={mood}>
									{mood}
								</option>
							))}
						</select>
					</div>

					<div className="sort-container">
						<select
							value={sortBy}
							onChange={(e) => setSortBy(e.target.value as "date" | "title")}
							className="sort-select"
						>
							<option value="date">Sort by date</option>
							<option value="title">Sort by title</option>
						</select>

						<button
							onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
							className="sort-order-btn"
						>
							{sortOrder === "asc" ? "↑" : "↓"}
						</button>
					</div>
				</div>
			</div>

			<div className="entries-grid">
				{filteredEntries.length === 0 ? (
					<div className="empty-state">
						{searchTerm || filterMood
							? "No journals match your filters"
							: "No journals yet. Start writing!"}
					</div>
				) : (
					filteredEntries.map((entry) => (
						<div
							key={entry.id}
							className="entry-card"
							onClick={() => onSelectEntry(entry)}
						>
							<div className="card-header">
								<h3 className="entry-title">{entry.title || "Untitled"}</h3>
								<div className="card-actions">
									<button
										className="action-btn read-btn"
										onClick={(e) => {
											e.stopPropagation();
											onSelectEntry(entry);
										}}
										title="Read journal"
									>
										<Eye size={14} />
									</button>
									<button
										className="action-btn edit-btn"
										onClick={(e) => {
											e.stopPropagation();
											onEditEntry(entry);
										}}
										title="Edit journal"
									>
										<Edit3 size={14} />
									</button>
									<button
										className="action-btn delete-btn"
										onClick={(e) => handleDelete(entry.id!, e)}
										title="Delete journal"
									>
										<Trash2 size={14} />
									</button>
								</div>
							</div>

							<div className="card-meta">
								<div className="meta-item">
									<Calendar size={14} />
									<span>{formatDate(entry.date)}</span>
								</div>
								<div className="meta-item">
									<Clock size={14} />
									<span>{formatTime(entry.date)}</span>
								</div>
							</div>

							<p className="entry-preview">{getEntryPreview(entry.content)}</p>

							<div className="card-footer">
								{entry.mood && (
									<div className="mood-badge">
										<Heart size={12} />
										<span>{entry.mood}</span>
									</div>
								)}

								{entry.tags && entry.tags.length > 0 && (
									<div className="tags-preview">
										<Tag size={12} />
										<span>{entry.tags.slice(0, 3).join(", ")}</span>
										{entry.tags.length > 3 && (
											<span className="more-tags">
												+{entry.tags.length - 3}
											</span>
										)}
									</div>
								)}
							</div>
						</div>
					))
				)}
			</div>
		</div>
	);
};

export default JournalList;
