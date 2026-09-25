// packages/library-pipeline/src/ingest-article/precheck.test.ts
//
// 모음 단계 사전검증 — 실측에서 나온 오판 사례를 회귀로 고정한다(2026-09-25).

import { describe, expect, it } from 'vitest'
import { precheckArticle, proseRatio, englishRatio, headOf } from './precheck'

const NEWS_BODY =
  'The city council approved a new plan on Monday. Officials said the project would take three years. ' +
  'Residents will be able to comment on the design next month. The mayor called it an important step for the town.'

describe('precheckArticle', () => {
  it('뉴스 원천은 제목 부적합이면 막는다 (wikinews 실측 — 표본 전부 정확)', () => {
    const r = precheckArticle({ source: 'wikinews', title: 'Heavy storm hits Philippines, kills fourteen', content: NEWS_BODY })
    expect(r.verdict).toBe('block')
    expect(r.blockedBy).toEqual(['title'])
    expect(r.reasons).toContain('title:unfit')
  })

  it('건강 원천은 제목 규칙을 끈다 — 「Heart Attack」 기사는 사고가 아니다', () => {
    const r = precheckArticle({ source: 'nih_news_in_health', title: 'Can You Recognize a Heart Attack or Stroke?', content: NEWS_BODY })
    expect(r.verdict).toBe('pass')
  })

  it('그림책 「Shock! Crash!」 은 제목으로 걸리지 않는다', () => {
    expect(precheckArticle({ source: 'gdl', title: 'Shock! Crash!', content: NEWS_BODY }).verdict).toBe('pass')
  })

  it('모르는 원천은 전부 표시만 한다 — 막지 않는다', () => {
    const r = precheckArticle({ source: 'voa', title: 'Soldiers killed in attack', content: NEWS_BODY })
    expect(r.verdict).toBe('flag')
    expect(r.blockedBy).toEqual([])
  })

  it('카테고리 차단은 원천이 카테고리를 줄 때만 걸린다', () => {
    expect(precheckArticle({ source: 'wikinews', title: 'City approves plan', content: NEWS_BODY, categories: ['Football'] }).blockedBy).toEqual(['category'])
    expect(precheckArticle({ source: 'wikinews', title: 'City approves plan', content: NEWS_BODY }).verdict).toBe('pass')
  })

  it('긴 기사가 「404 Not Found」를 보도해도 안내문이 아니다 (wikinews 2편 오판)', () => {
    const long = `The site returned a 404 Not Found error for hours. ${NEWS_BODY} ${NEWS_BODY} ${NEWS_BODY} ${NEWS_BODY}`
    expect(precheckArticle({ source: 'wikinews', title: 'The Pirate Bay back online', content: long }).reasons).not.toContain('head:boilerplate')
    expect(precheckArticle({ source: 'wikinews', title: 'Home', content: '404 Not Found. The page you requested does not exist.' }).reasons).toContain('head:boilerplate')
  })

  it('목록 본문(박스오피스 순위)은 산문이 아니다', () => {
    const list = 'The highest grossing films are:\n\n' + Array.from({ length: 12 }, (_, i) => `Film number ${i} with $${i}.5 million`).join('\n\n')
    expect(precheckArticle({ source: 'wikinews', title: 'US box office', content: list }).reasons).toContain('head:not_prose')
  })
})

describe('앞부분 지표 — 처음 규칙이 틀렸던 자리', () => {
  it('문장 중간에서 줄을 끊은 원문도 산문이다 (wikinews 137편 오판)', () => {
    const wrapped = 'Seven unknown men invaded the camp, in the\n\ncity of Minas Gerais, and the police\n\nsaid they are searching for them. ' + NEWS_BODY
    expect(proseRatio(wrapped)).toBeGreaterThanOrEqual(1.5)
  })

  it('한 쪽에 한 줄인 그림책도 산문이다', () => {
    expect(proseRatio('Where is my cat?\n\nIs it under the bed?\n\nIs it on top of the cupboard?')).toBeGreaterThanOrEqual(1.5)
  })

  it('쉬운 아동 영어도 영어다 (대명사·의문사를 기능어로 센다)', () => {
    const kid = 'I wake up and make fire. I boil some water. I chop the firewood. I stir the pot. I sweep the floor. Why do I work so hard when my brother sleeps?'
    expect(englishRatio(kid)).toBeGreaterThanOrEqual(0.12)
  })

  it('스페인어 본문은 영어가 아니다', () => {
    const es = 'La ciudad aprobó un nuevo plan el lunes. Los funcionarios dijeron que el proyecto tomaría tres años y que los residentes podrán comentar el diseño el próximo mes según el alcalde.'
    expect(englishRatio(es)).toBeLessThan(0.12)
  })

  it('앞부분은 200어에서 자른다', () => {
    const long = Array.from({ length: 500 }, () => 'word').join(' ')
    expect(headOf(long).split(' ').length).toBe(200)
  })
})
