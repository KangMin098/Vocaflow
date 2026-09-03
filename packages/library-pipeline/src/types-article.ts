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
  | 'factbook' // ACP §18 — B1~B2 국가 개요 참고문 (PD US Gov → 발행 허용, reference gap 보강)
  | 'elife' // ACP §18 — B2~C1 과학 digest (편집자 저작 요약 · CC-BY 4.0 → 발행 허용)
  | 'wikipedia' // ACP §18 — B2~C1 정규 백과 FA/GA (CC-BY-SA → 발행 허용, Simple 대비 심화)
  | 'plos' // ACP §18 — C1~C2 오픈 학술 논문 (CC-BY → 발행 허용, S4 킬러급 심화)
  | 'wikivoyage' // ACP §18 — B1~B2 여행 가이드 (CC-BY-SA → 발행 허용, reference 밴드 보강)
  | 'usgs' // ACP §18 — B2 지구과학·자연재해 과학 저널리즘 (PD US Gov → 발행 허용, 신규 도메인)
  | 'noaa' // ACP §18 — B2-C1 기후과학 explainer (PD US Gov → 발행 허용, climate 신규 도메인·CSAT 최빈출)
  | 'futurity' // ACP — B1~B2 대학 연구 기사 (CC-BY 4.0 → 발행·변형 허용). 학술 소재 × 접근형 문체, PLOS(C1-C2)와 VOA(A2-B1) 사이를 메운다
  | 'openstax' // ACP §19 (설계) — C1 학술 교재 모듈 (CNXML · 현행 CC-BY-NC-SA → 게이트 차단, 라이선스 결정 선행)
  | 'space_place' // NASA Space Place — 어린이·청소년 우주 설명글(PD · 교재 이용 명시 허용). FK 중앙 6.63 로 초·중 한가운데
  | 'storyweaver' // 초·중 이야기 지문 (Pratham Books · 책마다 CC — 책 안에서 읽는다). narrative 재고가 0 이라 넣는다
  | 'original' // ACP §20 — 사실 재저작 (CC0 자체 저작 · 외부 본문 미사용 · compose 게이트 통과 필수)
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
  /** Phase 3 — 문맥 지배 POS (winkNLP). sense 매칭용. */
  context_pos: string | null
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
