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

## Release and Icons

- App icons:
  - Windows: `public/logo-1-light.ico` is used by default. For higher quality, replace with `build/icons/win/icon.ico` and set `build.win.icon` accordingly.
  - macOS: `public/logo-1-light.png` is used by default. For best results, create `build/icons/mac/icon.icns` and set `build.mac.icon`.
  - Linux: uses `public/logo-1-light.png` or PNGs in `build/icons/png/`.
  - See `build/icons/**/README.txt` for size and generation tips.

### Tag and publish (PowerShell)

Create a version tag to trigger release publishing on CI:

1. Update `package.json` version.
2. Commit your changes.
3. Create and push a tag:

```
git tag v1.0.1
git push origin HEAD ; git push origin --tags
```

Use prerelease tags like `v1.1.0-beta.1` for beta channels.
