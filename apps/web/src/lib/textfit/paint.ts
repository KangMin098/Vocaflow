// apps/web/src/lib/textfit/paint.ts
//
// **지문을 칠한다** — 원문을 낱말/비낱말 조각으로 나누고, 낱말마다 사전 V-Level 을 붙인다.
//
// 랜딩 히어로(`lib/marketing/hero-demo.ts`)와 `/fit`(2026-09-19 발산 A 「칠해지는 입력칸」)이
// 같은 규칙으로 칠해야 한다 — 광고와 도구가 같은 몸짓이어야 한다는 것이 `/fit` 재설계의 이유다
// (`docs/design/compare/fit.md`). 그래서 조각 규칙을 여기 한 곳에 둔다.
//
// ⚠️ 이 파일은 클라이언트에서도 쓴다 — 서버 전용 모듈(analyze · supabase)을 import 하지 않는다.
// ⚠️ `/fit` 은 지문 원문을 서버로 보내지 않는다(빈도표만). 그래서 서버는 **표면형 → 레벨 표**만
//    돌려주고, 칠하기는 원문을 가진 브라우저가 한다.

/** 소문자 표면형 → V-Level. `null` = 실재하지만 레벨 미상. 표에 없으면 학습 대상이 아니다(기능어 등). */
export type SurfaceLevels = Record<string, number | null>

/** 화면에 그려질 조각 하나 — 낱말이거나 그 사이의 공백·문장부호다. */
export interface PaintToken {
  /** 원문 표면형 그대로 (대소문자·문장부호 보존) */
  t: string
  /**
   * 사전 V-Level. `null` 은 **레벨 미상**, `undefined` 는 학습 대상이 아니다(기능어·문장부호·공백).
   */
  v?: number | null
}

/**
 * 원문을 낱말 / 비낱말로 쪼갠다 — 순서와 문장부호를 그대로 살려 다시 그려야 한다.
 * **이어 붙이면 원문과 글자 하나까지 같아야 한다**(지문을 조용히 잘라 놓고 그 지문의
 * 커버리지라고 말하면 안 된다). 회귀가 그것을 잰다.
 */
export function splitSurface(text: string): string[] {
  return text.split(/([A-Za-z]+(?:'[A-Za-z]+)?)/).filter((s) => s.length > 0)
}

/** 원문 + 레벨 표 → 칠할 조각들. 표에 없는 낱말은 칠하지 않는다(학습 대상이 아니다). */
export function paintTokens(text: string, surfaces: SurfaceLevels): PaintToken[] {
  return splitSurface(text).map((piece) => {
    if (!/^[A-Za-z]/.test(piece)) return { t: piece }
    const key = piece.toLowerCase()
    if (!Object.prototype.hasOwnProperty.call(surfaces, key)) return { t: piece }
    return { t: piece, v: surfaces[key] }
  })
}

/** 이 학년에서 처음 만나는 낱말인가 — 레벨 미상은 안다고도 모른다고도 하지 않는다. */
export function isUnknownAt(token: PaintToken, level: number): boolean {
  return typeof token.v === 'number' && token.v > level
}

/** 이 학년에서 처음 만나는 낱말의 **서로 다른** 개수(소문자 기준). */
export function countUnknownTypes(tokens: PaintToken[], level: number): number {
  const seen = new Set<string>()
  for (const tok of tokens) if (isUnknownAt(tok, level)) seen.add(tok.t.toLowerCase())
  return seen.size
}
