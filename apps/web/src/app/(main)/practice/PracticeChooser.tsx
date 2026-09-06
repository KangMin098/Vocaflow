// apps/web/src/app/(main)/practice/PracticeChooser.tsx
//
// 연습 선택 — **면(facet)으로 고른다.** 도구 이름은 결과로만 나온다.
//
// ── 조사 근거 (2026-08-15) ────────────────────────────────────────────
// · Duolingo Practice Hub — 도구가 아니라 **기술**(Speak·Listen·Words·Mistakes)로 고르게 하고,
//   상단에 **회전하는 추천 하나**를 둔다. 이 화면의 골격이 그것이다.
// · Quizlet — Match(게임)를 Flashcards·Learn·Test 와 **같은 화면**에 둔다. 같은 콘텐츠를 쓰니까.
//   → Game Lab 게임을 면 안으로 흡수했다(`practice-map.ts`). 게임은 별도 세계가 아니라
//     같은 단어의 다른 인출 형식이다.
// · 저자극 UI 연구 — 밀도 40% 가 80% 를 이긴다 · 여백은 능동적 장치.
//
// ── v2 에서 고친 것 (v1 실측 결함) ────────────────────────────────────
// ① **하단 45% 공백** — 강조 1 + 조용한 행 2 뿐이라 화면이 미완성으로 읽혔다.
//    → 여섯 면을 **모두** 카드로 세운다. 여백이 아니라 지도가 된다.
// ② **"Sound·Build 는 전용 연습이 없어요" 가 거짓이었다** — Game Lab 에 있었다.
//    화면이 자기 제품을 모르고 있었다. 이제 게임이 그 면 안에 뜬다.
// ③ **대비 미달** — 도구 이름이 `--t3` mono 11px 라 사실상 안 읽혔다. `--t2` 12.5px 로 올리고
//    행 배경을 줘서 정보를 장식에서 정보로 되돌렸다.
// ④ **진행 신호 0** — 내가 이 면에서 어디까지 왔는지 알 수 없었다. `distribution` 의
//    통과/시도를 그대로 쓴다(없으면 안 쓴다 — 지어내지 않는다).
//
// 이름은 레지스트리에서: 면 `FACETS[].name` · 도구 라벨은 `practice-map.ts`.

'use client'

import { ArrowRight, Gamepad2 } from 'lucide-react'
import Link from 'next/link'

import { useFacetSummary } from '@/components/wordvault/hooks/useFacetSummary'
import { FACETS, FACET_ORDER, type FacetId } from '@/lib/framework/axes'
import {
  GAME_LAB_HREF,
  gameLabCount,
  practiceToolsByFacet,
  type PracticeTool,
} from '@/lib/learner/practice-map'

const TOOLS = practiceToolsByFacet()
const GAME_COUNT = gameLabCount()

export function PracticeChooser({
  ownedTotal,
  sessionSize,
  gamePoolSize,
  syntaxCount,
}: {
  /** 보유 단어 총수 (`SessionQueue.vocabTotal`) */
  ownedTotal: number | null
  /** Flashcard·SpellForge 가 담을 개수 — 둘은 같은 큐를 쓴다 */
  sessionSize: number | null
  /** 게임 풀 크기(`fetchDueGameWords`) */
  gamePoolSize: number | null
  /** DCP 구문 연습 문항 수 — 잠겨 있으면 null(링크를 만들지 않는다) */
  syntaxCount: number | null
}) {
  const facets = useFacetSummary()
  const ready = facets.status === 'ready' ? facets.data : null

  // Syntax(DCP)는 문장 안에서 쓰는 훈련이라 Use 면에 속한다. 잠긴 날은 아예 없는 것으로 둔다.
  //
  // ⚠️ `?from` 은 게임 링크와 **같은 이유**로 붙인다 — 없으면 `/practice/dcp` 의 복귀
  //    링크 세 곳(상단 ←, 빈 상태 CTA, 완주 CTA)이 전부 `/hub` 로 가서, 이 화면에서
  //    들어간 학습자는 온 곳으로 돌아갈 수단을 잃는다(`/practice/dcp` 의 부모는 `/practice` 다).
  const tools: Record<FacetId, PracticeTool[]> =
    syntaxCount != null
      ? {
          ...TOOLS,
          use: [
            { label: 'Syntax', href: `/practice/dcp?from=${encodeURIComponent('/practice')}`, isGame: false },
            ...TOOLS.use,
          ],
        }
      : TOOLS

  const weakest = ready?.weakest ? (ready.weakest.facet as FacetId) : null
  const weakestHasTool = weakest != null && tools[weakest].length > 0

  // 강조는 계산된 사실일 때만 "가장 무른 곳" 이라 부른다. 아니면 첫 면을 조용히 권한다.
  const lead: FacetId = weakestHasTool ? weakest! : 'recognize'
  const rest = FACET_ORDER.filter((f) => f !== lead)

  /** 면별 대기 분량 — 그 면을 기록하는 도구의 실제 큐. 없으면 렌더하지 않는다. */
  const amountOf = (f: FacetId): number | null => {
    if (f === 'recognize' || f === 'spell') return sessionSize
    if (f === 'fluency') return gamePoolSize
    if (f === 'use') return syntaxCount // DCP 가 열린 날만 숫자가 있다
    // sound·build 는 게임만 있고 그 게임들은 각자 풀이 달라 하나로 말할 수 없다.
    return null
  }

  /** 면별 진행 — 통과/시도. 시도가 0이면 "안 해봤다" 이므로 비율을 만들지 않는다. */
  const progressOf = (f: FacetId): { passed: number; tried: number } | null => {
    const d = ready?.distribution?.[f]
    if (!d || d.tried === 0) return null
    return d
  }

  return (
    <div className="flex flex-col gap-6 py-8 md:py-10">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="font-editorial text-[30px] font-[500] leading-[1.15] tracking-[-0.014em] text-[var(--t1)] md:text-[36px]">
          연습
        </h1>
        {ownedTotal != null && (
          <span className="font-mono text-[12px] tabular-nums text-[var(--t2)]">
            내 단어 {ownedTotal.toLocaleString()}개
          </span>
        )}
      </header>

      {/* 가장 무른 면에 도구가 없을 때만 — 조용히 바꿔치기하지 않고 사실을 말한다. */}
      {weakest != null && !weakestHasTool && (
        <p className="max-w-[52ch] font-body text-[13px] leading-[1.7] text-[var(--t2)] [word-break:keep-all]">
          지금 가장 무른 곳은 <b className="font-[700] text-[var(--t1)]">{FACETS[weakest].name}</b>{' '}
          인데 아직 연습이 없어요. 가까운 것부터 해요.
        </p>
      )}

      <LeadCard
        facet={lead}
        isMeasured={weakestHasTool}
        tools={tools[lead]}
        amount={amountOf(lead)}
        progress={progressOf(lead)}
      />

      {/* ── 나머지 다섯 면 ──
          v1 은 두 행뿐이라 하단이 비었다. 여섯 면을 다 세우면 그 자체가 "내가 고를 수 있는
          전부" 라는 지도가 된다(Progressive Disclosure — 깊이는 카드 안에서). */}
      <section aria-label="다른 연습">
        {/* Game Lab 진입을 **여기** 둔다 — 면에 매핑되지 않은 게임(리텐션·시너지·해독)이
            거기 있고, 이 줄이 "다른 선택지" 구역의 머리이기 때문이다.
            맨 아래에 뒀더니 데스크톱·모바일 **양쪽 다 접힘선 아래**로 밀렸다(실측:
            desktop 1.31화면 · mobile 1.84화면). 예전 `/hub` 의 ArcadeEntryCard 를 없앤 뒤
            Game Lab 통로가 사이드바 하나로 줄었던 것을 되돌리려던 링크가, 정작 스크롤하지
            않으면 안 보였다. 조용하되 **보이는 곳**에 둔다.
            글자는 12px, 누를 곳은 44px(프로젝트 하한). */}
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-x-4">
          <h2 className="font-body text-[12px] text-[var(--t2)]">다른 쪽도 연습할 수 있어요</h2>
          <Link
            href={GAME_LAB_HREF}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] px-2 font-body text-[12px] text-[var(--t2)] no-underline transition-colors hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          >
            <Gamepad2 size={13} aria-hidden className="shrink-0" />
            Game Lab {GAME_COUNT}종 전부
            <ArrowRight size={12} aria-hidden />
          </Link>
        </div>
        {/* 2열 × 5장 = 마지막 줄에 **항상** 구멍이 남는다(면 6 − 강조 1 = 홀수).
            마지막 카드를 두 칸으로 펴면 구멍이 의도가 된다. */}
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {rest.map((f, i) => (
            <FacetCard
              key={f}
              facet={f}
              tools={tools[f]}
              amount={amountOf(f)}
              progress={progressOf(f)}
              wide={rest.length % 2 === 1 && i === rest.length - 1}
            />
          ))}
        </ul>
      </section>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// 강조 카드 — 이 화면의 유일한 1차 행동
// ────────────────────────────────────────────────────────────
function LeadCard({
  facet,
  tools,
  isMeasured,
  amount,
  progress,
}: {
  facet: FacetId
  tools: PracticeTool[]
  isMeasured: boolean
  amount: number | null
  progress: { passed: number; tried: number } | null
}) {
  const def = FACETS[facet]
  const primary = tools[0]
  const others = tools.slice(1)

  return (
    <section
      aria-label="지금 연습할 곳"
      data-design-card
      className="rounded-ios-2xl bg-[var(--bg)] px-6 py-7 shadow-ios-1 md:px-8 md:py-8"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {/* 자간을 주지 않는다 — 라틴 eyebrow 관습(0.16em)을 한글에 그대로 쓰면
            "지 금  가 장  무 른  곳" 으로 벌어져 낱글자로 읽힌다(실측). */}
        <p className="font-body text-[11px] font-[700] text-[var(--t3)]">
          {isMeasured ? '지금 가장 무른 곳' : '여기서부터'}
        </p>
        {progress && (
          <p className="font-mono text-[11px] tabular-nums text-[var(--t2)]">
            {progress.passed}/{progress.tried} 통과
          </p>
        )}
      </div>

      <h2 className="mt-2.5 font-editorial text-[26px] font-[500] leading-[1.2] tracking-[-0.012em] text-[var(--t1)] md:text-[32px]">
        {def.name}
      </h2>
      <p className="mt-1.5 max-w-[44ch] font-body text-[14.5px] leading-[1.7] text-[var(--t2)] [word-break:keep-all]">
        {def.says}
      </p>

      {primary && (
        <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2">
          <Link
            href={primary.href}
            className="inline-flex min-h-[48px] items-center gap-2 rounded-ios-pill bg-[var(--p)] px-5 font-display text-[14px] font-[700] text-[var(--on-p)] no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] motion-safe:transition-all motion-safe:duration-[var(--dur-ios-normal)] motion-safe:hover:brightness-110 motion-safe:active:scale-[0.98]"
          >
            {primary.label} 로 연습
            <ArrowRight size={15} aria-hidden />
          </Link>
          {/* 라벨이 "대기" 인 이유: 이 수는 **큐 전체**다. 도구 화면의 "This Session 20" 은
              거기서 고른 세션 길이라 다른 수다 — "이번에 50개" 로 쓰면 정면으로 어긋난다. */}
          {amount != null && amount > 0 && (
            <span className="font-mono text-[12px] tabular-nums text-[var(--t2)]">
              대기 {amount}개
            </span>
          )}
        </div>
      )}

      {others.length > 0 && <ToolRow tools={others} className="mt-4" />}
    </section>
  )
}

// ────────────────────────────────────────────────────────────
// 나머지 면 카드 — 같은 무게, 카드 배경으로 읽기 쉽게
// ────────────────────────────────────────────────────────────
function FacetCard({
  facet,
  tools,
  amount,
  progress,
  wide = false,
}: {
  facet: FacetId
  tools: PracticeTool[]
  amount: number | null
  progress: { passed: number; tried: number } | null
  /** 마지막 홀수 카드 — 두 칸을 채운다 */
  wide?: boolean
}) {
  const def = FACETS[facet]

  // 같은 줄의 카드는 도구 수가 달라 높이가 갈린다 — `li` 까지 늘려야 안쪽 `h-full` 이 먹는다.
  const cell = wide ? 'h-full sm:col-span-2' : 'h-full'

  // ⚠️ **카드 전체를 링크로 만들지 않는다.** 그렇게 두면 도구 이름은 장식 텍스트가 되고
  // 카드는 그중 첫 번째로만 간다 — 실제로 PairFlip 이 "보이는데 눌리지 않는" 상태였다
  // (26-practice-chooser ⑤ 가 잡았다). 도구 하나하나가 링크여야 화면이 파는 것과
  // 실제로 갈 수 있는 곳이 같아진다. 앵커 중첩도 이걸로 함께 사라진다.
  return (
    <li className={cell}>
      <div
        data-design-card
        className="flex h-full flex-col rounded-ios-xl bg-[var(--bg)] px-4 py-4 shadow-ios-1 md:px-5 md:py-4"
      >
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-display text-[15px] font-[700] text-[var(--t1)]">{def.name}</span>
          {progress && (
            <span className="font-mono text-[10.5px] tabular-nums text-[var(--t2)]">
              {progress.passed}/{progress.tried}
            </span>
          )}
          {/* 좁은 카드에서만 오른쪽 정렬한다 — 두 칸으로 편 카드에서 `ml-auto` 를 쓰면
            숫자가 제목에서 700px 떨어져 어느 면의 수인지 끊긴다. */}
          {amount != null && amount > 0 && (
            <span
              className={`font-mono text-[10.5px] tabular-nums text-[var(--t2)] ${wide ? '' : 'ml-auto'}`}
            >
              대기 {amount}
            </span>
          )}
        </div>
        <p className="mt-1 max-w-[34ch] font-body text-[12.5px] leading-[1.6] text-[var(--t2)] [word-break:keep-all]">
          {def.says}
        </p>
        {tools.length > 0 ? (
          <ToolRow tools={tools} className="mt-2" />
        ) : (
          // 도구가 없는 면은 **없다고 말한다.** 빈 카드를 두거나 목록에서 지우지 않는다 —
          // 학습자가 "왜 이 면은 없지" 를 화면에서 답 받게.
          <p className="mt-2.5 font-body text-[11.5px] leading-[1.6] text-[var(--t3)] [word-break:keep-all]">
            아직 전용 연습이 없어요. 읽기와 따라읽기에서 쌓여요.
          </p>
        )}
      </div>
    </li>
  )
}

// ────────────────────────────────────────────────────────────
/**
 * 도구 줄 — 모듈과 게임을 한 줄에. 게임은 아이콘으로 구분(색만으로 전달 금지).
 *
 * 각 칩은 **링크**이고 높이 44px 이다(프로젝트 하한). 이전에는 `span` + 11px mono 라
 * 읽기도 어렵고 누를 수도 없었다 — 화면이 도구를 나열하면서 그리로 갈 길은 안 준 셈이다.
 */
function ToolRow({ tools, className = '' }: { tools: PracticeTool[]; className?: string }) {
  return (
    <ul className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${className}`}>
      {tools.map((t) => (
        <li key={t.href}>
          <Link
            href={t.href}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-ios-pill bg-[var(--bg2)] px-3 font-mono text-[12px] text-[var(--t2)] no-underline hover:bg-[var(--bg3)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] motion-safe:transition-colors"
          >
            {t.isGame && <Gamepad2 size={12} aria-hidden className="shrink-0" />}
            {t.label}
          </Link>
        </li>
      ))}
    </ul>
  )
}
