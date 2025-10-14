# Cloud Sync Setup Guide

This guide will help you set up cloud synchronization for your journal entries with Google Drive and OneDrive.

## Overview

The journal app supports automatic backup and synchronization to:

- **Google Drive** - Free 15GB storage
- **OneDrive** - Free 5GB storage (15GB with Microsoft 365)

Your journals are synced as JSON files with all images embedded, ensuring nothing is lost.

---

## Table of Contents

1. [Google Drive Setup](#google-drive-setup)
2. [OneDrive Setup](#onedrive-setup)
3. [Using Cloud Sync](#using-cloud-sync)
4. [Troubleshooting](#troubleshooting)
5. [FAQ](#faq)

---

## Google Drive Setup

### Prerequisites

- A Google account
- Access to Google Cloud Console

### Step-by-Step Instructions

#### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **"Select a project"** → **"New Project"**
3. Enter a project name (e.g., "Diary App")
4. Click **"Create"**

#### 2. Enable Google Drive API

1. In your project, go to **"APIs & Services"** → **"Library"**
2. Search for **"Google Drive API"**
3. Click on it and press **"Enable"**

#### 3. Create OAuth 2.0 Credentials

1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"Create Credentials"** → **"OAuth client ID"**
3. If prompted, configure the OAuth consent screen:
   - Choose **"External"** user type
   - Fill in app name: "Diary App"
   - Add your email as developer contact
   - Click **"Save and Continue"** through the remaining steps
4. Back on the credentials page:
   - Application type: **"Desktop app"**
   - Name: "Diary Desktop Client"
   - Click **"Create"**

#### 4. Download Credentials

1. After creating, you'll see a dialog with your credentials
2. Click **"Download JSON"**
3. Save the file (you'll need its contents)

#### 5. Connect in the App

1. Open the Diary app
2. Go to **Settings** → **Cloud Sync**
3. Click **"Connect"** under Google Drive
4. Open the downloaded JSON file in a text editor
5. Copy the **entire contents** of the file
6. Paste it into the app's text area
7. Click **"Next"**
8. A browser window will open for authorization
9. Sign in with your Google account
10. Grant the requested permissions
11. Copy the authorization code from the browser
12. Paste it back into the app
13. Click **"Connect"**

✅ **Done!** Your Google Drive is now connected.

---

## OneDrive Setup

### Prerequisites

- A Microsoft account
- Access to Azure Portal

### Step-by-Step Instructions

#### 1. Register an Application

1. Go to [Azure App Registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. Sign in with your Microsoft account
3. Click **"New registration"**
4. Fill in the details:
   - Name: "Diary App"
   - Supported account types: **"Accounts in any organizational directory and personal Microsoft accounts"**
   - Redirect URI: Leave blank for now
5. Click **"Register"**

#### 2. Configure Redirect URI

1. In your app's overview, go to **"Authentication"**
2. Click **"Add a platform"** → **"Mobile and desktop applications"**
3. Add custom redirect URI: `http://localhost:3000/auth/callback`
4. Click **"Configure"**

#### 3. Get Application (Client) ID

1. Go to **"Overview"** in your app
2. Copy the **"Application (client) ID"**
3. Save it somewhere (you'll need it)

#### 4. Configure API Permissions

1. Go to **"API permissions"**
2. Click **"Add a permission"**
3. Choose **"Microsoft Graph"**
4. Select **"Delegated permissions"**
5. Add these permissions:
   - `Files.ReadWrite`
   - `User.Read`
6. Click **"Add permissions"**

#### 5. Connect in the App

1. Open the Diary app
2. Go to **Settings** → **Cloud Sync**
3. Click **"Connect"** under OneDrive
4. Paste your **Application (client) ID**
5. Click **"Next"**
6. A browser window will open for authorization
7. Sign in with your Microsoft account
8. Grant the requested permissions
9. Copy the authorization code from the browser
10. Paste it back into the app
11. Click **"Connect"**

✅ **Done!** Your OneDrive is now connected.

---

## Using Cloud Sync

### Manual Sync

1. Go to **Settings** → **Cloud Sync**
2. Click **"Sync Now"**
3. Your journals will be uploaded to all connected cloud services
4. You'll see a success message when complete

### Auto Sync

1. Connect at least one cloud service (Google Drive or OneDrive)
2. Toggle **"Auto Sync"** to ON
3. Your journals will automatically sync every hour
4. No manual action needed!

### Sync Status

The Cloud Sync section shows:

- **Connection status** for each service
- **Last sync time** for each service
- **Sync messages** (success/error notifications)

### What Gets Synced

- ✅ All journal entries
- ✅ All images (embedded as base64)
- ✅ Tags and metadata
- ✅ Mood data
- ✅ Dates and timestamps

### File Location

**Google Drive:**

- Files are stored in the root of your Google Drive
- File name format: `diary-backup-YYYY-MM-DD.json`

**OneDrive:**

- Files are stored in `/DiaryBackup/` folder
- File name format: `diary-backup-YYYY-MM-DD.json`

---

## Troubleshooting

### Google Drive Issues

#### "Failed to initialize Google Drive"

**Cause:** Invalid credentials JSON
**Solution:**

- Make sure you copied the entire JSON file contents
- Check that the JSON is valid (no missing brackets)
- Ensure you downloaded the correct OAuth client credentials

#### "Authentication failed"

**Cause:** Invalid authorization code
**Solution:**

- Make sure you copied the complete authorization code
- Try the authorization process again
- Check that your Google Cloud project has Google Drive API enabled

#### "Sync failed"

**Cause:** Network issues or expired tokens
**Solution:**

- Check your internet connection
- Try disconnecting and reconnecting Google Drive
- Ensure your Google account has available storage space

### OneDrive Issues

#### "Failed to initialize OneDrive"

**Cause:** Invalid Client ID
**Solution:**

- Double-check the Application (client) ID
- Make sure you copied it correctly from Azure Portal
- Verify the app is registered correctly

#### "Authentication failed"

**Cause:** Invalid authorization code or permissions
**Solution:**

- Ensure you granted all requested permissions
- Try the authorization process again
- Check that redirect URI is configured correctly

#### "Sync failed"

**Cause:** Network issues or token expiration
**Solution:**

- Check your internet connection
- Try disconnecting and reconnecting OneDrive
- Ensure your OneDrive has available storage space

### General Issues

#### "No entries to sync"

**Cause:** No journal entries exist yet
**Solution:** Create at least one journal entry before syncing

#### "Auto sync not working"

**Cause:** Auto sync is disabled or no services connected
**Solution:**

- Ensure at least one cloud service is connected
- Toggle Auto Sync ON in settings
- Check that the app is running (auto sync only works while app is open)

#### "Sync is slow"

**Cause:** Large number of entries or images
**Solution:**

- This is normal for first sync with many entries
- Subsequent syncs will be faster (only updates changed files)
- Consider reducing image sizes in future entries

---

## FAQ

### Is my data secure?

**Yes!** Your data security is ensured through:

- OAuth 2.0 authentication (no passwords stored)
- Direct connection to your cloud account
- No third-party servers involved
- All data encrypted in transit (HTTPS)
- Local encryption of credentials

### Can I use both Google Drive and OneDrive?

**Yes!** You can connect both services simultaneously. Your journals will sync to both, providing redundancy.

### What happens if I disconnect a service?

- Your journals remain safe locally
- Cloud backups remain in your cloud storage
- You can reconnect anytime without data loss
- No journals are deleted from your device

### How much storage do I need?

It depends on your usage:

- **Text-only journals:** Very small (~1-10 KB per entry)
- **With images:** Varies by image size (typically 100 KB - 5 MB per entry)
- **Estimate:** 1000 text entries ≈ 10 MB
- **Estimate:** 100 entries with images ≈ 50-500 MB

### Can I access my synced journals from another device?

Currently, the sync is one-way (upload only). To access on another device:

1. Download the backup JSON file from your cloud storage
2. Import it using **Settings** → **Import Entries**

### How often does auto-sync run?

Auto-sync runs every **1 hour** when:

- The app is running
- At least one cloud service is connected
- Auto-sync is enabled

### Will syncing use a lot of bandwidth?

- **First sync:** Yes, uploads all entries
- **Subsequent syncs:** Only uploads new/changed entries
- **Recommendation:** Use WiFi for first sync if you have many entries with images

### What if my cloud storage is full?

- Sync will fail with an error message
- Your journals remain safe locally
- Free up space in your cloud storage
- Try syncing again

### Can I choose what to sync?

Currently, all entries are synced. Selective sync may be added in future updates.

### Is there a sync conflict resolution?

The app uses a "last write wins" strategy:

- Each sync overwrites the cloud file
- The most recent local data is always uploaded
- No merge conflicts occur

---

## Security Best Practices

1. **Keep credentials private**

   - Never share your OAuth credentials
   - Don't commit credentials to version control
   - Store credentials securely

2. **Review app permissions**

   - The app only requests necessary permissions
   - Google Drive: `drive.file` (only files created by the app)
   - OneDrive: `Files.ReadWrite` (read/write access)

3. **Regular backups**

   - Enable auto-sync for automatic backups
   - Manually sync before important events
   - Keep local backups using Export feature

4. **Monitor sync status**
   - Check sync status regularly
   - Investigate any sync failures promptly
   - Ensure adequate cloud storage space

---

## Support

If you encounter issues not covered in this guide:

1. Check the app's console logs (View → Developer Tools)
2. Verify your internet connection
3. Ensure cloud services are not experiencing outages
4. Try disconnecting and reconnecting the service
5. Create a new OAuth client/app registration

---

## Privacy Policy

- **No data collection:** The app doesn't collect any personal data
- **Direct connection:** Your journals sync directly to your cloud account
- **No third parties:** No data passes through our servers
- **Local storage:** All data is stored locally on your device
- **You own your data:** You can export and delete data anytime

---

## Future Enhancements

Planned features for future versions:

- [ ] Two-way sync (download from cloud)
- [ ] Selective sync (choose which entries to sync)
- [ ] Sync conflict resolution
- [ ] Multiple device support
- [ ] Encrypted cloud storage
- [ ] Dropbox integration
- [ ] Custom sync intervals

---

**Last Updated:** October 2025
**Version:** 1.0.0

For more information, see [EXPORT_GUIDE.md](./EXPORT_GUIDE.md) for details on how data is exported and synced.
