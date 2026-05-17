// packages/library-pipeline/src/normalize/index.ts
// S3 NORMALIZE — boilerplate 제거 + TOC 제거 + 구두점 통일 + reflow

import { createHash } from 'node:crypto'
import { extractBody, removeTableOfContents } from './boundary'
import { normalizePunctuation } from './punctuation'
import { reflowSoftHyphens } from './reflow'
import type { RawBook, NormalizedBook } from '../types'

export function normalizeBook(raw: RawBook): NormalizedBook {
  // Gutenberg: 1) license header/footer 제거 2) TOC 제거 3) 구두점 통일 4) reflow
  // (Phase 11.12 — TOC 제거는 reflow 전 단계 — 줄바꿈 anchor 필요)
  const body =
    raw.source === 'gutenberg'
      ? reflowSoftHyphens(
          normalizePunctuation(removeTableOfContents(extractBody(raw.raw_content))),
        )
      : reflowSoftHyphens(normalizePunctuation(raw.raw_content))

  return {
    raw,
    body,
    body_hash: createHash('sha256').update(body).digest('hex'),
  }
}

export { extractBody, removeTableOfContents, normalizePunctuation, reflowSoftHyphens }
