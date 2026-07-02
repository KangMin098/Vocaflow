// apps/web/src/components/dictation/DictationSetupClient.tsx
// Dictation Setup — 단위/갯수/순서/채점/속도/반복/힌트 (v06.21 — CEFR 수동 선택 제거)
//
// CEFR 수동 UI 제거 근거:
//   - 리소스에서 자동 감지된 cefr 가 추천값(unit/speed/autoRepeat/hintsAllowed/count) 자동 적용
//   - 수동 변경은 추천값만 갱신 — 실제 세션(채점·오디오·힌트)에는 영향 X
//   - Hub 의 최근 세션 배지 표시용으로만 cefr 보존 (DictationConfig 그대로 유지)

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';

import { getLevelByCode } from '@/lib/dictation/cefr';
import { getResource, saveResource } from '@/lib/dictation/storage';
import { fetchTextAsDictationResource } from '@/lib/dictation/scoped-resource';
import { splitText, estimateUnit } from '@/lib/dictation/text-splitter';
import { createSession } from '@/hooks/dictation/useDictationSession';
import { createClient } from '@/lib/supabase/client';
import type {
  CEFRCode,
  DictationConfig,
  DictationOrder,
  DictationResource,
  DictationUnit,
  ScoringMode,
} from '@/lib/dictation/types';

const DICTATION_ACCENT = '#0EA5E9';

const UNIT_META: Record<DictationUnit, { icon: string; label: string; description: string; group: string }> = {
  sentence: {
    icon: '📄',
    label: '문장 단위',
    description: '한 문장씩 받아쓰기. 가장 작은 단위.',
    group: '초급+중급',
  },
  paragraph: {
    icon: '📑',
    label: '단락 단위',
    description: '단락 전체. 맥락과 흐름 유지.',
    group: '중급',
  },
  whole: {
    icon: '📰',
    label: '전체 스크립트',
    description: 'Dictogloss — 듣고 메모 후 재구성.',
    group: '고급',
  },
};

export function DictationSetupClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resourceId = searchParams.get('resourceId') ?? '';
  const textId = searchParams.get('text') ?? ''; // 계획 launch — 스크립트를 임시 리소스로

  const [resource, setResource] = useState<DictationResource | null>(null);
  const [unit, setUnit] = useState<DictationUnit>('sentence');
  const [count, setCount] = useState<number | 'all'>(10);
  const [order, setOrder] = useState<DictationOrder>('sequential');
  const [scoring, setScoring] = useState<ScoringMode>('smart');
  const [cefr, setCefr] = useState<CEFRCode>('B1');
  const [speed, setSpeed] = useState(0.85);
  const [autoRepeat, setAutoRepeat] = useState(3);
  const [hintsAllowed, setHintsAllowed] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // 리소스 로드 + 자동 레벨 적용
  useEffect(() => {
    const applyResource = (r: DictationResource) => {
      setResource(r);
      if (r.cefr) {
        setCefr(r.cefr);
        const level = getLevelByCode(r.cefr);
        setUnit(level.recommended.unit);
        setSpeed(level.recommended.speed);
        setAutoRepeat(level.recommended.autoRepeat);
        setHintsAllowed(level.recommended.hintsAllowed);
        setCount(level.recommended.sessionCount);
      }
    };

    // 계획 launch — ?text= 스크립트를 임시 리소스로 만들어 진행
    if (!resourceId && textId) {
      void (async () => {
        try {
          const client = createClient();
          const {
            data: { user },
          } = await client.auth.getUser();
          const r = await fetchTextAsDictationResource(client, textId, user?.id ?? null);
          if (!r) {
            router.replace('/dictate');
            return;
          }
          saveResource(r);
          applyResource(r);
        } catch {
          router.replace('/dictate');
        }
      })();
      return;
    }

    if (!resourceId) {
      router.replace('/dictate');
      return;
    }
    const r = getResource(resourceId);
    if (!r) {
      router.replace('/dictate');
      return;
    }
    applyResource(r);
  }, [resourceId, textId, router]);

  // 분리된 단위 갯수 미리보기
  const unitPreview = useMemo(() => {
    if (!resource) return { total: 0, estimated: 0 };
    const units = splitText(resource.script, unit);
    const taken = count === 'all' ? units : units.slice(0, count);
    const totalSeconds = taken.reduce(
      (sum, t) => sum + estimateUnit(t).estimatedSeconds,
      0
    );
    return {
      total: units.length,
      taken: taken.length,
      estimated: Math.ceil(totalSeconds / 60),
    };
  }, [resource, unit, count]);

  const startSession = () => {
    if (!resource) return;
    const config: DictationConfig = {
      resourceId: resource.id,
      unit,
      count,
      order,
      scoring,
      cefr,
      speed,
      autoRepeat,
      hintsAllowed,
      voice: '',
    };
    const session = createSession(config);
    if (session) {
      router.push(`/dictate/session?sessionId=${session.id}`);
    }
  };

  if (!resource) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-center font-body text-[14px] text-[var(--t3)]">
        리소스를 불러오는 중...
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8 md:px-6 md:py-10">
      {/* ─── Header ─── */}
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--r-md)] border border-[var(--bd)] text-[var(--t2)] hover:bg-[var(--bg2)]"
          aria-label="뒤로"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <p className="font-display text-[11px] font-[700] uppercase tracking-[0.10em] text-[var(--t3)]">
            Dictation Setup
          </p>
          <h1 className="font-display text-[20px] font-[700] text-[var(--t1)]">
            {resource.title}
          </h1>
        </div>
      </header>

      {/* ─── 1. 단위 ─── */}
      <Section
        title="📝 받아쓰기 단위"
        subtitle={
          resource.cefr
            ? `리소스 레벨: ${resource.cefr} · 추천값 자동 적용됨`
            : undefined
        }
      >
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          {(['sentence', 'paragraph', 'whole'] as DictationUnit[]).map((u) => {
            const meta = UNIT_META[u];
            const recommended = getLevelByCode(cefr).recommended.unit === u;
            return (
              <button
                key={u}
                type="button"
                onClick={() => setUnit(u)}
                className={`group flex flex-col items-start gap-1 rounded-[var(--r-md)] border p-3 text-left transition-all ${
                  unit === u
                    ? 'border-[var(--p)] bg-[var(--p-light)] shadow-[var(--sh-sm)]'
                    : 'border-[var(--bd)] bg-[var(--bg)] hover:border-[var(--p)]'
                }`}
                aria-pressed={unit === u}
              >
                <div className="flex items-center justify-between self-stretch">
                  <span className="font-display text-[14px] font-[700] text-[var(--t1)]">
                    {meta.icon} {meta.label}
                  </span>
                  {recommended && (
                    <span className="rounded-full bg-[var(--p)] px-2 py-0.5 font-display text-[9px] font-[700] uppercase tracking-wider text-[var(--ti)]">
                      추천
                    </span>
                  )}
                </div>
                <p className="font-body text-[11px] text-[var(--t2)]">{meta.description}</p>
                <span className="font-body text-[10px] text-[var(--t3)]">{meta.group}</span>
              </button>
            );
          })}
        </div>
      </Section>

      {/* ─── 2. 갯수 ─── */}
      <Section title="🔢 갯수" subtitle={`전체 ${unitPreview.total}개 중 ${unitPreview.taken ?? 0}개 · 약 ${unitPreview.estimated}분`}>
        <div className="grid grid-cols-4 gap-2">
          {([5, 10, 20, 'all'] as const).map((c) => (
            <button
              key={String(c)}
              type="button"
              onClick={() => setCount(c)}
              className={`rounded-[var(--r-md)] border py-2 font-display text-[14px] font-[600] transition-colors ${
                count === c
                  ? 'border-[var(--p)] bg-[var(--p-light)] text-[var(--p-dark)]'
                  : 'border-[var(--bd)] text-[var(--t2)] hover:bg-[var(--bg2)]'
              }`}
              aria-pressed={count === c}
            >
              {c === 'all' ? '전체' : c}
            </button>
          ))}
        </div>
      </Section>

      {/* ─── 3. 순서 ─── */}
      <Section title="🔀 순서">
        <div className="grid grid-cols-2 gap-2">
          {(['sequential', 'random'] as DictationOrder[]).map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => setOrder(o)}
              className={`rounded-[var(--r-md)] border p-3 text-left transition-colors ${
                order === o
                  ? 'border-[var(--p)] bg-[var(--p-light)]'
                  : 'border-[var(--bd)] hover:bg-[var(--bg2)]'
              }`}
              aria-pressed={order === o}
            >
              <p className="font-display text-[13px] font-[600] text-[var(--t1)]">
                {o === 'sequential' ? '순차' : '랜덤'}
              </p>
              <p className="font-body text-[11px] text-[var(--t2)]">
                {o === 'sequential' ? '스크립트 순서대로' : '인지 부담 ↑ (Bjork)'}
              </p>
            </button>
          ))}
        </div>
      </Section>

      {/* ─── 4. 채점 방식 ─── */}
      <Section title="✓ 채점 방식">
        <div className="grid grid-cols-2 gap-2">
          {(['smart', 'strict'] as ScoringMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setScoring(m)}
              className={`rounded-[var(--r-md)] border p-3 text-left transition-colors ${
                scoring === m
                  ? 'border-[var(--p)] bg-[var(--p-light)]'
                  : 'border-[var(--bd)] hover:bg-[var(--bg2)]'
              }`}
              aria-pressed={scoring === m}
            >
              <div className="flex items-center justify-between">
                <p className="font-display text-[13px] font-[600] text-[var(--t1)]">
                  {m === 'smart' ? '스마트' : '엄격'}
                </p>
                {m === 'smart' && (
                  <span className="rounded-full bg-[var(--success-light)] px-2 py-0.5 font-display text-[9px] font-[700] uppercase tracking-wider text-[var(--success)]">
                    기본
                  </span>
                )}
              </div>
              <p className="font-body text-[11px] text-[var(--t2)]">
                {m === 'smart'
                  ? '대소문자/구두점 무시. 단어 의미만 평가'
                  : '대소문자/구두점/공백 모두 체크. 시험 준비용'}
              </p>
            </button>
          ))}
        </div>
      </Section>

      {/* ─── 5. 고급 옵션 ─── */}
      <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] shadow-[var(--sh-sm)]">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-4"
        >
          <span className="font-display text-[14px] font-[600] text-[var(--t1)]">
            ⚙️ 고급 옵션
          </span>
          {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {showAdvanced && (
          <div className="flex flex-col gap-4 border-t border-[var(--bd)] px-5 py-4">
            {/* 속도 */}
            <div>
              <label className="flex items-center justify-between font-body text-[12px] text-[var(--t2)]">
                재생 속도
                <span className="font-mono text-[12px] font-[700] text-[var(--t1)]">
                  {speed.toFixed(2)}x
                </span>
              </label>
              <div className="mt-2 flex gap-1">
                {[0.5, 0.75, 0.85, 1.0, 1.25, 1.5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSpeed(s)}
                    className={`flex-1 rounded-[var(--r-sm)] border py-1.5 font-mono text-[11px] font-[600] transition-colors ${
                      Math.abs(speed - s) < 0.01
                        ? 'border-[var(--p)] bg-[var(--p-light)] text-[var(--p-dark)]'
                        : 'border-[var(--bd)] text-[var(--t2)] hover:bg-[var(--bg2)]'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>

            {/* 자동 반복 */}
            <div>
              <label className="flex items-center justify-between font-body text-[12px] text-[var(--t2)]">
                자동 반복 횟수
                <span className="font-mono text-[12px] font-[700] text-[var(--t1)]">
                  {autoRepeat}회
                </span>
              </label>
              <div className="mt-2 flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setAutoRepeat(n)}
                    className={`flex-1 rounded-[var(--r-sm)] border py-1.5 font-mono text-[11px] font-[600] transition-colors ${
                      autoRepeat === n
                        ? 'border-[var(--p)] bg-[var(--p-light)] text-[var(--p-dark)]'
                        : 'border-[var(--bd)] text-[var(--t2)] hover:bg-[var(--bg2)]'
                    }`}
                  >
                    {n}회
                  </button>
                ))}
              </div>
            </div>

            {/* 힌트 허용 */}
            <label className="flex cursor-pointer items-center justify-between rounded-[var(--r-md)] bg-[var(--bg2)] px-3 py-2">
              <span className="font-body text-[13px] text-[var(--t1)]">
                힌트 시스템 허용 (-5 / -3 / -10 / -25점)
              </span>
              <input
                type="checkbox"
                checked={hintsAllowed}
                onChange={(e) => setHintsAllowed(e.target.checked)}
                className="h-4 w-4 cursor-pointer"
              />
            </label>
          </div>
        )}
      </section>

      {/* ─── CTA ─── */}
      <button
        type="button"
        onClick={startSession}
        className="group flex items-center justify-center gap-2 rounded-[var(--r-lg)] py-4 font-display text-[15px] font-[700] text-[var(--ti)] shadow-[var(--sh-md)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--sh-lg)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
        style={{
          background: `linear-gradient(135deg, ${DICTATION_ACCENT}, #1D4ED8)`,
        }}
      >
        <Sparkles size={16} />
        시작하기
        <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
      </button>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)]">
      <header className="mb-3 flex items-baseline justify-between">
        <h3 className="font-display text-[14px] font-[700] text-[var(--t1)]">{title}</h3>
        {subtitle && (
          <span className="font-body text-[11px] text-[var(--t3)]">{subtitle}</span>
        )}
      </header>
      {children}
    </section>
  );
}

