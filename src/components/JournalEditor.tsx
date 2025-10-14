import React, { useState, useEffect, useRef } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { Save, Trash2, Calendar, Heart, Tag, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Entry } from "../types";
import "./JournalEditor.css";

interface JournalEditorProps {
	entry: Entry | null;
	onSave: (entry: Entry) => Promise<Entry>;
	onDelete: (id: number) => Promise<boolean>;
}

const JournalEditor: React.FC<JournalEditorProps> = ({
	entry,
	onSave,
	onDelete,
}) => {
	const [title, setTitle] = useState("");
	const [content, setContent] = useState("");
	const [date, setDate] = useState("");
	const [mood, setMood] = useState("");
	const [tags, setTags] = useState<string[]>([]);
	const [isSaving, setIsSaving] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [hasChanges, setHasChanges] = useState(false);
	const quillRef = useRef<ReactQuill>(null);
	const navigate = useNavigate();

	const moodOptions = [
		"😊 Happy",
		"😢 Sad",
		"😴 Tired",
		"😰 Anxious",
		"😍 Excited",
		"😤 Angry",
		"😌 Calm",
		"🤔 Thoughtful",
		"😋 Content",
		"😎 Confident",
	];

	useEffect(() => {
		if (entry) {
			setTitle(entry.title || "");
			setContent(entry.content || "");
			setDate(entry.date || new Date().toISOString().split("T")[0]);
			setMood(entry.mood || "");
			setTags(entry.tags || []);
			setHasChanges(false);
		} else {
			// New entry
			setTitle("");
			setContent("");
			setDate(new Date().toISOString().split("T")[0]);
			setMood("");
			setTags([]);
			setHasChanges(false);
		}
	}, [entry]);

	const handleSave = async () => {
		if (!title.trim() && !content.trim()) return;

		setIsSaving(true);
		try {
			const entryToSave: Entry = {
				id: entry?.id,
				title: title.trim(),
				content: content.trim(),
				date,
				mood: mood || undefined,
				tags: tags.length > 0 ? tags : undefined,
			};

			await onSave(entryToSave);
			setHasChanges(false);
		} catch (error) {
			console.error("Failed to save entry:", error);
		} finally {
			setIsSaving(false);
		}
	};

	const handleDelete = async () => {
		if (!entry?.id) return;

		if (window.confirm("Are you sure you want to delete this journal?")) {
			setIsDeleting(true);
			try {
				await onDelete(entry.id);
				navigate("/");
			} catch (error) {
				console.error("Failed to delete journal:", error);
			} finally {
				setIsDeleting(false);
			}
		}
	};

	const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setTitle(e.target.value);
		setHasChanges(true);
	};

	const handleContentChange = (value: string) => {
		setContent(value);
		setHasChanges(true);
	};

	const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setDate(e.target.value);
		setHasChanges(true);
	};

	const handleMoodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		setMood(e.target.value);
		setHasChanges(true);
	};

	const handleTagAdd = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter" && e.currentTarget.value.trim()) {
			const newTag = e.currentTarget.value.trim();
			if (!tags.includes(newTag)) {
				setTags([...tags, newTag]);
				setHasChanges(true);
			}
			e.currentTarget.value = "";
		}
	};

	const handleTagRemove = (tagToRemove: string) => {
		setTags(tags.filter((tag) => tag !== tagToRemove));
		setHasChanges(true);
	};

	// Auto-save functionality
	useEffect(() => {
		if (hasChanges && (title.trim() || content.trim())) {
			const timer = setTimeout(() => {
				handleSave();
			}, 2000); // Auto-save after 2 seconds of inactivity

			return () => clearTimeout(timer);
		}
	}, [title, content, date, mood, tags, hasChanges]);

	const quillModules = {
		toolbar: [
			[{ header: [1, 2, 3, false] }],
			["bold", "italic", "underline", "strike"],
			[{ list: "ordered" }, { list: "bullet" }],
			[{ color: [] }, { background: [] }],
			["link", "image"],
			["clean"],
		],
	};

	const quillFormats = [
		"header",
		"bold",
		"italic",
		"underline",
		"strike",
		"list",
		"bullet",
		"color",
		"background",
		"link",
		"image",
	];

	if (!entry) {
		return (
			<div className="journal-editor empty">
				<div className="empty-state">
					<h2>Select a journal to start writing</h2>
					<p>Choose a journal from the sidebar or create a new one</p>
				</div>
			</div>
		);
	}

	return (
		<div className="journal-editor">
			<div className="editor-header">
				<div className="editor-actions">
					<button
						className="btn btn-ghost back-btn"
						onClick={() => navigate("/")}
					>
						<ArrowLeft size={16} />
						Back
					</button>

					<div className="action-buttons">
						{entry.id && (
							<button
								className="btn btn-ghost delete-btn"
								onClick={handleDelete}
								disabled={isDeleting}
							>
								<Trash2 size={16} />
								{isDeleting ? "Deleting..." : "Delete"}
							</button>
						)}

						<button
							className="btn btn-primary save-btn"
							onClick={handleSave}
							disabled={isSaving || (!title.trim() && !content.trim())}
						>
							<Save size={16} />
							{isSaving ? "Saving..." : hasChanges ? "Save Changes" : "Saved"}
						</button>
					</div>
				</div>

				<div className="entry-meta">
					<div className="meta-item">
						<Calendar size={16} />
						<input
							type="date"
							value={date}
							onChange={handleDateChange}
							className="date-input"
						/>
					</div>

					<div className="meta-item">
						<Heart size={16} />
						<select
							value={mood}
							onChange={handleMoodChange}
							className="mood-select"
						>
							<option value="">Select mood</option>
							{moodOptions.map((moodOption) => (
								<option key={moodOption} value={moodOption}>
									{moodOption}
								</option>
							))}
						</select>
					</div>
				</div>
			</div>

			<div className="editor-content">
				<input
					type="text"
					placeholder="Journal title..."
					value={title}
					onChange={handleTitleChange}
					className="title-input"
				/>

				<div className="tags-section">
					<div className="tags-input">
						<Tag size={16} />
						<input
							type="text"
							placeholder="Add tags (press Enter)"
							onKeyDown={handleTagAdd}
							className="tag-input"
						/>
					</div>

					{tags.length > 0 && (
						<div className="tags-list">
							{tags.map((tag) => (
								<span key={tag} className="tag">
									{tag}
									<button
										onClick={() => handleTagRemove(tag)}
										className="tag-remove"
									>
										×
									</button>
								</span>
							))}
						</div>
					)}
				</div>

				<div className="quill-container">
					<ReactQuill
						ref={quillRef}
						theme="snow"
						value={content}
						onChange={handleContentChange}
						modules={quillModules}
						formats={quillFormats}
						placeholder="Start writing your thoughts..."
						className="quill-editor"
					/>
				</div>
			</div>
		</div>
	);
};

export default JournalEditor;
