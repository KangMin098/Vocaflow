// scripts/csat/map/anchor-bind.mts
//
// 계약 B(Evidence Anchor) 결속 — 합의 주석(evidence-tasks.v1.json)의 근거 문장을 **원문 텍스트**에 묶는다(2026-10-10 · MC-06).
// 지금 주석은 골격 서명(문장 길이 해시)에만 묶여 있다 — 경계만 같은 다른 문장을 막지 못한다(계약 B-2 · boundary_only).
// 이 스크립트는 개발 DB 의 기출 원문(csat_items.passage)을 읽어(읽기만) 문항마다 다음을 주석 파일에 적는다.
//   source: { revision(원문 sha256) · textHash(정규화 문장 배열 sha256) · normalization · segmentation }
//   anchors: 근거 · 갈린 문장마다 { index · textHash · charRange } — 원문은 복제하지 않는다(해시 · 위치만)
// 문장 경계가 골격과 하나라도 다르면 결속하지 않고 멈춘다(번호가 어긋나면 채점이 틀린 문장을 가리킨다).
// 재실행 안전 — 같은 원문이면 같은 값으로 덮어쓴다. 원문이 바뀌었으면 값이 바뀌고, 런타임 관문이 재검토 전까지 과제를 닫는다.
//   cd apps/web && node <tsx cli> --env-file=<.env.local> ../../scripts/csat/map/anchor-bind.mts [--check]
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { createClient } from '@supabase/supabase-js'

import { splitSentences } from '../../../apps/web/src/lib/csat/passage-skeleton'
import { NORMALIZATION_VERSION, sourceHash, textHash } from '../../../apps/web/src/lib/csat/map/evidence-anchor'
import { SEGMENTATION_VERSION } from '../../../apps/web/src/lib/knowledge/anchor-source'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const FILE = path.join(ROOT, 'apps/web/src/lib/knowledge/annotations/evidence-tasks.v1.json')
const CHECK = process.argv.includes('--check')
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL as string
if (!URL_?.includes('jajenrevcbmrpaliomxv')) throw new Error('개발 프로젝트가 아니다')
const db = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } })

type Item = { key: string; sentenceCount: number; evidence: number[]; disputed: number[]; source?: unknown; anchors?: unknown }
const doc = JSON.parse(fs.readFileSync(FILE, 'utf8')) as { items: Record<string, Item> }
let changed = 0
for (const [id, it] of Object.entries(doc.items)) {
  const { data, error } = await db.from('csat_items').select('passage').eq('id', id).maybeSingle()
  if (error) throw error
  const passage = data?.passage as string | undefined
  if (!passage) throw new Error(`${id} 원문 없음`)
  const ranges = splitSentences(passage)
  const sentences = ranges.map((r) => passage.slice(r.start, r.end))
  if (sentences.length !== it.sentenceCount) throw new Error(`${id} 문장 수 ${sentences.length} ≠ 주석 ${it.sentenceCount} — 결속하지 않는다`)
  const unit = (index: number) => ({ index, textHash: textHash(sentences[index]), charRange: { start: ranges[index].start, end: ranges[index].end } })
  const source = { revision: crypto.createHash('sha256').update(passage).digest('hex'), textHash: sourceHash(sentences), normalization: NORMALIZATION_VERSION, segmentation: SEGMENTATION_VERSION }
  const anchors = { evidence: it.evidence.map(unit), disputed: it.disputed.map(unit) }
  if (JSON.stringify(it.source) !== JSON.stringify(source) || JSON.stringify(it.anchors) !== JSON.stringify(anchors)) {
    changed++
    console.log(`${CHECK ? '다름' : '결속'} ${id} · 근거 ${it.evidence.map((i) => i + 1).join(',')} · 원문 ${source.revision.slice(0, 10)}`)
    it.source = source
    it.anchors = anchors
  }
}
if (CHECK) {
  console.log(changed ? `원문과 다른 주석 ${changed} — 재검토 필요` : '모든 주석이 지금 원문과 같다')
  process.exitCode = changed ? 1 : 0
} else {
  fs.writeFileSync(FILE, JSON.stringify(doc, null, 1) + '\n')
  console.log(`결속 ${changed} · 전체 ${Object.keys(doc.items).length}`)
}
