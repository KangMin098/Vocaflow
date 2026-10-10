// scripts/csat/map/anchor-bind.mts
//
// 계약 B(Evidence Anchor) 결속 — 합의 주석(evidence-tasks.v1.json)의 근거 문장을 **원문 텍스트**에 묶는다(2026-10-10 · MC-06).
// 지금 주석은 골격 서명(문장 길이 해시)에만 묶여 있다 — 경계만 같은 다른 문장을 막지 못한다(계약 B-2 · boundary_only).
// 이 스크립트는 개발 DB 의 기출 원문(csat_items.passage)을 읽어(읽기만) 문항마다 다음을 주석 파일에 적는다.
//   source: { revision(원문 sha256) · textHash(정규화 문장 배열 sha256) · normalization · segmentation }
//   anchors: 근거 · 갈린 문장마다 { index · textHash · charRange } — 원문은 복제하지 않는다(해시 · 위치만)
// 문장 경계가 골격과 하나라도 다르면 결속하지 않고 멈춘다(번호가 어긋나면 채점이 틀린 문장을 가리킨다).
// 처음 결속(결속 없는 문항)만 자동으로 쓴다. **이미 결속된 문항의 원문 · 주석이 바뀌었으면 덮어쓰지 않는다** —
// 재검토 없이 과제가 다시 열리면 안 된다(Codex P1). 그 문항은 런타임 관문이 닫아 둔 채로 남는다.
// 재검토를 마친 문항만 `--rebind <itemId> --reason "<누가 무엇을 확인했나>"` 로 다시 묶는다(사유가 주석 rebound 에 남는다).
//   cd apps/web && node <tsx cli> --env-file=<.env.local> ../../scripts/csat/map/anchor-bind.mts [--check] [--rebind <itemId> --reason "…"]
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
const arg = (k: string) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : null)
const REBIND = arg('--rebind')
const REASON = arg('--reason')
if (REBIND && (!REASON || REASON.length < 10)) throw new Error('--rebind 는 재검토 사유(--reason, 10자 이상)가 필요하다')
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL as string
if (!URL_?.includes('jajenrevcbmrpaliomxv')) throw new Error('개발 프로젝트가 아니다')
const db = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } })

type Item = { key: string; sentenceCount: number; evidence: number[]; disputed: number[]; source?: unknown; anchors?: unknown; rebound?: { reason: string; at: string }[] }
const doc = JSON.parse(fs.readFileSync(FILE, 'utf8')) as { items: Record<string, Item> }
let written = 0
const blocked: string[] = []
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
  if (JSON.stringify(it.source) === JSON.stringify(source) && JSON.stringify(it.anchors) === JSON.stringify(anchors)) continue
  const wasBound = !!it.source
  if (wasBound && REBIND !== id) {
    blocked.push(id)
    console.log(`다름(재검토 필요) ${id} — 덮어쓰지 않는다. 확인 뒤 --rebind ${id} --reason "…"`)
    continue
  }
  console.log(`${CHECK ? '다름' : wasBound ? '재결속' : '결속'} ${id} · 근거 ${it.evidence.map((i) => i + 1).join(',')} · 원문 ${source.revision.slice(0, 10)}`)
  if (CHECK) { blocked.push(id); continue }
  it.source = source
  it.anchors = anchors
  if (wasBound) it.rebound = [...(it.rebound ?? []), { reason: REASON as string, at: new Date().toISOString() }]
  written++
}
if (CHECK) {
  console.log(blocked.length ? `원문과 다른 주석 ${blocked.length} — 재검토 필요` : '모든 주석이 지금 원문과 같다')
  process.exitCode = blocked.length ? 1 : 0
} else {
  if (written) fs.writeFileSync(FILE, JSON.stringify(doc, null, 1) + '\n')
  console.log(`결속 ${written} · 재검토 필요(그대로 둠) ${blocked.length} · 전체 ${Object.keys(doc.items).length}`)
  if (blocked.length) process.exitCode = 1
}
