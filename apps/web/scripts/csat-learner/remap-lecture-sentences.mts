// apps/web/scripts/csat-learner/remap-lecture-sentences.mts
//
// **강의 대본의 문장 번호(`sentence:k`)를 새 원문 분할로 옮긴다.** (2026-09-25 · 원문 재생성 3단계)
//
// DB 원문을 reflow 로 다시 만들면(`regen-passages.mts`) 쪽 번호가 붙어 한 문장으로 셌던 곳이 두 문장이 된다
// (장문 43~45 · 29회차 전부 +1). 강의 큐는 옛 분할의 번호라, 그대로 두면 강조가 한 칸씩 밀린다.
// 옛/새 문장 길이열을 `alignSentences`(Gale–Church · align.ts)로 짝지어 번호를 옮긴다.
//
//   옛 분할 = `--old <regen-backup.json>`(적재 뒤) 또는 지금 DB(적재 전 dry-run)
//   새 분할 = reflow(로컬 PDF) — regen 이 DB 에 넣는 값과 같은 함수
//   옛 문장 하나가 새 문장 둘로 갈리면 앞 조각으로 옮기고 「갈린 자리」로 따로 센다(글자 없이 어느 조각인지 모른다)
//
// 기본은 dry-run. `--write` 가 있어야 `src/lib/csat/lecture-data/*.json` 을 고친다(저장소 파일 · DB 무관).
//   npx tsx scripts/csat-learner/remap-lecture-sentences.mts [--old <backup.json>] [--write]

import fs from 'node:fs'
import path from 'node:path'

import { splitSentences } from '../../src/lib/csat/passage-skeleton'
import { alignSentences } from '../../src/lib/csat/reflow/align'
import { reflowExam } from '../../src/lib/csat/reflow/reflow'
import type { ReflowAnchors } from '../../src/lib/csat/reflow/types'
import { arg, flag, localPapers, pdfPages, serviceDb } from './env.mts'

const WRITE = flag('write')
const OLD = arg('old')
const LEC = path.resolve('src/lib/csat/lecture-data')
const db = await serviceDb()
const papers = localPapers()

const lengths = (s: string) => splitSentences(s).map((r) => r.end - r.start)
const backup = OLD ? new Map((JSON.parse(fs.readFileSync(path.resolve(OLD), 'utf8')) as { id: string; passage: string | null }[]).map((b) => [b.id, b.passage])) : null

type Cue = { target: { kind: string; id: string }; segments?: { lang: string; text: string }[] }
const squash = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, ' ').trim()
type Lecture = { item_id: string; cues: Cue[] }

const tally = { items: 0, cues: 0, moved: 0, split: 0, splitByQuote: 0, unmatched: 0, files: 0 }
const splitAt: string[] = []

for (const f of fs.readdirSync(LEC).filter((x) => x.endsWith('.json') && x !== 'index.json')) {
  const file = path.join(LEC, f)
  const j = JSON.parse(fs.readFileSync(file, 'utf8')) as { exam_id: string; lectures: Record<string, Lecture> }
  const anchors = JSON.parse(fs.readFileSync(path.resolve(`src/lib/csat/anchor-data/${j.exam_id}.json`), 'utf8')) as ReflowAnchors & { sha256: string }
  const pdf = papers.get(anchors.sha256)
  if (!pdf) continue
  const { data, error } = await db.from('csat_items').select('id, no, type_id, passage').eq('exam_id', j.exam_id).eq('in_scope', true)
  if (error) throw error
  const rows = (data ?? []) as { id: string; no: number; type_id: string | null; passage: string | null }[]
  const got = reflowExam(await pdfPages(pdf), anchors, (no) => rows.find((r) => r.no === no)?.type_id ?? null, rows.map((r) => r.no))
  let changed = false
  for (const lec of Object.values(j.lectures)) {
    const row = rows.find((r) => r.id === lec.item_id)
    const oldText = backup?.has(lec.item_id) ? backup.get(lec.item_id) : row?.passage
    const rf = row ? got.get(row.no) : undefined
    if (!oldText || !rf?.passage) continue
    const a = lengths(oldText)
    const b = lengths(rf.passage)
    if (a.length === b.length) continue
    tally.items++
    const map = new Map<number, { to: number; split: boolean; parts: number[] }>()
    for (const blk of alignSentences(a, b)) for (const i of blk.a) if (blk.b.length) map.set(i, { to: blk.b[0], split: blk.b.length > 1, parts: blk.b })
    const newSentences = splitSentences(rf.passage).map((r) => squash(rf.passage.slice(r.start, r.end)))
    for (const cue of lec.cues) {
      const m = /^sentence:(\d+)$/.exec(cue.target.kind === 'anchor' ? cue.target.id : '')
      if (!m) continue
      tally.cues++
      const k = Number(m[1])
      const hit = map.get(k)
      if (!hit) {
        tally.unmatched++
        continue
      }
      let to = hit.to
      if (hit.split) {
        // 갈린 자리 — 큐의 영어 인용이 두 조각 중 어디 있는지로 고른다. 인용이 없으면 앞 조각
        const quotes = (cue.segments ?? []).filter((s) => s.lang.startsWith('en')).map((s) => squash(s.text)).filter((q) => q.length >= 8)
        const found = hit.parts.find((p) => quotes.some((q) => newSentences[p]?.includes(q)))
        if (found !== undefined) {
          to = found
          tally.splitByQuote++
        } else {
          tally.split++
          splitAt.push(`${lec.item_id}#${k}`)
        }
      }
      if (to !== k) {
        tally.moved++
        cue.target.id = `sentence:${to}`
        changed = true
      }
    }
  }
  if (changed && WRITE) {
    fs.writeFileSync(file, JSON.stringify(j, null, 2) + '\n')
    tally.files++
  }
}

console.log(`=== 강의 문장 번호 옮기기 ${WRITE ? '적용' : 'dry-run'} · 옛 분할 ${OLD ? `백업 ${OLD}` : '지금 DB'} ===`)
console.log(`문장 수가 바뀐 강의 ${tally.items} · 그 안의 문장 큐 ${tally.cues} · 번호가 바뀌는 큐 ${tally.moved} · 갈린 자리: 인용으로 고름 ${tally.splitByQuote} · 인용 없어 앞 조각 ${tally.split} · 짝 없음 ${tally.unmatched}${WRITE ? ` · 고친 파일 ${tally.files}` : ''}`)
if (splitAt.length) console.log(`  갈린 자리(앞 조각으로 옮김): ${splitAt.join(' ')}`)
