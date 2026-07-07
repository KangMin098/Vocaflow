// packages/library-pipeline/src/types-article.ts
// ACP v1.0 — 짧은 글(article) 도메인 타입.
// 책(RawBook)과 구조 다름: chapter 없음 · 단일 content unit.

export type ArticleSource =
  | 'voa'
  | 'nasa'
  | 'nih'
  | 'cdc'
  | 'medlineplus'
  | 'simple_wikipedia' // ACP §18 — A2~B1 설명문 갭 (CC-BY-SA)
  | 'the_conversation' // ACP §18 — B2~C1 논증문 (CC-BY-ND → display_only)
  | 'wikinews' // ACP §18 — A2~B2 시사 (CC-BY 2.5)
  | 'owid' // ACP §18 T-2 — B2~C1 데이터 논증문 (CC-BY 4.0 → 발행 허용, argumentative gap 보강)
  | 'openstax' // ACP §19 (설계) — C1 학술 교재 모듈 (CNXML · 현행 CC-BY-NC-SA → 게이트 차단, 라이선스 결정 선행)
  | 'manual'

export interface RawArticle {
  source: ArticleSource
  source_id: string
  source_url: string
  title: string
  author?: string
  language: string
  license: string
  published_at: Date | null
  content: string
  /** ingester 가 알고 있는 사전 추정 CEFR (예: VOA Level 2 → B1). 없으면 analyze 단계에서 자동 감지 */
  estimated_cefr: string | null
  /** v06.45 — article HTML 에서 추출한 audio MP3 URL (도서 LCP librivox_audio 와 동일 패턴).
   *  VOA Learning English = 학습 정체성으로 100% audio.
   *  Lit2Go = passage 별 mp3.
   *  /text/[id] 학습 화면에서 native player 자동 노출 (LibriVox 와 동일 연계). */
  audio_url?: string | null
  fetched_at: Date
}

export interface NormalizedArticle {
  raw: RawArticle
  body: string
  body_hash: string
}

export interface ArticleWord {
  word: string
  frequency_in_article: number
  first_sentence: string
  base_learning_value: number
}

export interface AnalyzedArticle {
  article_id: string
  cefr_level: string
  cefr_confidence: number
  word_count: number
  reading_minutes: number
  words: ArticleWord[]
  llm_cost_usd: number
}
