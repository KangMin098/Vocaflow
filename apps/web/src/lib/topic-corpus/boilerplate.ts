// apps/web/src/lib/topic-corpus/boilerplate.ts
//
// 상용구 제거 — 같은 출처의 문서들에 **그대로 반복되는 줄**을 본문에서 걷어낸다.
//
// ── 왜 필요한가 (실측 2026-08-16) ──
// 1회차 수확 뒤 주제별 상위 단어를 보니 신호가 둘로 갈렸다:
//   · NOAA  → atmospheric · celsius · dioxide · hemisphere · radiate   (정확)
//   · OWID  → cite · browse · thanks · comment · acknowledgment        (사이트 상용구)
//   · VOA   → dictionary · word · expression · learning                (교재 메타 어휘)
//
// salience 는 제 일을 정확히 했다 — "이 출처에서만 유독 잦은 것" 을 찾았고, 하필 그게
// 각 사이트가 모든 글 밑에 붙이는 문구였다. 알고리즘이 아니라 **입력이 오염된** 것이다.
// 이대로 승격하면 `politics-and-society-social-issues` 에 'cite·browse' 가,
// `culture-tv-radio-and-news` 에 'dictionary·word' 가 들어간다 — 주제 분류를 넓히려다 더럽힌다.
//
// ── 무엇을 근거로 거르나 ──
// DB 실측으로 확인한 오염의 모양은 **줄 단위 완전 일치 반복**이었다. 출처별로:
//   · OWID  "Cite this articleReuse our work freely"(8/8편) · "Browse past versions"(8/8) ·
//           "Subscribe to our newsletters"(6/8) · "Acknowledgments"(8/8)
//   · VOA   "... wrote this story for VOA Learning English."(8편) ·
//           "And now, Words and Their Stories, from VOA Learning English."(7편) · 구분선 다수
// 그래서 판정 기준은 **"같은 출처의 여러 문서에 똑같이 나타나는 줄"** 하나로 충분하다.
// 단어 빈도 통계로 사후에 추정하지 않는다 — 그 방식은 'temperature'(NOAA 전 문서에 정당하게
// 등장)처럼 **모든 문서에 나오는 핵심 주제어**를 상용구로 오인한다.
//
// ── 보수적으로 만든 이유 ──
// 과하게 지우면 본문이 사라지고, 그건 통계가 조용히 줄어드는 형태로만 드러난다(눈에 안 띈다).
// 그래서 ① 완전 일치만 ② 최소 3개 문서 ③ 문서가 3편 미만인 출처는 아예 적용하지 않는다.

/** 상용구로 판정하기 위한 최소 문서 수 — 2편에서 겹치는 것은 우연일 수 있다. */
const MIN_DOCS = 3

/** 이 비율 이상의 문서에 나타나야 상용구. 문서가 많은 출처에서 우연 일치를 막는다. */
const MIN_RATIO = 0.2

/**
 * 너무 짧은 줄은 판정에서 제외한다 — "2020" · "Note" 같은 조각은 본문에도 흔히 나온다.
 * (제거 대상에서 빼는 것이지, 통계에서 빼는 것이 아니다.)
 */
const MIN_LINE_CHARS = 10

/** 정규화 — 앞뒤 공백·연속 공백·아포스트로피 변종만 접는다. 내용은 바꾸지 않는다. */
function normalizeLine(line: string): string {
  return line.replace(/[‘’ʼ]/g, "'").replace(/\s+/g, ' ').trim()
}

/**
 * 같은 출처 문서들에서 반복되는 줄을 찾는다.
 *
 * @param docs 같은 출처의 본문들 (메모리 전용 — 저장하지 않는다)
 * @returns 상용구로 판정된 줄의 정규화 집합
 */
export function detectBoilerplateLines(docs: string[]): Set<string> {
  const found = new Set<string>()
  if (docs.length < MIN_DOCS) return found

  // 줄 → 그 줄이 나타난 문서 수. 한 문서 안에서 여러 번 나와도 1 로 센다.
  const docCount = new Map<string, number>()

  for (const doc of docs) {
    const seen = new Set<string>()
    for (const raw of (doc ?? '').split(/\r?\n/)) {
      const line = normalizeLine(raw)
      if (line.length < MIN_LINE_CHARS) continue
      seen.add(line)
    }
    for (const line of seen) {
      docCount.set(line, (docCount.get(line) ?? 0) + 1)
    }
  }

  const threshold = Math.max(MIN_DOCS, Math.ceil(docs.length * MIN_RATIO))
  for (const [line, n] of docCount) {
    if (n >= threshold) found.add(line)
  }
  return found
}

/** 상용구 줄을 걷어낸 본문. 줄 수가 아니라 **내용**만 줄어든다. */
export function stripBoilerplate(text: string, boilerplate: Set<string>): string {
  if (boilerplate.size === 0) return text
  return (text ?? '')
    .split(/\r?\n/)
    .filter((raw) => !boilerplate.has(normalizeLine(raw)))
    .join('\n')
}

/** 제거 효과 — 얼마나 걷어냈는지 보고용. 0 이면 그 출처엔 상용구가 없었다는 뜻이다. */
export interface BoilerplateReport {
  lines: number
  removedChars: number
}

export function boilerplateReport(text: string, boilerplate: Set<string>): BoilerplateReport {
  const before = (text ?? '').length
  const after = stripBoilerplate(text, boilerplate).length
  let lines = 0
  for (const raw of (text ?? '').split(/\r?\n/)) {
    if (boilerplate.has(normalizeLine(raw))) lines += 1
  }
  return { lines, removedChars: before - after }
}
