// apps/web/src/app/dev/article-source/dev.tsx
'use client'

import { ReadingUniverse } from '@/components/workspace/ReadingUniverse'

const noop = () => {}

export function ArticleSourceDev({ src, withChapter }: { src: string | null; withChapter: boolean }) {
  const body = [
    { id: 1, sentences: [{ id: 0, parts: [{ text: 'The river rose slowly through the night.' }] }] },
    { id: 2, sentences: [{ id: 1, parts: [{ text: 'By morning, the town had moved its market uphill.' }] }] },
  ]
  const paragraphs = withChapter
    ? [
        { id: 0, sentences: [], chapterMarker: { number: '1', title: 'Synthetic', sourceHref: 'https://www.gutenberg.org/ebooks/0' } },
        ...body,
      ]
    : body
  return (
    <ReadingUniverse
      paragraphs={paragraphs}
      isFocusMode={false}
      onWordHover={noop}
      onSentencePlay={noop}
      playingSentenceId={null}
      articleSourceHref={src}
    />
  )
}
