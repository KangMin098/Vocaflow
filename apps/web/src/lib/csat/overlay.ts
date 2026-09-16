// apps/web/src/lib/csat/overlay.ts
//
// **오버레이가 읽는 것 — 좌표(우리가 만든 것) + 분석(우리가 쓴 것).**
//
// ⚠️ 평가원 문제지는 **서버를 거치지 않는다.** 학습자가 브라우저에 떨어뜨린 파일은 그 자리에서
//    PDF.js 가 렌더하고, 서버로 올라가는 것은 **SHA-256 64자**뿐이다. 해시로 회차를 찾고
//    그 회차의 좌표와 분석을 돌려준다 — 원본은 우리 쪽에 복제되지 않는다.
//
// ⚠️ 여기서도 `passage`·`choices` 는 읽지 않는다. 나가는 것은 `csat_item_analyses`(우리 저작물)와
//    그 안의 짧은 인용(`answer_locus.quote`)까지다. `lib/csat/learner.ts` 와 같은 경계이고,
//    같은 이유로 **RLS 를 따르는 클라이언트**를 쓴다 — service_role 을 쓰면 실수 한 번에 샌다.

import fs from 'node:fs'
import path from 'node:path'

import type { SupabaseClient } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'

const DATA_DIR = path.join(process.cwd(), 'src/lib/csat/anchor-data')

/** 앵커 상자 하나 — PDF 좌표계(왼아래 원점 · 1/72 인치). 화면 배율은 그리는 쪽이 정한다. */
export interface AnchorBox {
  p: number
  x: number
  y: number
  w: number
  h: number
}

export interface AnchorItem extends AnchorBox {
  no: number
  col: number
  marks: (AnchorBox & { n: number })[]
}

export interface ExamAnchors {
  exam_id: string
  sha256: string
  pages: { p: number; w: number; h: number }[]
  form_pages: number
  total_pages: number
  items: AnchorItem[]
}

interface AnchorIndex {
  built: string
  exams: { exam_id: string; sha256: string; items: number; form_pages: number }[]
}

let indexCache: AnchorIndex | null = null

/**
 * 해시 → 회차. `build-anchor-data.mjs` 가 만든 색인을 읽는다.
 *
 * **한 해시가 두 회차를 가리키는 일은 없다** — 빌드가 그런 회차를 양쪽 다 떨어뜨린다
 * (실측: M2009 의 문제지가 M2106 것과 sha256 까지 같다. 담아 두면 회차 판정이 동전 던지기다).
 */
function anchorIndex(): AnchorIndex {
  if (!indexCache) {
    const p = path.join(DATA_DIR, 'index.json')
    indexCache = fs.existsSync(p)
      ? (JSON.parse(fs.readFileSync(p, 'utf8')) as AnchorIndex)
      : { built: '', exams: [] }
  }
  return indexCache
}

export function examBySha256(sha256: string): string | null {
  if (!/^[0-9a-f]{64}$/.test(sha256)) return null
  return anchorIndex().exams.find((e) => e.sha256 === sha256)?.exam_id ?? null
}

/** 좌표 카탈로그 요약 — 「어느 회차를 받을 수 있는지」를 화면이 미리 말해 줄 수 있게 */
export function anchorCatalog(): { built: string; exams: string[] } {
  const idx = anchorIndex()
  return { built: idx.built, exams: idx.exams.map((e) => e.exam_id) }
}

function readAnchors(examId: string): ExamAnchors | null {
  // 회차 id 는 색인에서 온 것만 쓴다 — 사용자 입력을 파일 경로에 그대로 붙이면 경로 탈출이 된다
  if (!anchorIndex().exams.some((e) => e.exam_id === examId)) return null
  const p = path.join(DATA_DIR, `${examId}.json`)
  if (!fs.existsSync(p)) return null
  return JSON.parse(fs.readFileSync(p, 'utf8')) as ExamAnchors
}

/**
 * **그 문항이 몇 쪽에 있나** — 「링크로 열기」가 이 값으로 뷰어를 그 쪽부터 열게 한다.
 *
 * 좌표를 뽑아 둔 덕에 알 수 있는 것이다(앵커 없이는 회차 전체를 처음부터 넘겨야 한다).
 * 회차나 문항을 모르면 null — 화면은 그때 1쪽부터 연다.
 */
export function pageOfItem(examId: string, no: number): number | null {
  const a = readAnchors(examId)
  return a?.items.find((i) => i.no === no)?.p ?? null
}

/** 그 회차 좌표의 요약 — 「이 문제지는 앞 8쪽만 우리 기준」을 화면이 말할 수 있게 */
export function anchorMetaOf(examId: string): { formPages: number; totalPages: number; sha256: string } | null {
  const a = readAnchors(examId)
  return a ? { formPages: a.form_pages, totalPages: a.total_pages, sha256: a.sha256 } : null
}

/** 오버레이 한 벌이 화면에 내보내는 문항 한 줄 */
export interface OverlayItem {
  item_id: string
  no: number
  slug: string
  type_id: string | null
  type_name: string | null
  points: number | null
  answer: number | null
  /** 분석이 준비됐나 — 없는 문항은 상자를 그려도 누를 것이 없다 */
  ready: boolean
  measured_ability: string | null
  design_intent: string | null
  answer_quote: string | null
  choice_analysis: { n: number; verdict?: string; trap?: string; why_tempting?: string; how_to_reject?: string; why_correct?: string }[]
  solve_procedure: { step: string; on_fail?: string }[]
  /** 이 문항이 요구한 낱말 — 순차 공개의 마지막 겹(L6). 우리가 쓴 목록이지 원문이 아니다. */
  required_vocab: string[]
  time_budget_sec: number | null
}

export interface OverlayPayload {
  exam_id: string
  exam_label: string
  /** 이 분석이 어느 형 문제지를 기준으로 쓰였나 — 선지 자리에 상자를 그리기 전에 대조해야 한다 */
  paper_form: string | null
  anchors: ExamAnchors
  items: OverlayItem[]
}

const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])

// ⚠️ 여기 같은 함수가 **따로 하나 더** 있었다(2026-09-15까지). 갈라지면 한쪽 링크가
// 조용히 404 가 되고, 갈라진 것을 알 방법이 없다. 정의는 `item-slug.ts` 하나다.
export { toItemSlug } from './item-slug'
import { toItemSlug } from './item-slug'

/**
 * 해시 하나로 오버레이 한 벌.
 *
 * 분석이 없는 문항도 **숨기지 않는다** — 상자는 그리고 `ready: false` 로 말한다.
 * 숨기면 학습자는 그 문항이 시험에 없었다고 읽는다(`/csat` 허브와 같은 규칙).
 */
export async function loadOverlayBySha256(
  sha256: string,
): Promise<{ payload: OverlayPayload | null; error: string | null }> {
  const examId = examBySha256(sha256)
  if (!examId) return { payload: null, error: null } // 모르는 파일 — 오류가 아니다

  const anchors = readAnchors(examId)
  if (!anchors) return { payload: null, error: '좌표를 찾지 못했어요' }

  // `@vocaflow/types` 의 `Database` 는 마이그레이션 적용 전 타입에 `csat_*` 가 없다.
  // 완화 지점을 `learner.ts` 와 같은 방식으로 한 줄에 모은다.
  const db = (await createClient()) as unknown as SupabaseClient

  const { data: exam, error: examErr } = await db
    .from('csat_exams')
    .select('id, label, paper_form')
    .eq('id', examId)
    .maybeSingle()
  if (examErr) return { payload: null, error: examErr.message }

  const { data: rows, error: itemErr } = await db
    .from('csat_items_public')
    .select('id, no, type_id, points, answer')
    .eq('exam_id', examId)
    .eq('in_scope', true)
    .order('no')
  if (itemErr) return { payload: null, error: itemErr.message }

  const { data: types } = await db.from('csat_types').select('id, name')
  const typeName = new Map((types ?? []).map((t: { id: string; name: string }) => [t.id, t.name]))

  const ids = (rows ?? []).map((r: { id: string }) => r.id)
  // **최신 버전만 쓴다.** 한 문항에 published 버전이 여럿이라 그냥 읽으면 옛 분석이 섞인다
  // (실측 2026-09-13: 적재의 중복 판정이 깨져 있어 문항마다 버전이 최대 5개까지 있다).
  const { data: analyses } = ids.length
    ? await db
        .from('csat_item_analyses')
        .select(
          'item_id, version, measured_ability, design_intent, answer_locus, choice_analysis, solve_procedure, required_vocab, time_budget_sec',
        )
        .in('item_id', ids)
        .eq('status', 'published')
        .order('version', { ascending: false })
    : { data: [] }

  type ARow = {
    item_id: string
    version: number
    measured_ability: string | null
    design_intent: string | null
    answer_locus: unknown
    choice_analysis: unknown
    solve_procedure: unknown
    required_vocab: unknown
    time_budget_sec: number | null
  }
  const latest = new Map<string, ARow>()
  for (const a of (analyses ?? []) as ARow[]) {
    const cur = latest.get(a.item_id)
    if (!cur || a.version > cur.version) latest.set(a.item_id, a)
  }

  const items: OverlayItem[] = (rows ?? []).map(
    (r: { id: string; no: number; type_id: string | null; points: number | null; answer: number | null }) => {
      const a = latest.get(r.id)
      const locus = (a?.answer_locus ?? null) as { quote?: string } | null
      return {
        item_id: r.id,
        no: r.no,
        slug: toItemSlug(r.id),
        type_id: r.type_id,
        type_name: r.type_id ? (typeName.get(r.type_id) ?? null) : null,
        points: r.points,
        answer: r.answer,
        ready: Boolean(a),
        measured_ability: a?.measured_ability ?? null,
        design_intent: a?.design_intent ?? null,
        answer_quote: locus?.quote ?? null,
        choice_analysis: arr<OverlayItem['choice_analysis'][number]>(a?.choice_analysis),
        solve_procedure: arr<OverlayItem['solve_procedure'][number]>(a?.solve_procedure),
        required_vocab: arr<string>(a?.required_vocab).filter((w) => typeof w === 'string'),
        time_budget_sec: a?.time_budget_sec ?? null,
      }
    },
  )

  return {
    payload: {
      exam_id: examId,
      exam_label: (exam as { label?: string } | null)?.label ?? examId,
      paper_form: (exam as { paper_form?: string | null } | null)?.paper_form ?? null,
      anchors,
      items,
    },
    error: null,
  }
}
