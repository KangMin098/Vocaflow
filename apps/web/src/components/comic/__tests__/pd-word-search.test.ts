// apps/web/src/components/comic/__tests__/pd-word-search.test.ts
// T-0242 — 복원만화 뜻 시트의 「내 단어장에서 찾기」: 탭한 낱말의 정규화 · 인코딩, 무효 입력은 링크 없음, 공개 리더에서만 · prefetch 없음 · resolved_word 미사용(소스 결속).
// 실제 단어 탭 → 시트 → 연속 다른 단어 · 늦은 사전 응답 · 닫기/Esc · 초점 왕복은 PC 하네스가 덮는다(jsdom 없음).
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { comicWordSearchHref } from '../word-search'

describe('comicWordSearchHref', () => {
  it('탭한 낱말을 정규화(공백 · 소문자)해 기존 WordVault 검색 ?q= 로', () => {
    expect(comicWordSearchHref('Lantern')).toBe('/wordvault/browse?q=lantern')
    expect(comicWordSearchHref('  harbor ')).toBe('/wordvault/browse?q=harbor')
    expect(comicWordSearchHref("don't")).toBe("/wordvault/browse?q=don%27t")
    expect(comicWordSearchHref('well-known')).toBe('/wordvault/browse?q=well-known')
  })
  it('빈 · 한 글자 · 숫자 · 기호 · 공백 섞임 · 끝 기호 · 너무 긴 값 · 비문자열은 링크 없음', () => {
    for (const bad of [null, undefined, '', '  ', 'a', '42', 'x1', 'a b', "rock'", '-rock', 'rock&roll', '<script>', 'é'.repeat(3), 'a'.repeat(65)]) {
      expect(comicWordSearchHref(bad as string)).toBeNull()
    }
  })
})

describe('PdModernReader 소스 결속', () => {
  const src = readFileSync(path.resolve(__dirname, '../PdModernReader.tsx'), 'utf8')
  it('탭한 vocab 으로만 만들고(resolved_word 아님) 공개 리더에서만 · prefetch 없음 · 저장 문구 없음', () => {
    expect(src).toContain('const vocabSearchHref = comicWordSearchHref(vocab)')
    expect(src).not.toMatch(/comicWordSearchHref\([^)]*resolved_word/)
    expect(src).toMatch(/\{publicPresentation && vocabSearchHref \? \(\s*<Link\s+href=\{vocabSearchHref\}\s+prefetch=\{false\}/)
    expect(src).toContain('내 단어장에서 찾기')
    expect(src).not.toMatch(/단어장 추가|저장됨|추가됨/)
    // 링크는 시트(vocab && …) 안에만 있다 — 닫으면(vocab null) 함께 사라진다
    expect(src.indexOf('pd-word-search')).toBeGreaterThan(src.indexOf('{vocab && ('))
  })
})
