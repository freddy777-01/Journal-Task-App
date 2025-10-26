# Diary - A Beautiful Journal Desktop Application

A modern, cross-platform journal/diary desktop application built with Electron, React, TypeScript, and SQLite. Inspired by the Journey app, it provides a beautiful and intuitive interface for writing and managing your personal journal entries.

## Features

- ✨ **Rich Text Editing**: Powered by Quill.js for a beautiful writing experience
- 🎨 **Modern UI**: Clean, responsive design with light/dark theme support
- 💾 **Local Storage**: SQLite database for secure local storage
- ☁️ **Cloud Sync**: Automatic synchronization with Google Drive and OneDrive
- 📤 **Export/Import**: Export as JSON or HTML with embedded images
- 🔄 **Auto-save**: Automatically saves your entries as you type
- 🏷️ **Tags & Moods**: Organize entries with tags and track your mood
- 📅 **Calendar View**: Browse entries by date with visual indicators
- 📖 **Reading Mode**: Dedicated view for reading journal entries
- 📱 **Cross-platform**: Windows, macOS, and Linux support
- 🔄 **Auto-updates**: Built-in update mechanism
- 🎯 **Search**: Find entries quickly with powerful search functionality
- 🎨 **Customizable**: Adjust fonts, themes, and sync settings

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Desktop**: Electron
- **Database**: SQLite (better-sqlite3)
- **Rich Text**: Quill.js
- **Cloud APIs**: Google Drive API, Drop Box Api, ❌Microsoft Graph API
- **Styling**: CSS with CSS Variables
- **Icons**: Lucide React
- **Routing**: React Router DOM

```

```

## Installing Unsigned Builds

This app ships unsigned by default:

- Windows: SmartScreen may warn. Click "More info" → "Run anyway".
- macOS: Gatekeeper may block opening. Right‑click the app → Open → Open. Or go to System Settings → Privacy & Security → Open Anyway.
- Linux: AppImage may need execute permissions: `chmod +x Diary-*.AppImage`.

Note: Auto‑updates on macOS may not work reliably without signing/notarization.
