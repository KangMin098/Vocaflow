// packages/video-factory/src/render/loudness.ts
//
// **음량 규격 — 순수부.** ffmpeg 를 부르지 않는다(그래서 회귀가 붙는다).
//
// ── 왜 이게 품질 축인가 (실측 2026-09-13) ──────────────────────────
// 찍어 둔 영상을 재 보니 **-16.5 ~ -19.6 LUFS** 였다. YouTube 의 재생 목표는 **-14 LUFS** 이고,
// 결정적으로 **큰 소리는 줄이지만 작은 소리는 키워 주지 않는다.** 즉 우리 영상은 같은 피드에서
// 경쟁 광고보다 **작게 재생된다** — 소리를 키우려 손이 한 번 더 가는 사이에 넘겨진다.
// 게다가 편끼리 **3.1 LU** 나 벌어져서, 우리 영상 두 편을 이어 보면 음량이 튄다.
//
// 이건 취향이 아니라 **공개된 규격**이다. 그래서 이 축에서만은 "시중 대비" 를 숫자로 말할 수 있다 —
// 나머지 축(카피·구성·색)은 경쟁사 파이프라인을 관측할 수 없어 비교가 성립하지 않는다.

/** YouTube 재생 목표(LUFS). 출처: YouTube 라우드니스 정규화 규격, 2026-09-13 확인. */
export const TARGET_LUFS = -14
/** 트루 피크 상한(dBTP). 재인코딩에서 깨지지 않도록 같은 규격이 권하는 여유. */
export const TARGET_TP = -1
/**
 * 허용 오차(LU). `loudnorm` 2패스의 실측 재현 오차가 이 안에 든다 —
 * 더 좁히면 통과 못 하는 편이 생기는데 그건 품질 문제가 아니라 **자의 문제**다.
 */
export const TOLERANCE_LU = 1.0

export interface Loudness {
  file: string
  /** 통합 음량(LUFS). 못 재면 null. */
  integrated: number | null
  /** 트루 피크(dBTP). */
  truePeak: number | null
  /** 음량 범위(LU) — 작을수록 고르다. */
  range: number | null
}

const num = (s: string | undefined): number | null => {
  if (s === undefined) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/**
 * `loudnorm=print_format=summary` 출력에서 세 값을 꺼낸다.
 *
 * ⚠️ **`Input` 만 읽는다.** 같은 출력에 `Output Integrated` 도 찍히는데, 그건 필터를 **통과시켰다면**
 * 나왔을 값이라 분석 실행에서도 늘 -14 근처다. 그걸 읽으면 **무엇을 재도 합격**한다.
 */
export function parseLoudness(file: string, text: string): Loudness {
  const grab = (label: string): number | null => {
    // ⚠️ **`String.raw` 가 필요하다.** 보통 템플릿 리터럴에 쓰면 `\s` 가 `s` 로 줄어
    //    `^s*Input Integrated:` 가 되고 — 무엇을 재도 안 맞아 **186편 전부 «못 잼»** 이 된다
    //    (실측 2026-09-13에 실제로 그랬다).
    // 값은 **같은 줄**에서만 찾는다(`[^\S\n]` = 줄바꿈 아닌 공백). 줄을 넘기면 다음 항목의 수를 집는다.
    const re = new RegExp(String.raw`^[^\S\n]*${label}:[^\S\n]*(-?[\d.]+|-?inf)`, 'm')
    return num(text.match(re)?.[1])
  }
  return {
    file,
    integrated: grab('Input Integrated'),
    truePeak: grab('Input True Peak'),
    range: grab('Input LRA'),
  }
}

/** 규격 안인가. **못 쟀으면 `null`** — 통과도 실패도 아니다(0 으로 세면 조용히 합격한다). */
export function withinSpec(l: Loudness): boolean | null {
  if (l.integrated === null || l.truePeak === null) return null
  return Math.abs(l.integrated - TARGET_LUFS) <= TOLERANCE_LU && l.truePeak <= TARGET_TP
}

/** 목표에서 얼마나 벗어났나(LU, 부호 있음). 음수면 목표보다 조용하다. */
export function offsetFromTarget(l: Loudness): number | null {
  return l.integrated === null ? null : Number((l.integrated - TARGET_LUFS).toFixed(1))
}

/**
 * 편끼리 얼마나 벌어졌나(LU). **한 편의 음량만큼 중요하다** — 값이 크면 이어 볼 때 튄다.
 * 잰 것이 없으면 null.
 */
export function spread(list: Loudness[]): number | null {
  const v = list.map((l) => l.integrated).filter((n): n is number => n !== null)
  if (v.length === 0) return null
  return Number((Math.max(...v) - Math.min(...v)).toFixed(1))
}

export interface LoudnessReport {
  measured: number
  pass: number
  fail: number
  /** 못 잰 것 — 합격으로도 불합격으로도 세지 않는다. */
  unknown: number
  spreadLu: number | null
  worst: Loudness | null
}

/** 목록 전체의 판정. 화면·CLI·회귀가 같은 함수를 쓴다. */
export function report(list: Loudness[]): LoudnessReport {
  let pass = 0
  let fail = 0
  let unknown = 0
  let worst: Loudness | null = null
  for (const l of list) {
    const v = withinSpec(l)
    if (v === null) {
      unknown++
      continue
    }
    if (v) pass++
    else {
      fail++
      const d = Math.abs((l.integrated ?? 0) - TARGET_LUFS)
      const wd = worst ? Math.abs((worst.integrated ?? 0) - TARGET_LUFS) : -1
      if (d > wd) worst = l
    }
  }
  return { measured: list.length, pass, fail, unknown, spreadLu: spread(list), worst }
}
