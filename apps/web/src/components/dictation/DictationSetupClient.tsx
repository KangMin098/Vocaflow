// apps/web/src/components/dictation/DictationSetupClient.tsx
//
// 받아쓰기 설정 — 무엇을 받아쓰는지 먼저 보여주고, 조절은 그 다음이다.
//
// v07 변경:
//   · 자료가 localStorage 리소스가 아니라 DB 학습 자산(`?text=` / `?set=`)이다.
//   · '단위(문장/단락/전체)' → '한 번에 받아쓸 분량(1·2·3문장)'.
//     단락·전체는 연속 본문에서만 성립해 단어장에서는 고를 수조차 없는 옵션이었다.
//   · 이 자료가 훈련하는 내 단어 수를 미리 보여준다 — 받아쓰기가 복습으로 이어진다는
//     사실을 시작 전에 알아야 "왜 이걸 하는가"가 성립한다.
//
// CEFR 수동 선택은 v06.21 에서 제거된 그대로 — 자료에서 감지된 값이 추천값을 만든다.

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Loader2,
  Sparkles,
} from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { getLevelByCode } from '@/lib/dictation/cefr'
import { fetchDictationOverview } from '@/lib/dictation/persist'
import {
  countWords,
  pickBySpan,
  spanBand,
  resolveDictationSource,
  type DictationSource,
} from '@/lib/dictation/source'
import { createDictationSession, DictationStartError } from '@/hooks/dictation/useDictationSession'
import type {
  CEFRCode,
  ChunkSize,
  DictationConfig,
  DictationOrder,
  ScoringMode,
} from '@/lib/dictation/types'

const DICTATION_ACCENT = '#0EA5E9'
const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2'

const CHUNK_META: Record<ChunkSize, { label: string; description: string }> = {
  1: { label: '1문장', description: '한 문장씩. 가장 정확하게 듣는 연습.' },
  2: { label: '2문장', description: '두 문장을 이어 듣기. 맥락과 흐름 유지.' },
  3: { label: '3문장', description: 'Dictogloss — 듣고 기억해 재구성.' },
}

/** 단어장·오늘의 받아쓰기는 문장이 서로 이어지지 않아 묶어 들으면 문맥이 깨진다. */
function allowsChunking(kind: string): boolean {
  return kind === 'book' || kind === 'text' || kind === 'custom'
}

export function DictationSetupClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const textId = searchParams.get('text') ?? ''
  const setId = searchParams.get('set') ?? ''
  const custom = searchParams.get('custom') === '1'
  const chapterRaw = Number(searchParams.get('chapter'))
  const chapter = Number.isInteger(chapterRaw) && chapterRaw > 0 ? chapterRaw : null

  const [source, setSource] = useState<DictationSource | null>(null)
  // 자료 좌표가 아예 없으면 **불러올 것이 없다** — 허브로 돌아가는 중일 뿐이다.
  // 그 상태에 "자료를 불러오는 중" 을 띄우면 화면이 거짓말을 하고, 전환이 느린 순간에는
  // 학습자가 멈춘 화면을 본다(회귀가 이걸 "로딩이 최종 상태" 로 잡았다).
  const hasSourceParam = !!textId || !!setId || custom
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'missing'>('loading')
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  /** 청취 폭 — 문항을 고를 길이대의 기준 (null = 아직 기록 없음) */
  const [span, setSpan] = useState<number | null>(null)

  const [chunkSize, setChunkSize] = useState<ChunkSize>(1)
  const [count, setCount] = useState<number | 'all'>(10)
  const [order, setOrder] = useState<DictationOrder>('sequential')
  const [scoring, setScoring] = useState<ScoringMode>('smart')
  const [cefr, setCefr] = useState<CEFRCode>('B1')
  const [speed, setSpeed] = useState(0.85)
  const [autoRepeat, setAutoRepeat] = useState(3)
  const [hintsAllowed, setHintsAllowed] = useState(true)
  const [showAdvanced, setShowAdvanced] = useState(false)

  useEffect(() => {
    if (!textId && !setId && !custom) {
      router.replace('/dictate')
      return
    }
    let mounted = true
    void (async () => {
      const client = createClient()
      const {
        data: { user },
      } = await client.auth.getUser()
      const [resolved, overview] = await Promise.all([
        resolveDictationSource(client, {
          text: textId || undefined,
          set: setId || undefined,
          custom,
          chapter,
          userId: user?.id ?? null,
        }),
        fetchDictationOverview(client),
      ])
      if (!mounted) return
      setSpan(overview.span > 0 ? overview.span : null)
      if (!resolved) {
        setLoadState('missing')
        return
      }
      setSource(resolved)
      setLoadState('ready')

      // 자료 레벨 → 추천값 자동 적용
      const level = getLevelByCode(resolved.cefr ?? 'B1')
      setCefr(resolved.cefr ?? 'B1')
      setSpeed(level.recommended.speed)
      setAutoRepeat(level.recommended.autoRepeat)
      setHintsAllowed(level.recommended.hintsAllowed)
      setCount(Math.min(level.recommended.sessionCount, resolved.sentences.length))
      setChunkSize(allowsChunking(resolved.kind) ? level.recommended.chunkSize : 1)
    })()
    return () => {
      mounted = false
    }
  }, [textId, setId, custom, chapter, router])

  // 미리보기는 **실제로 시작될 문항**을 그대로 계산한다 —
  // 예상치와 실제가 다르면 그 순간 화면이 거짓말이 된다(앞에서 N개 자르던 시절의 함정).
  const preview = useMemo(() => {
    if (!source)
      return { items: 0, available: 0, minutes: 0, targetWords: 0, band: null as null | string }
    const band = spanBand(span)
    const totalChunks = Math.ceil(source.sentences.length / chunkSize)
    const wanted = count === 'all' ? totalChunks : Math.min(count, totalChunks)

    // 실제 문항 조립과 같은 규칙 — 묶은 뒤 청취 폭으로 고른다
    const merged: Array<{ text: string; targetWords: string[] }> = []
    for (let i = 0; i < source.sentences.length; i += chunkSize) {
      const group = source.sentences.slice(i, i + chunkSize)
      merged.push({
        text: group.map((g) => g.text).join(' '),
        targetWords: [...new Set(group.flatMap((g) => g.targetWords))],
      })
    }
    const picked =
      source.kind === 'daily' ? merged.slice(0, wanted) : pickBySpan(merged, wanted, band)

    const words = picked.reduce((sum, p) => sum + countWords(p.text), 0)
    // 발화 150wpm + 입력·채점 시간을 문항당 약 25초로 잡는다 (실측 근사)
    const seconds = (words / 150) * 60 * autoRepeat + picked.length * 25
    return {
      items: picked.length,
      available: merged.length,
      minutes: Math.max(1, Math.round(seconds / 60)),
      targetWords: new Set(picked.flatMap((p) => p.targetWords)).size,
      band: span ? `${band.lo}~${band.hi}단어` : null,
    }
  }, [source, chunkSize, count, autoRepeat, span])

  const start = useCallback(async () => {
    if (!source || starting) return
    setStarting(true)
    setStartError(null)
    const config: DictationConfig = {
      chunkSize,
      count,
      order,
      scoring,
      cefr,
      speed,
      autoRepeat,
      hintsAllowed,
      voice: '',
    }
    // 실패는 반드시 화면에 남긴다 — 조용히 스피너만 끄면 "아무 반응 없음" 이 된다.
    let session
    try {
      session = await createDictationSession(source, config, span)
    } catch (e) {
      setStarting(false)
      setStartError(
        e instanceof DictationStartError && e.reason === 'cache-failed'
          ? '이 브라우저의 저장 공간이 가득 차 세션을 이어받지 못했어요. 사이트 데이터를 정리하거나 다른 브라우저에서 다시 시도해 주세요.'
          : '이 설정으로 만들 문항이 없었어요. 문항 수나 묶음 크기를 줄여서 다시 시도해 주세요.',
      )
      return
    }
    router.push(`/dictate/session?sessionId=${session.id}`)
  }, [source, starting, chunkSize, count, order, scoring, cefr, speed, autoRepeat, hintsAllowed, span, router])

  // 좌표 없이 들어온 경우 — 허브로 돌아가는 중이다.
  // `null` 을 그리지 않는다: 전환이 느리면 **빈 화면**이 되고, 그건 틀린 문구보다 나쁘다.
  // 무슨 일이 일어나는지 말하고, 전환이 막혀도 손으로 갈 길을 함께 준다.
  if (!hasSourceParam) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-16 text-center">
        <p role="status" className="font-body text-[13px] text-[var(--t2)]">
          받아쓸 자료를 고르는 화면으로 이동하고 있어요
        </p>
        <Link
          href="/dictate"
          className={`inline-flex h-11 items-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] px-4 font-display text-[13px] font-[600] text-[var(--t1)] transition-colors hover:bg-[var(--bg2)] ${FOCUS_RING}`}
        >
          받아쓰기 열기
          <ArrowRight size={14} />
        </Link>
      </div>
    )
  }

  if (loadState === 'loading') {
    return (
      // 맨 스피너는 화면 판독기에 아무것도 아니다 — 상태를 말로도 남긴다(결과 화면과 같은 규칙).
      <div
        role="status"
        aria-live="polite"
        className="mx-auto flex max-w-3xl items-center justify-center gap-2 px-4 py-20"
      >
        <Loader2 size={20} className="animate-spin text-[var(--t3)]" aria-hidden="true" />
        <span className="font-body text-[13px] text-[var(--t2)]">자료를 불러오는 중</span>
      </div>
    )
  }

  if (loadState === 'missing' || !source) {
    return (
      <EmptyState
        title={custom ? '붙여넣은 글이 사라졌어요' : '이 자료로는 받아쓸 수 없어요'}
        body={
          custom
            ? '붙여넣은 글은 이 탭에서만 유지돼요. 새로고침하거나 탭을 다시 열면 다시 붙여넣어야 합니다.'
            : '본문이 없거나 접근할 수 없는 자료예요. 다른 자료를 골라 주세요.'
        }
        onBack={() => router.push('/dictate')}
      />
    )
  }

  if (source.sentences.length === 0) {
    return (
      <EmptyState
        title="받아쓸 만한 문장이 없어요"
        body={
          source.kind === 'set'
            ? '이 단어장에는 아직 원문 문장이 붙어 있지 않아요. 도서에서 만들어진 단어장은 문장을 함께 갖고 있어요.'
            : '문장이 너무 짧거나 길어서 받아쓰기에 적합한 문장을 찾지 못했어요.'
        }
        onBack={() => router.push('/dictate')}
      />
    )
  }

  const canChunk = allowsChunking(source.kind)

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-8 md:px-6 md:py-10">
      {/* ─── Header ─── */}
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={() =>
            typeof window !== 'undefined' && window.history.length > 1
              ? router.back()
              : router.push('/dictate')
          }
          className={`inline-flex h-11 w-11 items-center justify-center rounded-[var(--r-md)] border border-[var(--bd)] text-[var(--t2)] transition-colors hover:bg-[var(--bg2)] ${FOCUS_RING}`}
          aria-label="뒤로"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[11px] font-[700] uppercase tracking-[0.10em] text-[var(--t2)]">
            받아쓰기 준비
          </p>
          <h1 className="truncate font-display text-[19px] font-[700] text-[var(--t1)]">
            {source.title}
          </h1>
        </div>
      </header>

      {/* ─── 미리보기 — 무엇을, 얼마나, 무슨 단어를 ─── */}
      <section className="grid grid-cols-3 gap-2 rounded-[var(--r-lg)] border border-[var(--bd)] bg-gradient-to-br from-[var(--bg)] to-[var(--bg2)] p-4 shadow-[var(--sh-sm)]">
        {/* 고른 수만 보여주면 "얼마 중에 얼마인지"를 알 수 없다 — 분모를 함께 준다 */}
        <PreviewStat
          value={preview.items}
          unit="문항"
          label={`전체 ${preview.available}개 중`}
        />
        <PreviewStat value={preview.minutes} unit="분" label="예상 소요" />
        <PreviewStat
          value={preview.targetWords}
          unit="단어"
          label="복습으로 이어짐"
          emphasis={preview.targetWords > 0}
        />
      </section>

      {preview.targetWords > 0 && (
        <p className="rounded-[var(--r-md)] bg-[var(--p-light)] px-4 py-3 font-body text-[12px] leading-relaxed text-[var(--on-p-tint)]">
          이 세션에서 받아쓰는 문장에 내 단어 {preview.targetWords}개가 들어 있어요. 맞히면 그
          단어의 복습 간격이 늘어납니다.
        </p>
      )}

      {/* 문항을 왜 그렇게 골랐는지 밝힌다 — 보이지 않는 적응은 신뢰를 만들지 못한다 */}
      {preview.band && source.kind !== 'daily' && count !== 'all' && (
        <p className="px-1 font-body text-[11px] leading-relaxed text-[var(--t2)]">
          지금 청취 폭이 {span}단어라 {preview.band} 문장을 우선 골랐어요. 순서는 자료 그대로예요.
        </p>
      )}

      {/* ─── 1. 한 번에 받아쓸 분량 ─── */}
      {canChunk && (
        <Section title="한 번에 받아쓸 분량">
          <div className="grid grid-cols-3 gap-2">
            {([1, 2, 3] as ChunkSize[]).map((c) => {
              const meta = CHUNK_META[c]
              const recommended = getLevelByCode(cefr).recommended.chunkSize === c
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setChunkSize(c)}
                  aria-pressed={chunkSize === c}
                  className={`flex flex-col items-start gap-1 rounded-[var(--r-md)] border p-3 text-left transition-all duration-[var(--dur-normal)] ${FOCUS_RING} ${
                    chunkSize === c
                      ? 'border-[var(--p)] bg-[var(--p-light)] shadow-[var(--sh-sm)]'
                      : 'border-[var(--bd)] bg-[var(--bg)] hover:border-[var(--p)]'
                  }`}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="font-display text-[13px] font-[700] text-[var(--t1)]">
                      {meta.label}
                    </span>
                    {recommended && (
                      <span className="rounded-full bg-[var(--p)] px-2 py-1 font-display text-[9px] font-[700] uppercase tracking-wider text-[var(--on-p)]">
                        추천
                      </span>
                    )}
                  </div>
                  <p className="font-body text-[11px] leading-snug text-[var(--t2)]">
                    {meta.description}
                  </p>
                </button>
              )
            })}
          </div>
        </Section>
      )}

      {/* ─── 2. 갯수 ─── */}
      <Section title="문항 수">
        <div className="grid grid-cols-4 gap-2">
          {([5, 10, 20, 'all'] as const).map((c) => (
            <button
              key={String(c)}
              type="button"
              onClick={() => setCount(c)}
              aria-pressed={count === c}
              className={`rounded-[var(--r-md)] border py-2 font-display text-[13px] font-[600] transition-colors duration-[var(--dur-normal)] ${FOCUS_RING} ${
                count === c
                  ? 'border-[var(--p)] bg-[var(--p-light)] text-[var(--on-p-tint)]'
                  : 'border-[var(--bd)] text-[var(--t2)] hover:bg-[var(--bg2)]'
              }`}
            >
              {c === 'all' ? '전체' : c}
            </button>
          ))}
        </div>
      </Section>

      {/* ─── 3. 순서 ─── */}
      <Section title="순서">
        <div className="grid grid-cols-2 gap-2">
          {(['sequential', 'random'] as DictationOrder[]).map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => setOrder(o)}
              aria-pressed={order === o}
              className={`rounded-[var(--r-md)] border p-3 text-left transition-colors duration-[var(--dur-normal)] ${FOCUS_RING} ${
                order === o
                  ? 'border-[var(--p)] bg-[var(--p-light)]'
                  : 'border-[var(--bd)] hover:bg-[var(--bg2)]'
              }`}
            >
              <p className="font-display text-[13px] font-[600] text-[var(--t1)]">
                {o === 'sequential' ? '순차' : '섞기'}
              </p>
              <p className="font-body text-[11px] text-[var(--t2)]">
                {o === 'sequential' ? '자료 순서 그대로' : '문맥 단서를 줄여 더 어렵게'}
              </p>
            </button>
          ))}
        </div>
      </Section>

      {/* ─── 4. 채점 ─── */}
      <Section title="채점 방식">
        <div className="grid grid-cols-2 gap-2">
          {(['smart', 'strict'] as ScoringMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setScoring(m)}
              aria-pressed={scoring === m}
              className={`rounded-[var(--r-md)] border p-3 text-left transition-colors duration-[var(--dur-normal)] ${FOCUS_RING} ${
                scoring === m
                  ? 'border-[var(--p)] bg-[var(--p-light)]'
                  : 'border-[var(--bd)] hover:bg-[var(--bg2)]'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="font-display text-[13px] font-[600] text-[var(--t1)]">
                  {m === 'smart' ? '스마트' : '엄격'}
                </p>
                {m === 'smart' && (
                  <span className="rounded-full bg-[var(--success-light)] px-2 py-1 font-display text-[9px] font-[700] uppercase tracking-wider text-[var(--success)]">
                    기본
                  </span>
                )}
              </div>
              <p className="font-body text-[11px] text-[var(--t2)]">
                {m === 'smart'
                  ? '대소문자·구두점은 넘어가고 단어만 봅니다'
                  : '대소문자·구두점까지 모두 채점합니다'}
              </p>
            </button>
          ))}
        </div>
      </Section>

      {/* ─── 5. 고급 ─── */}
      <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] shadow-[var(--sh-sm)]">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          aria-expanded={showAdvanced}
          className={`flex w-full items-center justify-between px-5 py-4 ${FOCUS_RING}`}
        >
          <span className="font-display text-[13px] font-[600] text-[var(--t1)]">
            듣기 옵션
          </span>
          <span className="flex items-center gap-2 font-mono text-[11px] text-[var(--t2)]">
            {speed}x · {autoRepeat}회
            {showAdvanced ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </span>
        </button>
        {showAdvanced && (
          <div className="flex flex-col gap-4 border-t border-[var(--bd)] px-5 py-4">
            <OptionRow label="재생 속도" value={`${speed.toFixed(2)}x`}>
              {[0.5, 0.75, 0.85, 1.0, 1.25].map((s) => (
                <MiniButton key={s} active={Math.abs(speed - s) < 0.01} onClick={() => setSpeed(s)}>
                  {s}x
                </MiniButton>
              ))}
            </OptionRow>

            <OptionRow label="자동 반복" value={`${autoRepeat}회`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <MiniButton key={n} active={autoRepeat === n} onClick={() => setAutoRepeat(n)}>
                  {n}회
                </MiniButton>
              ))}
            </OptionRow>

            <label className="flex cursor-pointer items-center justify-between rounded-[var(--r-md)] bg-[var(--bg2)] px-3 py-3">
              <span className="font-body text-[13px] text-[var(--t1)]">
                힌트 사용 (쓰면 그 단어의 복습 간격이 덜 늘어나요)
              </span>
              <input
                type="checkbox"
                checked={hintsAllowed}
                onChange={(e) => setHintsAllowed(e.target.checked)}
                className="h-4 w-4 cursor-pointer accent-[var(--p)]"
              />
            </label>
          </div>
        )}
      </section>

      {/* ─── CTA ─── */}
      {/* 시작 실패 사유. `role="alert"` 로 스크린리더에도 즉시 전달된다 —
          버튼만 되돌아오는 화면은 학습자에게 "아무 일도 안 일어났다" 로 읽힌다. */}
      {startError && (
        <p
          role="alert"
          className="rounded-[var(--r-md)] border border-[var(--bde)] bg-[var(--error-light)] px-3 py-3 font-body text-[13px] leading-relaxed text-[var(--error-ink)]"
        >
          {startError}
        </p>
      )}

      <button
        type="button"
        onClick={start}
        disabled={starting}
        className={`group flex items-center justify-center gap-2 rounded-[var(--r-lg)] py-4 font-display text-[15px] font-[700] text-[var(--ti)] shadow-[var(--sh-md)] transition-all duration-[var(--dur-normal)] hover:-translate-y-0.5 hover:shadow-[var(--sh-lg)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
        style={{ background: `linear-gradient(135deg, ${DICTATION_ACCENT}, #1D4ED8)` }}
      >
        {starting ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            준비 중
          </>
        ) : (
          <>
            <Sparkles size={16} />
            시작하기
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
          </>
        )}
      </button>
    </div>
  )
}

// ── 조각들 ────────────────────────────────────────────────────────

function PreviewStat({
  value,
  unit,
  label,
  emphasis,
}: {
  value: number
  unit: string
  label: string
  emphasis?: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className="font-mono text-[22px] font-[800] tabular-nums leading-none"
        style={{ color: emphasis ? DICTATION_ACCENT : 'var(--t1)' }}
      >
        {value}
        <span className="ml-0.5 font-body text-[11px] font-[600] text-[var(--t2)]">{unit}</span>
      </span>
      <span className="truncate font-body text-[11px] text-[var(--t2)]">{label}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4 shadow-[var(--sh-sm)]">
      <h3 className="mb-2.5 font-display text-[13px] font-[700] text-[var(--t1)]">{title}</h3>
      {children}
    </section>
  )
}

function OptionRow({
  label,
  value,
  children,
}: {
  label: string
  value: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center justify-between font-body text-[12px] text-[var(--t2)]">
        {label}
        <span className="font-mono text-[12px] font-[700] text-[var(--t1)]">{value}</span>
      </div>
      <div className="mt-2 flex gap-1">{children}</div>
    </div>
  )
}

function MiniButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex-1 rounded-[var(--r-sm)] border py-2 font-mono text-[11px] font-[600] transition-colors duration-[var(--dur-normal)] ${FOCUS_RING} ${
        active
          ? 'border-[var(--p)] bg-[var(--p-light)] text-[var(--on-p-tint)]'
          : 'border-[var(--bd)] text-[var(--t2)] hover:bg-[var(--bg2)]'
      }`}
    >
      {children}
    </button>
  )
}

function EmptyState({
  title,
  body,
  onBack,
}: {
  title: string
  body: string
  onBack: () => void
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
      <div>
        <h2 className="font-display text-[16px] font-[700] text-[var(--t1)]">{title}</h2>
        <p className="mt-1.5 font-body text-[13px] leading-relaxed text-[var(--t2)]">{body}</p>
      </div>
      <button
        type="button"
        onClick={onBack}
        className={`inline-flex h-11 items-center gap-2 rounded-[var(--r-md)] px-4 font-display text-[13px] font-[700] text-[var(--ti)] shadow-[var(--sh-sm)] transition-transform hover:-translate-y-0.5 ${FOCUS_RING}`}
        style={{ background: `linear-gradient(135deg, ${DICTATION_ACCENT}, #1D4ED8)` }}
      >
        자료 다시 고르기
        <ArrowRight size={14} />
      </button>
    </div>
  )
}
