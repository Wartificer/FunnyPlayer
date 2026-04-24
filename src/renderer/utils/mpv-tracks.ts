import { getMpv } from '../mpv'
import { resolveLanguage } from '../constants/languages'

export interface MpvTrack {
  id: number
  type: 'audio' | 'video' | 'sub'
  title: string
  lang: string
  selected: boolean
}

export function getTrackList(): { audio: MpvTrack[]; subtitle: MpvTrack[] } {
  const mpv = getMpv()
  const audio: MpvTrack[] = []
  const subtitle: MpvTrack[] = []

  if (!mpv) return { audio, subtitle }

  const countStr = mpv.getPropertyString('track-list/count')
  const count = countStr ? parseInt(countStr, 10) : 0

  for (let i = 0; i < count; i++) {
    const type = mpv.getPropertyString(`track-list/${i}/type`) || ''
    if (type !== 'audio' && type !== 'sub') continue

    const track: MpvTrack = {
      id: parseInt(mpv.getPropertyString(`track-list/${i}/id`) || '0', 10),
      type: type as 'audio' | 'sub',
      title: mpv.getPropertyString(`track-list/${i}/title`) || '',
      lang: mpv.getPropertyString(`track-list/${i}/lang`) || '',
      selected: mpv.getPropertyBool(`track-list/${i}/selected`) ?? false
    }

    if (type === 'audio') audio.push(track)
    else subtitle.push(track)
  }

  return { audio, subtitle }
}

export function getTrackLabel(track: MpvTrack): string {
  const langDef = track.lang ? resolveLanguage(track.lang) : undefined
  const langLabel = langDef ? langDef.label : (track.lang || '')
  const parts: string[] = [`Track ${track.id}`]
  if (track.title) parts.push(track.title)
  if (langLabel) parts.push(`[${langLabel}]`)
  return parts.join(' - ')
}
