# Journal Export Guide

## Overview

The journal application supports exporting your entries in two formats: **JSON** and **HTML**. Both formats preserve all your content, including **embedded images**.

## How Images Are Handled

### Image Storage

When you add an image to your journal entry using Quill.js:

1. The image is automatically converted to **base64 format**
2. The base64 data is embedded directly in the HTML content
3. This means images are stored as text data within the journal entry itself
4. No separate image files are needed

### Example of Base64 Image in Content

```html
<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA..." />
```

## Export Formats

### 1. JSON Export (Recommended for Backup)

**Use Case:**

- Creating backups of your journal
- Importing entries back into the app
- Preserving all metadata (tags, mood, dates)

**What's Included:**

- ✅ All journal entries
- ✅ Titles and content (with embedded images)
- ✅ Tags
- ✅ Mood data
- ✅ Dates and timestamps
- ✅ Entry IDs

**File Structure:**

```json
[
	{
		"id": 1,
		"title": "My First Journal",
		"content": "<p>Hello world</p><img src='data:image/png;base64,...' />",
		"date": "2025-10-10",
		"mood": "Happy",
		"tags": ["personal", "memories"],
		"created_at": "2025-10-10 10:30:00",
		"updated_at": "2025-10-10 10:30:00"
	}
]
```

**How to Use:**

1. Go to Settings → Data & Backup
2. Click "Export as JSON"
3. Choose where to save the file
4. Keep this file safe as a backup

**Importing Back:**

- Use the "Import Entries" button in Settings
- Select your JSON backup file
- All entries (with images) will be restored

---

### 2. HTML Export (Recommended for Reading/Sharing)

**Use Case:**

- Creating a readable version of your journal
- Printing your journal
- Sharing entries (without needing the app)
- Archiving in a universal format

**What's Included:**

- ✅ All journal entries with beautiful formatting
- ✅ Embedded images (fully visible)
- ✅ Tags displayed as badges
- ✅ Mood indicators
- ✅ Formatted dates and times
- ✅ Print-friendly styling

**Features:**

- Opens in any web browser
- Professional styling with the app's theme colors
- Responsive design (works on mobile)
- Print-optimized (each entry stays together)
- No internet connection needed (all images embedded)

**How to Use:**

1. Go to Settings → Data & Backup
2. Click "Export as HTML"
3. Choose where to save the file
4. Open the HTML file in any browser to view your journal

**HTML Export Preview:**

```html
<!DOCTYPE html>
<html>
	<head>
		<title>Journal Backup</title>
		<style>
			/* Beautiful styling included */
		</style>
	</head>
	<body>
		<h1>Journal Backup</h1>
		<p>Exported on October 10, 2025</p>

		<div class="entry">
			<h2>My First Journal</h2>
			<div class="entry-meta">
				<span>📅 October 10, 2025</span>
				<span>🕐 10:30 AM</span>
				<span>💖 Happy</span>
			</div>
			<div class="entry-tags">
				<span class="tag">personal</span>
				<span class="tag">memories</span>
			</div>
			<div class="entry-content">
				<p>Hello world</p>
				<img src="data:image/png;base64,..." />
			</div>
		</div>
	</body>
</html>
```

---

## Important Notes

### ✅ Images Are Always Included

- **Both JSON and HTML exports include all images**
- Images are embedded as base64 data
- No separate image files are created
- The export file is self-contained

### 📦 File Size Considerations

- Images increase file size significantly
- A journal with many high-resolution images may create large export files
- This is normal and ensures nothing is lost

### 🔒 Privacy & Security

- All exports are stored locally on your computer
- No data is sent to any server
- Keep your backup files secure
- Consider encrypting sensitive backups

### 💡 Best Practices

1. **Regular Backups:**

   - Export as JSON weekly or monthly
   - Store backups in multiple locations (external drive, cloud storage)

2. **Archiving:**

   - Export as HTML for long-term archival
   - HTML files can be opened decades from now

3. **Sharing:**

   - Use HTML export if you want to share specific entries
   - You can edit the HTML file to remove entries you don't want to share

4. **Cloud Storage:**
   - Both JSON and HTML files can be uploaded to Google Drive, OneDrive, etc.
   - Your images will remain intact

---

## Troubleshooting

### "No entries to export" Message

**Cause:** You haven't created any journal entries yet.
**Solution:** Create at least one journal entry before exporting.

### Empty Export File

**Cause:** Database might not be initialized properly.
**Solution:**

1. Create a test journal entry
2. Save it
3. Try exporting again

### Large File Size

**Cause:** Many images or high-resolution images in your journals.
**Solution:** This is normal. Consider:

- Compressing images before adding them to journals
- Creating multiple smaller exports (by date range)

### Images Not Showing in HTML Export

**Cause:** Browser security settings (rare).
**Solution:**

- Try opening in a different browser
- Check if the base64 data is present in the HTML file
- Ensure you're opening the file locally (not from a server)

---

## Technical Details

### Base64 Encoding

- Images are converted to base64 when added to Quill editor
- Base64 is a text representation of binary data
- Increases file size by ~33% compared to original image
- Universally supported by all browsers and applications

### Quill.js Image Handling

- Quill automatically converts images to base64
- Supports: PNG, JPEG, GIF, WebP
- Images are stored in the `content` field as HTML

### Export Process

1. Retrieve all entries from SQLite database
2. Parse tags from JSON format
3. Format dates and metadata
4. Generate HTML wrapper (for HTML export)
5. Write to file with UTF-8 encoding

---

## Future Enhancements

Potential improvements for future versions:

- [ ] PDF export with custom styling
- [ ] Selective export (date range, tags, mood)
- [ ] Automatic cloud backup
- [ ] Image compression options
- [ ] Export to Markdown format
- [ ] Password-protected exports

---

## Support

If you encounter any issues with exporting:

1. Check the console logs (View → Developer Tools)
2. Verify you have write permissions to the export location
3. Ensure you have enough disk space
4. Try exporting to a different location

---

**Remember:** Your journal entries and images are always safe in the local database. Exports are copies, not moves, so you can export as many times as you want without losing data.
