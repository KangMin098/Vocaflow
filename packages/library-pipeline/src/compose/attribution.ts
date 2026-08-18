// packages/library-pipeline/src/compose/attribution.ts
//
// ACP §20 — 재저작 글의 사실 출처 표기.
//
// ── 왜 본문 안인가 ──────────────────────────────────────────────────
// 학습자가 재저작 글을 만나는 표면이 셋이다(카탈로그 카드 → texts 변환 → 리더). 출처를 별도
// 필드로 두면 세 곳에 각각 배선해야 하고, 한 곳이라도 빠지면 **출처 없는 재저작 글**이
// 학습자에게 도달한다. 본문에 두면 배선이 필요 없다. 카드 설명문(`SOURCE_META.original`)이
// 이미 "사실 출처는 글 안에 표기해요" 라고 약속하고 있기도 하다.
//
// 학습 가치로도 맞다 — 사실 기반 지문에서 출처 확인은 읽기 능력의 일부다.
//
// ── 왜 대조에서는 빼야 하는가 (실측 2026-08-18) ──────────────────────
// 출처 문구를 붙인 첫 실행에서 **I17 서가 중복이 두 판을 모두 차단했다.** 같은 취재 묶음의
// 형제 판끼리 22어절이 그대로 겹쳤는데, 겹친 것이 바로 이 상용구였다. 우리가 스스로 붙인
// 문장은 표절의 증거가 아니다 — 지문을 만들 때는 반드시 떼고 잰다.

/** 표기 문장의 고정 머리. 이 문자열로 기존 표기를 찾아 갈아 끼운다. */
export const ATTRIBUTION_PREFIX = 'Facts in this story were confirmed in reporting by'

/**
 * 적응(쉬운 판) 표기의 머리.
 *
 * 재저작과 **다른 말을 해야 한다** — 재저작은 사실만 가져와 우리가 쓴 글이고, 적응은
 * 그 발행사의 글을 쉽게 고쳐 쓴 글이다. 같은 문구를 쓰면 학습자에게 거짓을 말하는 것이다.
 */
export const ADAPTATION_PREFIX = 'This is an easier version of an article by'

/** 원본 발행사 → 적응 표기 한 줄. */
export function buildAdaptationAttribution(publisher: string, url?: string): string {
  if (!publisher.trim()) return ''
  const where = url && /^https?:/i.test(url) ? ` (${url})` : ''
  return `${ADAPTATION_PREFIX} ${publisher}${where}. Vocaflow rewrote it for easier reading.`
}

/** 발행사 목록 → 표기 문단 한 줄. */
export function buildAttribution(publishers: ReadonlyArray<string>): string {
  if (publishers.length === 0) return ''
  const names =
    publishers.length === 1
      ? publishers[0]!
      : `${publishers.slice(0, -1).join(', ')} and ${publishers[publishers.length - 1]!}`
  return `${ATTRIBUTION_PREFIX} ${names}. Vocaflow wrote this text from those facts.`
}

/**
 * 본문에서 표기 문단을 떼어 낸다.
 *
 * 지문·중복 대조 전에 반드시 거친다. 빈 줄로 떨어진 한 문단이므로 문단 단위로 걸러 낸다.
 */
export function stripAttribution(body: string): string {
  return body
    .split(/\n\s*\n/)
    .filter((p) => {
      const t = p.trim()
      return !t.startsWith(ATTRIBUTION_PREFIX) && !t.startsWith(ADAPTATION_PREFIX)
    })
    .join('\n\n')
    .trimEnd()
}

/**
 * 본문 끝에 표기 문단을 붙인다(멱등 — 이미 있으면 갈아 끼운다).
 *
 * 빈 줄로 떼어 놓아 DCP 문단 적격에서 자연히 빠진다(1문장 문단은 4~6문장 조건을 못 넘는다).
 */
export function withAttribution(body: string, publishers: ReadonlyArray<string>): string {
  const stripped = stripAttribution(body)
  const line = buildAttribution(publishers)
  return line ? `${stripped}\n\n${line}` : stripped
}
