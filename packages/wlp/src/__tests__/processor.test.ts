// packages/wlp/src/__tests__/processor.test.ts
import { describe, it, expect } from 'vitest'
import { processText } from '../processor'

describe('processText', () => {
  it('단순 문장 처리', () => {
    const result = processText('The cats are running.')
    expect(result.stats.sentenceCount).toBe(1)
    expect(result.uniqueLemmas).toContain('cat')
    expect(result.uniqueLemmas).toContain('run')
  })

  it('stopword 제외', () => {
    const result = processText('The cat is here.', {
      excludeStopWords: true,
    })
    expect(result.uniqueLemmas).not.toContain('the')
    expect(result.uniqueLemmas).not.toContain('is')
  })

  it('다중 문장 분리', () => {
    const result = processText('Hello world. Good morning!')
    expect(result.stats.sentenceCount).toBe(2)
  })

  it('lemma 통일', () => {
    const result = processText('I ran. She runs. They are running.')
    expect(result.uniqueLemmas).toContain('run')
  })

  it('charStart/charEnd 정확성', () => {
    const result = processText('Hello world.')
    const helloToken = result.sentences[0]?.tokens.find(
      (t) => t.surface === 'Hello',
    )
    expect(helloToken?.charStart).toBe(0)
    expect(helloToken?.charEnd).toBe(5)
  })
})
