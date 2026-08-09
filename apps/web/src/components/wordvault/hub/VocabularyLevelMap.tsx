// apps/web/src/components/wordvault/hub/VocabularyLevelMap.tsx
//
// WordVault Section 2 (v06.36) — 단어 수준 지도.
// iOS 프리미티브 사용 (Frame / Capsule / InsetGroup / InsetRow).

'use client'

import { useEffect, useState } from 'react'

import { Capsule, Frame, InsetGroup, InsetRow } from '@/components/ui/ios'
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
        <p className="font-body text-[13px] text-[var(--t2)]">
          단어가 누적되면 V-Level 분포가 보여요.
        </p>
      </Frame>
    )
  }

  if (state.kind === 'no-words') {
    return (
      <Frame title="단어 수준 지도">
        <p className="font-body text-[13px] text-[var(--t2)]">
          사전 매칭된 단어가 없어요.
        </p>
      </Frame>
    )
  }

  const { byLevel, currentVLevel, trackLevels, totalWithLevel } = state.data
  const max = Math.max(1, ...byLevel)
  const iPlusOne = currentVLevel != null && currentVLevel < 11 ? currentVLevel + 1 : null

  const tracksWithLevel = Object.entries(trackLevels).filter(
    ([, level]) => level != null && level > 0,
  )

  return (
    <Frame title="단어 수준 지도" meta={`${NF.format(totalWithLevel)}개 분류됨`}>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {currentVLevel != null && (
          <Capsule label="지금" value={`V${currentVLevel}`} tone="brand" />
        )}
        {iPlusOne != null && (
          <Capsule label="다음 (i+1)" value={`V${iPlusOne}`} tone="green" />
        )}
        <Capsule label="합계" value={NF.format(totalWithLevel)} />
      </div>

      {/* V-Level 캡슐 막대 */}
      <div className="flex h-[136px] items-end gap-2">
        {byLevel.map((count, lv) => {
          const heightPct = max > 0 ? (count / max) * 100 : 0
          const isCurrent = lv === currentVLevel
          const isIPlusOne = lv === iPlusOne
          let bg = 'var(--bg3)'
          if (count > 0) {
            if (isCurrent) bg = 'var(--p)'
            else if (isIPlusOne) bg = 'var(--ios-green)'
            else bg = 'var(--ios-gray-3)'
          }
          return (
            <div key={lv} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex h-full w-full items-end justify-center">
                <div
                  className="w-full rounded-full transition-[height] duration-[var(--dur-ios-slow)] ease-ios-emphasized"
                  style={{
                    height: `${Math.max(4, heightPct)}%`,
                    backgroundColor: bg,
                    opacity: count === 0 ? 0.35 : 1,
                    boxShadow:
                      isCurrent || isIPlusOne
                        ? `0 2px 8px ${isCurrent ? 'rgba(88,86,214,0.30)' : 'rgba(52,199,89,0.22)'}`
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
                      ? 'font-[700] text-ios-green'
                      : 'text-[var(--t2)]'
                }`}
              >
                {lv}
              </span>
            </div>
          )
        })}
      </div>

      {/* 트랙별 수준 — Settings 인셋 그룹 */}
      {tracksWithLevel.length > 0 && (
        <div className="mt-6">
          <InsetGroup header="트랙별 수준">
            {tracksWithLevel.map(([key, level]) => {
              const label = TRACK_LABEL[key] ?? key
              return (
                <InsetRow
                  key={key}
                  title={label}
                  hideChevron
                  metaRight={`L${level}`}
                />
              )
            })}
          </InsetGroup>
        </div>
      )}
    </Frame>
  )
}
