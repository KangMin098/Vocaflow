// apps/web/src/components/wordvault/hub/VocabularyLevelMap.tsx
//
// WordVault Portfolio — 단어 수준 지도 (v06.35).
//
// 사용자가 보유한 단어를 V-Level (0~11) 별 분포 막대로 시각화 +
// 현재 V-Level 위치 + i+1 zone (V+1) 강조 + Track levels (csat/business/academic).
//
// "단어 관점의 종합 포트폴리오" 정합 — 학습자가 "어디까지 와 있고 다음은 어디"인지
// 한눈에 보임.

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

      // 1) 사용자 V-Level + 트랙
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

      // 2) vocabularies → lemma 추출 → shared_dictionary v_level 매핑
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
        // 청크 (URL/IN 제한 회피)
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
      meta={`${new Intl.NumberFormat('en-US').format(totalWithLevel)} 단어 분류됨`}
    >
      {/* V-Level bars (V0-V11) */}
      <div className="flex h-[120px] items-end gap-1.5">
        {byLevel.map((count, lv) => {
          const heightPct = max > 0 ? (count / max) * 100 : 0
          const isCurrent = lv === currentVLevel
          const isIPlusOne = lv === iPlusOne
          let bg = 'var(--bg3)'
          if (count > 0) {
            if (isCurrent) bg = 'var(--p)'
            else if (isIPlusOne) bg = 'var(--success)'
            else bg = 'var(--t3)'
          }
          return (
            <div key={lv} className="flex flex-1 flex-col items-center gap-1.5">
              <div
                className="w-full rounded-t-[2px] transition-[height] duration-[var(--dur-slow)] ease-[var(--ease-out)]"
                style={{
                  height: `${Math.max(2, heightPct)}%`,
                  backgroundColor: bg,
                  opacity: count === 0 ? 0.4 : 1,
                }}
                title={`V${lv} · ${count}개`}
              />
              <span
                className={`font-mono text-[10px] tabular-nums ${
                  isCurrent
                    ? 'font-[800] text-[var(--p)]'
                    : isIPlusOne
                      ? 'font-[700] text-[var(--success)]'
                      : 'text-[var(--t3)]'
                }`}
              >
                {lv}
              </span>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] text-[var(--t3)]">
        {currentVLevel != null && (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-[7px] w-[7px] rounded-full bg-[var(--p)]" />
            <span>
              현재 <strong className="font-display tabular-nums text-[var(--p-dark)]">V{currentVLevel}</strong>
            </span>
          </span>
        )}
        {iPlusOne != null && (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-[7px] w-[7px] rounded-full bg-[var(--success)]" />
            <span>
              i+1 zone <strong className="font-display tabular-nums text-[#16a34a]">V{iPlusOne}</strong> · Krashen 권장
            </span>
          </span>
        )}
      </div>

      {/* Track levels (only show if at least 1) */}
      {Object.keys(trackLevels).length > 0 && (
        <div className="mt-4 flex flex-col gap-2 border-t border-[var(--bd)] pt-3">
          <span className="font-mono text-[10px] font-[700] uppercase tracking-[0.16em] text-[var(--t3)]">
            트랙별 수준
          </span>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 font-mono text-[11px] text-[var(--t2)]">
            {Object.entries(trackLevels).map(([key, level]) => {
              if (level == null || level <= 0) return null
              const label = TRACK_LABEL[key] ?? key
              return (
                <span key={key} className="inline-flex items-baseline gap-1.5">
                  <span className="text-[var(--t3)]">{label}</span>
                  <strong className="font-display tabular-nums text-[var(--t1)]">L{level}</strong>
                </span>
              )
            })}
          </div>
        </div>
      )}
    </Frame>
  )
}

function Frame({
  title,
  meta,
  children,
}: {
  title: string
  meta?: string
  children: React.ReactNode
}) {
  return (
    <section
      aria-label={title}
      className="rounded-[var(--r-2xl)] border border-[var(--bd)] bg-[var(--bg)] p-6 md:p-7"
    >
      <header className="mb-4 flex items-baseline justify-between gap-3">
        <span className="font-mono text-[10px] font-[700] uppercase tracking-[0.18em] text-[var(--t3)]">
          {title}
        </span>
        {meta && (
          <span className="font-mono text-[10px] tabular-nums text-[var(--t3)]">{meta}</span>
        )}
      </header>
      {children}
    </section>
  )
}
