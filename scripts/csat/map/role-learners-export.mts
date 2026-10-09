// scripts/csat/map/role-learners-export.mts
//
// 역할 학습자 시뮬레이션 ① 내보내기(2026-10-10 · 사용자 「실제 학습자가 필요하면 역할을 부여해서 claude code 로 진행」).
// E축 확인 과제(option-restate · evidence-locate)의 확인 문항 묶음을 학습자에게 보이는 그대로(번호 붙은 지문 문장 · 발문 · 선지) 내보낸다.
// 정답 · 근거 · 함정 위치는 넣지 않는다 — 역할 학습자(Claude Code 서브에이전트)가 맹검으로 풀게 한다.
// 읽기 전용(개발 DB 조회만). 재실행 안전 — 같은 파일을 덮어쓴다.
//   cd apps/web && node <tsx cli> --env-file=<.env.local> ../../scripts/csat/map/role-learners-export.mts
import fs from 'node:fs'
import path from 'node:path'

import { createClient } from '@supabase/supabase-js'

import { splitSentences } from '../../../apps/web/src/lib/csat/passage-skeleton'
import { EVIDENCE_TASK_TYPES, deriveEvidenceAnnotation, type EvidenceTaskKey, type SkeletonLike } from '../../../apps/web/src/lib/knowledge/evidence-locate'
import { EVIDENCE_PANEL_TEXT } from '../../../apps/web/src/lib/knowledge/evidence-locate-labels'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const OUT = path.join(ROOT, 'scripts/csat/map/role-learners')
const PER_KEY = 6
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL as string
if (!URL_?.includes('jajenrevcbmrpaliomxv')) throw new Error('개발 프로젝트가 아니다')
const db = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } })

const DIR = path.join(ROOT, 'apps/web/src/lib/csat/skeleton-data')
const skeletons: (SkeletonLike & { no: number })[] = fs.readdirSync(DIR).filter((f) => f.endsWith('.json') && f !== 'index.json')
  .flatMap((f) => (JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) as { items: (SkeletonLike & { no: number })[] }).items)

// 확인 문항 선택 — 수능 본시험(연도 4자리) 최근 회차부터. 시뮬레이션 묶음은 활성화 시드와 같은 문항이다
const order = (id: string) => { const e = id.split('#')[0]; return /^\d{4}$/.test(e) ? 10_000 + Number(e) : 0 }
fs.mkdirSync(OUT, { recursive: true })
const manifest: Record<string, string[]> = {}
for (const key of Object.keys(EVIDENCE_TASK_TYPES) as EvidenceTaskKey[]) {
  const pool = skeletons.filter((s) => order(s.id) > 0 && deriveEvidenceAnnotation(key, s)).sort((a, b) => order(b.id) - order(a.id) || a.no - b.no)
  const items: unknown[] = []
  for (const s of pool) {
    if (items.length >= PER_KEY) break
    const { data, error } = await db.from('csat_items').select('id, stem, passage, choices').eq('id', s.id).maybeSingle()
    if (error) throw error
    if (!data?.passage) continue
    const ranges = splitSentences(data.passage as string)
    // 골격과 문장 경계가 같을 때만 — 번호가 어긋나면 채점이 틀린 문장을 가리킨다
    if (ranges.length !== s.sentences.length || ranges.some((r, i) => r.end - r.start !== s.sentences[i].chars)) { console.log(`skip ${s.id} — 문장 경계 불일치`); continue }
    items.push({
      itemId: s.id,
      question: EVIDENCE_PANEL_TEXT[key].question,
      stem: data.stem,
      sentences: ranges.map((r, i) => ({ no: i + 1, text: (data.passage as string).slice(r.start, r.end) })),
      choices: data.choices,
    })
  }
  manifest[key] = items.map((i) => (i as { itemId: string }).itemId)
  fs.writeFileSync(path.join(OUT, `packet-${key}.json`), JSON.stringify({ key, items }, null, 2))
  console.log(`${key}: ${items.length}문항 — ${manifest[key].join(', ')}`)
}
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2))
