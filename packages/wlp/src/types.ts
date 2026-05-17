// packages/wlp/src/types.ts
export interface WlpToken {
  surface: string //         원형 그대로 (예: "running")
  lemma: string //           표제어 (예: "run")
  pos: string //             품사 태그 (NOUN, VERB...)
  isStopWord: boolean
  isPunctuation: boolean
  sentenceIndex: number //   몇 번째 문장 소속
  charStart: number
  charEnd: number
}

export interface WlpSentence {
  index: number
  text: string
  tokens: WlpToken[]
}

export interface WlpResult {
  text: string
  sentences: WlpSentence[]
  uniqueLemmas: string[] //  중복 제거된 lemma 목록
  stats: {
    totalTokens: number
    contentTokens: number //  stopword/punct 제외
    uniqueCount: number
    sentenceCount: number
  }
}

export interface WlpOptions {
  excludeStopWords?: boolean //   default: true
  excludePunctuation?: boolean // default: true
  minLemmaLength?: number //      default: 2
}
