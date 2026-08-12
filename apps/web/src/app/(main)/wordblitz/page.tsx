// apps/web/src/app/(main)/wordblitz/page.tsx
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
import {
  Award,
  Gamepad2,
  Layers,
  Maximize2,
  Trophy,
  Zap,
} from 'lucide-react'
import Link from 'next/link'

import { RecentScoresList } from '@/components/hub/RecentScoresList'
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

export const metadata = {
  title: 'WordBlitz · Vocaflow',
}

export default async function WordBlitzHubPage() {
  const client = (await createClient()) as unknown as SupabaseClient<Database>
  const {
    data: { user },
  } = await client.auth.getUser()

  const [recent, best] = user
    ? await Promise.all([
        fetchRecentScores(client, user.id, 'wordblitz'),
        fetchBestScore(client, user.id, 'wordblitz'),
      ])
    : [[] as RecentScore[], null]

  // 최근 정확도 = 가장 마지막 세션의 정확도. 평균이 아니라 마지막인 이유는 라벨이 "최근" 이고,
  // 평균을 "최근" 이라 부르면 한 판 잘한 것이 며칠간 화면에 남는다.
  const lastAccuracy = recent.find((r) => r.accuracy != null)?.accuracy ?? null
  const hasRecord = best != null

  return (
    <div className="mx-auto max-w-[var(--ios-content-wide-max)] px-4 py-6 md:px-6 md:py-8">
      {/* ── Hero (v06.30 슬림화) ── */}
      <section
        aria-label="WordBlitz 소개"
        className="relative mb-4 overflow-hidden rounded-[var(--r-md)] px-4 py-3 text-[var(--ti)] shadow-[var(--sh-xs)] md:px-5 md:py-3.5"
        style={{
          background:
            'linear-gradient(135deg, #2d6a2d 0%, #3d8a3d 50%, #5ab540 100%)',
        }}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Gamepad2 size={14} aria-hidden strokeWidth={2.25} className="shrink-0 text-[#FFE234]" />
            <span className="font-mono text-[10px] font-[700] uppercase tracking-[0.10em] text-[#FFE234]">
              정글 어드벤처
            </span>
            <span className="opacity-30" aria-hidden>·</span>
            <h1 className="font-display text-[15px] font-[800] leading-tight text-[#FFE234] md:text-[16px]">
              WordBlitz
            </h1>
            <span className="hidden opacity-30 sm:inline" aria-hidden>·</span>
            <p className="hidden truncate font-body text-[12px] opacity-85 sm:block">
              {hasRecord
                ? `Best ${best!.toLocaleString()}${lastAccuracy != null ? ` · 최근 정확도 ${lastAccuracy}%` : ''}`
                : '첫 판을 기다리고 있어요'}
            </p>
          </div>

          <div className="flex shrink-0 gap-1.5">
            <Link
              href="/play/wordblitz"
              className="group inline-flex items-center gap-1.5 rounded-[var(--r-sm)] bg-[#FFE234] px-3 py-1.5 font-display text-[12px] font-[800] text-[#1a4a08] shadow-[var(--sh-xs)] transition-all duration-[var(--dur-normal)] hover:bg-[#FFD93D] active:translate-y-0.5"
            >
              <Gamepad2 size={12} strokeWidth={2.5} aria-hidden />
              바로 시작
              <Zap size={10} strokeWidth={2.5} aria-hidden />
            </Link>
            <Link
              href="/play/wordblitz"
              aria-label="풀스크린으로 시작"
              className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--r-sm)] border border-[var(--ti)]/30 bg-[var(--ti)]/10 text-[var(--ti)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--ti)]/20"
            >
              <Maximize2 size={11} aria-hidden />
            </Link>
          </div>
        </div>

        {/* Stats — 실기록만. 기록이 없으면 row 자체를 렌더하지 않는다
            (0점·0% 를 넣으면 "해봤는데 0점" 으로 읽혀 처음 온 학습자를 깎아내린다) */}
        {hasRecord && (
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-[#FFE234]/15 pt-2">
            <li className="inline-flex items-baseline gap-1 font-display tabular-nums leading-tight">
              <span className="text-[11px] font-[700] text-[#FFE234]">Best</span>
              <span className="text-[15px] font-[800] text-[#FFE234]">{best!.toLocaleString()}</span>
            </li>
            {lastAccuracy != null && (
              <li className="inline-flex items-baseline gap-1 font-display tabular-nums leading-tight">
                <span className="text-[11px] font-[700] text-white/75">최근 정확도</span>
                <span className="text-[13px] font-[700] text-white">
                  {lastAccuracy}
                  <span className="ml-0.5 text-[10px] font-[600] opacity-70">%</span>
                </span>
              </li>
            )}
            {/* "기록 N회" 는 넣지 않는다 — fetchRecentScores 는 4행으로 캡돼 있어서
                30회 한 학습자에게도 4회라고 말하게 된다. 정확한 총 횟수를 세려면 별도
                count 쿼리가 필요하고, 그만한 가치가 있는 숫자는 아니다. */}
          </ul>
        )}
      </section>

      {/* ── 학습 효과 + 통계 (2 cols) ── */}
      <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 학습 효과 (1 col) */}
        <aside
          aria-label="학습 효과"
          className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)]"
        >
          <header className="flex items-center gap-2">
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--r-sm)] bg-[var(--p-light)] text-[var(--on-p-tint)]"
              aria-hidden
            >
              <Layers size={14} strokeWidth={1.75} />
            </span>
            <h2 className="font-display text-[14px] font-[700] text-[var(--t1)]">학습 효과</h2>
          </header>
          <ul className="mt-4 space-y-3">
            {[
              { ko: '능동적 회상', en: 'Active Recall — 4 옵션 즉시 인출' },
              { ko: '정서적 부호화', en: 'Emotional Encoding — 콤보 도파민' },
              { ko: '간격 반복', en: 'Spaced Repetition — 오답 단어 우선 노출' },
            ].map((e) => (
              <li key={e.en}>
                <p className="font-display text-[13px] font-[700] text-[var(--t1)]">{e.ko}</p>
                <p className="mt-0.5 font-mono text-[10px] text-[var(--t2)]">{e.en}</p>
              </li>
            ))}
          </ul>
        </aside>

        {/* 게임 룰 (2 col) */}
        <aside
          aria-label="게임 규칙"
          className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)] lg:col-span-2"
        >
          <header className="mb-4 flex items-center gap-2">
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--r-sm)] bg-[var(--success-light)] text-[var(--success)]"
              aria-hidden
            >
              <Gamepad2 size={14} strokeWidth={1.75} />
            </span>
            <h2 className="font-display text-[14px] font-[700] text-[var(--t1)]">게임 규칙</h2>
            <span className="ml-auto font-mono text-[11px] text-[var(--t2)]">3단계</span>
          </header>
          <ol className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {RULES.map((r) => (
              <li
                key={r.step}
                className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-3"
              >
                <p className="font-mono text-[10px] font-[700] tabular-nums tracking-[0.10em] text-[var(--success)]">
                  {r.step}
                </p>
                <p className="mt-1 font-display text-[13px] font-[700] text-[var(--t1)]">
                  {r.title}
                </p>
                <p className="mt-1 font-body text-[11px] leading-relaxed text-[var(--t2)]">
                  {r.description}
                </p>
              </li>
            ))}
          </ol>
        </aside>
      </div>

      {/* ── Best score + 최근 기록 ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Best score 강조 */}
        <aside
          aria-label="최고 점수"
          className="rounded-[var(--r-lg)] border-2 border-[#FFE234]/40 bg-gradient-to-br from-[#FEF3C7] to-[var(--bg)] p-5 shadow-[var(--sh-sm)]"
        >
          <header className="flex items-center gap-2">
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--r-sm)] bg-[#FFE234] text-[#1a4a08]"
              aria-hidden
            >
              <Trophy size={14} strokeWidth={2} />
            </span>
            <h2 className="font-display text-[14px] font-[700] text-[var(--t1)]">최고 기록</h2>
          </header>
          {hasRecord ? (
            <>
              <p className="mt-4 font-display text-[40px] font-[800] tabular-nums leading-none text-[var(--t1)]">
                {best!.toLocaleString()}
                <span className="ml-1 font-display text-[16px] font-[600] text-[var(--t2)]">점</span>
              </p>
              {/* 이전에는 "4일 전 · 콤보 11 · 94%" 였다. 최고 기록이 **언제**였는지는
                  fetchBestScore 가 점수만 돌려주므로 알 수 없고, 콤보는 저장되지 않는다.
                  모르는 것을 쓰지 않는다. */}
              <p className="mt-2 font-mono text-[11px] text-[var(--t2)]">
                <Award size={11} className="mr-1 inline align-text-bottom" aria-hidden />
                지금까지 이 게임 최고점
              </p>
            </>
          ) : (
            <p className="mt-4 font-body text-[13px] italic leading-relaxed text-[var(--t2)]">
              아직 기록이 없어요. 한 판만 해보면 여기에 최고점이 새겨져요.
            </p>
          )}
        </aside>

        {/* 최근 기록 (2 cols) — 콤보 열은 사라졌다(scores 에 저장되지 않는다) */}
        <div className="lg:col-span-2">
          <RecentScoresList
            scores={recent}
            best={best}
            accent="#3d8a3d"
            emptyHint="아직 이 게임 기록이 없어요. 한 판을 마치면 점수와 정확도가 여기에 남아요."
          />
        </div>
      </div>

      {/* ── Bottom CTA ── */}
      <footer className="mt-10 text-center">
        <Link
          href="/play/wordblitz"
          className="inline-flex items-center gap-2 rounded-[var(--r-full)] bg-[#3d8a3d] px-8 py-3.5 font-display text-[15px] font-[700] text-[#FFE234] shadow-[0_4px_0_#1a4a08,var(--sh-md)] transition-all duration-[var(--dur-normal)] hover:bg-[#5ab540] active:translate-y-1 active:shadow-[0_2px_0_#1a4a08]"
        >
          <Gamepad2 size={16} strokeWidth={2.5} aria-hidden />
          지금 한 판
        </Link>
        <p className="mt-3 font-body text-[12px] italic text-[var(--t2)]">
          짧고 즐겁게. 5분 안에 끝나는 한 라운드.
        </p>
      </footer>
    </div>
  )
}
