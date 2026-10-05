// packages/library-pipeline/src/textbook/academic-reading-drain.test.ts
import { describe, expect, it } from 'vitest'
import {
  adaptationKey,
  canonical,
  readingTask,
  targetKey,
  validateReadingDraft,
  researchOriginForSource,
} from '../../../../scripts/textbook/academic-reading-contract.mjs'
import { analysis, quote, rights, target } from './academic-reading-fixtures'
import { extractFrymResearchOrigin } from '../ingest-article/research-origin'
import { REVIEWERS, REVIEW_DIMENSIONS, reviewTemplate, prepareReviewRows, mergeReviewTemplates, validateAgentReviews, validateStoredAgentReview, canExportReadingItem, readingReviewAllowsItem, normalizeReviewedLongBody, reviewedPassageIsComplete, readingItemSourceFailure } from '../../../../scripts/textbook/academic-reading-review.mjs'
import { buildPassage } from './csat-format'

const now = Date.parse('2026-10-04T00:00:00Z')
const current = {
  id: 'source-1',
  content: quote,
  source: 'noaa',
  source_url: rights.canonical_url,
  license: rights.license,
  license_class: 'public_domain',
  updated_at: '2026-10-01T00:00:00Z',
  status: 'ready',
  display_only: false,
  copyright_safe_in_kr: true,
  csat_fit: { gate: { verdict: 'use' } },
}
const exported = {
  adapted_from_id: current.id,
  target_v_level: 3,
  target_band: 'middle',
  source_text: quote,
  source_feed: 'noaa',
  source_url: current.source_url,
  source_license: 'public_domain',
  reading: readingTask(current, target),
}
const row = {
  ...exported,
  title: 'Ocean habitats',
  text: quote,
  reading: { ...exported.reading, source_rights: rights, reading_analysis: analysis },
}

describe('각색 드레인 계보와 재실행 계약', () => {
  it('같은 원문·같은 V-Level의 서로 다른 학년 목표는 별도 판이다', () => {
    const high = { ...target, age_band: 'high_1', reasoning_band: 'high_1' }
    expect(adaptationKey(current.id, target)).not.toBe(adaptationKey(current.id, high))
    expect(adaptationKey(current.id, target)).toBe(
      adaptationKey(current.id, structuredClone(target))
    )
  })
  it('JSONB의 키 순서는 식별키를 바꾸지 않는다', () => {
    expect(targetKey({ ...target, words: { max: 250, min: 180 } })).toBe(targetKey(target))
    expect(canonical({ b: 2, a: 1 })).toBe(canonical({ a: 1, b: 2 }))
  })
  it('자료의 권리 확인일·근거 갱신은 같은 교육 목적의 새 판을 만들지 않는다', () => {
    const resource = {
      kind: 'text',
      canonical_source: 'noaa',
      canonical_url: rights.canonical_url,
      content: quote,
      checked_at: rights.checked_at,
      license_evidence: 'Reviewed article-specific rights.',
    }
    const a = { ...target, resources: [resource] }
    expect(targetKey(a)).toBe(
      targetKey({
        ...target,
        resources: [
          {
            ...resource,
            checked_at: '2026-10-03T00:00:00Z',
            license_evidence: 'Rights were checked again.',
          },
        ],
      })
    )
    expect(targetKey(a)).not.toBe(
      targetKey({ ...target, resources: [{ ...resource, content: 'A revised additional text.' }] })
    )
  })
  it('최신 원문에 묶인 완성형 결과만 통과하고 원문을 바꾸지 않는다', () => {
    const before = structuredClone(current)
    const result = validateReadingDraft(row, exported, current, now)
    expect(result.ok).toBe(true)
    expect(result.spec?.provenance.source_id).toBe(current.id)
    expect(current).toEqual(before)
  })
  it.each([
    { content: 'Changed source body.' },
    { updated_at: '2026-10-03T00:00:00Z' },
    { license_class: 'cc_by_nd' },
    { display_only: true },
    { status: 'archived' },
    { csat_fit: { gate: { verdict: 'reject' } } },
    { csat_fit: { gate: { retain: { verdict: 'discard' } } } },
  ])('변경·반려·권리 차단 원문을 거절한다: %j', (change) => {
    expect(validateReadingDraft(row, exported, { ...current, ...change }, now).ok).toBe(false)
  })
  it('채운 청크의 부모·수준·원문·출처 바꿔치기를 거절한다', () => {
    for (const change of [
      { adapted_from_id: 'other' },
      { source_text: 'Changed exported text.' },
      { target_v_level: 4 },
      { source_url: 'https://example.org/wrong' },
    ])
      expect(validateReadingDraft({ ...row, ...change }, exported, current, now).ok).toBe(false)
    expect(
      validateReadingDraft(
        { ...row, reading: { ...row.reading, target: { ...target, age_band: 'high_1' } } },
        exported,
        current,
        now
      ).ok
    ).toBe(false)
  })
  it('기사별 권리 증거 누락과 미래 확인일을 막는다', () => {
    expect(
      validateReadingDraft(
        { ...row, reading: { ...row.reading, source_rights: null } },
        exported,
        current,
        now
      ).ok
    ).toBe(false)
    expect(
      validateReadingDraft(
        {
          ...row,
          reading: {
            ...row.reading,
            source_rights: { ...rights, checked_at: '2026-10-05T00:00:00Z' },
          },
        },
        exported,
        current,
        now
      ).ok
    ).toBe(false)
  })
})

describe('독립 에이전트 의미 검수 게이트', () => {
  const approved = REVIEWERS.map(reviewer => ({
    ...reviewTemplate(row, exported, reviewer),
    verdict: 'pass',
    dimensions: Object.fromEntries(REVIEW_DIMENSIONS.map(k => [k, true])),
    source_quote: quote.slice(0, 24),
    passage_quote: quote.slice(0, 24),
    rationale: 'The causal claim and scope match the source passage.',
  }))
  it('두 에이전트가 같은 원천·목표·각색본을 독립 승인해야 한다', () => {
    const result = validateAgentReviews(row, exported, approved.map(r => [r]))
    expect(result.ok).toBe(true)
    expect(result.ok && result.certificate.reviews.map(r => r.reviewer)).toEqual(REVIEWERS)
    const validation = validateReadingDraft(row, exported, current, now)
    expect(validation.ok).toBe(true)
    if (!result.ok || !validation.ok) return
    const article = {
      title: row.title,
      content: row.text,
      adapted_from_id: current.id,
      source_id: adaptationKey(current.id, target),
      source: current.source,
      license: current.license,
      license_class: current.license_class,
      display_only: false,
      copyright_safe_in_kr: true,
      article_v_level: 3,
      composed_spec: { academic_reading: { ...validation.spec, state: 'agent_reviewed', content_review: result.certificate } },
    }
    expect(validateStoredAgentReview(article, current)).toBe(true)
    expect(validateStoredAgentReview({ ...article, composed_spec: { academic_reading: { ...article.composed_spec.academic_reading, target: { ...target, resources: undefined } } } }, current)).toBe(false)
    expect(validateStoredAgentReview({ ...article, license_class: 'restricted' }, current)).toBe(false)
    expect(validateStoredAgentReview({ ...article, display_only: true }, current)).toBe(false)
    expect(validateStoredAgentReview(article, { ...current, license_class: 'restricted' })).toBe(false)
    expect(validateStoredAgentReview(article, { ...current, display_only: true })).toBe(false)
    expect(validateStoredAgentReview(article, { ...current, license: 'Changed license' })).toBe(false)
    expect(canExportReadingItem(article, current, 'topic')).toBe(true)
    expect(canExportReadingItem(article, { ...current, copyright_safe_in_kr: false }, 'topic')).toBe(false)
    expect(readingReviewAllowsItem(article, current, 'topic')).toBe(true)
    expect(readingReviewAllowsItem({ ...article, composed_spec: null }, current, 'topic')).toBe(false)
    expect(reviewedPassageIsComplete(article, article.content)).toBe(true)
    expect(reviewedPassageIsComplete({ source_id: article.source_id, content: "Students don't assume every change has one cause." }, 'Students don’t assume every change has one cause.')).toBe(true)
    expect(reviewedPassageIsComplete({ source_id: article.source_id, content: 'The report says “water changed”.' }, 'The report says "water changed".')).toBe(true)
    expect(reviewedPassageIsComplete({ source_id: article.source_id, content: 'The report says “water changed”.' }, 'The report says "water disappeared".')).toBe(false)
    const readyArticle = { ...article, status: 'ready', updated_at: '2026-10-04T01:00:00Z' }
    const originalItem = { passage: quote, reading: { version: 1, target, source_hash: exported.reading.source_hash, source_revision: readyArticle.updated_at } }
    const item = { passage: quote, reading: { ...originalItem.reading, skill: 'R4', passage_level: 4, item_reasoning_level: 7, item_difficulty: 5, difficulty_evidence: 'Main idea is supported by this passage.', evidence: [quote] } }
    expect(readingItemSourceFailure(item, originalItem, readyArticle, current, 'topic', 3)).toBeNull()
    expect(readingItemSourceFailure(item, originalItem, { ...readyArticle, license_class: 'restricted' }, current, 'topic', 3)).toMatch(/review/)
    expect(readingItemSourceFailure(item, originalItem, readyArticle, { ...current, content: 'changed' }, 'topic', 3)).toMatch(/review/)
    expect(readingItemSourceFailure(item, originalItem, readyArticle, { ...current, license_class: 'restricted' }, 'topic', 3)).toMatch(/review/)
    expect(readingItemSourceFailure(item, { ...originalItem, passage: quote.slice(0, 18) }, readyArticle, current, 'topic', 3)).toMatch(/truncated/)
    expect(readingItemSourceFailure({ passage: quote }, originalItem, readyArticle, current, 'topic', 3)).toMatch(/contract/)
    expect(canExportReadingItem({ ...article, article_v_level: 4 }, current, 'topic')).toBe(false)
    expect(canExportReadingItem(article, current, 'grammar_choice')).toBe(false)
    expect(validateStoredAgentReview({ ...article, content: `${article.content} Changed.` }, current)).toBe(false)
    expect(validateStoredAgentReview({ ...article, adapted_from_id: 'other' }, current)).toBe(false)
    expect(validateStoredAgentReview(article, { ...current, content: 'changed source' })).toBe(false)
    expect(validateStoredAgentReview({ ...article, composed_spec: { academic_reading: { ...article.composed_spec.academic_reading, target_key: 'changed' } } }, current)).toBe(false)
    expect(validateStoredAgentReview({ ...article, composed_spec: { academic_reading: { ...article.composed_spec.academic_reading, content_review: { ...result.certificate, reviews: [result.certificate.reviews[0]] } } } }, current)).toBe(false)
    expect(validateStoredAgentReview({ ...article, composed_spec: { academic_reading: { ...article.composed_spec.academic_reading, content_review: { ...result.certificate, reviews: [{ ...result.certificate.reviews[0], review: { ...result.certificate.reviews[0].review, rationale: 'tampered' } }, result.certificate.reviews[1]] } } } }, current)).toBe(false)
    expect(validateStoredAgentReview({ ...article, composed_spec: { academic_reading: { ...article.composed_spec.academic_reading, state: 'awaiting_content_review' } } }, current)).toBe(false)
  })
  it('실제 제시문 창이 조건과 근거를 잘라내면 독립 검수 전체 승인으로 통과시키지 않는다', () => {
    const source = [
      'The first finding is that ocean water became warmer in the study region.',
      ...Array.from({ length: 10 }, (_, i) => `Observation ${i + 1} records a different habitat in the same region during the survey.`),
      'However, the change occurred only when shallow water remained warm for several weeks.',
    ].join(' ')
    const excerpt = buildPassage(source, { min: 50, max: 80 }, 5)
    expect(excerpt).toBeTruthy()
    expect(excerpt).not.toContain('only when shallow water')
    expect(reviewedPassageIsComplete({ source_id: 'reading:source:target', content: source }, excerpt)).toBe(false)
    expect(reviewedPassageIsComplete({ source_id: 'legacy', content: source }, excerpt)).toBe(true)
    expect(reviewedPassageIsComplete({ source_id: 'reading:source:target', content: 'The count was [12] samples.' }, 'The count was samples.')).toBe(false)
  })
  it('장문 순서 문항의 네 문단 재배열은 전체 포함일 때만 허용한다', () => {
    const paragraphs = ['First paragraph explains the research question.', 'Second paragraph describes the sample.', 'Third paragraph gives the finding.', 'Fourth paragraph states the condition.']
    const article = { source_id: 'reading:source:target', content: paragraphs.join('\n\n') }
    const parts = [
      { label: '(A)', text: paragraphs[0] }, { label: '(B)', text: paragraphs[2] },
      { label: '(C)', text: paragraphs[3] }, { label: '(D)', text: paragraphs[1] },
    ]
    const passage = [parts[0].text, ...parts.slice(1).map(p => `${p.label}\n${p.text}`)].join('\n\n')
    expect(reviewedPassageIsComplete(article, article.content, 'long_match')).toBe(true)
    expect(reviewedPassageIsComplete(article, article.content, 'long_order')).toBe(false)
    expect(reviewedPassageIsComplete(article, passage, 'long_order', parts)).toBe(true)
    expect(reviewedPassageIsComplete(article, passage, 'long_order', parts.map((p, i) => i === 2 ? { ...p, text: 'Missing condition.' } : p))).toBe(false)
    expect(reviewedPassageIsComplete(article, passage.replace(paragraphs[3], 'Changed text.'), 'long_order', parts)).toBe(false)
    const quoted = { ...article, content: article.content.replace('the sample', "don't exclude the sample") }
    const normalized = normalizeReviewedLongBody(quoted.content)
    expect(normalized.split(/\n\s*\n+/)).toHaveLength(4)
    expect(reviewedPassageIsComplete(quoted, normalized, 'long_match')).toBe(true)
    const normalizedParts = normalized.split(/\n\s*\n+/)
    const quotedParts = [
      { label: '(A)', text: normalizedParts[0] }, { label: '(B)', text: normalizedParts[2] },
      { label: '(C)', text: normalizedParts[3] }, { label: '(D)', text: normalizedParts[1] },
    ]
    const quotedPassage = [quotedParts[0].text, ...quotedParts.slice(1).map(p => `${p.label}\n${p.text}`)].join('\n\n')
    expect(reviewedPassageIsComplete(quoted, quotedPassage, 'long_order', quotedParts)).toBe(true)
    const countArticle = { ...article, content: article.content.replace('the sample', 'the [8] samples') }
    const lostCount = normalizeReviewedLongBody(countArticle.content)
    expect(reviewedPassageIsComplete(countArticle, lostCount, 'long_match')).toBe(false)
  })
  it('누락·중복·바뀐 본문과 target을 거절한다', () => {
    expect(validateAgentReviews(row, exported, [[approved[0]], null]).ok).toBe(false)
    expect(validateAgentReviews({ ...row, text: `${quote} Changed.` }, exported, approved.map(r => [r])).ok).toBe(false)
    expect(validateAgentReviews(row, { ...exported, reading: { ...exported.reading, target_key: 'changed' } }, approved.map(r => [r])).ok).toBe(false)
    expect(validateAgentReviews(row, exported, [[approved[0], approved[0]], [approved[1]]]).ok).toBe(false)
    expect(() => reviewTemplate(row, { ...exported, source_text: 'tampered source text' }, 'codex')).toThrow(/source body/)
  })
  it('결과 순서가 바뀌어도 UUID·target으로 결속하고 보류 행만 제외한다', () => {
    const secondInput = { ...exported, adapted_from_id: 'source-2' }
    const secondDraft = { ...row, adapted_from_id: 'source-2' }
    const prepared = prepareReviewRows([exported, secondInput], [secondDraft, row])
    expect(prepared.complete.map(pair => pair[1].adapted_from_id)).toEqual(['source-2', 'source-1'])
    expect(prepareReviewRows([exported, secondInput], [{ ...secondDraft, text: '' }, row]).held).toHaveLength(1)
    expect(prepareReviewRows([exported, secondInput], [{ ...secondDraft, reading: { ...secondDraft.reading, source_rights: null } }, row]).complete).toHaveLength(1)
    expect(() => prepareReviewRows([exported], [row, row])).toThrow(/duplicate/)
    expect(() => prepareReviewRows([exported], [{ ...row, adapted_from_id: 'other' }])).toThrow(/no source/)
  })
  it('기존 검수를 보존하고 완성·수정된 각색의 새 해시 양식만 더한다', () => {
    const first = reviewTemplate(row, exported, 'codex')
    const changed = { ...row, text: `${quote} More detail follows.` }
    const firstMerge = mergeReviewTemplates([first], [[changed, exported]], 'codex')
    expect(firstMerge.added).toBe(1)
    expect(firstMerge.rows[0]).toEqual(first)
    expect(firstMerge.rows[1].draft_hash).not.toBe(first.draft_hash)
    expect(mergeReviewTemplates(firstMerge.rows, [[changed, exported]], 'codex').added).toBe(0)
    const matching = [firstMerge.rows.map(r => ({ ...r, reviewer: 'claude_code', verdict: 'pass', dimensions: Object.fromEntries(REVIEW_DIMENSIONS.map(k => [k, true])), source_quote: quote, passage_quote: quote, rationale: 'The adapted claim preserves the condition and relationship.' })), firstMerge.rows.map(r => ({ ...r, verdict: 'pass', dimensions: Object.fromEntries(REVIEW_DIMENSIONS.map(k => [k, true])), source_quote: quote, passage_quote: quote, rationale: 'The adapted claim preserves the condition and relationship.' }))]
    expect(validateAgentReviews(changed, exported, matching).ok).toBe(true)
  })
  it('중복 방지 키에서 빠진 추가 자료의 권리 변경도 검수 hash를 무효화한다', () => {
    const resource = {
      kind: 'text', canonical_source: 'noaa', canonical_url: rights.canonical_url,
      content: quote, license_evidence: rights.evidence, license: rights.license,
      license_url: rights.license_url, commercial_use: true, derivative_use: true,
      ai_processing: 'allowed', third_party_text: false, share_alike: false,
      attribution: 'NOAA original article', checked_at: rights.checked_at,
    }
    const a = { ...target, resources: [resource] }
    const b = { ...target, resources: [{ ...resource, attribution: 'A changed attribution statement' }] }
    expect(targetKey(a)).toBe(targetKey(b))
    const withTarget = (t: typeof a) => ({ ...exported, reading: { ...exported.reading, target: t } })
    expect(reviewTemplate(row, withTarget(a), 'codex').target_hash).not.toBe(reviewTemplate(row, withTarget(b), 'codex').target_hash)
  })
  it('치명 항목 실패·왜곡·거절·근거 부재를 평균으로 숨기지 않는다', () => {
    for (const change of [
      { dimensions: { ...approved[0].dimensions, scope_preserved: false } },
      { distortions: ['SCOPE_EXPANSION'] },
      { verdict: 'revise' },
      { passage_quote: 'not in the draft' },
    ]) expect(validateAgentReviews(row, exported, [[{ ...approved[0], ...change }], [approved[1]]]).ok).toBe(false)
  })
})

describe('FYM 연구 계보와 각색 연결', () => {
  const url = 'https://kids.frontiersin.org/articles/10.3389/frym.2021.556361/full'
  const container = `<div class="fulltext-content"><p>${quote}</p><h6>Original Source Article</h6><p>Lafuente 2019. Research citation. doi: 10.1111/geb.12928</p><h6>References</h6><p>Other study. doi: 10.1000/other</p></div>`
  const origin = extractFrymResearchOrigin({ html: `<meta property="og:url" content="${url}">${container}`, container, studentUrl: url, body: quote, checkedAt: '2026-10-03T00:00:00Z' })
  const frym = { ...current, source: 'frym', source_id: 'frym-full:10.3389/frym.2021.556361', source_url: url, license: 'CC-BY-4.0', license_class: 'cc_by' }
  const input = { ...exported, source_feed: 'frym', source_url: url, source_license: 'cc_by', reading: readingTask(frym, target, origin) }
  const relation = origin.relations[0]!
  const pair = { ...relation, student_url: url }
  const output = { ...row, ...input, reading: { ...input.reading,
    source_rights: { ...rights, canonical_source: 'frym', canonical_url: url, license: frym.license },
    reading_analysis: { ...analysis, parallel_pair: pair },
  } }
  const manifestRow = { id: frym.id, source_id: frym.source_id, source_url: url, source_revision: frym.updated_at, source_hash: input.reading.source_hash, status: origin.status, research_origin: origin }
  it('passes explicit publisher evidence kept outside learning prose and preserves it in provenance', () => {
    expect(quote).not.toContain(pair.original_work_id)
    const result = validateReadingDraft(output, input, frym, now)
    expect(result.ok).toBe(true)
    expect(result.ok && result.spec.provenance.research_origin).toEqual(origin)
  })
  it('hands a read-only pair export to adaptation without editing the DB source', () => {
    expect(researchOriginForSource(frym, new Map([[frym.id, manifestRow]]), now)).toEqual(origin)
    expect(frym.csat_fit).toEqual(current.csat_fit)
    expect(input.reading.database_research_origin).toBeNull()
  })
  it('rejects old manifest revisions and held exports', () => {
    expect(() => researchOriginForSource(frym, new Map([[frym.id, { ...manifestRow, source_revision: 'old' }]]), now)).toThrow(/stale/)
    expect(() => researchOriginForSource(frym, new Map([[frym.id, { ...manifestRow, status: 'held', reason: 'body changed' }]]), now)).toThrow(/held/)
  })
  it('rejects edits to the exported research snapshot', () => {
    expect(validateReadingDraft({ ...output, reading: { ...output.reading, research_origin: { ...origin, page_hash: 'a'.repeat(64) } } }, input, frym, now).ok).toBe(false)
  })
  it('rejects wrong/current-body hashes and future origin evidence', () => {
    for (const bad of [{ ...origin, body_hash: 'a'.repeat(64) }, { ...origin, checked_at: '2026-10-05T00:00:00Z' }]) {
      const badInput = { ...input, reading: readingTask(frym, target, bad) }
      const badOutput = { ...output, reading: { ...output.reading, ...badInput.reading, source_rights: output.reading.source_rights, reading_analysis: output.reading.reading_analysis } }
      expect(validateReadingDraft(badOutput, badInput, frym, now).ok).toBe(false)
    }
  })
  it('rejects arbitrary DOI evidence, another research URL and ordinary bibliography', () => {
    for (const bad of [{ ...pair, evidence: 'Other study. doi: 10.1000/other', original_work_id: '10.1000/other', research_url: 'https://doi.org/10.1000/other' }, { ...pair, research_url: 'https://example.com' }]) {
      expect(validateReadingDraft({ ...output, reading: { ...output.reading, reading_analysis: { ...analysis, parallel_pair: bad } } }, input, frym, now).ok).toBe(false)
    }
  })
  it('does not fall back to an isolated body DOI without explicit publisher origin', () => {
    const bodyOnlyInput = { ...input, reading: readingTask(frym, target) }
    const bodyOnlyOutput = { ...output, reading: { ...output.reading, research_origin: null } }
    expect(validateReadingDraft(bodyOnlyOutput, bodyOnlyInput, frym, now).ok).toBe(false)
  })
})
