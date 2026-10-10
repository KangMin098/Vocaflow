// scripts/csat/map/v4/exam-review-packet.mts
//
// 학습 지도 rev4.0 3차 §6 — 진단 반영 후보 시험의 **사람 검수 패킷**(읽기 전용 · 검수 · 승인을 대신하지 않는다 · diagnosis_ready 를 바꾸지 않는다).
// 문항마다: 정답 · 배점 · 유형 · 시드 역량(9 · 가중치 · 출처) · 선지 함정 · 해설 발행 · 근거 위치 · 문장 단위 · 보류 여부 ·
//   M2409 대조(같은 유형을 사람이 검수할 때 시드에서 바꾼 역량 — 이 문항에서도 확인할 지점).
//   cd apps/web && node --env-file=.env.local --import tsx ../../scripts/csat/map/v4/exam-review-packet.mts 2026 M2706
// 출력: docs/csat-learner/v4/review-packets/<시험>.json · docs/csat-learner/LEARNING_MAP_V4_REVIEW_PACKETS.md(생성물)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient } from '@supabase/supabase-js'

import { ATTRIBUTE_CODES } from '../../../../apps/web/src/lib/csat/diagnosis/engine/types.ts'
import { examReadiness } from '../../../../apps/web/src/lib/csat/diagnosis/readiness.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
if (!String(process.env.NEXT_PUBLIC_SUPABASE_URL).includes('jajenrevcbmrpaliomxv')) throw new Error('개발 프로젝트가 아니다')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } })
const must = async <T,>(q: PromiseLike<{ data: unknown; error: { message: string } | null }>, w: string): Promise<T> => { const r = await q; if (r.error) throw new Error(`${w}: ${r.error.message}`); return r.data as T }
const exams = process.argv.slice(2)
if (exams.length === 0) throw new Error('시험 id 를 준다(예: 2026 M2706)')
const REF = 'M2409'

type Item = { id: string; exam_id: string; no: number; type_id: string | null; answer: number | null; answers: number[] | null; points: number | null }
type Attr = { item_id: string; attribute_code: string; weight: number; source: string | null; reviewed_at: string | null }
type Trap = { item_id: string; option_no: number; trap_key: string; reviewed_at: string | null }
const load = async (examId: string) => {
  const items = await must<Item[]>(db.from('csat_items').select('id, exam_id, no, type_id, answer, answers, points').eq('exam_id', examId).order('no'), 'items')
  const ids = items.map((i) => i.id)
  const [attrs, traps, analyses, units, keys] = await Promise.all([
    must<Attr[]>(db.from('csat_dx_item_attribute').select('item_id, attribute_code, weight, source, reviewed_at').in('item_id', ids), 'attrs'),
    must<Trap[]>(db.from('csat_dx_option_trap').select('item_id, option_no, trap_key, reviewed_at').in('item_id', ids), 'traps'),
    must<{ item_id: string; status: string; version: number; answer_locus: unknown }[]>(db.from('csat_item_analyses').select('item_id, status, version, answer_locus').in('item_id', ids), 'analyses'),
    must<{ item_id: string }[]>(db.from('csat_item_units').select('item_id').in('item_id', ids), 'units'),
    must<{ no: number }[]>(db.from('csat_dx_answer_key').select('no').eq('exam_id', examId), 'keys'),
  ])
  return { items, attrs, traps, analyses, units, keys }
}

// M2409 — 사람 검수값(유형별 첫 문항 기준)과 그 유형 시드(후보 시험에서 같은 유형 시드)를 비교해 「바뀌는 역량」을 뽑는다
const ref = await load(REF)
const refByType = new Map<string, Record<string, number>>()
for (const it of ref.items) {
  if (!it.type_id || refByType.has(it.type_id)) continue
  refByType.set(it.type_id, Object.fromEntries(ATTRIBUTE_CODES.map((c) => [c, Number(ref.attrs.find((a) => a.item_id === it.id && a.attribute_code === c)?.weight ?? 0)])))
}
const { data: held } = await db.rpc('csat_ec_embargoed_exams', { p_exams: exams })
const heldSet = new Set(((held ?? []) as unknown[]).map((r) => (typeof r === 'string' ? r : String(Object.values(r as object)[0]))))

const out: Record<string, unknown> = {}
const md: string[] = ['# 학습 지도 rev4.0 — 진단 반영 검수 패킷(생성물)', '', '> **생성물 — 손으로 고치지 않는다.** `scripts/csat/map/v4/exam-review-packet.mts`(읽기 전용). 이 패킷은 **사람 검수를 돕는 자료**다 — 검수 · 진단 반영(`diagnosis_ready`)을 대신하지 않는다.', `> 규칙 대조 기준: ${REF}(사람 검수 완료 · 진단 반영). 「M2409 에서 바뀐 역량」= 같은 유형 문항을 사람이 검수하며 시드에서 바꾼 값 — 이 문항에서도 같은 판단이 맞는지 **확인할 지점**이지 정답이 아니다.`, '> 한계: 대조 기준은 M2409 에서 **그 유형의 첫 문항** 검수값이다. 같은 유형이라도 문항마다 검수값이 다를 수 있다(예: 빈칸 31–34번) — 「같음」도 확인을 생략해도 된다는 뜻이 아니다.', '']
for (const examId of exams) {
  const e = await load(examId)
  const items = e.items.map((it) => {
    const attrs = e.attrs.filter((a) => a.item_id === it.id)
    const seed = Object.fromEntries(ATTRIBUTE_CODES.map((c) => [c, Number(attrs.find((a) => a.attribute_code === c)?.weight ?? 0)]))
    const refW = it.type_id ? refByType.get(it.type_id) ?? null : null
    const diff = refW ? ATTRIBUTE_CODES.filter((c) => Math.abs((refW[c] ?? 0) - (seed[c] ?? 0)) > 1e-9).map((c) => ({ code: c, seed: seed[c], m2409: refW[c] })) : null
    const an = e.analyses.filter((a) => a.item_id === it.id)
    const pub = an.filter((a) => a.status === 'published').sort((a, b) => b.version - a.version)[0]
    const traps = e.traps.filter((t) => t.item_id === it.id)
    return {
      no: it.no, itemId: it.id, typeId: it.type_id, hasAnswer: (it.answers?.length ?? 0) > 0 || it.answer !== null, points: it.points,
      seed, seedSource: [...new Set(attrs.map((a) => a.source ?? 'null'))], reviewed: attrs.length === 9 && attrs.every((a) => a.reviewed_at),
      trapOptions: traps.length, trapKeys: [...new Set(traps.map((t) => t.trap_key))], trapsReviewed: traps.filter((t) => t.reviewed_at).length,
      analysis: pub ? { version: pub.version, hasLocus: !!pub.answer_locus } : null,
      units: e.units.some((u) => u.item_id === it.id),
      m2409Diff: diff, m2409TypeCovered: !!refW,
    }
  })
  const r = examReadiness(e.keys.length, e.items.map((i) => ({ id: i.id, hasAnswer: (i.answers?.length ?? 0) > 0 || i.answer !== null, attrs: e.attrs.filter((a) => a.item_id === i.id).map((a) => ({ code: a.attribute_code, reviewed: !!a.reviewed_at })) })))
  const summary = {
    examId, held: heldSet.has(examId), keyRows: e.keys.length, items: items.length, readiness: r.reason, structural: r.structural,
    noAnswer: items.filter((i) => !i.hasAnswer).length, withTraps: items.filter((i) => i.trapOptions > 0).length, published: items.filter((i) => i.analysis).length,
    withLocus: items.filter((i) => i.analysis?.hasLocus).length, withUnits: items.filter((i) => i.units).length,
    typesNotInM2409: [...new Set(items.filter((i) => !i.m2409TypeCovered).map((i) => i.typeId))],
    itemsWithM2409Diff: items.filter((i) => i.m2409Diff && i.m2409Diff.length > 0).length,
  }
  out[examId] = { summary, items }
  fs.mkdirSync(path.join(ROOT, 'docs/csat-learner/v4/review-packets'), { recursive: true })
  fs.writeFileSync(path.join(ROOT, `docs/csat-learner/v4/review-packets/${examId}.json`), JSON.stringify({ generated_by: 'scripts/csat/map/v4/exam-review-packet.mts', ref: REF, summary, items }, null, 1) + '\n')
  md.push(`## ${examId}`, '', `- 판정(examReadiness): ${r.reason} · 보류 ${summary.held ? '예' : '아니오'} · 정답표 ${summary.keyRows}/45 · 문항 ${summary.items}`)
  md.push(`- 정답 없는 문항 ${summary.noAnswer} · 선지 함정 있는 문항 ${summary.withTraps} · 해설 발행 ${summary.published} · 근거 위치 ${summary.withLocus} · 문장 단위 ${summary.withUnits}`)
  md.push(`- M2409 에 없는 유형(대조 기준 없음 — 처음부터 사람 판단): ${summary.typesNotInM2409.join(' · ') || '없음'} · M2409 검수에서 바뀐 역량이 걸린 문항 ${summary.itemsWithM2409Diff}`, '')
  md.push('| 번호 | 유형 | 배점 | 시드 역량(가중치>0) | M2409 에서 바뀐 역량(시드 → 검수) | 선지 함정 | 해설 · 근거 위치 | 문장 단위 |', '|---|---|---|---|---|---|---|---|')
  for (const i of items) {
    const pos = Object.entries(i.seed).filter(([, w]) => w > 0).map(([c, w]) => `${c} ${w}`).join(' · ') || '—'
    const diff = i.m2409Diff === null ? '대조 기준 없음' : i.m2409Diff.length ? i.m2409Diff.map((d) => `${d.code} ${d.seed}→${d.m2409}`).join(' · ') : '같음'
    md.push(`| ${i.no} | ${i.typeId ?? '—'} | ${i.points ?? '—'} | ${pos} | ${diff} | ${i.trapOptions ? `${i.trapOptions}선지 · ${i.trapKeys.length}종` : '없음'} | ${i.analysis ? `v${i.analysis.version}${i.analysis.hasLocus ? ' · 있음' : ' · 없음'}` : '미발행'} | ${i.units ? '있음' : '없음'} |`)
  }
  md.push('')
}
md.push('## 검수 · 반영 절차(사람 · 관리자 — 자동화하지 않는다)', '',
  '1. 관리자 `/admin/csat/diagnosis/exams/<시험>`(TaggingBoard)에서 문항마다 역량 9(0 = 해당 없음도 판정) · 선지 함정을 확인해 저장한다 — 저장은 RPC `csat_dx_save_item_tagging`(9개 한 트랜잭션).',
  '2. 「M2409 에서 바뀐 역량」 칸은 같은 유형에서 사람이 바꾼 지점이다 — 이 문항 본문 · 선지로 같은 판단이 맞는지 본다(그대로 복사하지 않는다).',
  '3. 「대조 기준 없음」 유형은 M2409 에 없던 유형 — 처음부터 판단하고, 판단 근거를 메모로 남긴다.',
  '4. 28문항 모두 저장되면 같은 화면의 판정이 「진단 반영 가능」으로 바뀐다(examReadiness). **켜기(setExamReadyAction)는 별도 관리자 승인 뒤**.',
  '5. 켠 뒤: `pnpm docs:db-stats` · 지도 E2E(`scripts/csat/map/e2e-map-v4.mjs`)를 그 시험 기록으로 한 번 더 돌려 학습 지도 근거가 생기는지 확인.',
  '6. 문장 단위(`csat_item_units`)가 없는 문항은 진단 반영 조건이 아니지만, 그 시험을 직접 확인 콘텐츠로 쓰려면 먼저 만들어야 한다(Evidence Anchor 결속의 전제).', '')
fs.writeFileSync(path.join(ROOT, 'docs/csat-learner/LEARNING_MAP_V4_REVIEW_PACKETS.md'), md.join('\n'))
console.log(JSON.stringify(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, (v as { summary: unknown }).summary]))))
