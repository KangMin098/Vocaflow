// scripts/csat/map/vocab-export.mts
//
// V 「문맥 속 낱말 판단」 후보 내보내기(2026-10-10 · VS_DIRECT_CHECK_DESIGN §2 · 트랙 B). 개발 DB 읽기만 · 재실행 안전(덮어쓴다).
// 기출 R-VOCAB(30번류) 문항마다: 번호 붙은 지문 문장 · 발문 · 선지 · 밑줄 낱말(①–⑤)이 든 문장 번호(골격 reveals) · 공식 정답 번호.
//   packet-vocab.json  — 맹검 검토자용(공식 정답 · 골격 앵커 없음). 지문 원문이 들어 있어 커밋하지 않는다(.gitignore).
//   vocab-keys.json    — 정답 대조용(공식 정답 · 골격 answer 앵커 문장 · 문장 경계 일치 여부). 원문 없음.
//   cd apps/web && node <tsx cli> --env-file=<.env.local> ../../scripts/csat/map/vocab-export.mts
import fs from 'node:fs'
import path from 'node:path'

import { createClient } from '@supabase/supabase-js'

import { splitSentences } from '../../../apps/web/src/lib/csat/passage-skeleton'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const OUT = path.join(ROOT, 'scripts/csat/map/role-learners')
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL as string
if (!URL_?.includes('jajenrevcbmrpaliomxv')) throw new Error('개발 프로젝트가 아니다')
const db = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } })

type Sk = { id: string; type_id: string | null; sentences: { chars: number; reveals?: { anchorId: string; text: string }[] }[]; anchors: { id: string; sentences: number[] }[] }
const DIR = path.join(ROOT, 'apps/web/src/lib/csat/skeleton-data')
const pool: Sk[] = fs.readdirSync(DIR).filter((f) => f.endsWith('.json') && f !== 'index.json')
  .flatMap((f) => (JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) as { items: Sk[] }).items).filter((i) => i.type_id === 'R-VOCAB')

const packet: unknown[] = []
const keys: Record<string, unknown> = {}
for (const s of pool) {
  const { data, error } = await db.from('csat_items').select('stem, passage, choices, answer').eq('id', s.id).maybeSingle()
  if (error) throw error
  const passage = data?.passage as string | undefined
  if (!passage) { keys[s.id] = { skip: 'no_passage' }; continue }
  const ranges = splitSentences(passage)
  const aligned = ranges.length === s.sentences.length && ranges.every((r, i) => r.end - r.start === s.sentences[i].chars)
  // 밑줄 번호 → 문장(골격 앵커: answer = 정답 번호 문장, reject:k = 나머지 번호 문장)
  const optionSentence: Record<string, number[]> = {}
  for (const a of s.anchors) if (a.id === 'answer' || a.id.startsWith('reject:')) optionSentence[a.id] = a.sentences
  keys[s.id] = { official: data?.answer ?? null, aligned, answerAnchorSentences: optionSentence.answer ?? [], rejectAnchors: Object.fromEntries(Object.entries(optionSentence).filter(([k]) => k !== 'answer')) }
  if (!aligned) continue
  packet.push({ itemId: s.id, stem: data?.stem, sentences: ranges.map((r, i) => ({ no: i + 1, text: passage.slice(r.start, r.end) })), choices: data?.choices })
}
fs.mkdirSync(OUT, { recursive: true })
fs.writeFileSync(path.join(OUT, 'packet-vocab.json'), JSON.stringify({ items: packet }, null, 2))
fs.writeFileSync(path.join(OUT, 'vocab-keys.json'), JSON.stringify(keys, null, 1))
console.log(`R-VOCAB 골격 ${pool.length} · 원문 경계 일치 ${packet.length} · 공식 정답 있음 ${Object.values(keys).filter((k) => (k as { official?: unknown }).official != null).length}`)
