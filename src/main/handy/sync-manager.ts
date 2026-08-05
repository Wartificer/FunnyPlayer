import { EventEmitter } from 'events'
import { HandyClient } from './handy-client'
import { funscriptToCsv } from './funscript-csv'
import { getHandyPreferences } from '../settings-store'

export class SyncManager extends EventEmitter {
  private client = new HandyClient()
  private currentSha256: string = ''
  private isPlaying = false
  private isConnected = false

  /**
   * The script the device is holding, kept so a motion-range change can rebuild
   * and re-upload it without the renderer having to re-send the video's path.
   */
  private currentScriptPath: string | null = null

  /**
   * Video playback rate the script currently on the device was built for.
   *
   * Only ever updated once the device is actually holding a script re-timed for
   * the new rate — until then every position conversion must keep using the old
   * one, or a seek landing mid-change would be sent to the wrong script offset.
   */
  private playbackRate = 1

  /**
   * Resolves once the device and server clocks have been synced for this
   * connection. Both syncs are slow (the device alone makes 30 round trips) and
   * only need doing once, so they run at connect time — long before the user
   * picks a video — instead of being paid again on every script setup.
   */
  private clockSync: Promise<void> | null = null

  /**
   * sha256 -> hosted script URL. Handy's hosting is content addressed, so a
   * script we've already uploaded this session needs no second upload.
   */
  private uploadCache = new Map<string, string>()

  /** Bumped per setup so a superseded setup stops touching the device. */
  private setupGeneration = 0

  async connect(connectionKey: string): Promise<boolean> {
    console.log(`[SyncManager] Connecting with key: ${connectionKey.slice(0, 4)}...`)
    this.client.setConnectionKey(connectionKey)
    this.currentSha256 = ''
    this.currentScriptPath = null
    this.clockSync = null
    try {
      const connected = await this.client.isConnected()
      this.isConnected = connected
      console.log(`[SyncManager] Connection result: ${connected}`)
      // Start the clock syncs now and don't wait on them — by the time a video
      // is opened they're almost always already done.
      if (connected) {
        this.syncClocks()
        // We bake the motion range into the script itself, so the device must be
        // left wide open. Any range still set on it from the Handy app or the web
        // remote would otherwise multiply with ours.
        this.client.setSlideRange(0, 100).catch((err) => {
          console.error('[SyncManager] Could not reset device slide range:', err)
        })
      }
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
    this.currentSha256 = ''
    this.currentScriptPath = null
    this.clockSync = null
  }

  private syncClocks(): Promise<void> {
    if (!this.clockSync) {
      this.clockSync = (async () => {
        try {
          await this.client.syncDeviceClock()
          await this.client.syncServerTime()
          console.log('[SyncManager] Clock sync complete')
        } catch (err) {
          // Clear so the next setup retries rather than running forever on a
          // connection whose clocks were never synced.
          console.error('[SyncManager] Clock sync failed, will retry:', err)
          this.clockSync = null
        }
      })()
    }
    return this.clockSync
  }

  /**
   * Video position -> offset into the script the device is holding.
   *
   * The script is time-compressed to match the playback rate, so a video at
   * 2x reaches its 60s mark after 30s of script. Every hsspPlay start offset
   * has to go through here.
   */
  private toScriptTime(videoPositionMs: number): number {
    return videoPositionMs / this.playbackRate
  }

  async setupScript(funscriptPath: string, rate: number = this.playbackRate): Promise<void> {
    if (!this.isConnected) {
      console.log('[SyncManager] setupScript skipped - not connected')
      return
    }

    const generation = ++this.setupGeneration
    const superseded = (): boolean => generation !== this.setupGeneration
    const startedAt = Date.now()

    // Recorded before the early-out below so a later range change can rebuild
    // this script even when the device already held it.
    this.currentScriptPath = funscriptPath

    const prefs = getHandyPreferences()
    const { csv, sha256 } = funscriptToCsv(funscriptPath, prefs, rate)

    // The device is already holding this exact script — replaying the same video
    // or switching back to one costs nothing.
    if (sha256 === this.currentSha256) {
      console.log('[SyncManager] Script already loaded on device, skipping setup')
      return
    }

    console.log(`[SyncManager] Setting up script: ${funscriptPath}`)
    console.log(`[SyncManager] Motion range: ${prefs.rangeMin}-${prefs.rangeMax} (${prefs.rangeMode}), rate: ${rate}x`)
    console.log(`[SyncManager] CSV generated: ${csv.split('\n').length - 1} actions, sha256: ${sha256.slice(0, 12)}...`)

    if (this.isPlaying) {
      console.log('[SyncManager] Stopping current playback before script switch')
      await this.client.hsspStop().catch(() => {})
      this.isPlaying = false
    }
    if (superseded()) return

    // From here the device no longer holds a script we can honestly play: the
    // old one is stopped and the new one isn't uploaded yet. Clearing this now
    // makes onPlay() hold off rather than firing the previous video's script
    // during the setup window.
    this.currentSha256 = ''

    const wasCached = this.uploadCache.has(sha256)

    // Upload, mode switch and clock sync don't depend on each other, so pay for
    // the slowest rather than the sum. syncClocks() is normally already resolved.
    const [url] = await Promise.all([
      this.getScriptUrl(csv, sha256),
      this.client.setMode(1), // HSSP
      this.syncClocks()
    ])
    if (superseded()) return

    try {
      await this.client.hsspSetup(url, sha256)
    } catch (err) {
      // Hosted URLs are temporary and can expire out from under a cached entry.
      if (!wasCached) throw err
      console.warn('[SyncManager] Cached script URL rejected, re-uploading:', err)
      this.uploadCache.delete(sha256)
      const freshUrl = await this.getScriptUrl(csv, sha256)
      if (superseded()) return
      await this.client.hsspSetup(freshUrl, sha256)
    }
    if (superseded()) return

    this.currentSha256 = sha256
    console.log(`[SyncManager] Script setup complete in ${Date.now() - startedAt}ms`)

    // Clock offset drifts slowly, so refresh it off the critical path — the
    // existing offset stays good enough to play with meanwhile.
    if (this.client.isServerTimeStale()) {
      this.client.syncServerTime().catch(() => {})
    }
  }

  /**
   * Forget whatever script the device is holding and stop it.
   *
   * Called when a video has no script of its own. Without this the device keeps
   * the previous video's script loaded and onPlay() would happily run it against
   * unrelated footage — which looks exactly like "the funscript doesn't match".
   */
  async clearScript(): Promise<void> {
    // Supersede any setup still in flight for the video we just left.
    this.setupGeneration++
    const hadScript = this.currentScriptPath !== null
    this.currentScriptPath = null
    if (!this.currentSha256 && !this.isPlaying && !hadScript) return
    console.log('[SyncManager] Clearing script - this video has none')
    this.currentSha256 = ''
    if (!this.isConnected) return
    this.isPlaying = false
    await this.client.hsspStop().catch(() => {})
  }

  /**
   * Rebuild and re-send the loaded script under the current motion-range
   * preference. The range is baked into the CSV, so a settings change means a
   * different script identity — the upload and setup have to be redone.
   *
   * Returns whether the caller should resync playback afterwards: setup stops
   * the device, so a playing video needs an onPlay() at its current position.
   */
  async reloadScript(): Promise<boolean> {
    if (!this.isConnected || !this.currentScriptPath) return false
    const wasPlaying = this.isPlaying
    console.log('[SyncManager] Reloading script for motion-range change')
    await this.setupScript(this.currentScriptPath)
    return wasPlaying
  }

  getPlaybackRate(): number {
    return this.playbackRate
  }

  /**
   * Re-time the loaded script for a new video playback rate.
   *
   * The device cannot change speed on its own, so the script has to be rebuilt
   * and re-uploaded. `this.playbackRate` is deliberately updated *last*: until
   * the device is confirmed to hold the re-timed script, every position
   * conversion must keep using the rate the device is actually playing at.
   * Should the setup throw, the rate stays put and the caller leaves the video
   * speed alone too — both sides stay on the old rate rather than drifting apart.
   *
   * Returns whether playback needs resyncing afterwards; the caller must only
   * change the video's speed once this has resolved.
   */
  async setPlaybackRate(rate: number): Promise<boolean> {
    if (rate === this.playbackRate) return false

    // Nothing on the device to keep in step with — adopt the rate directly so
    // the next script built is already correct.
    if (!this.isConnected || !this.currentScriptPath) {
      console.log(`[SyncManager] Playback rate -> ${rate}x (no script loaded)`)
      this.playbackRate = rate
      return false
    }

    const wasPlaying = this.isPlaying
    console.log(`[SyncManager] Re-timing script for ${rate}x playback`)
    await this.setupScript(this.currentScriptPath, rate)
    this.playbackRate = rate
    return wasPlaying
  }

  private async getScriptUrl(csv: string, sha256: string): Promise<string> {
    const cached = this.uploadCache.get(sha256)
    if (cached) {
      console.log('[SyncManager] Reusing hosted script URL from cache')
      return cached
    }
    const url = await this.client.uploadScript(csv)
    this.uploadCache.set(sha256, url)
    return url
  }

  async onPlay(positionMs: number): Promise<void> {
    console.log(`[SyncManager] onPlay - position: ${positionMs.toFixed(0)}ms, connected: ${this.isConnected}`)
    if (!this.isConnected) return
    // No script loaded means either this video has none or its setup is still
    // running. Either way, staying still beats running the wrong script.
    if (!this.currentSha256) {
      console.log('[SyncManager] onPlay ignored - no script loaded')
      return
    }
    this.isPlaying = true
    // hsspPlay needs a server-time offset to line the device up against. Wait on
    // an in-flight sync, but never kick off a fresh one here — that would block
    // playback for seconds.
    if (this.clockSync && !this.client.hasServerTime()) await this.clockSync
    await this.client.hsspPlay(this.toScriptTime(positionMs))
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
    await this.client.hsspPlay(this.toScriptTime(positionMs))
  }

  getConnected(): boolean {
    return this.isConnected
  }
}
