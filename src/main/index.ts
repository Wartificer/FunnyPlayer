import { app, BrowserWindow, shell, protocol, ipcMain } from 'electron'
import path from 'path'
import fs from 'fs'
import { registerIpcHandlers, cleanup } from './ipc-handlers'
import { settingsStore } from './settings-store'

// Must be called before app.whenReady() — sets the app identity used by Windows
// for taskbar grouping, "Open With" label, and jump lists
app.setAppUserModelId('com.funnyplayer.app')
app.setName('FunnyPlayer')

let mainWindow: BrowserWindow | null = null

// Video extensions we handle via file association
const VIDEO_EXTS = /\.(mp4|mkv|avi|mov|wmv|flv|webm|m4v|ts|mpg|mpeg|m2ts|mts|divx|xvid)$/i

function extractVideoArg(args: string[]): string | null {
  // Skip the first arg (app executable path) and Electron flags
  for (let arg of args.slice(1)) {
    // Windows sometimes wraps paths in double quotes
    if (arg.startsWith('"') && arg.endsWith('"')) arg = arg.slice(1, -1)
    if (!arg.startsWith('-') && VIDEO_EXTS.test(arg)) {
      try { fs.accessSync(arg); return arg } catch {}
    }
  }
  return null
}

// Stored until renderer is ready to receive it
let pendingOpenFile: string | null = extractVideoArg(process.argv)

// Single-instance lock: if another instance is launched while this one is running,
// forward the file arg to the existing window and quit
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    const filePath = extractVideoArg(argv)
    if (filePath) {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.focus()
        mainWindow.webContents.send('open-file', filePath)
      } else {
        pendingOpenFile = filePath
      }
    } else if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

function createWindow(): void {
  const bounds = settingsStore.get('windowBounds')

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#1a1a2e',
    frame: false,
    // Icon for taskbar / task manager (resolves correctly in both dev and packaged)
    icon: app.isPackaged
      ? path.join(process.resourcesPath, 'icon.ico')
      : path.join(__dirname, '../../build/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: false,
      nodeIntegration: true,
      webSecurity: false // needed for file:// video sources
    }
  })

  mainWindow.on('resize', saveBounds)
  mainWindow.on('move', saveBounds)
  mainWindow.on('enter-full-screen', () => {
    mainWindow?.webContents.send('fullscreen-changed', true)
  })
  mainWindow.on('leave-full-screen', () => {
    mainWindow?.webContents.send('fullscreen-changed', false)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  registerIpcHandlers(mainWindow)

  // Open DevTools with Ctrl+Shift+I or F12
  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (
      (input.control && input.shift && input.key === 'I') ||
      input.key === 'F12'
    ) {
      mainWindow!.webContents.toggleDevTools()
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

function saveBounds(): void {
  if (!mainWindow) return
  const [width, height] = mainWindow.getSize()
  const [x, y] = mainWindow.getPosition()
  settingsStore.set('windowBounds', { width, height, x, y })
}

app.whenReady().then(() => {
  // Register file protocol for local video files
  protocol.registerFileProtocol('local-file', (request, callback) => {
    const filePath = decodeURIComponent(request.url.replace('local-file://', ''))
    callback({ path: filePath })
  })

  // Renderer calls this once on startup to check if the app was launched with a file
  ipcMain.handle('get-pending-open-file', () => {
    const file = pendingOpenFile
    pendingOpenFile = null
    return file
  })

  createWindow()
})

app.on('before-quit', async (e) => {
  e.preventDefault()
  await cleanup()
  app.exit(0)
})

app.on('window-all-closed', async () => {
  await cleanup()
  app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
