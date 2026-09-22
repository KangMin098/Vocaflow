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
import { kiceSourceOf } from '@/lib/csat/kice-source'
import { fromItemSlug, loadCsatItemExplain } from '@/lib/csat/learner'
import { toItemSlug } from '@/lib/csat/item-slug'
import { lectureMeta, lectureOutline } from '@/lib/csat/lecture/store'
import { pickNextItem } from '@/lib/csat/next-item'
import type { MapAnchor } from '@/lib/csat/passage-map-model'
import { loadItemSkeleton, skeletonSiblings } from '@/lib/csat/skeleton'
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
  const paper = kiceSourceOf(item.id.split('#')[0])

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
      backHref={item.type_id ? `/csat?type=${encodeURIComponent(item.type_id)}` : '/csat'}
      backLabel="기출 목록"
      next={nextPick ? { href: `/csat/item/${nextPick.item.slug}`, label: `${nextPick.item.exam_label} ${nextPick.item.no}번` } : null}
      source={{ url: paper.paperUrl ?? paper.listUrl, direct: paper.paperUrl != null, reason: paper.reason }}
      siblings={siblings
        .slice()
        .sort((a, b) => b.exam_label.localeCompare(a.exam_label) || a.no - b.no)
        .map((s) => ({ slug: s.slug, label: s.exam_label, no: s.no, current: s.id === item.id }))}
    />
  )

  // 강의가 없는 문항은 무대를 세우지 않는다 — 분석 블록과 지도는 그대로 읽힌다.
  return meta ? (
    <LectureStage slug={toItemSlug(item.id)} meta={meta}>
      {theater}
    </LectureStage>
  ) : (
    theater
  )
}
