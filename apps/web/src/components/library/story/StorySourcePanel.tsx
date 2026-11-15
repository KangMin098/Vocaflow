// apps/web/src/components/library/story/StorySourcePanel.tsx
//
// 원문 대응(요청할 때만) — 지금 단위의 검증된 앵커를 「원문 N문단 + 저장된 인용 그대로」로 보이고,
// 학습자가 인용 하나를 고르면 그 인용이 어느 단위의 근거인지 말하고 본문 쪽에 대응 표시를 켠다(onTrace).
// - 인용은 저장값을 텍스트 노드로만 그린다. 오프셋(start/end)은 메타일 뿐 화면이 문자열을 자르지 않는다.
// - 원천 메타: 제목 · 저자 · 판 이름 · 원작 언어 vs 본문 언어(다르면 번역본 · 번역자) · 원천 범위.
// - 원천 주소는 http/https 일 때만 새 창 링크(rel="noopener noreferrer"), 그 밖은 링크 없이 글자로만.

'use client'

import type { StoryReaderSource, StorySourceAnchor } from '@/lib/library/story/learner-types'

import styles from './story.module.css'
import { SOURCE_COVERAGE_LABEL, languageName, safeSourceHref, unitLabel } from './story-view'

export interface StorySourcePanelProps {
  id: string
  source: StoryReaderSource
  anchors: readonly StorySourceAnchor[]
  unitIndex: number
  unitTitle: string | null
  selected: number | null
  onSelect: (index: number | null) => void
}

export function StorySourcePanel({ id, source, anchors, unitIndex, unitTitle, selected, onSelect }: StorySourcePanelProps) {
  const translated = source.originalLanguage !== source.textLanguage
  const href = safeSourceHref(source.sourceUrl)
  const chosen = selected !== null ? anchors[selected] ?? null : null

  return (
    <section id={id} className={styles.asideBlock} aria-label="원문 대응" data-story-source-panel>
      <dl className={styles.sourceMeta}>
        <dt>원천</dt>
        <dd lang={source.textLanguage}>{source.title}</dd>
        {source.author ? (
          <>
            <dt>저자</dt>
            <dd>{source.author}</dd>
          </>
        ) : null}
        <dt>판</dt>
        <dd>{source.editionLabel}</dd>
        <dt>언어</dt>
        <dd data-story-language={translated ? 'translated' : 'original'}>
          {translated
            ? `번역본 — 원작 ${languageName(source.originalLanguage)} · 본문 ${languageName(source.textLanguage)}`
            : `원작 언어 그대로 — ${languageName(source.textLanguage)}`}
        </dd>
        {translated ? (
          <>
            <dt>번역</dt>
            <dd>{source.translator ?? '번역자 정보 없음'}</dd>
          </>
        ) : null}
        <dt>범위</dt>
        <dd>{SOURCE_COVERAGE_LABEL[source.coverage]}</dd>
        {source.sourceUrl ? (
          <>
            <dt>주소</dt>
            <dd>
              {href ? (
                <a href={href} target="_blank" rel="noopener noreferrer" className={styles.ctaQuiet} data-story-source-link>
                  원천 열기 (새 창)
                </a>
              ) : (
                <span data-story-source-text>{source.sourceUrl}</span>
              )}
            </dd>
          </>
        ) : null}
      </dl>

      {anchors.length === 0 ? (
        <p className={styles.traceNote}>이 단위에는 연결된 원문 인용이 없어요.</p>
      ) : (
        <>
          <p className={styles.meta}>인용을 고르면 이 단위의 어느 근거인지 본문 옆에 표시돼요.</p>
          <ul className={styles.anchorList}>
            {anchors.map((anchor, index) => {
              const on = selected === index
              return (
                <li
                  key={`${anchor.paragraph}:${anchor.start}:${anchor.end}`}
                  className={styles.anchorItem}
                  data-selected={on ? 'true' : 'false'}
                >
                  <button
                    type="button"
                    className={styles.anchorButton}
                    aria-pressed={on}
                    aria-describedby={`${id}-quote-${index}`}
                    onClick={() => onSelect(on ? null : index)}
                    data-story-anchor={index}
                  >
                    원문 {anchor.paragraph + 1}문단
                  </button>
                  <blockquote id={`${id}-quote-${index}`} className={styles.quote} lang={source.textLanguage}>
                    {anchor.quote}
                  </blockquote>
                </li>
              )
            })}
          </ul>
          <p className={styles.traceNote} aria-live="polite" data-story-trace>
            {chosen
              ? `원문 ${chosen.paragraph + 1}문단의 이 인용은 ${unitLabel(unitIndex, unitTitle)}의 근거예요.`
              : ''}
          </p>
        </>
      )}
    </section>
  )
}
