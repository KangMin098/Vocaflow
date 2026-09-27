// packages/library-pipeline/src/ingest-article/short-body.ts
//
// 본문이 하한보다 짧을 때 던지는 **형이 있는** 오류.
//
// ── 왜 문자열 오류로 두지 않는가 (사용자 결정 2026-09-23 · 재확인 2026-09-24) ──
// "길이로 원문을 제외하지 않는다"(docs/SOURCE_INTAKE_DESIGN.md). 예전에는 수집기가
// `... body too short ...` 를 던지면 호출자가 글을 **기록 없이** 잃었다 — 일일 수집은
// 실패 줄만 찍고 매일 다시 받았고, 심층 수확기는 `seen` 에 적어 다시는 받지 않았다.
// 이 오류는 이미 뽑은 본문과 기사 필드를 들고 나가서, 호출자가 `queued` 로 **저장**하고
// 내용 판정에 넘길 수 있게 한다.
//
// ── 하한은 왜 남기는가 ──
// 하한은 원문을 거르려고가 아니라 **파서 고장을 잡으려고** 있다(NOAA 0어 · NASA 크롬
// · OWID 파괴 본문 회귀). 그래서 오류는 그대로 던지고, 메시지에는 지금처럼
// "too short" / "너무 짧다" 가 남는다(회귀와 `isTransientHarvestError` 가 문자열을 본다).
// 본문이 **빈** 경우(0어)는 저장할 것이 없다 — 호출자는 저장하지 않고, 파서를 고치면
// 되살릴 수 있게 영구 `seen` 에도 넣지 않는다.

import type { RawArticle } from '../types-article'

export interface ShortBodyDetail {
  source: string
  url: string
  content: string
  /** 이미 조립한 기사. 본문이 비었어도 들고 나간다 — 저장 여부는 호출자가 `isEmpty` 로 가른다. */
  article?: RawArticle | null
  /** 소스별 부가 축(예: VOA `articleSection`). 짧아서 던진 뒤에도 분류가 같은 답을 내게 한다. */
  extra?: Record<string, unknown> | null
}

export class ShortBodyError extends Error {
  readonly source: string
  readonly url: string
  readonly content: string
  readonly words: number
  readonly chars: number
  readonly article: RawArticle | null
  readonly extra: Record<string, unknown> | null

  constructor(message: string, detail: ShortBodyDetail) {
    super(message)
    this.name = 'ShortBodyError'
    this.source = detail.source
    this.url = detail.url
    this.content = detail.content.trim()
    this.words = this.content ? this.content.split(/\s+/).filter(Boolean).length : 0
    this.chars = this.content.length
    this.article = detail.article ?? null
    this.extra = detail.extra ?? null
  }

  /** 저장할 본문이 없다 — 파서 확인 대상. */
  get isEmpty(): boolean {
    return this.words === 0
  }
}

/**
 * `instanceof` 만으로는 부족하다 — 패키지가 두 경로(소스 · 번들)로 불리면 클래스가
 * 둘이 된다. 이름과 필드 모양으로도 알아본다.
 */
export function isShortBodyError(e: unknown): e is ShortBodyError {
  if (e instanceof ShortBodyError) return true
  if (!e || typeof e !== 'object') return false
  const o = e as { name?: unknown; content?: unknown; words?: unknown }
  return o.name === 'ShortBodyError' && typeof o.content === 'string' && typeof o.words === 'number'
}
