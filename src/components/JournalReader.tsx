import React from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { ArrowLeft, Calendar, Heart, Tag, Edit3, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Entry } from "../types";
import "./JournalReader.css";

interface JournalReaderProps {
	entry: Entry | null;
	onEdit: () => void;
}

const JournalReader: React.FC<JournalReaderProps> = ({ entry, onEdit }) => {
	const navigate = useNavigate();

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

	if (!entry) {
		return (
			<div className="journal-reader empty">
				<div className="empty-state">
					<h2>Select a journal to read</h2>
					<p>Choose a journal from the sidebar to view its content</p>
				</div>
			</div>
		);
	}

	return (
		<div className="journal-reader">
			<div className="reader-header">
				<div className="reader-actions">
					<button
						className="btn btn-ghost back-btn"
						onClick={() => navigate("/")}
					>
						<ArrowLeft size={16} />
						Back
					</button>

					<button className="btn btn-primary edit-btn" onClick={onEdit}>
						<Edit3 size={16} />
						Edit
					</button>
				</div>

				<div className="entry-meta">
					<div className="meta-item">
						<Calendar size={16} />
						<span>{formatDate(entry.date)}</span>
					</div>

					<div className="meta-item">
						<Clock size={16} />
						<span>{formatTime(entry.date)}</span>
					</div>

					{entry.mood && (
						<div className="meta-item">
							<Heart size={16} />
							<span>{entry.mood}</span>
						</div>
					)}
				</div>
			</div>

			<div className="reader-content">
				<h1 className="journal-title">{entry.title || "Untitled"}</h1>

				{entry.tags && entry.tags.length > 0 && (
					<div className="tags-section">
						<Tag size={16} />
						<div className="tags-list">
							{entry.tags.map((tag) => (
								<span key={tag} className="tag">
									{tag}
								</span>
							))}
						</div>
					</div>
				)}

				<div className="content-section">
					<ReactQuill
						value={entry.content}
						readOnly={true}
						theme="snow"
						modules={{
							toolbar: false,
						}}
						className="read-only-quill"
					/>
				</div>
			</div>
		</div>
	);
};

export default JournalReader;
