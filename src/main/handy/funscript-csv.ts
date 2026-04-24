import fs from 'fs'
import crypto from 'crypto'

interface FunscriptAction {
  at: number
  pos: number
}

interface Funscript {
  actions: FunscriptAction[]
}

export function funscriptToCsv(funscriptPath: string): { csv: string; sha256: string } {
  const raw = fs.readFileSync(funscriptPath, 'utf-8')
  const script: Funscript = JSON.parse(raw)

  const lines = ['#time_ms,position']
  for (const action of script.actions) {
    lines.push(`${action.at},${action.pos}`)
  }

  const csv = lines.join('\n')
  const sha256 = crypto.createHash('sha256').update(csv).digest('hex')

  return { csv, sha256 }
}
