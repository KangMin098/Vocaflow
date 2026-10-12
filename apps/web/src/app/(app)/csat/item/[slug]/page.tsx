// apps/web/src/app/(app)/csat/item/[slug]/page.tsx
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

import { BookOpen } from 'lucide-react'

import { CsatShell } from '@/components/csat/home/CsatShell'
import { AnalysisTheater, type TheaterMap } from '@/components/csat/theater/AnalysisTheater'
import { railExams } from '@/lib/csat/rail-data'
import { LectureStage } from '@/components/csat/lecture/LectureStage'
import { CohesionPanel } from '@/components/csat/theater/CohesionPanel'
import { EvidencePanel } from '@/components/csat/theater/EvidencePanel'
import type { EvidencePanelProps } from '@/lib/knowledge/evidence-locate'
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
import { loadRevealedSkeleton, primeLearnerHakpyeongSkeletons, revealedSkeletonSiblings, skeletonSiblings } from '@/lib/csat/skeleton'
import { canRevealItem, loadRevealScope } from '@/lib/csat/embargo-gate'
import { loadItemPrinciple } from '@/lib/knowledge/product-server'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { CIRCLED, theaterBlocks, theaterMinutes, theaterSteps } from '@/lib/csat/theater'
import { buildChecks } from '@/lib/csat/understanding-check'
import { parseScene } from '@/lib/csat/inquiry/scenes'
import { inquiryBinding, lookupInquiry } from '@/lib/csat/inquiry/data'
import { lookupMeaningSupport } from '@/lib/csat/meaning-support/data'
import { parseMeaningParams } from '@/lib/csat/meaning-support/model'
import compareData from '@/lib/csat/compare-data.json'
import { projectV3Pairs, v3PairPartners } from '@/lib/csat/inquiry/compare-v3'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const { item } = await loadCsatItemExplain(fromItemSlug(slug))
  return {
    title: item ? `${item.exam_label} ${item.no}번 해설 — 기출` : '기출 문항 해설',
    description: '근거가 지문의 어디에 있고 오답이 어떻게 만들어졌는지 차례로 봅니다.',
  }
}

export default async function CsatItemTheaterPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ scene?: string | string[]; judgmentView?: string | string[]; check?: string; from?: string; pair?: string | string[]; back?: string | string[]; meaning?: string | string[]; depth?: string | string[] }>
}) {
  const { slug } = await params
  const sp = await searchParams
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  // 일곱 장면 파서 — 옛 장면 값(essence · structure · answer · distractor)은 별칭, 무효값은 평가 과제(UX v3 §2)
  const parsedScene = parseScene(first(sp.scene), first(sp.judgmentView))
  // 확인 모드(학습 지도의 확인 · 다시 확인 · 적용 링크) — 해설을 열기 전에 확인 과제만 푼다(6차).
  //   F01(2026-10-10): 문항을 열면 해설을 바로 보여 주므로 그 열람은 「해설 먼저 봄」으로 남는다 — 그 화면에서 푼 확인 과제는 독립 수행이 아니다.
  //   그래서 지도에서 확인용으로 들어올 때만 해설 극장 · 강의를 그리지 않는다(해설 열람 기록도 없다). 과제 뒤 「해설 보기」 는 일반 화면(F01 그대로).
  const checkMode = sp.check === '1'
  // 학습 지도에서 온 학습자(확인 링크 → 해설 보기)는 지도로 돌아갈 수 있다(v3 M4). 지도의 확인 링크는 모두 check=1 로 온다
  const fromMap = sp.from === 'map' || checkMode
  const itemId = fromItemSlug(slug)
  const { item, error, held } = await loadCsatItemExplain(itemId)
  // 보류 시험 문항(오답 원인 Pilot 수집 중) — 정답 · 분석 · 뼈대 · 강의 개요를 화면 데이터에 싣지 않는다(embargo-gate · Pilot 1c8e122fb)
  if (held) {
    return (
      <CsatShell place="item" exams={await railExams()} pill={<><BookOpen size={13} aria-hidden="true" />기출 해설</>}>
        <p className="mx-auto max-w-2xl break-keep py-10 text-sm leading-relaxed text-[var(--t2)]" data-testid="item-held">
          이 회차의 해설은 지금 잠시 닫혀 있어요. 풀이 기록을 모으는 기간이 끝나면 다시 열려요.
        </p>
      </CsatShell>
    )
  }
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
  const map: TheaterMap | null =
    skeleton && shown.length > 0 ? { sentences: skeleton.sentences, anchors: shown, placements: skeleton.anchors } : null

  const outline = lectureOutline(item.id)
  const meta = lectureMeta(item.id)
  const steps = theaterSteps(outline)
  const blocks = theaterBlocks(item)
  // 이해 확인(M4) — 검수된 근거 자리 · 함정 라벨로만 만든다(새 생성 없음)
  const answerPlacement = skeleton?.anchors.find((x) => x.id === 'answer')
  const checks = buildChecks({
    id: item.id,
    type_id: item.type_id,
    distractors: item.distractors,
    map: skeleton && answerPlacement ? { sentenceCount: skeleton.sentences.length, answerSentences: answerPlacement.sentences } : null,
  })

  // 같은 유형의 다음 문항 — 조회 0회(커밋된 골격이 `type_id` 를 들고 있다)
  const siblings = item.type_id
    ? revealedSkeletonSiblings(item.type_id, await loadRevealScope()).map((sib) => ({
        id: sib.id,
        slug: toItemSlug(sib.id),
        exam_label: sib.exam_label,
        no: sib.no,
        explained: true,
      }))
    : []
  const nextPick = pickNextItem(siblings, item.id, () => true)
  // 같은 원리 비교 쌍(M4) — 검수 통과분 중 지금 열 수 있는(같은 유형 공개 목록에 있는) 문항만
  const sibById = new Map(siblings.map((x) => [x.id, x]))
  const pairs = (compareData.items as Record<string, { kind?: 'same' | 'contrast'; other: string; choice: number; otherChoice: number; trap: string; note: string }[]>)[item.id] ?? []
  const comparePairs = pairs.flatMap((p) => {
    const o = sibById.get(p.other)
    return o ? [{ ...p, otherSlug: o.slug, otherLabel: `${o.exam_label} ${o.no}번` }] : []
  })
  // v3 비교 쌍(M4) — 상대는 같은 유형 siblings 가 아니라 **상대 유형의 공개 목록**에서 확인한다(교차 유형 허용 · 비공개 상대는 뺀다)
  const inquiryHit = lookupInquiry(item.id, item.analysis_version)
  // v3.1 원문 이해 교수 설명 — 문항 접근 · 탐구 ready 뒤에만, 결속(분석 버전 · units_hash · 배포 레코드 해시)이 맞을 때 문항 1개 projection 만 넘긴다
  const msHit = lookupMeaningSupport(item.id, item.analysis_version, inquiryHit.state === 'ready')
  const msParams = msHit.view
    ? parseMeaningParams({ meaning: first(sp.meaning) ?? null, depth: first(sp.depth) ?? null }, msHit.view.units.map((u) => u.id), msHit.view.defaultUnitId)
    : null
  const revealScope = await loadRevealScope()
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

  // 마지막 관문 — 처음 판정과 골격 판정 사이에 보류가 시작됐으면 이미 읽은 정답 · 해설 · 강의 개요를 내지 않는다(Codex P1)
  if (!(await canRevealItem(item.id))) {
    return (
      <CsatShell place="item" exams={await railExams()} pill={<><BookOpen size={13} aria-hidden="true" />기출 해설</>}>
        <p className="mx-auto max-w-2xl break-keep py-10 text-sm leading-relaxed text-[var(--t2)]" data-testid="item-held">
          이 회차의 해설은 지금 잠시 닫혀 있어요. 풀이 기록을 모으는 기간이 끝나면 다시 열려요.
        </p>
      </CsatShell>
    )
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
      checks={checks}
      comparePairs={comparePairs}
      v3Pairs={v3Compare.pairs}
      pairAbsence={v3Compare.absence}
      pairWithheld={v3Compare.withheld}
      initialPairId={first(sp.pair) ?? null}
      currentSlug={slug}
      compareReturn={(() => {
        // 다른 문항의 비교에서 넘어왔다(`back`) — 같은 쌍을 그 문항 쪽에서 다시 연다. 문항 slug 형식만 받는다(열린 리디렉트 방지)
        const b = first(sp.back)
        if (!b || !/^[A-Za-z0-9]+-\d+$/.test(b)) return null
        const bid = fromItemSlug(b)
        const label = openById.get(bid)?.label ?? bid.replace('#', ' ') + '번'
        const pr = first(sp.pair)
        return { href: `/csat/item/${b}?scene=compare${pr ? `&pair=${encodeURIComponent(pr)}` : ''}${fromMap ? '&from=map' : ''}`, label }
      })()}
      // 지금 읽은 분석 버전과 같은 버전으로 만든 탐구 데이터만 — 다르면 stale 로 빼고 기존 블록만 보인다
      inquiry={inquiryHit.state === 'ready' ? inquiryHit.record : null}
      initialScene={parsedScene.scene}
      meaningSupport={msHit.view}
      initialMeaning={msParams?.unitId ?? null}
      initialDepth={msParams?.depth ?? 'brief'}
      initialJudgmentView={parsedScene.judgmentView}
      sceneNormalized={parsedScene.normalized}
      map={map}
      itemId={item.id}
      backHref="/csat"
      mapReturn={fromMap ? '/csat/diagnosis' : null}
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
        .map((s) => ({ id: s.id, slug: s.slug, label: s.exam_label, no: s.no, current: s.id === item.id }))}
    />
  )

  // 이 문항에서 확인할 읽기 원리(Phase 3) — 채택 사슬 · 적용 active · 주석 서명이 모두 맞을 때만 온다. 하나라도 빠지면 null(화면에 없음).
  // 게이트 조회가 실패해도 해설은 그대로 보인다 — 원리 칸만 빠진다
  const principle = await loadItemPrinciple(item.id).catch((e) => { console.error('[csat-item principle]', e); return null })
  const panel = principle ? (
    principle.taskKey === 'option-restate' || principle.taskKey === 'evidence-locate' ? (
      <EvidencePanel slug={toItemSlug(item.id)} principle={principle.principle} why={principle.why} {...(principle.panel as unknown as EvidencePanelProps)} />
    ) : principle.taskKey === 'cohesion-link' ? (
      <CohesionPanel slug={toItemSlug(item.id)} principle={principle.principle} why={principle.why} {...(principle.panel as unknown as CohesionPanelProps)} />
    ) : (
      <PrinciplePanel slug={toItemSlug(item.id)} principle={principle.principle} why={principle.why} {...(principle.panel as { sentenceCount: number; relationSentence: number })} />
    )
  ) : null
  if (checkMode && panel) {
    return (
      <CsatShell place="item" exams={await railExams()} pill={<><BookOpen size={13} aria-hidden="true" />{item.exam_label} {item.no}번 · 직접 확인</>}>
        <div data-testid="item-check-mode">
          <p className="mx-auto mt-6 max-w-3xl break-keep px-4 text-sm leading-relaxed text-[var(--t2)]">
            해설을 보기 전에 혼자 판단해 보는 확인이에요. 공개 문제지의 지문을 보며 문장 번호로 골라 주세요.
          </p>
          {panel}
          <p className="mx-auto mt-4 max-w-3xl break-keep px-4 text-sm">
            <a href={`/csat/item/${toItemSlug(item.id)}?from=map${first(sp.scene) ? `&scene=${parsedScene.scene}` : ''}`} className="inline-flex min-h-11 items-center underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" data-testid="item-check-explain">
              확인을 마쳤으면 해설 보기 →
            </a>
          </p>
        </div>
      </CsatShell>
    )
  }
  const body = principle ? (
    <>
      {theater}
      {principle.taskKey === 'option-restate' || principle.taskKey === 'evidence-locate' ? (
        <EvidencePanel slug={toItemSlug(item.id)} principle={principle.principle} why={principle.why} {...(principle.panel as unknown as EvidencePanelProps)} />
      ) : principle.taskKey === 'cohesion-link' ? (
        <CohesionPanel slug={toItemSlug(item.id)} principle={principle.principle} why={principle.why} {...(principle.panel as unknown as CohesionPanelProps)} />
      ) : (
        <>
          <PrinciplePanel slug={toItemSlug(item.id)} principle={principle.principle} why={principle.why} {...(principle.panel as { sentenceCount: number; relationSentence: number })} />
          {/* E11 기출 → Practice: 같은 원리를 다른 기출에서 연습(판정 뒤 복습 예약 → 학습 지도 「다시 보기」 → 이 확인 과제로 재평가) */}
          <p className="mx-auto mt-4 max-w-3xl break-keep px-4 text-sm">
            <a href={`/csat/practice/${PRACTICE_SLUG}`} className="inline-flex min-h-11 items-center underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
              다른 기출 지문으로 한 번 더 확인하기 →
            </a>
          </p>
        </>
      )}
    </>
  ) : (
    theater
  )

  // 강의가 없는 문항은 무대를 세우지 않는다 — 분석 블록과 지도는 그대로 읽힌다.
  // 2026-10-10 1440 통합: 해설 극장도 기출분석공간 레일 안에 둔다(일반 앱 셸에서는 이어서 · 서가 · 연습으로 가는 길이 없었다).
  return (
    <CsatShell place="item" exams={await railExams()} pill={<><BookOpen size={13} aria-hidden="true" />{item.exam_label} {item.no}번</>} bare>
      {meta ? (
        <LectureStage slug={toItemSlug(item.id)} meta={meta} keys={false}>
          {body}
        </LectureStage>
      ) : (
        body
      )}
    </CsatShell>
  )
}
