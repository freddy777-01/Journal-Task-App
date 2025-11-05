import React, { useState } from "react";
import {
	ChevronLeft,
	ChevronRight,
	Calendar as CalendarIcon,
	Clock,
	Heart,
} from "lucide-react";
import { Entry } from "../types";
import "./Calendar.css";

interface CalendarProps {
	entries: Entry[];
	onSelectEntry: (entry: Entry) => void;
	onNewEntryForDate: (dateISO: string) => void;
}

const Calendar: React.FC<CalendarProps> = ({
	entries,
	onSelectEntry,
	onNewEntryForDate,
}) => {
	const [currentDate, setCurrentDate] = useState(new Date());
	const [selectedDate, setSelectedDate] = useState<Date | null>(null);

	const monthNames = [
		"January",
		"February",
		"March",
		"April",
		"May",
		"June",
		"July",
		"August",
		"September",
		"October",
		"November",
		"December",
	];

	const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

	const getDaysInMonth = (date: Date) => {
		return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
	};

	const getFirstDayOfMonth = (date: Date) => {
		return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
	};

	const getEntriesForDate = (date: Date) => {
		const dateString = date.toISOString().split("T")[0];
		return entries.filter((entry) => entry.date === dateString);
	};

	const navigateMonth = (direction: "prev" | "next") => {
		setCurrentDate((prev) => {
			const newDate = new Date(prev);
			if (direction === "prev") {
				newDate.setMonth(prev.getMonth() - 1);
			} else {
				newDate.setMonth(prev.getMonth() + 1);
			}
			return newDate;
		});
	};

	const isToday = (date: Date) => {
		const today = new Date();
		return date.toDateString() === today.toDateString();
	};

	const isSelected = (date: Date) => {
		return selectedDate && date.toDateString() === selectedDate.toDateString();
	};

	const handleDateClick = (date: Date) => {
		setSelectedDate(date);
	};

	const renderCalendarDays = () => {
		const daysInMonth = getDaysInMonth(currentDate);
		const firstDay = getFirstDayOfMonth(currentDate);
		const days = [];

		// Add empty cells for days before the first day of the month
		for (let i = 0; i < firstDay; i++) {
			days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
		}

		// Add days of the month
		for (let day = 1; day <= daysInMonth; day++) {
			const date = new Date(
				currentDate.getFullYear(),
				currentDate.getMonth(),
				day
			);
			const dayEntries = getEntriesForDate(date);
			const hasEntries = dayEntries.length > 0;

			days.push(
				<div
					key={day}
					className={`calendar-day ${isToday(date) ? "today" : ""} ${
						isSelected(date) ? "selected" : ""
					} ${hasEntries ? "has-entries" : ""}`}
					onClick={() => handleDateClick(date)}
				>
					<span className="day-number">{day}</span>
					{hasEntries && (
						<div className="entries-indicator">
							<div className="entry-dot"></div>
							{dayEntries.length > 1 && (
								<span className="entry-count">{dayEntries.length}</span>
							)}
						</div>
					)}
				</div>
			);
		}

		return days;
	};

	const selectedDateEntries = selectedDate
		? getEntriesForDate(selectedDate)
		: [];

	return (
		<div className="calendar">
			<div className="calendar-header">
				<div className="calendar-title">
					<CalendarIcon size={24} />
					<h1>Calendar</h1>
				</div>

				<div className="calendar-navigation">
					<button className="nav-button" onClick={() => navigateMonth("prev")}>
						<ChevronLeft size={20} />
					</button>

					<h2 className="month-year">
						{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
					</h2>

					<button className="nav-button" onClick={() => navigateMonth("next")}>
						<ChevronRight size={20} />
					</button>
				</div>
			</div>

			<div className="calendar-content">
				<div className="calendar-grid">
					{/* Day headers */}
					{dayNames.map((day) => (
						<div key={day} className="day-header">
							{day}
						</div>
					))}

					{/* Calendar days */}
					{renderCalendarDays()}
				</div>

				{/* Selected date entries */}
				{selectedDate && (
					<div className="selected-date-entries">
						<h3>
							Entries for{" "}
							{selectedDate.toLocaleDateString("en-US", {
								weekday: "long",
								year: "numeric",
								month: "long",
								day: "numeric",
							})}
						</h3>

						{selectedDateEntries.length === 0 ? (
							<div className="no-entries">
								<p>No journals for this date</p>
								<button
									className="btn btn-primary"
									onClick={() => {
										if (!selectedDate) return;
										const iso = new Date(selectedDate.getTime())
											.toISOString()
											.split("T")[0];
										onNewEntryForDate(iso);
									}}
								>
									+ New Journal
								</button>
							</div>
						) : (
							<div className="entries-list">
								{selectedDateEntries.map((entry) => (
									<div
										key={entry.id}
										className="entry-card"
										onClick={() => onSelectEntry(entry)}
									>
										<div className="entry-header">
											<h4>{entry.title || "Untitled"}</h4>
											<div className="entry-time">
												<Clock size={14} />
												<span>
													{new Date(entry.date).toLocaleTimeString("en-US", {
														hour: "2-digit",
														minute: "2-digit",
													})}
												</span>
											</div>
										</div>

										<p className="entry-preview">
											{entry.content.replace(/<[^>]*>/g, "").substring(0, 100)}
											...
										</p>

										{entry.mood && (
											<div className="entry-mood">
												<Heart size={12} />
												<span>{entry.mood}</span>
											</div>
										)}
									</div>
								))}
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
};

export default Calendar;
