// apps/web/src/lib/csat/dissect-catalog.ts
// Published analysis only; no passage/choices columns. Learners use RLS; authenticated admin callers may inject a fresh client.
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { keysetSelect } from '@/lib/supabase/keyset-select'
import { loadSessionCatalog } from './session/catalog'
import { loadItemSkeleton, primeLearnerHakpyeongSkeletons, type ItemSkeleton } from './skeleton'
import verifiedAnchors from './dissect-anchors.json'
import { loadLecture } from './lecture/store'
import { firstSentences } from './session/text'
import { DISSECTION_METADATA } from './dissect-metadata'
import { HAKPYEONG_ID_PREFIX } from './exam-id'
import { hashTag, readyItem, type DissectionCatalog, type DissectionItem } from './dissect'

interface Analysis {
  item_id: string; version: number; design_intent: string | null; answer_unknown: boolean
  answer_locus: { reasoning?: string }
  choice_analysis: { n: number; trap?: string; verdict: string; how_to_reject?: string }[]
}
const clean = (s: string | null | undefined) => (s ?? '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()
let cached: { at: number; value: DissectionCatalog } | null = null

export async function loadDissectionCatalog(options: { db?: SupabaseClient; fresh?: boolean } = {}): Promise<DissectionCatalog> {
  if (!options.db && !options.fresh && cached && Date.now() - cached.at < 600000) return cached.value
  const db = options.db ?? (await createClient()) as unknown as SupabaseClient
  // 학평 골격(DB · 발행분만) — 학습자 클라이언트일 때만 채운다(skeleton.ts)
  if (!options.db) await primeLearnerHakpyeongSkeletons(db)
  const [base, items, analyses, hakAnalyses] = await Promise.all([
    loadSessionCatalog(options),
    keysetSelect<{ id: string; type_id: string; answer: number | null }, string>((cursor, limit) => {
      // 범위: 평가원 + 발행 학평 목록(해부는 같은 기능 · 함정 빈도 통계만 평가원)
      let query = db.from('csat_items_public').select('id,type_id,answer').eq('in_scope', true).order('id').limit(limit)
      if (cursor) query = query.gt('id', cursor)
      return query
    }, (row) => row.id, '해부 문항'),
    keysetSelect<Analysis, { itemId: string; version: number }>((cursor, limit) => {
      let query = db.from('csat_item_analyses').select('item_id,version,design_intent,answer_unknown,answer_locus,choice_analysis').eq('status', 'published').not('item_id', 'like', `${HAKPYEONG_ID_PREFIX}%`).order('item_id').order('version').limit(limit)
      if (cursor) query = query.or(`item_id.gt.${cursor.itemId},and(item_id.eq.${cursor.itemId},version.gt.${cursor.version})`)
      return query
    }, (row) => ({ itemId: row.item_id, version: row.version }), '해부 분석'),
    // 발행된 학평 분석 — 문항 해부는 같은 기능으로 열되(2026-10-01), 함정 빈도 통계에는 넣지 않는다(통계는 집합별)
    keysetSelect<Analysis, { itemId: string; version: number }>((cursor, limit) => {
      let query = db.from('csat_item_analyses').select('item_id,version,design_intent,answer_unknown,answer_locus,choice_analysis').eq('status', 'published').like('item_id', `${HAKPYEONG_ID_PREFIX}%`).order('item_id').order('version').limit(limit)
      if (cursor) query = query.or(`item_id.gt.${cursor.itemId},and(item_id.eq.${cursor.itemId},version.gt.${cursor.version})`)
      return query
    }, (row) => ({ itemId: row.item_id, version: row.version }), '해부 분석(학평)'),
  ])
  if (base.error) throw new Error(base.error)
  // An expired session can return an empty RLS result without a query error.
  // Do not turn that into hundreds of false metadata defects or cache it.
  if (items.length > 0 && analyses.length === 0) throw new Error('공개 분석을 읽지 못했습니다. 로그인 상태를 확인해 주세요.')
  const latest = new Map<string, Analysis>()
  for (const row of [...analyses, ...hakAnalyses]) {
    const current = latest.get(row.item_id)
    if (!current || row.version > current.version) latest.set(row.item_id, row)
  }
  const typeOf = new Map(items.map(i => [i.id, i.type_id]))
  const frequency = new Map<string, Map<string, number>>()
  for (const a of latest.values()) {
    // 함정 빈도(선지 후보 순위)는 평가원 분석으로만 — 학평이 평가원 통계를 흔들지 않게
    if (a.item_id.startsWith(HAKPYEONG_ID_PREFIX)) continue
    const type = typeOf.get(a.item_id)
    if (!type) continue
    const counts = frequency.get(type) ?? new Map<string, number>()
    for (const d of a.choice_analysis ?? []) if (d.verdict === 'distractor' && clean(d.trap)) counts.set(clean(d.trap), (counts.get(clean(d.trap)) ?? 0) + 1)
    frequency.set(type, counts)
  }
  const fields: Record<string, number> = {}
  const excluded: DissectionCatalog['audit']['excluded'] = []
  const built: DissectionItem[] = []
  const baseItems = new Map(base.catalog.items.map(i => [i.id, i]))
  for (const row of items) {
    const a = latest.get(row.id)
    const sk = (verifiedAnchors as Record<string, ItemSkeleton>)[row.id] ?? loadItemSkeleton(row.id)
    if (sk && DISSECTION_METADATA[row.id] && !baseItems.has(row.id)) baseItems.set(row.id, { id: row.id, exam_id: row.id.split('#')[0], no: sk.no, type_id: row.type_id, points: null })
    const metadata = DISSECTION_METADATA[row.id]
    const wrapup = clean(loadLecture(row.id)?.cues.filter(c => c.role === 'wrapup').flatMap(c => c.segments.filter(s => s.lang === 'ko-KR').map(s => s.text)).join(' '))
    const anchors = sk?.anchors.map(anchor => ({ ...anchor, from: anchor.from ?? null, quotes: sk.sentences.flatMap(s => s.reveals.filter(r => r.anchorId === anchor.id).map(r => r.text)) })) ?? []
    const d = (a?.choice_analysis ?? []).find(c => c.verdict === 'distractor' && clean(c.trap) && clean(c.how_to_reject) && anchors.some(x => x.id === `reject:${c.n}` && x.sentences.length))
    const ranked = [...(frequency.get(row.type_id) ?? [])].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).map(([name]) => name)
    const intent = clean(a?.design_intent)
    // 설계 의도 대안(오답 보기)도 같은 집합 안에서 고른다 — 평가원 문항엔 평가원, 학평엔 학평
    const sameSet = (x: Analysis) => x.item_id.startsWith(HAKPYEONG_ID_PREFIX) === row.id.startsWith(HAKPYEONG_ID_PREFIX)
    const peers = [...latest.values()].filter(x => x.item_id !== row.id && typeOf.get(x.item_id) === row.type_id && sameSet(x)).map(x => clean(x.design_intent))
    const alternatives = [...new Set(peers)].filter(s => s !== intent && s.length >= intent.length * .8 && s.length <= intent.length * 1.2).sort((x, y) => Math.abs(x.length - intent.length) - Math.abs(y.length - intent.length)).slice(0, 2)
    const history = metadata ? Object.entries(DISSECTION_METADATA).filter(([id, m]) => id !== row.id && m.format === metadata.format).map(([id, m]) => ({ id, topic: m.topic, formula: m.formula })) : []
    const checks = {
      answer: Boolean(row.answer && !a?.answer_unknown),
      evidence: Boolean(clean(a?.answer_locus?.reasoning)),
      anchor: anchors.some(x => x.id === 'answer' && x.sentences.length),
      distractor: Boolean(d),
      intent: Boolean(intent),
      intentOptions: alternatives.length === 2,
      trapOptions: ranked.length >= 4,
      topic: Boolean(metadata?.topic),
      format: Boolean(metadata?.format),
      formula: Boolean(metadata?.formula && wrapup),
      history: history.length > 0,
      catalog: baseItems.has(row.id),
    }
    for (const [key, ok] of Object.entries(checks)) fields[key] = (fields[key] ?? 0) + Number(ok)
    const missing = Object.entries(checks).filter(([, ok]) => !ok).map(([key]) => key)
    if (missing.length || !d || !metadata || !sk) { excluded.push({ id: row.id, missing }); continue }
    const item: DissectionItem = {
      ...baseItems.get(row.id)!, ...metadata,
      answer: row.answer!, formulaTag: hashTag(metadata.formula), wrapup, intent,
      intentOptions: [intent, ...alternatives], evidence: firstSentences(clean(a?.answer_locus?.reasoning), 3).text,
      distractor: { n: d.n, family: clean(d.trap), line: firstSentences(clean(d.how_to_reject), 1).text },
      trapOptions: [clean(d.trap), ...ranked.filter(t => t !== clean(d.trap)).slice(0, 3)],
      skeleton: { sentences: sk.sentences.map(s => s.chars), anchors }, history,
    }
    if (readyItem(item)) built.push(item)
    else excluded.push({ id: row.id, missing: ['ready-check'] })
  }
  const value: DissectionCatalog = { ...base.catalog, items: built, families: [...new Set(built.flatMap(i => i.trapOptions))].sort(), audit: { total: items.length, fields, excluded } }
  if (!options.db && built.length > 0) cached = { at: Date.now(), value }
  return value
}
