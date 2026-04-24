// Loads the native mpv_player.node addon
// With nodeIntegration: true, we can use require() directly in the renderer

const path = (window as any).require('path') as typeof import('path')

function loadNativeAddon() {
  const nativeRequire = (window as any).require
  // In dev, the built addon is in native/build/Release/
  // In prod, it's bundled next to the app
  const possiblePaths = [
    // Packaged: extraResources puts it in resources/
    path.join(process.resourcesPath ?? '', 'mpv_player.node'),
    // Dev: built addon in native/build/Release/
    path.join(process.cwd(), 'native', 'build', 'Release', 'mpv_player.node'),
    path.join(__dirname, '..', '..', 'native', 'build', 'Release', 'mpv_player.node'),
    path.join(__dirname, 'mpv_player.node'),
  ]

  for (const p of possiblePaths) {
    try {
      const mod = nativeRequire(p)
      console.log(`[mpv] Loaded native addon from: ${p}`)
      return mod
    } catch {
      // try next
    }
  }

  console.error('[mpv] Failed to load native addon from any path:', possiblePaths)
  return null
}

const native = loadNativeAddon()

export interface MpvPlayerNative {
  create(): void
  destroy(): void
  command(...args: string[]): void
  setOptionString(name: string, value: string): void
  setPropertyDouble(name: string, value: number): void
  setPropertyBool(name: string, value: boolean): void
  setPropertyString(name: string, value: string): void
  getPropertyDouble(name: string): number | null
  getPropertyBool(name: string): boolean | null
  getPropertyString(name: string): string | null
  observeProperty(name: string, format: 'double' | 'bool' | 'string'): void
  setRenderSize(width: number, height: number): void
  renderFrame(): Uint8Array | null
  processEvents(): Array<{ type: string; name: string; data: unknown }>
}

let mpvInstance: MpvPlayerNative | null = null

export function getMpv(): MpvPlayerNative | null {
  return mpvInstance
}

export function createMpv(): MpvPlayerNative | null {
  if (mpvInstance) return mpvInstance
  if (!native) return null

  try {
    const player = new native.MpvPlayer()
    player.create()
    mpvInstance = player
    console.log('[mpv] Instance created')
    return player
  } catch (err) {
    console.error('[mpv] Failed to create instance:', err)
    return null
  }
}

export function destroyMpv(): void {
  if (mpvInstance) {
    try {
      mpvInstance.destroy()
    } catch (err) {
      console.error('[mpv] Error destroying:', err)
    }
    mpvInstance = null
  }
}
