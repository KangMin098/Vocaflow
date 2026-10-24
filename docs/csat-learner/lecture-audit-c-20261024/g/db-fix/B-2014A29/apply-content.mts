// docs/csat-learner/lecture-audit-c-20261024/g/db-fix/B-2014A29/apply-content.mts
// 2014A#29 감수 확정 문안(FINAL_CONTENT.json)을 저장소 콘텐츠에 입힌다 — 강의 c9(version 3) · 탐구 6곳.
// 낭독 시간은 withComputedTimes, 말한 문장 focus 는 withFocus 로 다시 계산한다. 다른 문항 · 다른 cue 는 바꾸지 않는다.
//   npx tsx apply-content.mts <repo-root> <FINAL_CONTENT.json>
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const [root, finalFile] = process.argv.slice(2)
const web = path.join(root, 'apps/web/src/lib/csat')
const { withComputedTimes } = await import(pathToFileURL(path.join(web, 'lecture/validate.ts')).href)
const { withFocus } = await import(pathToFileURL(path.join(web, 'lecture/focus.ts')).href)
const fc = JSON.parse(fs.readFileSync(finalFile, 'utf8'))

// 강의 — c9 만 교체하고 version 을 올린다
const lecFile = path.join(web, 'lecture-data/2014A.json')
const lecRaw = fs.readFileSync(lecFile, 'utf8')
const exam = JSON.parse(lecRaw)
const lec = exam.lectures['2014A#29']
if (lec.version !== 2) throw new Error(`2014A#29 강의 version 이 2 가 아니다: ${lec.version}`)
const i = lec.cues.findIndex((c: { id: string }) => c.id === 'c9')
const old = lec.cues[i]
if (old.target?.id !== 'reject:3') throw new Error('c9 target 이 reject:3 이 아니다')
const sentences = String(fc.lecture_c9_v3).split(/(?<=[.?!])\s+/).filter(Boolean)
const cues = lec.cues.map((c: unknown, k: number) => (k === i ? { ...old, segments: sentences.map((text: string) => ({ lang: 'ko-KR', text })) } : c))
const sk = JSON.parse(fs.readFileSync(path.join(web, 'skeleton-data/2014A.json'), 'utf8')).items
const skItem = Array.isArray(sk) ? sk.find((x: { id: string }) => x.id === '2014A#29') : sk['2014A#29']
const timed = withComputedTimes({ ...lec, cues: withFocus(cues, skItem.sentences.length) })
const next = { ...timed, version: 3 }
const c9 = next.cues[i]
if (JSON.stringify(c9.focus) !== JSON.stringify([4])) throw new Error(`c9 focus 가 [4] 가 아니다: ${JSON.stringify(c9.focus)}`)
exam.lectures['2014A#29'] = next
const eol = lecRaw.includes('\r\n') ? '\r\n' : '\n'
const indent = /^\{\n( +)"/.exec(lecRaw.replace(/\r\n/g, '\n'))?.[1].length ?? 2
fs.writeFileSync(lecFile, JSON.stringify(exam, null, indent).replace(/\n/g, eol) + (lecRaw.endsWith('\n') ? eol : ''))

// 탐구 — 경로 6곳의 문자열만 교체(현재 값이 「잘림·보류」 전제인지 확인)
const inqFile = path.join(web, 'inquiry-data.json')
const inqRaw = fs.readFileSync(inqFile, 'utf8')
const inq = JSON.parse(inqRaw)
for (const [p, text] of Object.entries(fc.inquiry as Record<string, string>)) {
  const keys = p.split('.').slice(1) // items 다음부터(문항 id 에 '.' 이 없다)
  let o = inq.items
  for (const k of keys.slice(0, -1)) o = o[k]
  const last = keys.at(-1) as string
  if (typeof o[last] !== 'string') throw new Error(`${p}: 문자열이 아니다`)
  if (!/(잘|보류|month|확인하지 못했)/.test(o[last])) throw new Error(`${p}: 현재 값이 예상과 다르다`)
  o[last] = text
}
const ieol = inqRaw.includes('\r\n') ? '\r\n' : '\n'
const iindent = /^\{\n( +)"/.exec(inqRaw.replace(/\r\n/g, '\n'))?.[1].length ?? 1
fs.writeFileSync(inqFile, JSON.stringify(inq, null, iindent).replace(/\n/g, ieol) + (inqRaw.endsWith('\n') ? ieol : ''))
console.log(JSON.stringify({ lecture: { version: next.version, c9_segments: c9.segments.length, c9_est_sec: c9.est_sec, focus: c9.focus }, inquiry_fields: Object.keys(fc.inquiry).length }))
