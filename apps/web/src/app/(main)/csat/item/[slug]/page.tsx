// apps/web/src/app/(main)/csat/item/[slug]/page.tsx
//
// **학습자용 문항 해설 — 해설 극장.**
//
// 이 라우트가 새로 생긴 이유: 지금까지 학습자가 분석을 볼 수 있는 문항은 **12개**였다.
// 「오늘의 해부」 한 갈래만 두고, 그 갈래가 요구하는 손질된 메타데이터를 가진 문항만
// 통과시켰기 때문이다. 실제 데이터는 **802문항 전부에 공개 분석**, 792문항에 강의가 있다.
// 그래서 문항마다 제 주소를 준다 — 목록에서 눌러 바로 들어오고, 링크로 공유되고,
// 같은 유형의 다음 문항으로 이어진다.
//
// ⚠️ 원문(지문·선지·발문)은 여기에 없다. 평가원 저작물이고 `csat_items_public` 이 주지도 않는다.
//    학습자는 공개 문제지를 곁에 두고 읽고, 화면은 **문장 지도**로 「어디인가」를 가리킨다.
// ⚠️ 관리자 검수용 사본(`/admin/kice/item/[slug]`)은 그대로 둔다 — 강의 검수 하네스가 쓴다.

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { AnalysisTheater, type TheaterMap } from '@/components/csat/theater/AnalysisTheater'
import { LectureStage } from '@/components/csat/lecture/LectureStage'
import { CohesionPanel } from '@/components/csat/theater/CohesionPanel'
import { PrinciplePanel } from '@/components/csat/theater/PrinciplePanel'
import { PRACTICE_SLUG } from '@/lib/knowledge/practice'
import type { CohesionPanelProps } from '@/lib/knowledge/cohesion-link-labels'
import { KICE_ARCHIVE_URL, kiceSourceOf } from '@/lib/csat/kice-source'
import { fromItemSlug, loadCsatItemExplain } from '@/lib/csat/learner'
import { toItemSlug } from '@/lib/csat/item-slug'
import { lectureMeta, lectureOutline } from '@/lib/csat/lecture/store'
import { pickNextItem } from '@/lib/csat/next-item'
import type { MapAnchor } from '@/lib/csat/passage-map-model'
import { loadSessionCatalog, type LearnerCatalog } from '@/lib/csat/session/catalog'
import { examOrder } from '@/lib/csat/session/model'
import { isKiceExam } from '@/lib/csat/exam-id'
import { loadItemSkeleton, primeLearnerHakpyeongSkeletons, skeletonSiblings } from '@/lib/csat/skeleton'
import { loadItemPrinciple } from '@/lib/knowledge/product-server'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { CIRCLED, theaterBlocks, theaterMinutes, theaterSteps } from '@/lib/csat/theater'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const { item } = await loadCsatItemExplain(fromItemSlug(slug))
  return {
    title: item ? `${item.exam_label} ${item.no}번 해설 — 기출` : '기출 문항 해설',
    description: '근거가 지문의 어디에 있고 오답이 어떻게 만들어졌는지 차례로 봅니다.',
  }
}

export default async function CsatItemTheaterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const itemId = fromItemSlug(slug)
  const { item, error } = await loadCsatItemExplain(itemId)
  if (!error && !item) notFound()

  if (error || !item) {
    return (
      <p className="mx-auto max-w-2xl py-10 text-sm leading-relaxed text-[var(--t2)]">
        지금은 해설을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.
      </p>
    )
  }

  // 지도는 **구워 둔 골격**에서만 온다(DB 의 지문을 런타임에 만지는 경로가 없어야 한다).
  // 학평 골격은 DB 의 구운 행(발행분만 · 학습자 RLS) — 지문 원본이 아니라 문장 길이와 해설 인용뿐이다
  await primeLearnerHakpyeongSkeletons((await createClient()) as unknown as SupabaseClient)
  const skeleton = loadItemSkeleton(item.id)
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
  const map: TheaterMap | null =
    skeleton && shown.length > 0 ? { sentences: skeleton.sentences, anchors: shown, placements: skeleton.anchors } : null

  const outline = lectureOutline(item.id)
  const meta = lectureMeta(item.id)
  const steps = theaterSteps(outline)
  const blocks = theaterBlocks(item)

  // 같은 유형의 다음 문항 — 조회 0회(커밋된 골격이 `type_id` 를 들고 있다)
  const siblings = item.type_id
    ? skeletonSiblings(item.type_id).map((sib) => ({
        id: sib.id,
        slug: toItemSlug(sib.id),
        exam_label: sib.exam_label,
        no: sib.no,
        explained: true,
      }))
    : []
  const nextPick = pickNextItem(siblings, item.id, () => true)
  const examId = item.id.split('#')[0]
  const paper = kiceSourceOf(examId)
  // 평가원 회차는 링크가 없으면 평가원 게시판으로, 학평은 갈 곳이 없다(평가원 게시판으로 보내지 않는다)
  const paperUrl = paper.paperUrl ?? paper.listUrl ?? (isKiceExam(examId) ? KICE_ARCHIVE_URL : null)
  // 왼쪽 열(기출문제 원본)이 쓰는 문제지 카탈로그 — 세션 카탈로그는 골격이 있는 문항만 담는다.
  // 이 문항이 빠져 있으면 추출기가 이 번호를 뽑지 않으므로 여기서 한 줄 보탠다(글자는 없다).
  const { catalog: base } = await loadSessionCatalog()
  const paperCatalog: LearnerCatalog = {
    ...base,
    items: base.items.some((i) => i.id === item.id)
      ? base.items
      : [...base.items, { id: item.id, exam_id: examId, no: item.no, type_id: item.type_id ?? '', points: item.points }],
    exams: base.exams[examId] ? base.exams : { ...base.exams, [examId]: { label: item.exam_label, order: examOrder(examId) } },
    papers: base.papers[examId] || !paperUrl
      ? base.papers
      : { ...base.papers, [examId]: { url: paperUrl, direct: paper.paperUrl != null } },
  }

  const theater = (
    <AnalysisTheater
      title={`${item.exam_label} ${item.no}번`}
      examLabel={item.exam_label}
      typeName={item.type_name}
      points={item.points}
      minutes={theaterMinutes(outline)}
      steps={steps}
      blocks={blocks}
      map={map}
      itemId={item.id}
      backHref="/csat"
      typeHref={item.type_id ? `/csat/browse?type=${encodeURIComponent(item.type_id)}` : null}
      next={nextPick ? { href: `/csat/item/${nextPick.item.slug}`, label: `${nextPick.item.exam_label} ${nextPick.item.no}번` } : null}
      paper={{ catalog: paperCatalog, examId, no: item.no }}
      gate={{
        answer: item.answer != null && !item.answer_unknown ? item.answer : null,
        evidence: skeleton?.anchors.find((x) => x.id === 'answer')?.sentences ?? [],
        design: item.design,
      }}
      typeId={item.type_id ?? ''}
      source={{ url: paperUrl, direct: paper.paperUrl != null, reason: paper.reason }}
      siblings={siblings
        .slice()
        .sort((a, b) => b.exam_label.localeCompare(a.exam_label) || a.no - b.no)
        .map((s) => ({ slug: s.slug, label: s.exam_label, no: s.no, current: s.id === item.id }))}
    />
  )

  // 이 문항에서 확인할 읽기 원리(Phase 3) — 채택 사슬 · 적용 active · 주석 서명이 모두 맞을 때만 온다. 하나라도 빠지면 null(화면에 없음).
  // 게이트 조회가 실패해도 해설은 그대로 보인다 — 원리 칸만 빠진다
  const principle = await loadItemPrinciple(item.id).catch((e) => { console.error('[csat-item principle]', e); return null })
  const body = principle ? (
    <>
      {theater}
      {principle.taskKey === 'cohesion-link' ? (
        <CohesionPanel slug={toItemSlug(item.id)} principle={principle.principle} why={principle.why} {...(principle.panel as unknown as CohesionPanelProps)} />
      ) : (
        <>
          <PrinciplePanel slug={toItemSlug(item.id)} principle={principle.principle} why={principle.why} {...(principle.panel as { sentenceCount: number; relationSentence: number })} />
          {/* E11 기출 → Practice: 같은 원리를 다른 기출에서 연습(판정 뒤 복습 예약 → 학습 지도 「다시 보기」 → 이 확인 과제로 재평가) */}
          <p className="mx-auto mt-4 max-w-3xl break-keep px-4 text-sm">
            <a href={`/csat/practice/${PRACTICE_SLUG}`} className="inline-flex min-h-11 items-center underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
              같은 원리를 다른 기출로 연습하기 →
            </a>
          </p>
        </>
      )}
    </>
  ) : (
    theater
  )

  // 강의가 없는 문항은 무대를 세우지 않는다 — 분석 블록과 지도는 그대로 읽힌다.
  return meta ? (
    <LectureStage slug={toItemSlug(item.id)} meta={meta}>
      {body}
    </LectureStage>
  ) : (
    body
  )
}
