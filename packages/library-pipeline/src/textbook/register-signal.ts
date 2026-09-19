// packages/library-pipeline/src/textbook/register-signal.ts
//
// **논증의 형태를 재는 자 — `register` 컬럼이 재지 않는 것을 잰다.**
//
// ── 왜 이 파일이 생겼나 (실측 2026-09-13) ────────────────────────────
// 이 저장소는 지문의 장르를 `register` 컬럼으로 관리한다. 그 값은 이렇게 정해진다:
//
//   `resolveArticleRegister(source, feedId)` → `FEED_REGISTER[…] ?? SOURCE_REGISTER_DEFAULT[…]`
//
// **본문을 한 글자도 보지 않는다.** 소스·피드 이름으로 찍는 라벨이다. 그래서 이런 일이 생겼다:
//
//   · frontiers 1,958편을 적재했더니 register 가 **전부 expository**(내용과 무관하게)
//   · 그런데 담화 표지로 재니 frontiers 가 기출 중앙 이상 **70%**, plos 가 **72%** 인데
//     선언 argumentative 인 owid 는 **0%**, the_conversation 은 33% 였다
//   · 선언 expository 행 중 **38%** 가 선언 argumentative 의 중앙값을 넘었다(무작위면 50%)
//
// 즉 「논증문이 1,485편뿐이다」는 재고의 성질이 아니라 **라벨링의 결과**였다. 같은 자로 다시 세면
// 변형 가능한 논증형 지문이 **약 23,405편**(15.8배)이다. 그래서 새 소스를 붙이는 일보다
// **이미 가진 것을 재는 일**이 먼저였다.
//
// ── 눈금은 기출이 정한다 ─────────────────────────────────────────────
// 임계값을 짐작으로 정하면 그 뒤 모든 판정이 짐작이 된다. `csat_items` 의 실제 평가원 지문
// **796편**을 같은 자로 재서 중앙값 **5.33**(1,000어당)을 하한으로 쓴다.
// 기출은 평균 189어이고 표지 보유율이 **59%** 뿐이라 **p25 는 0** 이다 — p25 를 임계값으로
// 쓰면 모든 소스가 100% 통과해 자가 아무것도 가르지 않는다(첫 판에 그렇게 나왔다).
//
// ⚠️ **이것은 형태이지 질이 아니다.** 표지가 많아도 엉성한 글이 있고 적어도 촘촘한 글이 있다.
//   결과는 **후보 선별**용이고 최종 판정은 사람·LLM 몫이다. 이 한계를 적어 두지 않으면
//   다음 사람이 점수를 품질로 읽는다.
//
// 순수 함수만 둔다 — 네트워크·DB 를 모른다. 계측은 `scripts/textbook/register-measure-probe.mjs`.

/** 기출 796편 실측 중앙값(1,000어당 담화 표지 수). **짐작이 아니라 측정에서 나온 값.** */
export const CSAT_MARKER_DENSITY_MEDIAN = 5.33

/** 기출 표지 보유율 — 짧은 글에서 밀도보다 안정적인 보조 지표. */
export const CSAT_MARKER_PRESENCE_RATE = 0.59

/** 밀도가 뜻을 잃는 길이. 이보다 짧으면 재지 않는다(`null` 을 낸다). */
export const MIN_MEASURABLE_WORDS = 50

export type MarkerGroupId = 'contrast' | 'concessive' | 'causal' | 'stance' | 'evaluative'

/**
 * 표지를 **묶음**으로 둔다. 낱말 하나의 빈도는 소재에 따라 흔들리지만, 기능이 같은 묶음의 합은
 * 장르를 따라간다. 묶음 이름은 그 기능이 논증에서 하는 일이다.
 */
export const MARKER_GROUPS: Record<MarkerGroupId, readonly string[]> = {
  /** 대조·역접 — 논증은 반대 입장을 세워야 한다 */
  contrast: [
    'however', 'nevertheless', 'nonetheless', 'in contrast', 'by contrast', 'on the contrary',
    'conversely', 'whereas', 'on the other hand', 'rather than', 'instead',
  ],
  /** 양보 — 반론을 인정하고 넘어서는 자리 */
  concessive: [
    'although', 'though', 'even though', 'despite', 'in spite of', 'admittedly',
    'granted that', 'while it is true',
  ],
  /** 인과·귀결 — 주장을 근거에 잇는 자리 */
  causal: [
    'therefore', 'thus', 'hence', 'consequently', 'as a result', 'accordingly',
    'it follows that', 'because of this', 'for this reason',
  ],
  /** 입장 표명 — 누가 무엇을 주장하는가 */
  stance: [
    'argue', 'argues', 'argued', 'claim', 'claims', 'claimed', 'contend', 'contends',
    'assert', 'asserts', 'maintain that', 'posit', 'propose', 'proposes',
  ],
  /** 평가·양태 — 필자의 판단이 드러나는 자리 */
  evaluative: [
    'arguably', 'crucially', 'importantly', 'notably', 'must be', 'should be', 'cannot be',
    'ought to', 'it is clear that', 'far from', 'misleading', 'mistaken',
  ],
}

export const MARKER_GROUP_IDS = Object.keys(MARKER_GROUPS) as MarkerGroupId[]

/**
 * 묶음별 정규식. **낱말 경계를 지킨다** — `(?<![a-z])…(?![a-z])`.
 * 없으면 `claims` 가 `proclaims` 안에서, `thus` 가 `enthusiasm` 안에서 잡힌다.
 * 구(phrase)의 공백은 `\s+` 로 두어 줄바꿈이 끼어도 잡는다.
 */
const GROUP_RE: Record<MarkerGroupId, RegExp> = Object.fromEntries(
  MARKER_GROUP_IDS.map((g) => [
    g,
    new RegExp(
      '(?<![a-z])(?:' + MARKER_GROUPS[g].map((w) => w.replace(/ /g, '\\s+')).join('|') + ')(?![a-z])',
      'gi',
    ),
  ]),
) as Record<MarkerGroupId, RegExp>

export const countWords = (s: string): number => (s ? s.split(/\s+/).filter(Boolean).length : 0)

export interface RegisterSignal {
  words: number
  /** 묶음별 1,000어당 표지 수 */
  per: Record<MarkerGroupId, number>
  /** 전체 1,000어당 표지 수 */
  density: number
  /** 표지를 하나라도 가졌는가 — 짧은 글에서 밀도보다 튼튼하다 */
  present: boolean
  /** 기출 중앙값 이상인가 — 후보 선별의 기본 관문 */
  atOrAboveCsatMedian: boolean
}

/**
 * 담화 표지 밀도. **어수로 나눈다** — 나누지 않으면 긴 글이 자동으로 높은 점수를 받아
 * 자가 장르가 아니라 길이를 재게 된다.
 *
 * @returns 너무 짧으면 `null`. 0 을 돌려주면 "표지 없음" 과 "잴 수 없음" 이 섞인다.
 */
export function measureRegisterSignal(text: string): RegisterSignal | null {
  const words = countWords(text)
  if (words < MIN_MEASURABLE_WORDS) return null
  const per = {} as Record<MarkerGroupId, number>
  let total = 0
  for (const g of MARKER_GROUP_IDS) {
    const n = (text.match(GROUP_RE[g]) ?? []).length
    per[g] = Number(((1000 * n) / words).toFixed(2))
    total += n
  }
  const density = Number(((1000 * total) / words).toFixed(2))
  return {
    words,
    per,
    density,
    present: total > 0,
    atOrAboveCsatMedian: density >= CSAT_MARKER_DENSITY_MEDIAN,
  }
}
