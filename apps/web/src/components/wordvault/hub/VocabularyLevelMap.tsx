// apps/web/src/components/wordvault/hub/VocabularyLevelMap.tsx
//
// WordVault Section 2 (v06.35 iOS) — 단어 수준 지도.
//
// iOS Health "Activity" 차트 감성:
//   · 흰 카드, soft shadow
//   · 둥근 캡슐 막대 (rounded-full, 두꺼움)
//   · 현재 V-Level = brand --p, i+1 = iOS green
//   · 트랙은 iOS Settings 인셋 list 스타일
//
// 데이터: vocabularies.lemma → shared_dictionary.v_level (500 row 청크)

'use client'

import { useEffect, useState } from 'react'

import { createClient } from '@/lib/supabase/client'

interface LevelData {
  byLevel: number[]
  currentVLevel: number | null
  trackLevels: Record<string, number>
  totalWithLevel: number
}

type State =
  | { kind: 'loading' }
  | { kind: 'unauth' }
  | { kind: 'no-words' }
  | { kind: 'ready'; data: LevelData }
  | { kind: 'error'; message: string }

const TRACK_LABEL: Record<string, string> = {
  csat_korean: '수능',
  business: '비즈니스',
  academic: '학술',
}

const NF = new Intl.NumberFormat('en-US')

export function VocabularyLevelMap() {
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (cancelled) return
      if (!user) {
        setState({ kind: 'unauth' })
        return
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('current_v_level, current_track_levels')
        .eq('user_id', user.id)
        .maybeSingle()
      if (cancelled) return
      const p = profile as
        | {
            current_v_level: number | null
            current_track_levels: Record<string, number> | null
          }
        | null

      const { data: vocabs } = await supabase
        .from('vocabularies')
        .select('lemma')
        .eq('user_id', user.id)
        .not('lemma', 'is', null)
      if (cancelled) return

      const lemmas = ((vocabs ?? []) as Array<{ lemma: string | null }>)
        .map((v) => v.lemma)
        .filter((v): v is string => !!v)

      const byLevel = new Array<number>(12).fill(0)
      let totalWithLevel = 0
      if (lemmas.length > 0) {
        const CHUNK = 500
        for (let i = 0; i < lemmas.length; i += CHUNK) {
          const slice = lemmas.slice(i, i + CHUNK)
          const { data: dict } = await supabase
            .from('shared_dictionary')
            .select('word, v_level')
            .in('word', slice)
          if (cancelled) return
          for (const r of (dict ?? []) as Array<{ word: string; v_level: number | null }>) {
            if (r.v_level != null && r.v_level >= 0 && r.v_level <= 11) {
              byLevel[r.v_level] = (byLevel[r.v_level] ?? 0) + 1
              totalWithLevel += 1
            }
          }
        }
      }

      if (totalWithLevel === 0) {
        setState({ kind: 'no-words' })
        return
      }

      setState({
        kind: 'ready',
        data: {
          byLevel,
          currentVLevel: p?.current_v_level ?? null,
          trackLevels: p?.current_track_levels ?? {},
          totalWithLevel,
        },
      })
    })().catch((e: unknown) => {
      if (cancelled) return
      setState({ kind: 'error', message: e instanceof Error ? e.message : String(e) })
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (state.kind === 'loading' || state.kind === 'unauth' || state.kind === 'error') {
    return (
      <Frame title="단어 수준 지도">
        <p className="font-body text-[13px] text-[var(--t3)]">
          단어가 누적되면 V-Level 분포가 보여요.
        </p>
      </Frame>
    )
  }

  if (state.kind === 'no-words') {
    return (
      <Frame title="단어 수준 지도">
        <p className="font-body text-[13px] text-[var(--t3)]">
          사전 매칭된 단어가 없어요.
        </p>
      </Frame>
    )
  }

  const { byLevel, currentVLevel, trackLevels, totalWithLevel } = state.data
  const max = Math.max(1, ...byLevel)
  const iPlusOne = currentVLevel != null && currentVLevel < 11 ? currentVLevel + 1 : null

  return (
    <Frame
      title="단어 수준 지도"
      subtitle={`${NF.format(totalWithLevel)}개 단어 분류 완료`}
    >
      {/* iOS Stats — 현재 / i+1 큰 캡슐 row */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {currentVLevel != null && (
          <StatPill label="지금" value={`V${currentVLevel}`} tone="brand" />
        )}
        {iPlusOne != null && (
          <StatPill label="다음 (i+1)" value={`V${iPlusOne}`} tone="success" />
        )}
        <StatPill label="합계" value={`${NF.format(totalWithLevel)}`} />
      </div>

      {/* V-Level bars — iOS rounded-full 캡슐 */}
      <div className="flex h-[136px] items-end gap-2">
        {byLevel.map((count, lv) => {
          const heightPct = max > 0 ? (count / max) * 100 : 0
          const isCurrent = lv === currentVLevel
          const isIPlusOne = lv === iPlusOne
          let bg = 'var(--bg3)'
          if (count > 0) {
            if (isCurrent) bg = 'var(--p)'
            else if (isIPlusOne) bg = '#34C759'
            else bg = '#D1D5DB'
          }
          return (
            <div key={lv} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex h-full w-full items-end justify-center">
                <div
                  className="w-full rounded-full transition-[height] duration-[var(--dur-slow)] ease-[var(--ease-out)]"
                  style={{
                    height: `${Math.max(4, heightPct)}%`,
                    backgroundColor: bg,
                    opacity: count === 0 ? 0.35 : 1,
                    boxShadow:
                      isCurrent || isIPlusOne
                        ? `0 2px 8px ${isCurrent ? 'rgba(59,130,246,0.25)' : 'rgba(52,199,89,0.22)'}`
                        : 'none',
                  }}
                  title={`V${lv} · ${NF.format(count)}개`}
                />
              </div>
              <span
                className={`font-mono text-[10px] tabular-nums ${
                  isCurrent
                    ? 'font-[800] text-[var(--p)]'
                    : isIPlusOne
                      ? 'font-[700] text-[#34C759]'
                      : 'text-[var(--t3)]'
                }`}
              >
                {lv}
              </span>
            </div>
          )
        })}
      </div>

      {/* Track levels — iOS Settings 인셋 list 스타일 */}
      {Object.entries(trackLevels).some(([, v]) => v != null && v > 0) && (
        <div className="mt-6 overflow-hidden rounded-[14px] bg-[var(--bg2)]">
          <div className="px-4 py-2.5">
            <span className="font-mono text-[9.5px] font-[700] uppercase tracking-[0.16em] text-[var(--t3)]">
              트랙별 수준
            </span>
          </div>
          <div className="bg-[var(--bg)]">
            {Object.entries(trackLevels)
              .filter(([, level]) => level != null && level > 0)
              .map(([key, level], idx, arr) => {
                const label = TRACK_LABEL[key] ?? key
                return (
                  <div
                    key={key}
                    className={`flex items-center justify-between px-4 py-3 ${
                      idx < arr.length - 1 ? 'border-b border-[var(--bd)]/60' : ''
                    }`}
                  >
                    <span className="font-display text-[14px] font-[500] text-[var(--t1)]">
                      {label}
                    </span>
                    <span className="rounded-[var(--r-full)] bg-[var(--bg2)] px-2.5 py-0.5 font-display text-[12px] font-[700] tabular-nums text-[var(--t1)]">
                      L{level}
                    </span>
                  </div>
                )
              })}
          </div>
        </div>
      )}
    </Frame>
  )
}

function StatPill({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'brand' | 'success'
}) {
  const colors =
    tone === 'brand'
      ? { bg: 'var(--p-light)', label: 'var(--p-dark)', value: 'var(--p-dark)' }
      : tone === 'success'
        ? { bg: '#E8F8EE', label: '#15803D', value: '#15803D' }
        : { bg: 'var(--bg2)', label: 'var(--t3)', value: 'var(--t1)' }
  return (
    <div
      className="inline-flex items-baseline gap-1.5 rounded-[var(--r-full)] px-3 py-1"
      style={{ backgroundColor: colors.bg }}
    >
      <span
        className="font-mono text-[9.5px] font-[700] uppercase tracking-[0.14em]"
        style={{ color: colors.label, opacity: 0.85 }}
      >
        {label}
      </span>
      <span
        className="font-display text-[12.5px] font-[700] tabular-nums"
        style={{ color: colors.value }}
      >
        {value}
      </span>
    </div>
  )
}

function Frame({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section
      aria-label={title}
      className="rounded-[24px] bg-[var(--bg)] p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.08)] md:p-7"
    >
      <header className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-[20px] font-[700] tracking-[-0.022em] text-[var(--t1)]">
          {title}
        </h2>
        {subtitle && (
          <span className="font-mono text-[11px] tabular-nums text-[var(--t3)]">{subtitle}</span>
        )}
      </header>
      {children}
    </section>
  )
}
