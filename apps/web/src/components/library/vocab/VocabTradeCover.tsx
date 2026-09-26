// apps/web/src/components/library/vocab/VocabTradeCover.tsx
//
// 단어장 **교재 표지** — `cover_image_meta.trade` 명세를 시중 교재 문법으로 조판한다(`tradeCoverSvg`).
// 선반(VocabSetCarousel)과 매대 카드(VocabSetCard)가 같은 표지를 쓴다 — 두 벌이면 같은 권이 두 얼굴이 된다.
// 수치는 명세에 없다: 표제어 수는 DB 실측(`wordCount`), 「N일 완성」은 사다리 계단의 하루 분량으로 즉석 계산(I5).
// SVG 는 인라인이다 — 페이지 서체 변수(--font-trade*)를 그대로 물려받는다.

import { useMemo } from 'react'
import { tradeCoverSvg, type TradeCoverSpec } from '@vocaflow/library-pipeline/vocab-trade-cover'

import { rungForSet } from '@/lib/library/vocab/rung'
import type { PublishedVocabSet } from '@/lib/library/vocab/queries'

export function VocabTradeCover({ set, spec, className }: { set: PublishedVocabSet; spec: TradeCoverSpec; className?: string }) {
  const { rung } = rungForSet(set)
  const html = useMemo(
    () => tradeCoverSvg(spec, { title: set.title, words: set.wordCount, perDay: spec.mode === 'series' ? (rung?.wordsPerDay ?? null) : null }),
    [spec, set.title, set.wordCount, rung?.wordsPerDay],
  )
  // role="img" · aria-label 은 SVG 안에 있다(표지 = 정보).
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />
}
