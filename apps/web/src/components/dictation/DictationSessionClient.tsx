// apps/web/src/components/dictation/DictationSessionClient.tsx
// Dictation Session — 메인 받아쓰기 화면
//
// 학습 과학:
//   · Spaced Dictation - 자동 반복 + 구간 사이 무음
//   · Phonological Loop - 입력 시 음성 멈춤 옵션
//   · Active Recall - 단어별 즉각 채점
//   · Scaffolding - 4단계 힌트 시스템
//   · Flow State - Focus Mode (사이드바 dim)
//
// 키보드 단축키 (입력창 밖에 포커스가 있을 때):
//   Space         - 재생 / 정지 토글 (1회 재생)
//   1-5           - 속도 (화면 버튼과 동일한 5단계: 0.5·0.75·0.85·1.0·1.25x)
//   F             - Focus Mode 토글
// 입력창 안에서도 동작:
//   Enter         - 제출 (피드백 표시 중이면 다음)
//   Esc           - 재생 정지
//   Tab           - 건너뛰기

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  Eye,
  EyeOff,
  Focus,
  Lightbulb,
  Play,
  Pause,
  RotateCw,
  SkipForward,
  X,
} from 'lucide-react';

import { useSessionProgress, type SessionResourceType } from '@/components/layout/SessionFrame';
import { useAudioControl } from '@/hooks/dictation/useAudioControl';
import { useDictationSession } from '@/hooks/dictation/useDictationSession';
import { getResource } from '@/lib/dictation/storage';
import { HINT_STAGES, type HintLevel } from '@/lib/dictation/hint';
import type { ScoringResult, WordResult } from '@/lib/dictation/types';

const DICTATION_ACCENT = '#0EA5E9';

// 프로젝트 공통 focus-visible 링 (키보드 접근성 — 모든 인터랙티브 요소 focus 상태 필수)
const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2';

export function DictationSessionClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');

  const { session, status, currentItem, progress, isComplete, submitAnswer, consumeHint, next, skip } =
    useDictationSession(sessionId);

  const audio = useAudioControl();

  const [userInput, setUserInput] = useState('');
  const [activeHint, setActiveHint] = useState<HintLevel | null>(null);
  const [usedHints, setUsedHints] = useState<HintLevel[]>([]);
  const [feedback, setFeedback] = useState<ScoringResult | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [speed, setSpeed] = useState(0.85);
  const [autoRepeat, setAutoRepeat] = useState(3);
  const [showTranslation, setShowTranslation] = useState(false);
  const itemStartedAtRef = useRef<number>(Date.now());
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 세션 설정으로 초기화
  useEffect(() => {
    if (session) {
      setSpeed(session.config.speed);
      setAutoRepeat(session.config.autoRepeat);
    }
  }, [session]);

  // 새 문항 도착 시 초기화
  useEffect(() => {
    setUserInput('');
    setActiveHint(null);
    setUsedHints([]);
    setFeedback(null);
    setShowTranslation(false);
    itemStartedAtRef.current = Date.now();
    inputRef.current?.focus();
  }, [currentItem?.index]);

  // ─── SessionFrame 셸에 리소스 컨텍스트 + 진행도 주입 ───
  const { setProgress } = useSessionProgress();
  useEffect(() => {
    if (!session) return;
    const resource = getResource(session.config.resourceId);
    const sourceMap: Record<string, SessionResourceType> = {
      library: 'library',
      'direct-script': 'script',
      'direct-file': 'script',
    };
    const unitLabel =
      session.config.unit === 'sentence'
        ? '문장'
        : session.config.unit === 'paragraph'
          ? '단락'
          : '전체';
    setProgress({
      current: session.currentIndex + 1,
      total: session.items.length,
      resource: {
        type: sourceMap[resource?.source ?? 'direct-script'] ?? 'script',
        label: session.resourceTitle,
        position: `${unitLabel} ${session.currentIndex + 1} / ${session.items.length}`,
      },
    });
    return () => setProgress(null);
  }, [session, setProgress]);

  // 완료 시 결과 페이지로
  useEffect(() => {
    if (isComplete && session) {
      router.replace(`/dictate/results?sessionId=${session.id}`);
    }
  }, [isComplete, session, router]);

  // ─── 오디오 ───
  const playAudio = useCallback(() => {
    if (!currentItem) return;
    audio.repeat(currentItem.expectedText, autoRepeat, speed, 1500);
  }, [audio, currentItem, autoRepeat, speed]);

  const playOnce = useCallback(() => {
    if (!currentItem) return;
    audio.play(currentItem.expectedText, speed);
  }, [audio, currentItem, speed]);

  const stopAudio = useCallback(() => {
    audio.stop();
  }, [audio]);

  // ─── 제출 ───
  const handleSubmit = useCallback(() => {
    if (!currentItem || feedback) return;
    if (userInput.trim().length === 0) return;
    const elapsed = Date.now() - itemStartedAtRef.current;
    const result = submitAnswer(userInput, elapsed);
    if (result) {
      setFeedback(result);
      audio.stop();
    }
  }, [currentItem, feedback, userInput, submitAnswer, audio]);

  const handleNext = useCallback(() => {
    audio.stop();
    next();
  }, [audio, next]);

  const handleSkip = useCallback(() => {
    audio.stop();
    skip();
  }, [audio, skip]);

  // ─── 힌트 ───
  const handleHint = useCallback(
    (level: HintLevel) => {
      if (!session?.config.hintsAllowed) return;
      const stage = HINT_STAGES.find((s) => s.level === level);
      if (!stage) return;
      if (!usedHints.includes(level)) {
        setUsedHints((prev) => [...prev, level]);
        consumeHint(stage.penalty);
      }
      setActiveHint(level);
    },
    [session, usedHints, consumeHint]
  );

  // ─── 키보드 단축키 ───
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // 입력 필드 안에서는 일부만
      const isInInput =
        e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement;

      if (e.key === 'Enter' && isInInput && !e.shiftKey) {
        e.preventDefault();
        if (feedback) handleNext();
        else handleSubmit();
        return;
      }

      if (isInInput && e.code !== 'Escape' && !e.ctrlKey && !e.metaKey) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (audio.isPlaying) stopAudio();
        else playOnce();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        stopAudio();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        handleSkip();
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setFocusMode((v) => !v);
      } else if (['1', '2', '3', '4', '5'].includes(e.key)) {
        // 화면의 속도 버튼과 동일한 5단계로 매핑
        const speeds = [0.5, 0.75, 0.85, 1.0, 1.25];
        setSpeed(speeds[Number(e.key) - 1]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [audio.isPlaying, feedback, handleNext, handleSubmit, handleSkip, playOnce, stopAudio]);

  // 세션 미발견 — 무한 로딩 대신 명확한 안내 (localStorage 소실·다른 브라우저·공유된 URL 등)
  if (status === 'not-found') {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg2)] text-[var(--t3)]">
          <X size={22} />
        </span>
        <div>
          <h2 className="font-display text-[16px] font-[700] text-[var(--t1)]">
            세션을 찾을 수 없어요
          </h2>
          <p className="mt-1.5 font-body text-[13px] leading-relaxed text-[var(--t3)]">
            받아쓰기 세션은 이 기기에만 저장돼요. 링크를 공유받았거나 오래된 세션이면
            다시 시작해 주세요.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push('/dictate')}
          className={`inline-flex h-10 items-center gap-1.5 rounded-[var(--r-md)] px-4 font-display text-[13px] font-[700] text-[var(--ti)] shadow-[var(--sh-sm)] transition-transform hover:-translate-y-0.5 ${FOCUS_RING}`}
          style={{ background: `linear-gradient(135deg, ${DICTATION_ACCENT}, #1D4ED8)` }}
        >
          받아쓰기 시작하기
          <ArrowRight size={14} />
        </button>
      </div>
    );
  }

  if (!session || !currentItem) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center font-body text-[14px] text-[var(--t3)]">
        세션을 불러오는 중...
      </div>
    );
  }

  const hintAllowed = session.config.hintsAllowed;
  const hintShown = activeHint
    ? HINT_STAGES.find((s) => s.level === activeHint)?.show(
        currentItem.expectedText,
        currentItem.translation
      )
    : null;

  return (
    <div
      className={`relative min-h-screen transition-colors duration-300 ${
        focusMode ? 'bg-[var(--bg2)]' : ''
      }`}
    >
      {/* Focus mode dim sidebar — global style */}
      {focusMode && (
        <style jsx global>{`
          aside {
            opacity: 0.25 !important;
            transition: opacity 300ms;
          }
          aside:hover {
            opacity: 1 !important;
          }
        `}</style>
      )}

      <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8 md:px-6 md:py-10">
        {/* ─── Header ─── */}
        <header className="flex items-center gap-3">
          <button
            type="button"
            onClick={() =>
              typeof window !== 'undefined' && window.history.length > 1
                ? router.back()
                : router.push('/dictate')
            }
            className={`inline-flex h-9 items-center gap-1 rounded-[var(--r-md)] border border-[var(--bd)] px-3 font-display text-[12px] font-[600] text-[var(--t2)] transition-colors hover:bg-[var(--bg2)] ${FOCUS_RING}`}
          >
            <X size={14} />
            나가기
          </button>
          <div className="flex-1">
            <p className="truncate font-body text-[12px] text-[var(--t3)]">
              {session.resourceTitle}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--bg3)]">
                <div
                  className="h-full rounded-full transition-[width] duration-300"
                  style={{
                    width: `${progress * 100}%`,
                    background: `linear-gradient(90deg, ${DICTATION_ACCENT}, #1D4ED8)`,
                  }}
                />
              </div>
              <span className="font-mono text-[11px] font-[700] tabular-nums text-[var(--t2)]">
                {session.currentIndex + 1} / {session.items.length}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFocusMode((v) => !v)}
            aria-pressed={focusMode}
            className={`inline-flex h-9 items-center gap-1 rounded-[var(--r-md)] border px-3 font-display text-[12px] font-[600] transition-colors ${FOCUS_RING} ${
              focusMode
                ? 'border-[var(--p)] bg-[var(--p-light)] text-[var(--p-dark)]'
                : 'border-[var(--bd)] text-[var(--t2)] hover:bg-[var(--bg2)]'
            }`}
            title="Focus Mode (F)"
          >
            <Focus size={14} />
            Focus
          </button>
        </header>

        {/* ─── Audio Player ─── */}
        <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-gradient-to-br from-[var(--bg)] to-[var(--bg2)] p-5 shadow-[var(--sh-sm)]">
          <div className="mb-3 flex items-center justify-between">
            <span
              className="font-display text-[11px] font-[700] uppercase tracking-[0.10em]"
              style={{ color: DICTATION_ACCENT }}
            >
              🎧 듣고 받아쓰기
            </span>
            <span className="font-mono text-[11px] text-[var(--t3)]">
              {audio.isPlaying ? `재생 중 ${audio.iteration}/${autoRepeat}` : '대기'}
            </span>
          </div>

          {/* 영어 TTS 음성 없음 안내 — 무음으로 방치되던 문제(브라우저/OS 영어 음성 미설치) 가시화 */}
          {audio.englishVoiceAvailable === false && (
            <div
              className="mb-3 rounded-[var(--r-md)] border border-[var(--warning)]/30 bg-[var(--warning-light)] px-3 py-2"
              role="status"
            >
              <p className="font-body text-[12px] leading-relaxed text-[var(--t2)]">
                ⚠️ 이 브라우저/기기에 영어 음성이 없어 소리가 재생되지 않아요. 기기의 음성(TTS)
                설정에서 영어 음성을 추가하거나, 크롬 등 다른 브라우저로 열어보세요.
              </p>
            </div>
          )}

          <div className="flex items-center gap-3">
            {/* 메인 재생 버튼 */}
            <button
              type="button"
              onClick={audio.isPlaying ? stopAudio : playAudio}
              className={`inline-flex h-14 w-14 items-center justify-center rounded-full text-[var(--ti)] shadow-[var(--sh-md)] transition-transform active:scale-95 ${FOCUS_RING}`}
              style={{
                background: `linear-gradient(135deg, ${DICTATION_ACCENT}, #1D4ED8)`,
              }}
              aria-label={audio.isPlaying ? '정지' : '재생'}
            >
              {audio.isPlaying ? <Pause size={22} /> : <Play size={22} className="ml-1" />}
            </button>

            {/* 한 번만 */}
            <button
              type="button"
              onClick={playOnce}
              className={`inline-flex h-10 items-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] px-3 font-display text-[12px] font-[600] text-[var(--t2)] transition-colors hover:bg-[var(--bg2)] ${FOCUS_RING}`}
              title="한 번만 재생 (Space)"
            >
              <RotateCw size={14} />
              1회
            </button>

            {/* 속도 */}
            <div className="ml-auto flex items-center gap-1 rounded-[var(--r-md)] border border-[var(--bd)] p-1">
              {[0.5, 0.75, 0.85, 1.0, 1.25].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSpeed(s)}
                  aria-pressed={Math.abs(speed - s) < 0.01}
                  aria-label={`재생 속도 ${s}배`}
                  className={`rounded-[var(--r-sm)] px-2 py-1 font-mono text-[11px] font-[700] transition-colors ${FOCUS_RING} ${
                    Math.abs(speed - s) < 0.01
                      ? 'bg-[var(--p)] text-[var(--ti)]'
                      : 'text-[var(--t2)] hover:bg-[var(--bg2)]'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 text-center text-[11px] text-[var(--t3)]">
            <kbd className="rounded bg-[var(--bg3)] px-1.5 py-0.5 font-mono">Space</kbd>
            <span>재생</span>
            <span className="opacity-50">·</span>
            <kbd className="rounded bg-[var(--bg3)] px-1.5 py-0.5 font-mono">1-5</kbd>
            <span>속도</span>
            <span className="opacity-50">·</span>
            <kbd className="rounded bg-[var(--bg3)] px-1.5 py-0.5 font-mono">F</kbd>
            <span>Focus</span>
            <span className="opacity-50">·</span>
            <kbd className="rounded bg-[var(--bg3)] px-1.5 py-0.5 font-mono">Enter</kbd>
            <span>제출</span>
          </div>
        </section>

        {/* ─── 입력 / 피드백 ─── */}
        {!feedback ? (
          <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)]">
            <h3 className="mb-3 font-display text-[14px] font-[700] text-[var(--t1)]">
              ✍️ 들은 내용을 받아써 보세요
            </h3>

            {/* 힌트 표시 영역 */}
            {hintShown && (
              <div className="mb-3 rounded-[var(--r-md)] bg-[var(--active-light)] px-4 py-3">
                <p className="mb-1 flex items-center gap-1 font-display text-[11px] font-[700] uppercase tracking-wider text-[var(--active)]">
                  <Lightbulb size={11} />
                  Hint Level {activeHint}
                </p>
                <p
                  className={`font-body ${
                    activeHint === 3 ? 'text-[14px] text-[var(--t1)]' : 'font-mono text-[16px] tracking-wider text-[var(--t1)]'
                  }`}
                >
                  {hintShown}
                </p>
              </div>
            )}

            <textarea
              ref={inputRef}
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="듣고 영어로 받아써보세요..."
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              rows={3}
              className="w-full resize-none rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-4 py-3 font-english text-[18px] leading-relaxed text-[var(--t1)] focus:border-[var(--bdf)] focus:outline-none focus:ring-2 focus:ring-[var(--p)]/20"
              style={{ fontFamily: 'Lora, serif' }}
            />

            {/* 힌트 버튼들 */}
            {hintAllowed && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="font-body text-[11px] text-[var(--t3)]">힌트:</span>
                {HINT_STAGES.map((stage) => {
                  const used = usedHints.includes(stage.level);
                  return (
                    <button
                      key={stage.level}
                      type="button"
                      onClick={() => handleHint(stage.level)}
                      aria-pressed={activeHint === stage.level}
                      className={`rounded-[var(--r-sm)] border px-2 py-1 font-display text-[11px] font-[600] transition-colors ${FOCUS_RING} ${
                        activeHint === stage.level
                          ? 'border-[var(--active)] bg-[var(--active-light)] text-[var(--active)]'
                          : used
                            ? 'border-[var(--bd)] bg-[var(--bg2)] text-[var(--t3)]'
                            : 'border-[var(--bd)] text-[var(--t2)] hover:bg-[var(--bg2)]'
                      }`}
                    >
                      {stage.name} ({stage.penalty})
                    </button>
                  );
                })}
              </div>
            )}

            {/* 제출 / 건너뛰기 */}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={userInput.trim().length === 0}
                className={`flex flex-1 items-center justify-center gap-2 rounded-[var(--r-md)] py-2.5 font-display text-[13px] font-[700] text-[var(--ti)] shadow-[var(--sh-sm)] transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
                style={{
                  background: `linear-gradient(135deg, ${DICTATION_ACCENT}, #1D4ED8)`,
                }}
              >
                제출
                <ArrowRight size={14} />
              </button>
              <button
                type="button"
                onClick={handleSkip}
                className={`inline-flex items-center gap-1 rounded-[var(--r-md)] border border-[var(--bd)] px-4 font-display text-[12px] font-[600] text-[var(--t2)] transition-colors hover:bg-[var(--bg2)] ${FOCUS_RING}`}
              >
                <SkipForward size={14} />
                건너뛰기 (Tab)
              </button>
            </div>
          </section>
        ) : (
          <FeedbackSection
            result={feedback}
            expected={currentItem.expectedText}
            translation={currentItem.translation}
            showTranslation={showTranslation}
            onToggleTranslation={() => setShowTranslation((v) => !v)}
            onNext={handleNext}
            onPlayAgain={playOnce}
          />
        )}
      </div>
    </div>
  );
}

function FeedbackSection({
  result,
  expected,
  translation,
  showTranslation,
  onToggleTranslation,
  onNext,
  onPlayAgain,
}: {
  result: ScoringResult;
  expected: string;
  translation?: string;
  showTranslation: boolean;
  onToggleTranslation: () => void;
  onNext: () => void;
  onPlayAgain: () => void;
}) {
  const accColor =
    result.accuracy >= 90
      ? 'var(--success)'
      : result.accuracy >= 70
        ? 'var(--p)'
        : 'var(--warning)';

  return (
    <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)]">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-[14px] font-[700] text-[var(--t1)]">결과</h3>
        <span className="font-mono text-[24px] font-[800] tabular-nums" style={{ color: accColor }}>
          {Math.round(result.accuracy)}%
        </span>
      </header>

      <p className="mb-3 font-body text-[13px] text-[var(--t2)]">{result.feedback}</p>

      {/* 단어별 시각 피드백 */}
      <div className="mb-3 rounded-[var(--r-md)] bg-[var(--bg2)] p-3 font-english text-[16px] leading-relaxed">
        {result.wordResults.map((w, idx) => (
          <WordChip key={idx} word={w} />
        ))}
      </div>

      {/* 색·표시 범례 — 색상만으로 정보 전달하지 않도록 */}
      <WordStatusLegend statuses={new Set(result.wordResults.map((w) => w.status))} />

      {/* 정답 */}
      <div className="mb-3 rounded-[var(--r-md)] border border-[var(--success-light)] bg-[var(--success-light)]/30 px-3 py-2">
        <p className="mb-1 font-display text-[10px] font-[700] uppercase tracking-wider text-[var(--success)]">
          정답
        </p>
        <p className="font-english text-[15px] text-[var(--t1)]">{expected}</p>
      </div>

      {/* 한국어 번역 토글 */}
      {translation && (
        <div className="mb-3">
          <button
            type="button"
            onClick={onToggleTranslation}
            className={`inline-flex items-center gap-1 rounded-[var(--r-sm)] font-body text-[11px] text-[var(--p)] hover:underline ${FOCUS_RING}`}
          >
            {showTranslation ? <EyeOff size={12} /> : <Eye size={12} />}
            {showTranslation ? '번역 숨기기' : '한국어 번역 보기'}
          </button>
          {showTranslation && (
            <p className="mt-1 font-body text-[13px] italic text-[var(--t2)]">{translation}</p>
          )}
        </div>
      )}

      {/* 오류 패턴 */}
      {result.errorPatterns.length > 0 && (
        <div className="mb-4">
          <h4 className="mb-2 font-display text-[11px] font-[700] uppercase tracking-wider text-[var(--t3)]">
            💡 발견된 패턴
          </h4>
          <ul className="space-y-1.5">
            {result.errorPatterns.slice(0, 3).map((p, i) => (
              <li
                key={i}
                className="rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg2)] px-3 py-2"
              >
                <p className="font-body text-[12px] font-[600] text-[var(--t1)]">
                  {p.description} ({p.frequency}회)
                </p>
                <p className="font-body text-[11px] text-[var(--t2)]">{p.suggestion}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onPlayAgain}
          className={`inline-flex items-center gap-1 rounded-[var(--r-md)] border border-[var(--bd)] px-3 py-2 font-display text-[12px] font-[600] text-[var(--t2)] transition-colors hover:bg-[var(--bg2)] ${FOCUS_RING}`}
        >
          <RotateCw size={12} />
          다시 듣기
        </button>
        <button
          type="button"
          onClick={onNext}
          className={`flex flex-1 items-center justify-center gap-2 rounded-[var(--r-md)] py-2 font-display text-[13px] font-[700] text-[var(--ti)] shadow-[var(--sh-sm)] transition-transform hover:-translate-y-0.5 ${FOCUS_RING}`}
          style={{
            background: `linear-gradient(135deg, ${DICTATION_ACCENT}, #1D4ED8)`,
          }}
        >
          다음
          <ArrowRight size={14} />
        </button>
      </div>
    </section>
  );
}

// 단어 채점 상태별 스타일 — 색 + 밑줄/취소선/테두리로 색맹 대응 (색상 단독 전달 금지)
const WORD_STATUS_STYLES: Record<WordResult['status'], string> = {
  correct: 'text-[var(--success)] bg-[var(--success-light)]/40',
  misspelled: 'text-[var(--warning)] bg-[var(--warning-light)]/40 underline decoration-wavy',
  wrong: 'text-[var(--error)] bg-[var(--error-light)]/40 line-through',
  missing: 'text-[var(--error)] border border-dashed border-[var(--error)]',
  extra: 'text-[var(--warning)] line-through opacity-60',
};

const WORD_STATUS_LABELS: Record<WordResult['status'], string> = {
  correct: '정답',
  misspelled: '철자',
  wrong: '오답',
  missing: '누락',
  extra: '불필요',
};

const WORD_STATUS_ORDER: WordResult['status'][] = [
  'correct',
  'misspelled',
  'wrong',
  'missing',
  'extra',
];

function WordStatusLegend({ statuses }: { statuses: Set<WordResult['status']> }) {
  const items = WORD_STATUS_ORDER.filter((s) => statuses.has(s));
  if (items.length === 0) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {items.map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={`inline-block rounded px-1.5 py-0.5 font-english text-[11px] ${WORD_STATUS_STYLES[s]}`}
          >
            Aa
          </span>
          <span className="font-body text-[11px] text-[var(--t3)]">{WORD_STATUS_LABELS[s]}</span>
        </span>
      ))}
    </div>
  );
}

function WordChip({ word }: { word: WordResult }) {
  const display = word.status === 'missing' ? word.expected : word.actual;

  return (
    <span
      className={`mr-1 inline-block rounded px-1.5 py-0.5 font-english ${WORD_STATUS_STYLES[word.status]}`}
      title={
        word.status === 'misspelled' || word.status === 'wrong'
          ? `정답: ${word.expected}`
          : undefined
      }
    >
      {display || '—'}
    </span>
  );
}
