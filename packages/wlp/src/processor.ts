// packages/wlp/src/processor.ts
import winkNLP, {
  type ItemToken,
  type ItemSentence,
  type ItsFunction,
} from 'wink-nlp'
import model from 'wink-eng-lite-web-model'
import type { WlpResult, WlpSentence, WlpToken, WlpOptions } from './types'

const nlp = winkNLP(model)
// wink-nlp v2.4 의 ItsHelpers 시그니처와 ItemToken.out 의 ItsFunction 시그니처가
// d.ts 수준에서 맞지 않아 (런타임은 정상) 호출 시 ItsFunction 으로 캐스트.
const its = nlp.its as unknown as {
  value: ItsFunction<string>
  lemma: ItsFunction<string>
  pos: ItsFunction<string>
  type: ItsFunction<string>
  stopWordFlag: ItsFunction<boolean>
}

const DEFAULT_OPTIONS: Required<WlpOptions> = {
  excludeStopWords: true,
  excludePunctuation: true,
  minLemmaLength: 2,
}

export function processText(text: string, options: WlpOptions = {}): WlpResult {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const doc = nlp.readDoc(text)

  const sentences: WlpSentence[] = []
  const lemmaSet = new Set<string>()
  let totalTokens = 0
  let contentTokens = 0
  // wink-nlp 토큰에는 char offset 이 직접 노출되지 않아 원본 텍스트에서 cursor 추적
  let cursor = 0

  doc.sentences().each((sent: ItemSentence, sentIdx: number) => {
    const sentTokens: WlpToken[] = []

    sent.tokens().each((tk: ItemToken) => {
      const surface = tk.out(its.value) as string
      const lemma = tk.out(its.lemma) as string
      const pos = tk.out(its.pos) as string
      const type = tk.out(its.type) as string
      const isStopWord = tk.out(its.stopWordFlag) as boolean
      const isPunctuation = type === 'punctuation'

      const found = text.indexOf(surface, cursor)
      const charStart = found === -1 ? cursor : found
      const charEnd = charStart + surface.length
      cursor = charEnd

      const token: WlpToken = {
        surface,
        lemma: lemma.toLowerCase(),
        pos,
        isStopWord,
        isPunctuation,
        sentenceIndex: sentIdx,
        charStart,
        charEnd,
      }

      sentTokens.push(token)
      totalTokens++

      // 통계용 필터링
      if (isPunctuation && opts.excludePunctuation) return
      if (isStopWord && opts.excludeStopWords) return
      if (token.lemma.length < opts.minLemmaLength) return

      contentTokens++
      lemmaSet.add(token.lemma)
    })

    sentences.push({
      index: sentIdx,
      text: sent.out() as string,
      tokens: sentTokens,
    })
  })

  return {
    text,
    sentences,
    uniqueLemmas: Array.from(lemmaSet).sort(),
    stats: {
      totalTokens,
      contentTokens,
      uniqueCount: lemmaSet.size,
      sentenceCount: sentences.length,
    },
  }
}
