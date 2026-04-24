import ffmpeg from 'fluent-ffmpeg'
import ffmpegPath from 'ffmpeg-static'
import ffprobePath from 'ffprobe-static'
import path from 'path'
import fs from 'fs'
import { app } from 'electron'

// Set ffmpeg/ffprobe paths
ffmpeg.setFfmpegPath(ffmpegPath as unknown as string)
ffmpeg.setFfprobePath(ffprobePath.path)

let tempDir = ''

function ensureTempDir(): string {
  if (!tempDir) {
    tempDir = path.join(app.getPath('temp'), 'funnyplayer')
  }
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
  }
  return tempDir
}

export function extractSubtitle(inputPath: string, subtitleStreamIndex: number): Promise<string> {
  ensureTempDir()
  const hash = Buffer.from(inputPath).toString('base64url').slice(0, 20)
  const outputPath = path.join(tempDir, `${hash}_s${subtitleStreamIndex}.vtt`)

  if (fs.existsSync(outputPath)) {
    return Promise.resolve(outputPath)
  }

  return new Promise((resolve, reject) => {
    console.log(`[ffmpeg] Extracting subtitle stream ${subtitleStreamIndex}: ${inputPath}`)
    ffmpeg(inputPath)
      .outputOptions([
        '-map', `0:${subtitleStreamIndex}`,
        '-c:s', 'webvtt'
      ])
      .output(outputPath)
      .on('end', () => {
        console.log(`[ffmpeg] Subtitle extraction complete: ${outputPath}`)
        resolve(outputPath)
      })
      .on('error', (err) => {
        console.error(`[ffmpeg] Subtitle extraction error:`, err)
        reject(err)
      })
      .run()
  })
}
