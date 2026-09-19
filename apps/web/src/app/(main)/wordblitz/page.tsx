// apps/web/src/app/(main)/wordblitz/page.tsx
// @form: 시험지 사물 — 이번 판 낱말: 게임이 실제로 쓸 낱말이 괘선 두 단(영어 — 뜻)으로, 시작은 하나
//
// 2026-09-19 화면 재설계(DD-35 · docs/design/compare/game-hubs.md 발산 A 「이번 판 낱말」):
//   같은 행동의 시작 버튼이 둘이었다(네이비 「바로 시작」 · 빨강 「지금 한 판」 — 빨강은 전역 「진단 시작」 과 같은 색).
//   지금은 판면 머리(ModuleHero)의 주묵 「한 판 시작」 하나. 알약 칩 → 괘선 두 단 · 트로피 상자 두 장 → 기록 괘선 ·
//   한글 이탤릭 3곳 제거. 최고 기록 줄(`aside[aria-label="최고 점수"]`)은 기록이 없어도 선다(없으면 안내 문장 — e2e 18).
// WordBlitz Hub — 게임 소개 + 실측 기록 + 시작 CTA → /play/wordblitz
// 정서적 부호화: 인형뽑기 정글 분위기 미리보기로 기대감 형성
//
// v08.6 목업 제거. 기록이 전부 상수였다:
//   · "Best 1410 · 콤보 11 · 정확도 94%" — 히어로 부제와 stats row **두 곳**에 하드코딩
//   · 최근 기록 4행(오늘 1240 콤보 8 · 어제 980 …) — 실측 결과 scores 에 wordblitz **1행**
//     뿐이었다(2026-08-12, 전체 사용자 기준). 처음 온 학습자도 4회의 전적을 봤다.
//
// 콤보를 되살리지 않은 이유: scores.metadata 에 콤보가 없다(실측 키 demo·scope·wrong·captured).
// 표시하려면 먼저 기록해야 한다 — 없는 값을 화면에 두는 것이 이 커밋이 지우는 대상이다.
//
// 게임 규칙·학습 효과 설명은 상수로 남긴다 — 그건 데이터가 아니라 이 게임의 설명이다.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@vocaflow/types'
import { ChevronRight, Gamepad2 } from 'lucide-react'
import Link from 'next/link'

import { GamePoolPanel } from '@/components/hub/GamePoolPanel'
import { ModuleHero } from '@/components/hub/ModuleHero'
import { RecentScoresList } from '@/components/hub/RecentScoresList'
import { fetchDueGameWords } from '@/lib/game/due-words'
import { fetchBestScore, fetchRecentScores, type RecentScore } from '@/lib/scores/recent'
import { createClient } from '@/lib/supabase/server'

interface RuleStep {
  step: string
  title: string
  description: string
}

const RULES: RuleStep[] = [
  {
    step: '01',
    title: '뜻을 읽어요',
    description: '화면 상단에 한국어 뜻이 표시됩니다.',
  },
  {
    step: '02',
    title: '인형을 골라요',
    description: '4개의 인형 중 뜻에 해당하는 영단어를 잡습니다.',
  },
  {
    step: '03',
    title: '연속 정답으로 콤보',
    description: '연속 정답 시 콤보 보너스 (최대 4단계).',
  },
]

/**
 * 한 판이 성립하는 최소 단어 수 — 게임 페이지(`(app)/play/wordblitz`)의 `MIN_WORDS` 와 같은 값.
 * 허브가 더 낮게 잡으면 "시작" 을 눌러도 게임이 거절해서, 화면이 될 것처럼 말한 셈이 된다.
 */
const MIN_WORDS = 6

export const metadata = {
  title: 'WordBlitz',
}

export default async function WordBlitzHubPage() {
  const client = (await createClient()) as unknown as SupabaseClient<Database>
  const {
    data: { user },
  } = await client.auth.getUser()

  const [recent, best, pool, ownedTotal] = user
    ? await Promise.all([
        fetchRecentScores(client, user.id, 'wordblitz'),
        fetchBestScore(client, user.id, 'wordblitz'),
        // 게임이 실제로 쓰는 그 함수. 허브가 별도 쿼리로 세면 시작 후와 어긋난다.
        fetchDueGameWords(client, user.id),
        // 보유 총수는 따로 센다 — 위 함수의 `total` 은 상한(40)으로 잘린 풀 크기다.
        client
          .from('vocabularies')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .then((r) => (r.error ? 0 : (r.count ?? 0))),
      ])
    : [[] as RecentScore[], null, { words: [], total: 0 }, 0]

  const poolWords = pool.words.map((w) => ({ en: w.en, ko: w.ko }))

  // 최근 정확도 = 가장 마지막 세션의 정확도. 평균이 아니라 마지막인 이유는 라벨이 "최근" 이고,
  // 평균을 "최근" 이라 부르면 한 판 잘한 것이 며칠간 화면에 남는다.
  const lastAccuracy = recent.find((r) => r.accuracy != null)?.accuracy ?? null
  const hasRecord = best != null
  /**
   * 아직 한 판도 안 한 상태.
   *
   * 이때 "최고 기록" 과 "최근 기록" 두 카드는 **같은 말을 다른 문장으로 두 번** 한다
   * ("아직 기록이 없어요…" / "아직 이 게임 기록이 없어요…"). 실측 2026-08-16: 모바일에서
   * 그 두 빈 카드가 화면의 약 40% 를 차지했다. 없는 것을 두 칸 잡아 두 번 알리는 것은
   * 안내가 아니라 소음이다 — 한 줄로 말하고 자리를 비운다.
   */
  const noHistory = !hasRecord && recent.length === 0

  return (
    <div className="mx-auto flex max-w-[var(--ios-content-wide-max)] flex-col gap-5 px-4 py-6 md:px-6 md:py-8">
      <ModuleHero
        eyebrow="WordBlitz · 정글 어드벤처"
        title="WordBlitz"
        note={hasRecord ? '뜻을 보고 네 인형 중 그 낱말을 잡아요 — 연속으로 맞히면 콤보' : '첫 판을 기다리고 있어요 — 뜻을 보고 네 인형 중 그 낱말을 잡아요'}
        gradient={{ from: '#2d6a2d', to: '#5ab540' }}
        icon={Gamepad2}
        // 기록이 없으면 통계 줄을 세우지 않는다(0점·0% 는 "해봤는데 0점" 으로 읽힌다)
        stats={
          hasRecord
            ? [
                { label: 'Best', value: best!.toLocaleString(), emphasis: true },
                ...(lastAccuracy != null ? [{ label: '최근 정확도', value: lastAccuracy, unit: '%' }] : []),
              ]
            : undefined
        }
        primaryAction={
          // 시작은 하나 — 예전에는 같은 곳으로 가는 버튼이 둘(색도 둘)이었다
          <Link
            href="/play/wordblitz"
            className="inline-flex min-h-[48px] items-center gap-2 rounded-[var(--r-md)] bg-[var(--ju)] px-5 font-display text-[14px] font-[700] text-[var(--on-ju)] no-underline transition-colors duration-[var(--dur-normal)] hover:bg-[var(--ju-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] active:translate-y-px"
          >
            <Gamepad2 size={15} strokeWidth={2.25} aria-hidden />
            한 판 시작
          </Link>
        }
      />

      {/* ── 이번 판 낱말 — 설명보다 먼저: 무엇으로 노는가 ── */}
      <GamePoolPanel words={poolWords} ownedTotal={ownedTotal} minWords={MIN_WORDS} />

      {/* ── 기록 — 상자 두 장(트로피) 대신 괘선. 최고 기록 줄은 기록이 없어도 선다 ── */}
      <section aria-label="기록" className="flex flex-col">
        <aside aria-label="최고 점수" className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-[var(--bd)] pb-2">
          <h2 className="font-display text-[14px] font-[700] text-[var(--t1)]">최고 기록</h2>
          {hasRecord ? (
            <>
              <p className="m-0 font-display text-[22px] font-[800] tabular-nums leading-none text-[var(--t1)]">
                {best!.toLocaleString()}
                <span className="ml-1 text-[13px] font-[600] text-[var(--t2)]">점</span>
              </p>
              {/* 언제였는지 · 콤보는 저장되지 않는다 — 모르는 것을 쓰지 않는다 */}
              <p className="m-0 font-body text-[12px] text-[var(--t2)]">지금까지 이 게임 최고점</p>
            </>
          ) : (
            <p className="m-0 font-body text-[13px] text-[var(--t2)] [word-break:keep-all]">
              아직 기록이 없어요. 한 판을 마치면 최고점과 정확도가 여기에 남아요.
            </p>
          )}
        </aside>
        {!noHistory && (
          <RecentScoresList
            scores={recent}
            best={best}
            accent="var(--p)"
            emptyHint="아직 이 게임 기록이 없어요. 한 판을 마치면 점수와 정확도가 여기에 남아요."
          />
        )}
      </section>

      {/* ── 설명은 접어 둔다 — 상자 없이 괘선 목록 ── */}
      <details className="group">
        <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center gap-2 font-body text-[12.5px] text-[var(--t2)] transition-colors hover:text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)] [&::-webkit-details-marker]:hidden">
          <ChevronRight size={13} aria-hidden className="shrink-0 transition-transform duration-[var(--dur-normal)] group-open:rotate-90" />
          이 게임이 뭘 하는지
        </summary>
        <div className="mt-2 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <section aria-label="학습 효과">
            <h2 className="font-display text-[13px] font-[700] text-[var(--t1)]">학습 효과</h2>
            <ul className="m-0 mt-2 list-none border-t border-[var(--bd)] p-0">
              {[
                { ko: '능동적 회상', en: 'Active Recall — 4 옵션 즉시 인출' },
                { ko: '정서적 부호화', en: 'Emotional Encoding — 콤보' },
                { ko: '간격 반복', en: 'Spaced Repetition — 오답 단어 우선 노출' },
              ].map((e) => (
                <li key={e.en} className="border-b border-[var(--bd)] py-2">
                  <p className="m-0 font-display text-[13px] font-[700] text-[var(--t1)]">{e.ko}</p>
                  <p className="m-0 mt-0.5 font-mono text-[11px] text-[var(--t2)]">{e.en}</p>
                </li>
              ))}
            </ul>
          </section>
          <section aria-label="게임 규칙">
            <h2 className="font-display text-[13px] font-[700] text-[var(--t1)]">게임 규칙</h2>
            <ol className="m-0 mt-2 list-none border-t border-[var(--bd)] p-0">
              {RULES.map((r) => (
                <li key={r.step} className="grid grid-cols-[28px_minmax(0,1fr)] gap-x-2 border-b border-[var(--bd)] py-2">
                  <span className="font-mono text-[12px] font-[700] text-[var(--t2)]">{r.step}</span>
                  <span>
                    <span className="font-display text-[13px] font-[700] text-[var(--t1)]">{r.title}</span>{' '}
                    <span className="font-body text-[12px] text-[var(--t2)]">— {r.description}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </details>
    </div>
  )
}
