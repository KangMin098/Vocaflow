// docs/csat-learner/lecture-audit-c-20261024/g/db-fix/B-2014A29/split-c9-lang.mts
// apply-content.mts 뒤 보정: c9 첫 문장의 영어 낱말 「Hours」를 en-US 조각으로 나눈다(한국어 조각에 영어 금지 — copyright-boundary 검사).
// 낭독 문구는 감수 확정본과 같다. 시간 · focus 는 다시 계산하고 version 3 은 유지한다.
//   npx tsx split-c9-lang.mts <repo-root>
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const [root] = process.argv.slice(2)
const web = path.join(root, 'apps/web/src/lib/csat')
const { withComputedTimes } = await import(pathToFileURL(path.join(web, 'lecture/validate.ts')).href)
const { withFocus } = await import(pathToFileURL(path.join(web, 'lecture/focus.ts')).href)
const lecFile = path.join(web, 'lecture-data/2014A.json')
const lecRaw = fs.readFileSync(lecFile, 'utf8')
const exam = JSON.parse(lecRaw)
const lec = exam.lectures['2014A#29']
if (lec.version !== 3) throw new Error(`version 이 3 이 아니다: ${lec.version}`)
const i = lec.cues.findIndex((c: { id: string }) => c.id === 'c9')
const first = '삼 번, 다섯 번째 문장 끝, Hours 에 붙은 별표 각주를 짚어 보세요.'
if (lec.cues[i].segments[0].text !== first) throw new Error('c9 첫 조각이 감수 확정본과 다르다')
const segments = [
  { lang: 'ko-KR', text: '삼 번, 다섯 번째 문장 끝,' },
  { lang: 'en-US', text: 'Hours' },
  { lang: 'ko-KR', text: '에 붙은 별표 각주를 짚어 보세요.' },
  ...lec.cues[i].segments.slice(1),
]
const cues = lec.cues.map((c: unknown, k: number) => (k === i ? { ...lec.cues[i], segments } : c))
const sk = JSON.parse(fs.readFileSync(path.join(web, 'skeleton-data/2014A.json'), 'utf8')).items
const skItem = Array.isArray(sk) ? sk.find((x: { id: string }) => x.id === '2014A#29') : sk['2014A#29']
const next = { ...withComputedTimes({ ...lec, cues: withFocus(cues, skItem.sentences.length) }), version: 3 }
if (JSON.stringify(next.cues[i].focus) !== JSON.stringify([4])) throw new Error(`focus 가 [4] 가 아니다: ${JSON.stringify(next.cues[i].focus)}`)
exam.lectures['2014A#29'] = next
const eol = lecRaw.includes('\r\n') ? '\r\n' : '\n'
const indent = /^\{\n( +)"/.exec(lecRaw.replace(/\r\n/g, '\n'))?.[1].length ?? 2
fs.writeFileSync(lecFile, JSON.stringify(exam, null, indent).replace(/\n/g, eol) + (lecRaw.endsWith('\n') ? eol : ''))
console.log(JSON.stringify({ segments: next.cues[i].segments.length, est_sec: next.cues[i].est_sec, focus: next.cues[i].focus }))
