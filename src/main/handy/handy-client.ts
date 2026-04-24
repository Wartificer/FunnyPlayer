const HANDY_BASE = 'https://www.handyfeeling.com/api/handy/v2'

export class HandyClient {
  private connectionKey: string = ''
  private serverTimeOffset: number = 0

  setConnectionKey(key: string): void {
    this.connectionKey = key
  }

  getConnectionKey(): string {
    return this.connectionKey
  }

  private async request(method: string, endpoint: string, body?: unknown): Promise<unknown> {
    const url = `${HANDY_BASE}${endpoint}`
    console.log(`[Handy] ${method} ${endpoint}`, body ?? '')
    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Connection-Key': this.connectionKey
        },
        body: body ? JSON.stringify(body) : undefined
      })
      const json = await res.json()
      console.log(`[Handy] ${method} ${endpoint} -> ${res.status}`, json)
      return json
    } catch (err) {
      console.error(`[Handy] ${method} ${endpoint} FAILED:`, err)
      throw err
    }
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

  async hsspSetup(url: string, sha256?: string): Promise<void> {
    console.log(`[Handy] HSSP setup - script URL: ${url}`)
    await this.request('PUT', '/hssp/setup', { url, sha256: sha256 || '' })
  }

  async syncDeviceClock(): Promise<void> {
    console.log('[Handy] Syncing device clock with server (/hstp/sync)...')
    const res = await this.request('GET', '/hstp/sync?syncCount=30&outliers=6')
    console.log('[Handy] Device clock sync result:', res)
  }

  async syncServerTime(): Promise<void> {
    console.log('[Handy] Calculating server time offset...')
    const samples: number[] = []
    for (let i = 0; i < 5; i++) {
      const sendTime = Date.now()
      const res = (await this.request('GET', '/servertime')) as { serverTime: number }
      const receiveTime = Date.now()
      const rtd = receiveTime - sendTime
      const estimatedServerTime = res.serverTime + rtd / 2
      const offset = estimatedServerTime - receiveTime
      samples.push(offset)
      console.log(`[Handy] Time sample ${i + 1}/5: offset=${offset.toFixed(0)}ms, rtd=${rtd}ms`)
    }
    samples.sort((a, b) => a - b)
    this.serverTimeOffset = samples[Math.floor(samples.length / 2)]
    console.log(`[Handy] Server time offset (median): ${this.serverTimeOffset.toFixed(0)}ms`)
  }

  getEstimatedServerTime(): number {
    return Date.now() + this.serverTimeOffset
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
