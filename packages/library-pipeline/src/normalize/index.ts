// packages/library-pipeline/src/normalize/index.ts
// S3 NORMALIZE — boilerplate 제거 + TOC 제거 + 구두점 통일 + reflow

import { createHash } from 'node:crypto'
import { extractBody, removeTableOfContents, stripIllustrations } from './boundary'
import { normalizePunctuation } from './punctuation'
import { reflowSoftHyphens } from './reflow'
import type { RawBook, NormalizedBook } from '../types'

export function normalizeBook(raw: RawBook): NormalizedBook {
  // Gutenberg: 1) license header/footer 2) TOC 제거 3) illustration 마커 제거
  //            4) 구두점 통일 5) reflow
  // (마커 제거는 줄바꿈 anchor 필요 — punctuation/reflow 전에 호출)
  const body =
    raw.source === 'gutenberg'
      ? reflowSoftHyphens(
          normalizePunctuation(
            stripIllustrations(removeTableOfContents(extractBody(raw.raw_content))),
          ),
        )
      : reflowSoftHyphens(normalizePunctuation(raw.raw_content))

  return {
    raw,
    body,
    body_hash: createHash('sha256').update(body).digest('hex'),
  }
}

export {
  extractBody,
  removeTableOfContents,
  stripIllustrations,
  normalizePunctuation,
  reflowSoftHyphens,
}
