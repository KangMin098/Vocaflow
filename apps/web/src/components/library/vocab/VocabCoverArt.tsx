// apps/web/src/components/library/vocab/VocabCoverArt.tsx
//
// **표지 도판 — 이제 그린다. 수집하지 않는다.**
//
// ── 무엇이 바뀌었나 (2026-09-07) ────────────────────────────────────
// 지금까지 표지는 Openverse 에서 찾아온 PD 판화 **사진**이었다(`VocabCoverPlate`, 삭제됨).
// 그 방식의 실패가 코드에 기록돼 있다 — 주제별 17권이 검색어 하나를 두고 다퉈
// **한 권만 도판을 받고 열여섯이 그라디언트로 떨어졌다**(`covers/design.ts`).
//
// 이제 Claude Design 캔버스에서 확정한 시각 체계를 코드가 **그린다**
// (`@vocaflow/library-pipeline/vocab-cover-art`). 계열마다 도형 문법이 있고,
// 권마다 슬러그에서 뽑은 시드로 그 문법 안에서 변주된다 — 한 시각 체계, 권마다 다른 판.
//
// ── 규격이 화면을 움직인다 (2026-09-07, 같은 날 두 번째) ─────────────
// 도판은 그렇게 규격을 따라갔지만 **규격의 나머지는 적재만 되고 읽히지 않았다** —
// kicker · 권 번호 표기 · 도판 여백 · 스크림 · 서체 역할 · 계열 줄. 여덟 중 하나만 살아 있었다.
// 이제 `lockup` 이 그 전부를 들고 온다(`covers/lockup.ts`). 각인이 없는 권에는 `null` 이
// 오고, 그때는 **그 요소들을 그리지 않는다** — 코드가 대신 지어내면 캔버스가 다시 장식이 된다.
//
// ── 색 ─────────────────────────────────────────────────────────────
// 도판은 **선만** 들고 온다. 색은 규격이 가리키는 역할을 토큰에서 풀어 칠한다
// (`resolveBrandColors`) — 이 저장소가 팔레트 사본으로 두 번 어긋난 뒤 정한 규칙이다.
//
// ── 모션 ───────────────────────────────────────────────────────────
// 없다. 표지는 서가에서 **가만히 있어야** 하는 것이고, 상시 모션은 지침이 금지한다.

import { coverArtFor } from '@vocaflow/library-pipeline/vocab-cover-art'

import {
  deepenCss, PLATE_INSET_FALLBACK, PLATE_TITLE_BAND, scrimCss,
} from '@/lib/vcb/covers/contrast'
import { FAMILY_GRAIN, type CoverFamily } from '@/lib/vcb/covers/design'
import { volumeLabel, type CoverLockup } from '@/lib/vcb/covers/lockup'

interface Props {
  /** 계열 — 도형 문법과 듀오톤이 여기서 온다. 모르면 `list` 로 떨어진다. */
  family: CoverFamily | null | undefined
  /**
   * 이 권을 가르는 열쇠. **슬러그를 넣는다** — id 를 넣으면 재발행 때 표지가 바뀌는데
   * 학습자에게는 같은 책이다. 슬러그가 없으면 제목으로 떨어진다.
   */
  artKey: string
  /** 아래쪽 어둡기 — 제목이 도판 위에서 읽혀야 한다. 캐러셀은 제목이 더 커서 약하게 누른다. */
  scrim?: 'card' | 'hero'
  /** 표지 규격(브랜드 각인). 없으면 kicker·권 번호·계열 줄을 그리지 않는다. */
  lockup?: CoverLockup | null
  /**
   * 권 번호 자리에 찍을 표시 — **계단 번호가 아니라 권 이름**이다.
   * 호출부가 `volumeMark(rung.volumeTitle)` 로 뽑아 넘긴다(`lockup.ts` 주석의 그 함정).
   */
  volumeMark?: string | null
  /**
   * 규격의 **글자**(kicker · 권 번호 · 계열 줄)를 그릴 것인가. 색·여백·스크림 같은 값은
   * 이 스위치와 무관하게 늘 적용된다.
   *
   * ── 왜 스위치가 필요한가 (실측 2026-09-07) ─────────────────────────
   * 캔버스는 **아무것도 얹히지 않은 480×640 표지**를 그렸다. 그런데 격자 타일의 표지는
   * 150px 이고 **네 귀퉁이가 이미 차 있다**:
   *   좌상 구독/신규 칩 · 우상 사다리 칩(`5단 · 고1`) · 좌하 카테고리+구독수 칩 ·
   *   우하 추가/제외 버튼(hover). 남는 띠는 도판과 제목이 쓰는 가운데뿐이다.
   * 거기에 kicker 를 얹으면 좌상 칩과 **겹치고**(둘 다 y 12~32), 권 번호는 사다리 칩과
   * 같은 자리에서 **다른 수**를 말한다(`VOL. 4` vs `5단`) — 교재 표지가 값을 치른 그 결함이다.
   *
   * 그래서 타일에서는 글자를 그리지 않는다. **자리가 없다는 사실을 코드가 말하게 두는 것**이,
   * 겹쳐 그려 놓고 규격을 지켰다고 하는 것보다 정직하다. 칩을 걷어내는 것은 별건의 결정이다.
   */
  drawLockup?: boolean
}

/*
  ⚠️ **잉크가 바탕이고 지면이 선이다** — 처음엔 반대로 짰다가 실측에서 되돌렸다(2026-09-07).

  듀오톤의 `paper` 는 사진 위에 얹는 **밝은 쪽 틴트**(#E1E8EF 류)라, 그것을 표지 바탕으로
  깔면 표지가 통째로 창백해진다. 그 위에 흰 세리프 제목이 오는데 대비가 무너졌고, 카드가
  얹는 광택·그레인 레이어가 한 번 더 씻어냈다. 스크린샷으로 보고서야 알았다.

  **층 값은 여기 없다** — `covers/contrast.ts` 가 갖고 있고 회귀가 같은 값으로 대비를 잰다.
  값을 여기 두면 회귀는 사본을 재게 되고, 사본은 반드시 갈린다.
*/

export function VocabCoverArt({
  family, artKey, scrim = 'card', lockup = null, volumeMark = null, drawLockup = true,
}: Props) {
  const fam: CoverFamily = lockup?.family ?? family ?? 'list'
  const grain = FAMILY_GRAIN[fam]
  const art = coverArtFor(fam, artKey)

  // 규격이 있으면 규격의 색이다 — 역할(`palette.ink`/`paper`)을 따라 푼 값이라
  // 규격이 둘을 바꿔 적으면 표지도 바뀐다. 없으면 계열 기본 듀오톤.
  const ink = lockup?.ink ?? grain.ink
  const paper = lockup?.paper ?? grain.paper

  const inset = lockup?.plateInset ?? PLATE_INSET_FALLBACK
  const compact = scrim === 'card'
  const volume = lockup ? volumeLabel(lockup.volumeFormat, volumeMark) : null

  // 규격의 글자는 판면 괘선(inset 7%) **안쪽**에 앉는다 — 괘선 위에 걸치면 둘 다 지저분해진다.
  const railPad = compact ? 'px-[11%] pt-[9%]' : 'px-[10%] pt-[8.5%]'

  return (
    // 표지 글자는 전부 카드 본문이 이미 말한 것이다(제목·시리즈·계열). 두 번 읽히면
    // 스크린리더가 한 권을 세 번 말한다 — 보이는 자리에만 두고 읽기에서는 뺀다.
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      {/* 바탕 — 계열의 잉크 */}
      <div className="absolute inset-0" style={{ background: ink }} />
      {/* 계열마다 다른 밝기를 같은 띠로 눌러 제목이 늘 읽히게 한다 */}
      <div className="absolute inset-0" style={{ background: deepenCss() }} />

      {/* 판면 괘선 — 시중 표지의 테두리 자리. 도판이 지면에 앉아 있다는 느낌을 준다 */}
      <div className="absolute inset-[7%] border" style={{ borderColor: paper, opacity: 0.3 }} />

      {/* 도판 — 선화만. 짙은 바탕 위에 밝은 선 */}
      <svg
        viewBox={art.viewBox}
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        fill="none"
        stroke={paper}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        // 아래를 크게 비운다 — 제목이 앉는 띠다. 균등 여백이면 도판이 제목과 겹쳐 둘 다 흐려진다.
        style={{ opacity: 0.62, padding: `${inset}% ${inset}% ${PLATE_TITLE_BAND}%` }}
      >
        {art.paths.map((d, i) => (
          <path key={i} d={d} />
        ))}
        {art.dots.map((dot, i) => (
          <circle key={`d${i}`} cx={dot.cx} cy={dot.cy} r={dot.r} />
        ))}
      </svg>

      <div className="absolute inset-0" style={{ background: scrimCss(scrim, lockup?.scrimStrength) }} />

      {/*
        규격의 글자 — 스크림 **위**에 온다. 아래에 두면 자기가 만든 어둠에 자기가 묻힌다.

        위: kicker(왼쪽) + 권 번호(오른쪽). 시중 표지가 시리즈와 권을 두는 자리 그대로다.
        아래: 계열 줄. 표지에서 **색이 무엇을 뜻하는지** 말하는 유일한 글자다
             — 이것이 없으면 다섯 색은 그냥 예쁜 색이고, 규격이 노린 "색만 보고 계열을 안다" 가
             학습자에게 도달하지 않는다.
      */}
      {lockup && drawLockup && (
        <>
          <div
            className={`absolute inset-x-0 top-0 flex items-baseline justify-between gap-2 ${railPad}`}
          >
            <span
              className={`truncate ${lockup.fontClass.numerals} ${
                compact ? 'text-[7.5px] tracking-[0.16em]' : 'text-[9.5px] tracking-[0.18em]'
              }`}
              style={{ color: paper, opacity: 0.85 }}
            >
              {lockup.kicker}
            </span>
            {volume && (
              <span
                className={`shrink-0 tabular-nums ${lockup.fontClass.numerals} ${
                  compact ? 'text-[7.5px]' : 'text-[9.5px]'
                }`}
                style={{ color: paper, opacity: 0.85 }}
              >
                {volume}
              </span>
            )}
          </div>

          <p
            className={`absolute inset-x-0 bottom-0 truncate text-center ${lockup.fontClass.body} ${
              compact ? 'px-[11%] pb-[7%] text-[7.5px] tracking-[0.14em]' : 'px-[10%] pb-[6.5%] text-[9.5px] tracking-[0.16em]'
            }`}
            style={{ color: paper, opacity: 0.8 }}
          >
            {lockup.seriesLine}
          </p>
        </>
      )}
    </div>
  )
}
