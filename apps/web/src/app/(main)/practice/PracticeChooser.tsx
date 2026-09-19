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

// ── v3 (2026-09-19 화면 재설계 DD-32 · docs/design/compare/practice.md 발산 A 「오늘의 연습지」) ──
// 카드 6장 + 알약 칩 메뉴판(감사 평균)을 **번호 붙은 괘선 문항 여섯 줄**로. 문항마다 그 면에서 아직
// 통과하지 못한 **내 낱말**(`FacetSummary.pending`)이 선다 — 연습 화면이 처음으로 연습할 낱말을 보여 준다.
// 도구는 칩이 아니라 글자 링크(44px). 면 요약은 서버가 읽어 넘긴다(첫 화면이 흔들리지 않게).

import { ArrowRight, Gamepad2 } from 'lucide-react'
import Link from 'next/link'

import { FACETS, FACET_ORDER, type FacetId } from '@/lib/framework/axes'
import type { FacetSummary } from '@/lib/framework/word-progress-query'
import {
  GAME_LAB_HREF,
  gameLabCount,
  practiceToolsByFacet,
  type PracticeTool,
} from '@/lib/learner/practice-map'

const TOOLS = practiceToolsByFacet()
const GAME_COUNT = gameLabCount()

const TOOL_LINK =
  'inline-flex min-h-[44px] items-center gap-1.5 font-display text-[13px] font-[600] text-[var(--t1)] underline decoration-[var(--bd)] underline-offset-4 transition-colors duration-[var(--dur-normal)] hover:text-[var(--p)] hover:decoration-[var(--p)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:translate-y-px'

export function PracticeChooser({
  facets,
  ownedTotal,
  sessionSize,
  gamePoolSize,
  syntaxCount,
}: {
  /** 면 요약(서버) — 없으면 면별 낱말·진행 없이 선다 */
  facets: FacetSummary | null
  /** 보유 단어 총수 (`SessionQueue.vocabTotal`) */
  ownedTotal: number | null
  /** Flashcard·SpellForge 가 담을 개수 — 둘은 같은 큐를 쓴다 */
  sessionSize: number | null
  /** 게임 풀 크기(`fetchDueGameWords`) */
  gamePoolSize: number | null
  /** DCP 구문 연습 문항 수 — 잠겨 있으면 null(링크를 만들지 않는다) */
  syntaxCount: number | null
}) {
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

  const weakest = facets?.weakest ? (facets.weakest.facet as FacetId) : null
  const weakestHasTool = weakest != null && tools[weakest].length > 0

  // 강조는 계산된 사실일 때만 "가장 무른 곳" 이라 부른다. 아니면 첫 면을 조용히 권한다.
  const lead: FacetId = weakestHasTool ? weakest! : 'recognize'
  const order: FacetId[] = [lead, ...FACET_ORDER.filter((f) => f !== lead)]

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
    const d = facets?.distribution?.[f]
    if (!d || d.tried === 0) return null
    return d
  }

  return (
    <div className="flex flex-col gap-5 py-8 md:py-10">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b-2 border-[var(--t1)] pb-3">
        <h1 className="font-editorial text-[30px] font-[500] leading-[1.15] tracking-[-0.014em] text-[var(--t1)] md:text-[36px]">
          오늘의 연습지
        </h1>
        {ownedTotal != null && (
          <span className="font-mono text-[12px] tabular-nums text-[var(--t2)]">
            내 단어 {ownedTotal.toLocaleString()}개 · 여섯 면
          </span>
        )}
        {/* 면에 매핑되지 않은 게임(리텐션·시너지·해독)은 Game Lab 에 있다 — 접힘선 위에 둔다
            (맨 아래에 뒀을 때 데스크톱·모바일 모두 접힘선 아래였다 — 26-practice-chooser ③) */}
        <Link href={GAME_LAB_HREF} className={`${TOOL_LINK} ml-auto text-[var(--t2)]`}>
          <Gamepad2 size={13} aria-hidden className="shrink-0" />
          Game Lab {GAME_COUNT}종 전부
          <ArrowRight size={12} aria-hidden />
        </Link>
      </header>

      {/* 가장 무른 면에 도구가 없을 때만 — 조용히 바꿔치기하지 않고 사실을 말한다. */}
      {weakest != null && !weakestHasTool && (
        <p className="max-w-[52ch] font-body text-[13px] leading-[1.7] text-[var(--t2)] [word-break:keep-all]">
          지금 가장 무른 곳은 <b className="font-[700] text-[var(--t1)]">{FACETS[weakest].name}</b>{' '}
          인데 아직 연습이 없어요. 가까운 것부터 해요.
        </p>
      )}

      <ol className="flex flex-col" aria-label="여섯 면 — 첫 문항이 지금 연습할 곳">
        {order.map((f, i) => (
          <Item
            key={f}
            n={i + 1}
            facet={f}
            lead={i === 0}
            isMeasured={i === 0 && weakestHasTool}
            tools={tools[f]}
            words={facets?.pending?.[f] ?? []}
            amount={amountOf(f)}
            progress={progressOf(f)}
          />
        ))}
      </ol>

    </div>
  )
}

// ────────────────────────────────────────────────────────────
// 문항 한 줄 — 번호 · 면 이름 · 그 면에서 걸리는 내 낱말 · 도구
// ────────────────────────────────────────────────────────────
function Item({
  n,
  facet,
  lead,
  isMeasured,
  tools,
  words,
  amount,
  progress,
}: {
  n: number
  facet: FacetId
  /** 첫 문항 — 이 화면의 유일한 1차 행동 */
  lead: boolean
  isMeasured: boolean
  tools: PracticeTool[]
  words: string[]
  amount: number | null
  progress: { passed: number; tried: number } | null
}) {
  const def = FACETS[facet]
  const primary = lead ? tools[0] : undefined
  const others = lead ? tools.slice(1) : tools

  return (
    <li
      data-practice-item={facet}
      className={`grid grid-cols-[28px_minmax(0,1fr)] gap-x-3 border-b border-[var(--bd)] ${lead ? 'py-6' : 'py-4'}`}
    >
      <span
        aria-hidden
        className={`pt-1 font-mono text-[13px] font-[700] tabular-nums ${lead ? 'text-[var(--ju-ink)]' : 'text-[var(--t2)]'}`}
      >
        {n}.
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {lead ? (
            <h2 className="font-editorial text-[24px] font-[500] leading-[1.2] tracking-[-0.012em] text-[var(--t1)] md:text-[28px]">
              {def.name}
            </h2>
          ) : (
            <h2 className="font-display text-[15px] font-[700] text-[var(--t1)]">{def.name}</h2>
          )}
          {lead && (
            // 자간을 주지 않는다 — 라틴 eyebrow 관습을 한글에 쓰면 낱글자로 읽힌다(실측)
            <span className="font-body text-[12px] font-[700] text-[var(--ju-ink)]">
              {isMeasured ? '지금 가장 무른 곳' : '여기서부터'}
            </span>
          )}
          {progress && (
            <span className="font-mono text-[11px] tabular-nums text-[var(--t2)]">
              {progress.passed}/{progress.tried} 통과
            </span>
          )}
          {/* 라벨이 "대기" 인 이유: 이 수는 **큐 전체**다(도구 화면의 세션 길이와 다른 수) */}
          {amount != null && amount > 0 && (
            <span className="font-mono text-[11px] tabular-nums text-[var(--t2)]">대기 {amount}</span>
          )}
        </div>
        <p className={`mt-1 max-w-[52ch] font-body leading-[1.65] text-[var(--t2)] [word-break:keep-all] ${lead ? 'text-[14px]' : 'text-[12.5px]'}`}>
          {def.says}
        </p>

        {/* 이 면에서 아직 걸리는 내 낱말 — 연습지의 문항 */}
        {words.length > 0 && (
          <p
            data-practice-words=""
            className={`mt-2 font-english leading-[1.8] text-[var(--t1)] [overflow-wrap:anywhere] ${lead ? 'text-[17px]' : 'line-clamp-1 text-[15px]'}`}
          >
            {words.join(' · ')}
          </p>
        )}

        {tools.length > 0 ? (
          <div className={`flex flex-wrap items-center gap-x-4 gap-y-0 ${lead ? 'mt-4' : 'mt-1'}`}>
            {primary && (
              <Link
                href={primary.href}
                className="mr-2 inline-flex min-h-[48px] items-center gap-2 rounded-[var(--r-md)] bg-[var(--ju)] px-5 font-display text-[14px] font-[700] text-[var(--on-ju)] no-underline transition-colors duration-[var(--dur-normal)] hover:bg-[var(--ju-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:translate-y-px"
              >
                {primary.label} 로 연습
                <ArrowRight size={15} aria-hidden />
              </Link>
            )}
            {others.map((t) => (
              <Link key={t.href} href={t.href} className={TOOL_LINK}>
                {t.isGame && <Gamepad2 size={12} aria-hidden className="shrink-0 text-[var(--t2)]" />}
                {t.label}
              </Link>
            ))}
          </div>
        ) : (
          // 도구가 없는 면은 **없다고 말한다** — 학습자가 "왜 이 면은 없지" 를 화면에서 답 받게.
          <p className="mt-1.5 font-body text-[12px] leading-[1.6] text-[var(--t2)] [word-break:keep-all]">
            아직 전용 연습이 없어요. 읽기와 따라읽기에서 쌓여요.
          </p>
        )}
      </div>
    </li>
  )
}
