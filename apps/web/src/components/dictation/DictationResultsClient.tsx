// apps/web/src/components/dictation/DictationResultsClient.tsx
// Dictation Results — 정확도 + 오류 패턴 + 오답 단어 + 다음 단계 추천

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  BarChart3,
  Clock,
  Home,
  Lightbulb,
  RotateCw,
  Trophy,
} from 'lucide-react';

import { NextActionCard } from '@/components/recommend/NextActionCard';
import { extractMistakenWords, analyzeErrorPatterns } from '@/lib/dictation/analyzer';
import { getSession } from '@/lib/dictation/storage';
import type { DictationSession, ErrorPattern, WordResult } from '@/lib/dictation/types';
import {
  getMockNextAction,
  MOCK_USER_CONTEXTS,
} from '@/lib/recommend/next-action.mock';
import { applyReview, createNewCard } from '@/lib/srs';
import { accuracyToRating } from '@/lib/srs/rating-mapper';
import { cacheCard, getCachedCard, pushPendingResult } from '@/lib/srs/session-storage';
import { flushPendingSession } from '@/lib/srs/flush-session';
import { cardToUpdatePayload } from '@/lib/srs/supabase-adapter';

const DICTATION_ACCENT = '#0EA5E9';

// SRS cardId 용 단어 정규화 — 소문자 + 양끝 구두점 제거 (apostrophe/hyphen 보존)
function normalizeWord(raw: string): string {
  return raw.toLowerCase().replace(/^[^\w']+|[^\w']+$/g, '');
}

export function DictationResultsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const [session, setSession] = useState<DictationSession | null>(null);
  const srsAppliedRef = useRef(false);

  useEffect(() => {
    if (!sessionId) {
      router.replace('/dictate');
      return;
    }
    const s = getSession(sessionId);
    if (!s) {
      router.replace('/dictate');
      return;
    }
    setSession(s);
  }, [sessionId, router]);

  // §17 [4] 기억 축 — Dictation 세션 종료 시 SRS 일괄 적용 (L4c 청각 생성)
  // sessionStorage 단계: 정규화된 단어 텍스트를 cardId로 사용. DB 연동 시 vocabulary lookup 필요.
  useEffect(() => {
    if (!session || srsAppliedRef.current) return;
    srsAppliedRef.current = true;

    // 단어별 정답/총 횟수 집계 (status === 'correct' 만 정답으로 카운트, 'extra' 는 vocab 매핑 불가로 제외)
    const wordStats = new Map<string, { correct: number; total: number }>();

    for (const item of session.items) {
      const wordResults = item.result?.wordResults ?? [];
      for (const wr of wordResults) {
        if (wr.status === 'extra') continue;
        const key = normalizeWord(wr.expected);
        if (!key) continue;
        const stats = wordStats.get(key) ?? { correct: 0, total: 0 };
        stats.total += 1;
        if (wr.status === 'correct') stats.correct += 1;
        wordStats.set(key, stats);
      }
    }

    const reviewedAt = new Date();
    wordStats.forEach(({ correct, total }, cardId) => {
      const accuracy = (correct / total) * 100;
      const existingCard = getCachedCard(cardId) ?? createNewCard(cardId);
      const reviewResult = applyReview({
        card: existingCard,
        rating: accuracyToRating(accuracy),
        reviewedAt,
        module: 'dictation',
      });
      cacheCard(reviewResult.card);
      pushPendingResult({
        cardId: reviewResult.card.id,
        word: cardId,
        cardUpdate: cardToUpdatePayload(reviewResult.card),
        rating: reviewResult.log.rating,
        reviewedAt: reviewResult.log.reviewedAt.toISOString(),
        module: 'dictation',
      });
    });

    // 세션 종료 시 SRS 큐 → DB flush (srsAppliedRef 가드로 1회).
    void flushPendingSession();
  }, [session]);

  const aggregateData = useMemo(() => {
    if (!session) return null;

    const allWordResults: WordResult[] = session.items.flatMap(
      (it) => it.result?.wordResults ?? []
    );
    const totalAccuracy = session.totalAccuracy ?? 0;
    const totalTimeMs = session.totalTimeMs ?? 0;
    const correctCount = session.items.filter(
      (it) => (it.result?.accuracy ?? 0) >= 90
    ).length;

    const aggregatedPatterns = analyzeErrorPatterns(allWordResults);
    const mistakenWords = extractMistakenWords(session.items);

    return {
      totalAccuracy,
      totalTimeMs,
      correctCount,
      patterns: aggregatedPatterns,
      mistakenWords,
    };
  }, [session]);

  // §17.3 추천 축 (3곳 중 1곳: 세션 종료 직후)
  // Dictation 직후 → 같은 모듈 self-loop 회피. warm_inprogress → Workspace "이어 듣기" (§17 Context-Dependent L4→L2 cycle)
  // DB 연동 시: getMockNextAction → getNextAction(userId, { context: 'after_dictation' })
  const recommendation = useMemo(
    () => getMockNextAction(MOCK_USER_CONTEXTS.warm_inprogress),
    []
  );

  if (!session || !aggregateData) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center font-body text-[14px] text-[var(--t3)]">
        결과를 불러오는 중...
      </div>
    );
  }

  const { totalAccuracy, totalTimeMs, correctCount, patterns, mistakenWords } = aggregateData;
  const minutes = Math.floor(totalTimeMs / 60000);
  const seconds = Math.floor((totalTimeMs % 60000) / 1000);

  const accColor =
    totalAccuracy >= 90
      ? 'var(--success)'
      : totalAccuracy >= 70
        ? 'var(--p)'
        : 'var(--warning)';

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 px-4 py-8 md:px-6 md:py-10">
      {/* ─── Hero 정확도 ─── */}
      <header
        className="relative overflow-hidden rounded-[var(--r-2xl)] p-8 text-[var(--ti)] shadow-[var(--sh-md)]"
        style={{
          background: `linear-gradient(135deg, ${DICTATION_ACCENT}, #1D4ED8)`,
        }}
      >
        <div className="flex flex-col items-center text-center">
          <Trophy size={32} className="mb-2 opacity-80" />
          <p className="font-display text-[12px] font-[700] uppercase tracking-[0.10em] opacity-80">
            Session Complete
          </p>
          <p className="mt-2 font-display text-[64px] font-[800] leading-none tabular-nums">
            {Math.round(totalAccuracy)}
            <span className="ml-1 text-[28px] opacity-80">%</span>
          </p>
          <p className="mt-2 font-body text-[14px] opacity-90">{session.resourceTitle}</p>

          <div className="mt-6 grid grid-cols-3 gap-4 text-left md:gap-8">
            <div>
              <p className="font-display text-[10px] font-[700] uppercase tracking-wider opacity-70">
                정답
              </p>
              <p className="font-display text-[24px] font-[800] tabular-nums">
                {correctCount} / {session.items.length}
              </p>
            </div>
            <div>
              <p className="font-display text-[10px] font-[700] uppercase tracking-wider opacity-70">
                시간
              </p>
              <p className="font-display text-[24px] font-[800] tabular-nums">
                {minutes}:{String(seconds).padStart(2, '0')}
              </p>
            </div>
            <div>
              <p className="font-display text-[10px] font-[700] uppercase tracking-wider opacity-70">
                힌트
              </p>
              <p className="font-display text-[24px] font-[800] tabular-nums">
                {session.totalHintsUsed}회
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* §17.3 추천 축 (3곳 중 1곳: 세션 종료 직후) */}
      <NextActionCard
        recommendation={recommendation}
        prelude="받아쓰기 결과가 정리됐어요. 다음으로 무엇을 해볼까요?"
      />

      {/* ─── 오류 패턴 분석 ─── */}
      {patterns.length > 0 ? (
        <ErrorAnalysis patterns={patterns} accColor={accColor} />
      ) : (
        <section className="rounded-[var(--r-lg)] border border-[var(--success-light)] bg-[var(--success-light)]/20 p-5 text-center">
          <p className="font-body text-[15px] text-[var(--success)]">
            ✨ 오류 패턴이 발견되지 않았습니다. 훌륭해요!
          </p>
        </section>
      )}

      {/* ─── 오답 단어 ─── */}
      {mistakenWords.length > 0 && (
        <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)]">
          <header className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-display text-[14px] font-[700] text-[var(--t1)]">
              📚 오답 단어 ({mistakenWords.length}개)
            </h3>
            <button
              type="button"
              className="rounded-[var(--r-sm)] border border-[var(--bd)] px-3 py-1 font-display text-[11px] font-[600] text-[var(--t2)] hover:bg-[var(--bg2)]"
              title="Phase 2 - SRS 통합 예정"
              disabled
            >
              모두 Flashcard에 추가 (Phase 2)
            </button>
          </header>
          <div className="flex flex-wrap gap-2">
            {mistakenWords.slice(0, 20).map((m) => (
              <span
                key={m.word}
                className="inline-flex items-center gap-1.5 rounded-full bg-[var(--error-light)]/40 px-3 py-1 font-english text-[13px] text-[var(--t1)]"
              >
                {m.word}
                {m.occurrences > 1 && (
                  <span className="font-mono text-[10px] font-[700] text-[var(--error)]">
                    ×{m.occurrences}
                  </span>
                )}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* ─── 문항별 결과 ─── */}
      <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] shadow-[var(--sh-sm)]">
        <header className="border-b border-[var(--bd)] px-5 py-3">
          <h3 className="font-display text-[14px] font-[700] text-[var(--t1)]">
            📝 문항별 결과
          </h3>
        </header>
        <ul className="divide-y divide-[var(--bg3)]">
          {session.items.map((item, idx) => {
            const acc = item.result?.accuracy ?? 0;
            const c =
              acc >= 90 ? 'var(--success)' : acc >= 70 ? 'var(--p)' : 'var(--warning)';
            return (
              <li key={idx} className="flex items-start gap-3 px-5 py-3">
                <span className="font-mono text-[11px] font-[700] tabular-nums text-[var(--t3)] mt-1">
                  #{idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-english text-[14px] text-[var(--t1)]">
                    {item.expectedText}
                  </p>
                  {item.userInput && (
                    <p className="mt-1 truncate font-english text-[12px] text-[var(--t3)]">
                      → {item.userInput}
                    </p>
                  )}
                </div>
                <span
                  className="font-mono text-[14px] font-[700] tabular-nums"
                  style={{ color: c }}
                >
                  {Math.round(acc)}%
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ─── 다음 단계 ─── */}
      <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-gradient-to-br from-[var(--bg)] to-[var(--bg2)] p-5 shadow-[var(--sh-sm)]">
        <h3 className="mb-3 flex items-center gap-2 font-display text-[14px] font-[700] text-[var(--t1)]">
          <Lightbulb size={16} className="text-[var(--active)]" />
          다음 단계 추천
        </h3>
        <ul className="space-y-2 font-body text-[13px] text-[var(--t2)]">
          {totalAccuracy >= 90 && (
            <li>✓ 마스터! 더 어려운 레벨 (B2~C1) 도전을 추천합니다.</li>
          )}
          {totalAccuracy >= 70 && totalAccuracy < 90 && (
            <li>↻ 동일 자료 한 번 더 — 정확도 마스터까지 도달.</li>
          )}
          {totalAccuracy < 70 && (
            <li>← 한 단계 낮은 레벨 또는 같은 자료를 천천히 다시.</li>
          )}
          {mistakenWords.length > 0 && (
            <li>📚 오답 단어 {mistakenWords.length}개를 Flashcard로 학습 (Phase 2).</li>
          )}
        </ul>
      </section>

      {/* ─── CTA ─── */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        <Link
          href={`/dictate/setup?resourceId=${session.config.resourceId}`}
          className="flex items-center justify-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] py-3 font-display text-[13px] font-[600] text-[var(--t2)] hover:bg-[var(--bg2)]"
        >
          <RotateCw size={14} />
          다시 도전
        </Link>
        <Link
          href="/dictate"
          className="flex items-center justify-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] py-3 font-display text-[13px] font-[600] text-[var(--t2)] hover:bg-[var(--bg2)]"
        >
          <Home size={14} />
          Hub
        </Link>
        <Link
          href="/dashboard"
          className="col-span-2 flex items-center justify-center gap-2 rounded-[var(--r-md)] py-3 font-display text-[13px] font-[700] text-[var(--ti)] shadow-[var(--sh-sm)] md:col-span-1"
          style={{ background: `linear-gradient(135deg, ${DICTATION_ACCENT}, #1D4ED8)` }}
        >
          <BarChart3 size={14} />
          통계
          <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}

function ErrorAnalysis({
  patterns,
  accColor,
}: {
  patterns: ErrorPattern[];
  accColor: string;
}) {
  return (
    <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)]">
      <header className="mb-3 flex items-center gap-2">
        <Clock size={16} style={{ color: accColor }} />
        <h3 className="font-display text-[14px] font-[700] text-[var(--t1)]">
          🎯 보강 필요 영역
        </h3>
      </header>
      <ul className="space-y-3">
        {patterns.slice(0, 5).map((p, i) => {
          const typeIcon =
            p.type === 'phonetic' ? '🔊' :
            p.type === 'morphological' ? '🏗' :
            p.type === 'syntactic' ? '🔗' : '📚';
          const typeKor =
            p.type === 'phonetic' ? '음성' :
            p.type === 'morphological' ? '형태' :
            p.type === 'syntactic' ? '구문' : '어휘';
          return (
            <li
              key={`${p.subtype}-${i}`}
              className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] p-3"
            >
              <header className="mb-2 flex items-center gap-2">
                <span className="rounded-full bg-[var(--bg3)] px-2 py-0.5 font-display text-[10px] font-[700] uppercase tracking-wider text-[var(--t2)]">
                  {typeIcon} {typeKor}
                </span>
                <p className="flex-1 font-body text-[13px] font-[600] text-[var(--t1)]">
                  {p.description}
                </p>
                <span className="font-mono text-[12px] font-[700] text-[var(--error)]">
                  {p.frequency}회
                </span>
              </header>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {p.examples.slice(0, 4).map((ex, j) => (
                  <span
                    key={j}
                    className="inline-flex items-center gap-1 rounded bg-[var(--bg)] px-2 py-0.5 font-mono text-[11px]"
                  >
                    <span className="text-[var(--success)]">{ex.expected}</span>
                    <span className="text-[var(--t3)]">→</span>
                    <span className="text-[var(--error)]">{ex.actual || '(누락)'}</span>
                  </span>
                ))}
              </div>
              <p className="font-body text-[11px] italic text-[var(--t2)]">{p.suggestion}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
