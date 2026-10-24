// apps/web/src/lib/csat/judgment-reveal.ts
//
// **서버 전용 — 문항 해설의 정답 자료를 한 곳에서 만든다.** 문항 페이지(첫 응답)와 판단 라우트(공개 응답)가 같은
// 로더 · 같은 분리(`lecture/answer-split.ts`)를 쓴다. 페이지는 `initial` 만, 라우트는 노출 원장 커밋 뒤 `reveal` 만 보낸다.
// 클라이언트 컴포넌트는 이 파일을 import 하지 않는다(정본 JSON · 골격 로더가 번들에 들어간다).

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import compareData from '@/lib/csat/compare-data.json'
import { projectV3Pairs, v3PairPartners } from '@/lib/csat/inquiry/compare-v3'
import { inquiryBinding, lookupInquiry, type InquiryLookup } from '@/lib/csat/inquiry/data'
import { toItemSlug } from '@/lib/csat/item-slug'
import type { CsatItemExplain } from '@/lib/csat/learner'
import { splitAnswer, splitMeaningSupport, type AnswerReveal, type TheaterAnswerData } from '@/lib/csat/lecture/answer-split'
import { lookupMeaningSupport } from '@/lib/csat/meaning-support/data'
import type { MeaningSupportView } from '@/lib/csat/meaning-support/labels'
import type { MapAnchor } from '@/lib/csat/passage-map-model'
import { loadRevealScope } from '@/lib/csat/embargo-gate'
import { loadRevealedSkeleton, primeLearnerHakpyeongSkeletons, revealedSkeletonSiblings, skeletonSiblings } from '@/lib/csat/skeleton'
import { CIRCLED, theaterBlocks } from '@/lib/csat/theater'
import { buildChecks } from '@/lib/csat/understanding-check'
import { createClient } from '@/lib/supabase/server'

export interface TheaterSibling { id: string; slug: string; exam_label: string; no: number; explained: true }

export interface TheaterLoad {
  initial: TheaterAnswerData
  reveal: AnswerReveal
  /** 원문 이해 교수 설명(첫 응답용 — 선지 연결 없음) */
  meaningSupport: MeaningSupportView | null
  skeleton: Awaited<ReturnType<typeof loadRevealedSkeleton>>
  /** 지도를 세울 수 있나(골격이 정답 · 오답 자리를 하나라도 찾았다) — 앵커 자체는 공개 응답에만 */
  mapReady: boolean
  siblings: TheaterSibling[]
  inquiryHit: InquiryLookup
  openById: Map<string, { slug: string; label: string }>
  pairAbsence: ReturnType<typeof projectV3Pairs>['absence']
  pairWithheld: ReturnType<typeof projectV3Pairs>['withheld']
}

export async function loadTheaterAnswer(item: CsatItemExplain): Promise<TheaterLoad> {
  // 지도는 **구워 둔 골격**에서만 온다(DB 의 지문을 런타임에 만지는 경로가 없어야 한다).
  await primeLearnerHakpyeongSkeletons((await createClient()) as unknown as SupabaseClient)
  const skeleton = await loadRevealedSkeleton(item.id)
  const anchors: MapAnchor[] = [
    ...(item.answer != null && !item.answer_unknown && item.why_correct
      ? [{ id: 'answer', label: CIRCLED[item.answer] ?? String(item.answer), kind: 'answer' as const, detail: item.why_correct }]
      : []),
    ...item.distractors.map((d) => ({
      id: `reject:${d.n}`,
      label: CIRCLED[d.n] ?? String(d.n),
      kind: 'reject' as const,
      detail: d.how_to_reject,
      tempting: d.why_tempting,
    })),
  ]
  // 골격이 실제로 자리를 찾은 앵커만 지도에 올린다 — 못 찾은 칩은 눌러도 아무 일이 없다.
  const shown = skeleton
    ? anchors.flatMap((a) => {
        const placed = skeleton.anchors.find((x) => x.id === a.id)
        return placed ? [{ ...a, origin: placed.from }] : []
      })
    : []
  const answerPlacement = skeleton?.anchors.find((x) => x.id === 'answer')
  const checks = buildChecks({
    id: item.id,
    type_id: item.type_id,
    distractors: item.distractors,
    map: skeleton && answerPlacement ? { sentenceCount: skeleton.sentences.length, answerSentences: answerPlacement.sentences } : null,
  })

  const revealScope = await loadRevealScope()
  const siblings: TheaterSibling[] = item.type_id
    ? revealedSkeletonSiblings(item.type_id, revealScope).map((sib) => ({ id: sib.id, slug: toItemSlug(sib.id), exam_label: sib.exam_label, no: sib.no, explained: true as const }))
    : []
  const sibById = new Map(siblings.map((x) => [x.id, x]))
  const pairs = (compareData.items as Record<string, { kind?: 'same' | 'contrast'; other: string; choice: number; otherChoice: number; trap: string; note: string }[]>)[item.id] ?? []
  const comparePairs = pairs.flatMap((p) => {
    const o = sibById.get(p.other)
    return o ? [{ ...p, otherSlug: o.slug, otherLabel: `${o.exam_label} ${o.no}번` }] : []
  })
  const inquiryHit = lookupInquiry(item.id, item.analysis_version)
  const partnerTypes = [...new Set(v3PairPartners(item.id).map((x) => x.type).filter((t): t is string => Boolean(t)))]
  const openById = new Map<string, { slug: string; label: string }>()
  const knownIds = new Set<string>()
  for (const t of partnerTypes) {
    for (const sib of t === item.type_id ? siblings.map((x) => ({ id: x.id, exam_label: x.exam_label, no: x.no })) : revealedSkeletonSiblings(t, revealScope)) {
      openById.set(sib.id, { slug: toItemSlug(sib.id), label: `${sib.exam_label} ${sib.no}번` })
    }
    // 공개 필터 전 골격 — 있는데 열 수 없으면 보류/접근 제한, 골격에도 없으면 삭제 · 미발행(서로 다른 이유)
    for (const sib of skeletonSiblings(t)) knownIds.add(sib.id)
  }
  const v3Compare = projectV3Pairs(
    item.id,
    inquiryHit.state === 'ready',
    (id) => {
      const o = openById.get(id)
      return o ? { state: 'open' as const, ...o } : knownIds.has(id) ? { state: 'held' as const } : { state: 'missing' as const }
    },
    undefined,
    inquiryBinding,
  )

  const full: TheaterAnswerData = {
    blocks: theaterBlocks(item),
    anchors: shown,
    placements: skeleton && shown.length > 0 ? skeleton.anchors : [],
    checks,
    comparePairs,
    v3Pairs: v3Compare.pairs,
    inquiry: inquiryHit.state === 'ready' ? inquiryHit.record : null,
    gate: {
      answer: item.answer != null && !item.answer_unknown ? item.answer : null,
      evidence: answerPlacement?.sentences ?? [],
      design: item.design,
    },
  }
  const { initial, reveal } = splitAnswer(full, item.analysis_version ?? null)
  // v3.1 원문 이해 교수 설명 — 문항 접근 · 탐구 ready 뒤에만, 결속(분석 버전 · units_hash · 배포 레코드 해시)이 맞을 때 문항 1개 projection.
  // 단위 ↔ 선지 연결(bridges)은 공개 응답으로
  const ms = splitMeaningSupport(lookupMeaningSupport(item.id, item.analysis_version, inquiryHit.state === 'ready', { skeletonChars: skeleton?.sentences.map((s) => s.chars) ?? null }).view)
  return {
    initial,
    reveal: { ...reveal, msBridges: ms.bridges },
    meaningSupport: ms.initial,
    skeleton,
    mapReady: Boolean(skeleton && shown.length > 0),
    siblings,
    inquiryHit,
    openById,
    pairAbsence: v3Compare.absence,
    pairWithheld: v3Compare.withheld,
  }
}
