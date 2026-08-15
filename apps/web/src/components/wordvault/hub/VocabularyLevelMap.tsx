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

      // lemma 가 있으면 lemma, 없으면 표면형(word) 으로 사전을 찾는다.
      //
      // 왜: 이 화면은 `lemma` 만 보고 `.not('lemma','is',null)` 로 걸렀는데, 실측(2026-08-15)
      // 결과 이 계정 252개 중 **lemma 가 채워진 것은 1개**였다(251개 null). 그래서 지도가
      // 통째로 비어 "단어가 누적되면 보여요" 를 띄웠다 — 252개를 가진 학습자에게.
      // 같은 데이터를 word 로 매칭하면 **242개**가 v_level 까지 붙는다.
      //
      // ⚠️ 근본 원인은 화면이 아니라 `vocabularies.lemma` 를 채우는 파이프라인이다.
      //    여기 폴백은 그 결손을 **가리는 것이 아니라** 이미 있는 데이터를 제대로 읽는 것이다.
      const { data: vocabs } = await supabase
        .from('vocabularies')
        .select('lemma, word')
        .eq('user_id', user.id)
      if (cancelled) return

      const lemmas = ((vocabs ?? []) as Array<{ lemma: string | null; word: string | null }>)
        .map((v) => (v.lemma ?? v.word ?? '').trim().toLowerCase())
        .filter((v) => v.length > 0)

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

  // 세 상태를 한 문장으로 뭉개지 않는다.
  //
  // 예전에는 loading·unauth·error 가 모두 "단어가 누적되면 V-Level 분포가 보여요" 였다.
  // 그래서 **조회가 실패해도 학습자는 "내 단어가 아직 부족한가 보다" 로 읽었다.**
  // 이 프로젝트가 처방 `unavailable` 플래그로 이미 한 번 싸운 침묵과 같은 계열이다.
  if (state.kind === 'loading') {
    return (
      <Frame title="단어 수준 지도">
        <p aria-busy="true" className="font-body text-[13px] text-[var(--t2)]">
          수준 분포를 세는 중…
        </p>
      </Frame>
    )
  }

  if (state.kind === 'unauth' || state.kind === 'error') {
    return (
      <Frame title="단어 수준 지도">
        <p role="status" className="font-body text-[13px] leading-[1.7] text-[var(--t2)] [word-break:keep-all]">
          {state.kind === 'unauth'
            ? '로그인하면 내 수준 분포가 보여요.'
            : '지금 수준 분포를 세지 못했어요. 단어가 사라진 건 아니에요 — 잠시 뒤 다시 열어 주세요.'}
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
      {/* ⚠️ `items-end` 를 주면 안 된다.
          이전 코드는 `flex h-[136px] items-end` 였고, 그러면 열들이 **콘텐츠 높이로 줄어든다**.
          그래서 안쪽 막대 상자의 `h-full` 이 0 으로 붕괴하고, `height: N%` 도 0 이 됐다.
          결과: 화면은 "243개 분류됨" 이라 말하면서 축만 그렸다(실측 2026-08-15 — 막대 0개).
          열은 늘어나야 하고(기본 stretch), 막대 상자가 `flex-1` 로 남은 높이를 가져간다. */}
      <div className="flex h-[136px] gap-2">
        {byLevel.map((count, lv) => {
          const heightPct = max > 0 ? (count / max) * 100 : 0
          const isCurrent = lv === currentVLevel
          const isIPlusOne = lv === iPlusOne
          // 막대 색.
          //
          // 예전에는 현재 레벨·i+1 만 색을 받고 **나머지는 전부 `--ios-gray-3`** 이었다.
          // 그 결과 이 학습자의 실제 분포(V9=94 · V7=50 · V10=38 …)가 배경에 묻혀 안 보이고,
          // 현재 레벨(V11)의 4개만 보였다 — 243개를 세어 놓고 4개짜리 차트를 그린 셈이다.
          // 실측 2026-08-15: 화면이 "243개 분류됨" 이라 말하는데 축만 보였다.
          //
          // 규칙: **데이터가 있으면 보인다.** 강조(현재·i+1)는 그 위에 얹는 두 번째 층이다.
          let bg = 'var(--bg3)'
          if (count > 0) {
            if (isCurrent) bg = 'var(--p)'
            else if (isIPlusOne) bg = 'var(--ios-green)'
            // 기본 막대 — 테마의 잉크를 옅게 섞어 두 테마 모두에서 배경과 분리된다.
            else bg = 'color-mix(in srgb, var(--p) 42%, var(--bg))'
          }
          return (
            <div key={lv} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex w-full flex-1 items-end justify-center">
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
