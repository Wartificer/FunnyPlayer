import { EventEmitter } from 'events'
import { HandyClient } from './handy-client'
import { funscriptToCsv } from './funscript-csv'

export class SyncManager extends EventEmitter {
  private client = new HandyClient()
  private currentSha256: string = ''
  private isPlaying = false
  private isConnected = false
  private setupInProgress = false

  async connect(connectionKey: string): Promise<boolean> {
    console.log(`[SyncManager] Connecting with key: ${connectionKey.slice(0, 4)}...`)
    this.client.setConnectionKey(connectionKey)
    try {
      const connected = await this.client.isConnected()
      this.isConnected = connected
      console.log(`[SyncManager] Connection result: ${connected}`)
      return connected
    } catch (err) {
      console.error('[SyncManager] Connection failed:', err)
      this.isConnected = false
      return false
    }
  }

  disconnect(): void {
    console.log('[SyncManager] Disconnecting')
    this.isConnected = false
    this.isPlaying = false
  }

  async setupScript(funscriptPath: string): Promise<void> {
    if (!this.isConnected) {
      console.log('[SyncManager] setupScript skipped - not connected')
      return
    }

    // Prevent concurrent setup calls
    if (this.setupInProgress) {
      console.log('[SyncManager] setupScript skipped - already in progress')
      return
    }
    this.setupInProgress = true

    try {
      // Stop current playback before switching scripts
      if (this.isPlaying) {
        console.log('[SyncManager] Stopping current playback before script switch')
        await this.client.hsspStop().catch(() => {})
        this.isPlaying = false
      }

      console.log(`[SyncManager] Setting up script: ${funscriptPath}`)
      const { csv, sha256 } = funscriptToCsv(funscriptPath)
      this.currentSha256 = sha256
      console.log(`[SyncManager] CSV generated: ${csv.split('\n').length} lines, sha256: ${sha256.slice(0, 12)}...`)

      // Upload CSV to public temp hosting so Handy cloud can access it
      const publicUrl = await this.uploadCsv(csv)
      console.log(`[SyncManager] CSV uploaded to: ${publicUrl}`)

      await this.client.setMode(1) // HSSP
      await this.client.syncDeviceClock()
      await this.client.hsspSetup(publicUrl, sha256)
      await this.client.syncServerTime()
      console.log('[SyncManager] Script setup complete')
    } finally {
      this.setupInProgress = false
    }
  }

  private async uploadCsv(csv: string): Promise<string> {
    const blob = new Blob([csv], { type: 'text/csv' })
    const formData = new FormData()
    formData.append('file', blob, 'script.csv')

    console.log('[SyncManager] Uploading CSV to tmpfiles.org...')
    const res = await fetch('https://tmpfiles.org/api/v1/upload', {
      method: 'POST',
      body: formData
    })
    const text = await res.text()
    console.log(`[SyncManager] Upload response (${res.status}):`, text)

    let json: { status?: string; data?: { url?: string } }
    try {
      json = JSON.parse(text)
    } catch {
      throw new Error(`Upload failed (${res.status}): ${text.slice(0, 200)}`)
    }

    if (!json.data?.url) {
      throw new Error('Failed to upload CSV: no URL returned')
    }

    // Convert page URL to direct download URL
    // tmpfiles.org/123/file.csv -> tmpfiles.org/dl/123/file.csv
    const directUrl = json.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/')
    console.log(`[SyncManager] Direct download URL: ${directUrl}`)
    return directUrl
  }

  async onPlay(positionMs: number): Promise<void> {
    console.log(`[SyncManager] onPlay - position: ${positionMs.toFixed(0)}ms, connected: ${this.isConnected}`)
    if (!this.isConnected) return
    this.isPlaying = true
    await this.client.hsspPlay(positionMs)
  }

  async onPause(): Promise<void> {
    console.log(`[SyncManager] onPause - connected: ${this.isConnected}`)
    if (!this.isConnected) return
    this.isPlaying = false
    await this.client.hsspStop()
  }

  async onSeek(positionMs: number): Promise<void> {
    console.log(`[SyncManager] onSeek - position: ${positionMs.toFixed(0)}ms, connected: ${this.isConnected}, playing: ${this.isPlaying}`)
    if (!this.isConnected || !this.isPlaying) return
    await this.client.hsspPlay(positionMs)
  }

  getConnected(): boolean {
    return this.isConnected
  }
}
