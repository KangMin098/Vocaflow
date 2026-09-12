// apps/web/src/components/wordvault/hub/VocabularyLevelMap.tsx
//
// WordVault Section 2 (v06.36) — 단어 수준 지도.
// iOS 프리미티브 사용 (Frame / Capsule / InsetGroup / InsetRow).
//
// ── 2026-09-05 — 조회를 서버로 옮겼다 ─────────────────────────────────
// 이 섹션은 `vocabularies` 를 **전량 한 번 더** 내려받고(허브가 이미 받은 것과 같은 표)
// `shared_dictionary` 를 500개씩 **직렬 루프**로 쳤다. 1,945단어 계정에서 연속 왕복 4회다.
// 지금은 `lib/wordvault/hub-query.ts` 가 허브가 이미 읽은 lemma 로 사전만 친다.
// 남은 것은 그리기뿐이라 상태 분기도 세 갈래에서 두 갈래(못 셌다 / 분류된 게 없다)로 준다.

import { Capsule, Frame, InsetGroup, InsetRow } from '@/components/ui/ios'
import type { LevelMapData } from '@/lib/wordvault/hub-query'

const TRACK_LABEL: Record<string, string> = {
  csat_korean: '수능',
  business: '비즈니스',
  academic: '학술',
}

const NF = new Intl.NumberFormat('en-US')

interface VocabularyLevelMapProps {
  data: LevelMapData
}

export function VocabularyLevelMap({ data }: VocabularyLevelMapProps) {
  // 실패를 "아직 단어가 부족한가 보다" 로 읽히게 두지 않는다 — 이 프로젝트가 처방
  // `unavailable` 플래그로 이미 한 번 싸운 침묵과 같은 계열이다.
  if (data.failed) {
    return (
      <Frame title="단어 수준 지도">
        <p role="status" className="font-body text-[13px] leading-[1.7] text-[var(--t2)] [word-break:keep-all]">
          지금 수준 분포를 세지 못했어요. 단어가 사라진 건 아니에요 — 잠시 뒤 다시 열어 주세요.
        </p>
      </Frame>
    )
  }

  if (data.totalWithLevel === 0) {
    return (
      <Frame title="단어 수준 지도">
        <p className="font-body text-[13px] text-[var(--t2)]">사전 매칭된 단어가 없어요.</p>
      </Frame>
    )
  }

  const { byLevel, currentVLevel, trackLevels, totalWithLevel } = data
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
