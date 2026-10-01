// apps/web/src/lib/methodology/transcript.ts
import { createHash } from 'node:crypto'

export interface Caption { start: number; end: number; text: string }
export interface CaptionSegment extends Caption { boundary: 'pause' | 'sentence' | 'budget' | 'end' }
export interface Permission {
  analysisPermitted: true; basis: string; sourceId: string; sourceUrl: string
  /** Hash binds permission to the supplied file, not any arbitrary replacement. */
  sha256: string
}
export const digest = (raw: string) => `sha256:${createHash('sha256').update(raw, 'utf8').digest('hex')}`

function seconds(value: string) {
  const parts = value.replace(',', '.').split(':').map(Number)
  if (parts.length < 2 || parts.length > 3 || parts.some(n => !Number.isFinite(n) || n < 0) || parts.at(-1)! >= 60 || (parts.length === 3 && parts[1] >= 60)) throw new Error('Malformed caption timestamp')
  return parts.reduce((total, part) => total * 60 + part, 0)
}
/** Parse permitted SRT/WebVTT in memory. Never write or persist raw text. */
export function parseCaptions(raw: string, permission: Permission): Caption[] {
  if (permission.analysisPermitted !== true || !permission.basis?.trim() || !permission.sourceId?.trim() || !/^https:\/\//.test(permission.sourceUrl) || permission.sha256 !== digest(raw)) throw new Error('Permission or transcript hash mismatch')
  const cues: Caption[] = []
  const blocks = raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split(/\n\s*\n/)
  for (const block of blocks) {
    if (/^(WEBVTT|NOTE|STYLE|REGION)(\s|$)/.test(block)) continue
    const lines = block.split('\n')
    const index = lines.findIndex(line => line.includes('-->'))
    if (index < 0) { if (block.trim()) throw new Error('Caption block has no time range'); continue }
    const match = lines[index].match(/^\s*([\d:.,]+)\s+-->\s+([\d:.,]+)(?:\s+.*)?$/)
    if (!match) throw new Error('Malformed caption time range')
    const start = seconds(match[1]), end = seconds(match[2])
    if (end <= start) throw new Error('Caption ends before it starts')
    // Keep speaker names; discard only WebVTT styling/timing tags.
    const text = lines.slice(index + 1).join(' ').replace(/<v\s+([^>]+)>/g, '$1: ').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
    if (text) cues.push({ start, end, text })
  }
  if (!cues.length) throw new Error('No readable caption cues')
  for (let i = 1; i < cues.length; i++) if (cues[i].start < cues[i - 1].start) throw new Error('Caption times are not ordered')
  // Rolling ASR duplicates are removed only when intervals overlap. Repeated instructions later remain.
  const normalized: Caption[] = []
  for (const cue of cues) {
    const previous = normalized.at(-1)
    if (previous && cue.start <= previous.end && cue.text.startsWith(previous.text)) { previous.text = cue.text; previous.end = Math.max(previous.end, cue.end) }
    else normalized.push({ ...cue })
  }
  return normalized
}
/** Propose boundaries; the agent still judges topic/meaning. Budget cuts are explicitly labeled. */
export function segmentCaptions(cues: Caption[], maxChars = 2400): CaptionSegment[] {
  if (!Number.isInteger(maxChars) || maxChars < 80) throw new Error('maxChars must be >=80')
  const result: CaptionSegment[] = []
  let current: Caption | undefined
  const flush = (boundary: CaptionSegment['boundary']) => { if (current) result.push({ ...current, boundary }); current = undefined }
  for (const cue of cues) {
    if (cue.text.length > maxChars) throw new Error('Single cue exceeds segment budget; inspect source before extraction')
    if (current && cue.start - current.end >= 2) flush('pause')
    if (current && current.text.length + cue.text.length + 1 > maxChars) flush('budget')
    current = current ? { start: current.start, end: Math.max(current.end, cue.end), text: `${current.text} ${cue.text}` } : { ...cue }
    if (current.text.length >= maxChars / 2 && /[.!?。？！]["'”’]?$/u.test(current.text)) flush('sentence')
  }
  flush('end')
  return result
}
