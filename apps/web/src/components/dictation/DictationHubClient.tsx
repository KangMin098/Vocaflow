// apps/web/src/components/dictation/DictationHubClient.tsx
// Dictation Hub — 리소스 선택 + 최근 세션 + 통계 + 직접 입력
// 학습 과학:
//   · Variable Reward (Skinner) — Smart Suggestion
//   · Self-determination — 사용자 선택 폭
//   · Implicit Progress — 통계 + 최근 활동

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Headphones, FileText, Upload, PencilLine, ArrowRight, Flame, TrendingUp, Plus } from 'lucide-react';

import { ModuleHero } from '@/components/hub/ModuleHero';
import {
  ensureSeedResources,
  getResources,
  getSessions,
  saveResource,
} from '@/lib/dictation/storage';
import { detectLevel } from '@/lib/dictation/cefr';
import type { DictationResource, DictationSession } from '@/lib/dictation/types';

const DICTATION_ACCENT = '#0EA5E9'; // Cyan — 청각 학습 모듈 색

export function DictationHubClient() {
  const router = useRouter();
  const [resources, setResources] = useState<DictationResource[]>([]);
  const [sessions, setSessions] = useState<DictationSession[]>([]);
  const [showDirectInput, setShowDirectInput] = useState(false);
  const [scriptInput, setScriptInput] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);

  useEffect(() => {
    ensureSeedResources();
    setResources(getResources());
    setSessions(getSessions());
  }, []);

  const completedSessions = sessions.filter((s) => s.completedAt);

  const stats = useMemo(() => {
    if (completedSessions.length === 0) {
      return { weeklyAccuracy: 0, totalSentences: 0, streak: 0 };
    }
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = completedSessions.filter((s) => (s.completedAt ?? 0) > weekAgo);
    const weeklyAccuracy =
      recent.length > 0
        ? recent.reduce((sum, s) => sum + (s.totalAccuracy ?? 0), 0) / recent.length
        : 0;
    const totalSentences = completedSessions.reduce(
      (sum, s) => sum + s.items.length,
      0
    );

    // streak — 연속 학습 일수 (오늘부터 거꾸로)
    const days = new Set(
      completedSessions
        .map((s) => new Date(s.completedAt ?? 0).toISOString().slice(0, 10))
        .sort()
        .reverse()
    );
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      if (days.has(key)) streak += 1;
      else if (i > 0) break;
    }

    return { weeklyAccuracy: Math.round(weeklyAccuracy), totalSentences, streak };
  }, [completedSessions]);

  // Smart Suggestion — 가장 유익한 리소스 1개
  const suggestion = useMemo(() => {
    if (resources.length === 0) return null;
    // 1. 마지막 세션 정확도 70~90% 사이의 리소스 우선
    const completed = completedSessions[0];
    if (completed && completed.totalAccuracy != null) {
      if (completed.totalAccuracy >= 70 && completed.totalAccuracy < 90) {
        const r = resources.find((r) => r.id === completed.config.resourceId);
        if (r) {
          return {
            resource: r,
            reason: `지난번 ${Math.round(completed.totalAccuracy)}% — 한 번 더 도전하면 마스터!`,
          };
        }
      }
    }
    // 2. 최근 시도 안 한 리소스
    const triedIds = new Set(sessions.map((s) => s.config.resourceId));
    const fresh = resources.find((r) => !triedIds.has(r.id));
    if (fresh) {
      return {
        resource: fresh,
        reason: `${fresh.cefr ?? 'B1'} 레벨 새 콘텐츠`,
      };
    }
    return { resource: resources[0], reason: '오늘의 추천' };
  }, [resources, sessions, completedSessions]);

  const handleDirectInputSubmit = () => {
    const text = scriptInput.trim();
    const title = titleInput.trim() || '직접 입력 스크립트';
    if (text.length < 20) {
      setInputError(`조금만 더 있으면 돼요 — 지금 ${text.length}자, 최소 20자가 필요해요.`);
      return;
    }
    setInputError(null);
    const detected = detectLevel(text);
    const id = `direct-${Date.now()}`;
    saveResource({
      id,
      title,
      script: text,
      source: 'direct-script',
      cefr: detected.code,
      createdAt: Date.now(),
    });
    router.push(`/dictate/setup?resourceId=${id}`);
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-8 md:px-6 md:py-10">
      <ModuleHero
        eyebrow="Dictation · 청각 인출"
        title="받아쓰기"
        note={
          stats.totalSentences === 0
            ? '아직 받아쓴 문장이 없어요 — 첫 자료를 골라보세요'
            : stats.streak >= 3
              ? `연속 ${stats.streak}일 학습 중 · 이번 주 정확도 ${stats.weeklyAccuracy}%`
              : `이번 주 정확도 ${stats.weeklyAccuracy}% · 누적 ${stats.totalSentences}문장`
        }
        gradient={{ from: '#0EA5E9', to: '#1D4ED8' }}
        icon={Headphones}
        stats={[
          { label: '이번 주', value: stats.weeklyAccuracy, unit: '%', emphasis: true },
          { label: '누적 문장', value: stats.totalSentences, unit: '개' },
          { label: 'Streak', value: stats.streak, unit: '일' },
        ]}
      />

      {/* ─── Smart Suggestion ─── */}
      {suggestion && (
        <Link
          href={`/dictate/setup?resourceId=${suggestion.resource.id}`}
          className="group flex flex-col gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-gradient-to-br from-[var(--bg)] to-[var(--bg2)] p-5 shadow-[var(--sh-sm)] transition-all duration-[var(--dur-normal)] hover:-translate-y-0.5 hover:border-[var(--p)] hover:shadow-[var(--sh-md)]"
        >
          <div className="flex items-center justify-between">
            <span
              className="font-display text-[11px] font-[700] uppercase tracking-[0.10em]"
              style={{ color: DICTATION_ACCENT }}
            >
              ⭐ 오늘의 추천
            </span>
            <ArrowRight
              size={18}
              className="text-[var(--t3)] transition-transform group-hover:translate-x-1 group-hover:text-[var(--p)]"
            />
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="font-display text-[20px] font-[700] text-[var(--t1)]">
              {suggestion.resource.title}
            </h3>
            <p className="font-body text-[13px] text-[var(--t2)]">{suggestion.reason}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-[var(--p-light)] px-3 py-1 font-mono text-[11px] font-[700] text-[var(--p-dark)]">
              {suggestion.resource.cefr ?? 'B1'}
            </span>
            <span className="font-body text-[12px] text-[var(--t3)]">
              {suggestion.resource.script.split(/\s+/).length} words
            </span>
          </div>
        </Link>
      )}

      {/* ─── 리소스 선택 ─── */}
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-[16px] font-[700] text-[var(--t1)]">
          📚 리소스 선택
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {/* 라이브러리 */}
          <article className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)]">
            <header className="mb-3 flex items-center gap-2">
              <span
                className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--r-sm)]"
                style={{ backgroundColor: `${DICTATION_ACCENT}15`, color: DICTATION_ACCENT }}
              >
                <FileText size={14} strokeWidth={2} />
              </span>
              <h3 className="font-display text-[14px] font-[700] text-[var(--t1)]">
                라이브러리
              </h3>
              <span className="ml-auto font-mono text-[11px] text-[var(--t3)]">
                {resources.length}개
              </span>
            </header>
            <ul className="flex flex-col gap-2">
              {resources.slice(0, 5).map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/dictate/setup?resourceId=${r.id}`}
                    className="group flex items-center gap-3 rounded-[var(--r-md)] px-3 py-2 transition-colors hover:bg-[var(--bg2)]"
                  >
                    <span className="rounded-full bg-[var(--bg3)] px-2 py-0.5 font-mono text-[10px] font-[700] text-[var(--t2)]">
                      {r.cefr ?? 'B1'}
                    </span>
                    <span className="flex-1 truncate font-body text-[13px] text-[var(--t1)]">
                      {r.title}
                    </span>
                    <ArrowRight
                      size={14}
                      className="text-[var(--t3)] opacity-0 transition-opacity group-hover:opacity-100"
                    />
                  </Link>
                </li>
              ))}
              {resources.length === 0 && (
                <li className="px-3 py-4 text-center font-body text-[12px] text-[var(--t3)]">
                  아직 등록된 리소스가 없습니다.
                </li>
              )}
            </ul>
          </article>

          {/* 직접 입력 */}
          <article className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)]">
            <header className="mb-3 flex items-center gap-2">
              <span
                className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--r-sm)] bg-[var(--active-light)] text-[var(--active)]"
              >
                <PencilLine size={14} strokeWidth={2} />
              </span>
              <h3 className="font-display text-[14px] font-[700] text-[var(--t1)]">
                직접 입력
              </h3>
            </header>
            {!showDirectInput ? (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setShowDirectInput(true)}
                  className="flex items-center justify-center gap-2 rounded-[var(--r-md)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] px-4 py-3 font-display text-[13px] font-[600] text-[var(--t1)] transition-colors hover:border-[var(--p)] hover:bg-[var(--p-light)]"
                >
                  <Plus size={14} />
                  스크립트 붙여넣기
                </button>
                <button
                  type="button"
                  disabled
                  title="Phase 2 예정"
                  className="flex items-center justify-center gap-2 rounded-[var(--r-md)] border border-dashed border-[var(--bd)] px-4 py-3 font-display text-[13px] font-[600] text-[var(--t3)] opacity-60"
                >
                  <Upload size={14} />
                  파일 업로드 (Phase 2)
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  placeholder="제목 (선택)"
                  className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-2 font-body text-[13px] focus:border-[var(--bdf)] focus:outline-none"
                />
                <textarea
                  value={scriptInput}
                  onChange={(e) => {
                    setScriptInput(e.target.value);
                    if (inputError) setInputError(null);
                  }}
                  placeholder="영어 스크립트를 붙여넣으세요 (최소 20자)"
                  rows={4}
                  aria-invalid={inputError != null}
                  className={`rounded-[var(--r-md)] border bg-[var(--bg)] px-3 py-2 font-body text-[13px] focus:outline-none focus:ring-2 focus:ring-[var(--p)]/20 ${
                    inputError
                      ? 'border-[var(--warning)] focus:border-[var(--warning)]'
                      : 'border-[var(--bd)] focus:border-[var(--bdf)]'
                  }`}
                />
                {inputError && (
                  <p
                    role="status"
                    className="font-body text-[12px] italic text-[var(--warning)]"
                  >
                    {inputError}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDirectInput(false);
                      setInputError(null);
                    }}
                    className="flex-1 rounded-[var(--r-md)] border border-[var(--bd)] py-2 font-display text-[13px] font-[600] text-[var(--t2)] transition-colors hover:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={handleDirectInputSubmit}
                    className="flex-1 rounded-[var(--r-md)] bg-[var(--p)] py-2 font-display text-[13px] font-[600] text-[var(--ti)] transition-colors hover:bg-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
                  >
                    분석 + 시작
                  </button>
                </div>
              </div>
            )}
          </article>
        </div>
      </section>

      {/* ─── 최근 세션 ─── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[16px] font-[700] text-[var(--t1)]">
            🕒 최근 세션
          </h2>
          {stats.streak > 0 && (
            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[var(--active)]">
              <Flame size={12} strokeWidth={2.5} />
              {stats.streak}일 연속
            </span>
          )}
        </div>
        <ul className="flex flex-col divide-y divide-[var(--bg3)] rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)]">
          {sessions.slice(0, 5).map((s) => {
            const acc = s.totalAccuracy ?? 0;
            const accColor =
              acc >= 90
                ? 'var(--success)'
                : acc >= 70
                  ? 'var(--p)'
                  : acc > 0
                    ? 'var(--warning)'
                    : 'var(--t3)';
            return (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                <span className="rounded-full bg-[var(--bg3)] px-2 py-0.5 font-mono text-[10px] font-[700] text-[var(--t2)]">
                  {s.config.cefr}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-body text-[13px] font-[600] text-[var(--t1)]">
                    {s.resourceTitle}
                  </p>
                  <p className="font-body text-[11px] text-[var(--t3)]">
                    {s.completedAt
                      ? `${new Date(s.completedAt).toLocaleString('ko-KR', {
                          month: 'numeric',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: 'numeric',
                        })} · ${s.items.length}개`
                      : '진행 중'}
                  </p>
                </div>
                {s.totalAccuracy != null ? (
                  <span
                    className="font-mono text-[14px] font-[700] tabular-nums"
                    style={{ color: accColor }}
                  >
                    {Math.round(acc)}%
                  </span>
                ) : null}
                {s.completedAt ? (
                  <Link
                    href={`/dictate/results?sessionId=${s.id}`}
                    className="rounded-[var(--r-sm)] bg-[var(--bg2)] px-2 py-1 font-display text-[11px] font-[600] text-[var(--t2)] hover:bg-[var(--bg3)]"
                  >
                    결과
                  </Link>
                ) : (
                  <Link
                    href={`/dictate/session?sessionId=${s.id}`}
                    className="rounded-[var(--r-sm)] bg-[var(--p-light)] px-2 py-1 font-display text-[11px] font-[600] text-[var(--p)] hover:bg-[var(--p)]/20"
                  >
                    이어하기
                  </Link>
                )}
              </li>
            );
          })}
          {sessions.length === 0 && (
            <li className="flex items-center gap-2 px-4 py-6 font-body text-[13px] text-[var(--t3)]">
              <TrendingUp size={14} />
              <span>아직 받아쓰기 기록이 없어요. 위에서 리소스를 선택해 시작해보세요.</span>
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
