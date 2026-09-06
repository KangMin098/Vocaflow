// apps/web/src/components/library/vocab/VocabCoverArt.tsx
//
// **표지 도판 — 이제 그린다. 수집하지 않는다.**
//
// ── 무엇이 바뀌었나 (2026-09-07) ────────────────────────────────────
// 지금까지 표지는 Openverse 에서 찾아온 PD 판화 **사진**이었다(`VocabCoverPlate`, 이 커밋에서 삭제).
// 그 방식의 실패가 코드에 기록돼 있다 — 주제별 17권이 검색어 하나를 두고 다퉈
// **한 권만 도판을 받고 열여섯이 그라디언트로 떨어졌다**(`covers/design.ts`).
//
// 이제 Claude Design 캔버스에서 확정한 시각 체계를 코드가 **그린다**
// (`@vocaflow/library-pipeline/vocab-cover-art`). 계열마다 도형 문법이 있고,
// 권마다 슬러그에서 뽑은 시드로 그 문법 안에서 변주된다 — 한 시각 체계, 권마다 다른 판.
//
// ── 색 ─────────────────────────────────────────────────────────────
// 도판은 **선만** 들고 온다. 색은 `FAMILY_GRAIN` 이 토큰에서 읽는다 — 이 저장소가
// 팔레트 사본으로 두 번 어긋난 뒤 정한 규칙이고, 다크 테마가 따라오는 이유이기도 하다.
//
// ── 모션 ───────────────────────────────────────────────────────────
// 없다. 표지는 서가에서 **가만히 있어야** 하는 것이고, 상시 모션은 지침이 금지한다.

import { coverArtFor } from '@vocaflow/library-pipeline/vocab-cover-art'

import { FAMILY_GRAIN, type CoverFamily } from '@/lib/vcb/covers/design'

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
}

/*
  ⚠️ **잉크가 바탕이고 지면이 선이다** — 처음엔 반대로 짰다가 실측에서 되돌렸다(2026-09-07).

  듀오톤의 `paper` 는 사진 위에 얹는 **밝은 쪽 틴트**(#E1E8EF 류)라, 그것을 표지 바탕으로
  깔면 표지가 통째로 창백해진다. 그 위에 흰 세리프 제목이 오는데 대비가 무너졌고, 카드가
  얹는 광택·그레인 레이어가 한 번 더 씻어냈다. 스크린샷으로 보고서야 알았다.

  그래서 바탕을 `ink`, 선을 `paper` 로 뒤집는다 — 시중 단어장 표지가 짙은 색에 밝은 도판을
  얹는 것과 같고, 제목이 읽힌다.
*/
/*
  제목은 표지의 **가운데 아래**에 앉는다(`GradientBookCover`). 그 띠에서 한 번 더 눌러야
  도판 선 위에서도 읽힌다 — 아래로만 어둡게 하면 제목 자리는 그대로 밝다.
*/
const SCRIM = {
  card: 'linear-gradient(180deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.05) 30%, rgba(0,0,0,0.40) 62%, rgba(0,0,0,0.60) 100%)',
  hero: 'linear-gradient(180deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.04) 34%, rgba(0,0,0,0.34) 62%, rgba(0,0,0,0.52) 100%)',
} as const

/**
 * 계열마다 잉크의 밝기가 다르다(`corpus` 는 앰버, `delivery` 는 짙은 네이비). 그대로 두면
 * 어떤 권은 제목이 읽히고 어떤 권은 안 읽힌다 — **한 번 눌러 같은 밝기 띠에 앉힌다.**
 * 색상(hue)은 그대로라 계열 식별은 유지된다.
 */
const DEEPEN = 'linear-gradient(180deg, rgba(12,10,8,0.30) 0%, rgba(12,10,8,0.42) 100%)'

export function VocabCoverArt({ family, artKey, scrim = 'card' }: Props) {
  const fam: CoverFamily = family ?? 'list'
  const grain = FAMILY_GRAIN[fam]
  const art = coverArtFor(fam, artKey)

  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      {/* 바탕 — 계열의 잉크 */}
      <div className="absolute inset-0" style={{ background: grain.ink }} />
      {/* 계열마다 다른 밝기를 같은 띠로 눌러 제목이 늘 읽히게 한다 */}
      <div className="absolute inset-0" style={{ background: DEEPEN }} />

      {/* 판면 괘선 — 시중 표지의 테두리 자리. 도판이 지면에 앉아 있다는 느낌을 준다 */}
      <div
        className="absolute inset-[7%] border"
        style={{ borderColor: grain.paper, opacity: 0.3 }}
      />

      {/* 도판 — 선화만. 짙은 바탕 위에 밝은 선 */}
      <svg
        viewBox={art.viewBox}
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        fill="none"
        stroke={grain.paper}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        // 아래를 크게 비운다 — 제목이 앉는 띠다. 균등 여백이면 도판이 제목과 겹쳐 둘 다 흐려진다.
        style={{ opacity: 0.62, padding: '11% 14% 33%' }}
      >
        {art.paths.map((d, i) => (
          <path key={i} d={d} />
        ))}
        {art.dots.map((dot, i) => (
          <circle key={`d${i}`} cx={dot.cx} cy={dot.cy} r={dot.r} />
        ))}
      </svg>

      <div className="absolute inset-0" style={{ background: SCRIM[scrim] }} />
    </div>
  )
}
