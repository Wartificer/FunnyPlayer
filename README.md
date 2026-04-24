<p align="center">
  <img src="build/icon.png" alt="FunnyPlayer logo" width="120" />
</p>

<h1 align="center">FunnyPlayer</h1>

<p align="center">
  A desktop video player with <a href="https://buttplug.io">funscript</a> and <a href="https://www.thehandy.com">The Handy</a> support, built with Electron and libmpv.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-Windows-blue" alt="Platform" />
  <!-- <img src="https://img.shields.io/badge/platform-Windows%20%7C%20Linux-blue" alt="Platform" /> -->
  <img src="https://img.shields.io/badge/license-GPLv3-green" alt="License" />
  <img src="https://img.shields.io/badge/electron-33-47848f" alt="Electron" />
</p>

---
> - **Quality of life** — Click to play, go back, start another video in under a second. Designed with a modern UX to stay out of your way.
> - **Performance** — Video plays as smoothly as the most popular video apps out there.

FunnyPlayer is built around FunScript support, but works perfectly as a standalone video player too — just create a profile with FunScript disabled and use it like any other player.

## Features

### Playback
- Hardware-accelerated video playback via **libmpv** rendered to a WebGL canvas
- Supports all formats mpv supports — MP4, MKV, AVI, MOV, WebM, and more
- Volume control with up to 200% volume

### Funscript & Device Support
- **The Handy** integration — scripts sync automatically when a video starts
- Auto-detection of `.funscript` files matching the video filename
- Support for multiple script variants per video (e.g. Normal, Fast, Soft) with an in-UI picker
- Script re-sync on seek

### Library & Organisation
- Add multiple folders to your library; folder tree with subfolder navigation
- Grid view and list view with sortable columns
- Sort by name, size, duration, date modified, or has script
- Search across the current folder or entire library
- **Recent** — automatically tracks recently played videos
- **Favorites** — star videos; accessible from a dedicated sidebar category
- **Hidden** — hide videos from normal views; toggle visibility in settings
- Drag files from your OS into a folder to move them
- Drag video cards between folders in the sidebar tree
- Right-click context menu: Play, Rename, Delete, Favorite, Hide, Open file location
- Bulk select with checkboxes; bulk delete from the topbar
- Rename renames the video **and all associated files** (scripts, subtitles)
- Delete sends files to the recycle bin

### Profiles & Settings
- Multiple profiles with independent folder libraries, recent history, favorites, and settings
- Per-profile theme: **Navy Blue**, **Dark**, **Light**
- Per-profile preferred audio and subtitle language
- Restores last viewed folder and view mode (grid/list) per profile on launch

### Subtitles
- Auto-loads `.srt` / `.ass` / `.ssa` / `.sub` / `.vtt` files matching the video name
- Drag a subtitle file onto the player to load it
- Load any subtitle file via right-click → Subtitles → Load subtitle file…
- (Experimental) Configurable default subtitle style: size, color, outline, shadow

### Platform
- **Windows**: NSIS installer and portable `.exe`
<!-- - **Linux**: AppImage and `.deb` -->
- File association support — double-click any video file to open it directly in FunnyPlayer
- Single-instance: opening a file while the app is running focuses the existing window and plays it

---

## Installation

Download the latest release from the [Releases](https://github.com/wartificer/FunnyPlayer/releases) page.

| Platform | File |
|---|---|
| Windows (installer) | `FunnyPlayer-x.x.x-setup.exe` |
| Windows (portable) | `FunnyPlayer-x.x.x-portable.exe` |
<!-- | Linux | `FunnyPlayer-x.x.x.AppImage` or `.deb` | -->

---

## Building from source

**Prerequisites**
- Node.js 18+
- CMake + Visual Studio Build Tools (Windows) or GCC (Linux)
- libmpv development headers

```bash
# Install dependencies
npm install

# Build the native libmpv addon
npm run build:native

# Start in development mode
npm run dev

# Package for release
npm run package:win    # Windows
npm run package:linux  # Linux
```

---

## Support

If you find FunnyPlayer useful, consider buying me a coffee!

<p>
  <a href="https://ko-fi.com/wartificer">
    <img src="https://ko-fi.com/img/githubbutton_sm.svg" alt="Support on Ko-fi" />
  </a>
</p>

---

## License

FunnyPlayer is free software: you can redistribute it and/or modify it under the terms of the **GNU General Public License v3.0** as published by the Free Software Foundation.

See the [LICENSE](LICENSE) file for the full license text, or visit [gnu.org/licenses/gpl-3.0](https://www.gnu.org/licenses/gpl-3.0.html).
