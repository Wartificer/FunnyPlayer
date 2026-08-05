const HANDY_BASE = 'https://www.handyfeeling.com/api/handy/v2'

// Handy's own temporary script hosting. Documented as the endpoint third-party
// apps should use, needs no authentication, and returns a content-addressed URL
// (identical script content always yields the same URL, so re-uploads dedupe
// server side). The device fetches from Handy's own CDN rather than a public
// file-sharing host, which is both far faster and keeps scripts off third parties.
const SCRIPT_UPLOAD_URL = 'https://scripts01.handyfeeling.com/api/script/v0/temp/upload'

// How long a measured server-time offset stays trustworthy before a refresh.
const SERVER_TIME_TTL_MS = 5 * 60 * 1000

interface HandyApiError {
  code: number
  name: string
  message: string
  connected?: boolean
}

export class HandyClient {
  private connectionKey: string = ''
  private serverTimeOffset: number = 0
  private serverTimeSyncedAt: number = 0
  private serverTimeInFlight: Promise<void> | null = null

  setConnectionKey(key: string): void {
    this.connectionKey = key
  }

  getConnectionKey(): string {
    return this.connectionKey
  }

  private async request(method: string, endpoint: string, body?: unknown): Promise<unknown> {
    const url = `${HANDY_BASE}${endpoint}`
    console.log(`[Handy] ${method} ${endpoint}`, body ?? '')
    let json: unknown
    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Connection-Key': this.connectionKey
        },
        body: body ? JSON.stringify(body) : undefined
      })
      json = await res.json()
      console.log(`[Handy] ${method} ${endpoint} -> ${res.status}`, json)
    } catch (err) {
      console.error(`[Handy] ${method} ${endpoint} FAILED:`, err)
      throw err
    }

    // The v2 API answers 200 even when the command failed — the payload carries
    // an `error` object instead of a result. Without this check a failed setup
    // looks identical to a successful one and the device just never moves.
    const apiError = (json as { error?: HandyApiError }).error
    if (apiError) {
      throw new Error(
        `Handy ${method} ${endpoint} failed: ${apiError.name} (${apiError.code}) — ${apiError.message}`
      )
    }
    return json
  }

  async isConnected(): Promise<boolean> {
    const res = (await this.request('GET', '/connected')) as { connected: boolean }
    console.log(`[Handy] Device connected: ${res.connected}`)
    return res.connected
  }

  async setMode(mode: number): Promise<void> {
    console.log(`[Handy] Setting mode to ${mode} (1=HSSP)`)
    await this.request('PUT', '/mode', { mode })
  }

  /** Upload a CSV script and return the URL the device should download it from. */
  async uploadScript(csv: string): Promise<string> {
    const formData = new FormData()
    formData.append('file', new Blob([csv], { type: 'text/csv' }), 'script.csv')

    console.log('[Handy] Uploading script to Handy script hosting...')
    const res = await fetch(SCRIPT_UPLOAD_URL, { method: 'POST', body: formData })
    const text = await res.text()

    let json: { url?: string }
    try {
      json = JSON.parse(text)
    } catch {
      throw new Error(`Script upload failed (${res.status}): ${text.slice(0, 200)}`)
    }
    if (!json.url) {
      throw new Error(`Script upload failed (${res.status}): no URL returned`)
    }
    console.log(`[Handy] Script hosted at: ${json.url}`)
    return json.url
  }

  /**
   * Ask the device to sync its own clock against the Handy server. The device
   * performs `syncCount` round trips itself, so this takes several seconds —
   * it belongs on the connect path, never on the per-video path.
   */
  async syncDeviceClock(syncCount = 30): Promise<void> {
    console.log(`[Handy] Syncing device clock with server (${syncCount} samples)...`)
    const res = await this.request('GET', `/hstp/sync?syncCount=${syncCount}&outliers=6`)
    console.log('[Handy] Device clock sync result:', res)
  }

  /**
   * Measure our own offset from the Handy server clock. Concurrent callers share
   * a single in-flight run so a background refresh can never double up with an
   * explicit sync.
   */
  syncServerTime(): Promise<void> {
    if (!this.serverTimeInFlight) {
      this.serverTimeInFlight = this.measureServerTime().finally(() => {
        this.serverTimeInFlight = null
      })
    }
    return this.serverTimeInFlight
  }

  private async measureServerTime(samples = 5): Promise<void> {
    console.log('[Handy] Calculating server time offset...')
    const offsets: number[] = []
    for (let i = 0; i < samples; i++) {
      const sendTime = Date.now()
      const res = (await this.request('GET', '/servertime')) as { serverTime: number }
      const receiveTime = Date.now()
      const rtd = receiveTime - sendTime
      const estimatedServerTime = res.serverTime + rtd / 2
      const offset = estimatedServerTime - receiveTime
      offsets.push(offset)
      console.log(`[Handy] Time sample ${i + 1}/${samples}: offset=${offset.toFixed(0)}ms, rtd=${rtd}ms`)
    }
    offsets.sort((a, b) => a - b)
    this.serverTimeOffset = offsets[Math.floor(offsets.length / 2)]
    this.serverTimeSyncedAt = Date.now()
    console.log(`[Handy] Server time offset (median): ${this.serverTimeOffset.toFixed(0)}ms`)
  }

  /** True once an offset has been measured at all. */
  hasServerTime(): boolean {
    return this.serverTimeSyncedAt > 0
  }

  /** True when the measured offset is old enough to be worth refreshing. */
  isServerTimeStale(): boolean {
    return Date.now() - this.serverTimeSyncedAt > SERVER_TIME_TTL_MS
  }

  getEstimatedServerTime(): number {
    return Date.now() + this.serverTimeOffset
  }

  /**
   * Set the device's own slide (stroke) range, 0-100.
   *
   * The device applies this in every mode by mapping the nominal 0-100 script
   * domain into the given zone — it scales, it never clamps. We do our own range
   * work on the script itself, so this is only ever used to open the device back
   * up to its full travel: a range left behind by the Handy app or the web remote
   * would otherwise compound with ours and make the app's slider look broken.
   */
  async setSlideRange(min: number, max: number): Promise<void> {
    console.log(`[Handy] Setting device slide range to ${min}-${max}`)
    await this.request('PUT', '/slide', { min, max })
  }

  async hsspSetup(url: string, sha256?: string): Promise<void> {
    console.log(`[Handy] HSSP setup - script URL: ${url}`)
    await this.request('PUT', '/hssp/setup', { url, sha256: sha256 || '' })
  }

  async hsspPlay(startTimeMs: number): Promise<void> {
    const est = Math.round(this.getEstimatedServerTime())
    const startTime = Math.round(startTimeMs)
    console.log(`[Handy] HSSP play - startTime: ${startTime}ms, estimatedServerTime: ${est}`)
    await this.request('PUT', '/hssp/play', {
      estimatedServerTime: est,
      startTime: startTime
    })
  }

  async hsspStop(): Promise<void> {
    console.log('[Handy] HSSP stop')
    await this.request('PUT', '/hssp/stop')
  }
}
