// apps/web/src/lib/design/__tests__/var-opacity-ratchet.test.ts
//
// **변수 색에 붙은 /N 은 칠해지지 않는다**(Tailwind 3.4 — DD-82 · learner-tines-audit S3 ④ · S4).
// `bg-[var(--bd)]/55` 는 CSS 를 만들지 않아 조용히 투명하다 — 읽기 화면의 문장 듣기 점, 서가 코버플로의 페이지 점 9개,
// 포커스 고리(기본 파랑으로 떨어짐)가 그래서 의도와 다르게 보였다.
// 2026-10-18 학습자 코드(관리자·테스트 제외)에 119곳 · 50파일 → 읽기(16) · 서가 · 단어장(17)을
// `scripts/design/var-opacity-codemod.mjs` 로 고쳤다(2026-10-19 기준 86곳 · 35파일). 나머지는 화면 묶음마다 눈으로 확인하며 고친다.
//
// **파일별 상한**이다 — 총량만 막으면 한 곳을 고친 몫이 다른 파일의 새 결함을 가린다(사용자 지시 2026-10-19).
// 목록에 없는 파일에 하나라도 생기면 실패하고, 목록의 파일은 그 수를 넘으면 실패한다. 고치면 수를 낮추거나 줄을 지운다.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = path.resolve(__dirname, '../../..')
const RE = /\[var\(--[a-z0-9-]+\)\]\/\d{1,3}(?![\d%])/g

/** 2026-10-19 기준선 — 파일(apps/web/src 기준) → 허용 상한 */
const BASELINE: Record<string, number> = {
  'app/(main)/my/books/page.tsx': 1,
  'app/(main)/settings/page.tsx': 3,
  'app/(marketing)/about/page.tsx': 1,
  'app/dev/page.tsx': 1,
  'components/comic/ComicFormatChoice.tsx': 1,
  'components/dashboard/RecentActivity.tsx': 2,
  'components/diagnostic/DiagnosticClient.tsx': 2,
  'components/dictation/DictationHubClient.tsx': 1,
  'components/dictation/DictationResultsClient.tsx': 1,
  'components/dictation/DictationSessionClient.tsx': 6,
  'components/dictation/SourcePicker.tsx': 1,
  'components/echo/EchoMatchPlayer.tsx': 8,
  'components/game/scriptquiz/ScriptQuiz.tsx': 4,
  'components/hub/HubStartCard.tsx': 1,
  'components/layout/SessionFrame.tsx': 1,
  'components/library/books/BookDetailClient.tsx': 6,
  'components/library/browse/ArticleCard.tsx': 1,
  'components/library/browse/ComicsBrowser.tsx': 1,
  'components/library/textbooks/SeriesTabs.tsx': 2,
  'components/library/vocab/CategoryMatrix.tsx': 3,
  'components/library/vocab/SubscribeSuccessToast.tsx': 1,
  'components/library/vocab/VocabSetCard.tsx': 2,
  'components/library/vocab/VocabSetGrid.tsx': 3,
  'components/library/vocab/VocabSetMatrix.tsx': 8,
  'components/library/vocab/VocabSpreadSheet.tsx': 3,
  'components/pairflip/PairFlipHUD.tsx': 1,
  'components/recommend/NextActionCard.tsx': 1,
  'components/text-extract/ExtractionPanel.tsx': 6,
  'components/text-extract/TokenizationSummary.tsx': 1,
  'components/textviewer/DiscoveryFooter.tsx': 1,
  'components/textviewer/MyLibraryCarousel.tsx': 3,
  'components/textviewer/TextHubContent.tsx': 6,
  'components/ui/Badge.tsx': 1,
  'components/ui/ios/GlassBar.tsx': 1,
  'components/ui/ios/InsetGroup.tsx': 1,
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name)
    if (statSync(p).isDirectory()) {
      if (name === '__tests__' || name === 'admin') continue
      walk(p, out)
    } else if (/\.(tsx?|jsx?)$/.test(name)) out.push(p)
  }
  return out
}

describe('변수 색 /N 클래스(칠해지지 않음) — 파일별 상한', () => {
  const counts = new Map<string, string[]>()
  for (const f of walk(SRC)) {
    const hits = readFileSync(f, 'utf8').match(RE)
    if (hits) counts.set(path.relative(SRC, f).split(path.sep).join('/'), hits)
  }

  it('기준선에 없는 파일에는 하나도 없다(새 결함)', () => {
    const fresh = [...counts.entries()].filter(([f]) => !(f in BASELINE)).map(([f, h]) => `${f}  ${h.join(' ')}`)
    expect(fresh).toEqual([])
  })

  it('기준선의 파일은 그 수를 넘지 않는다', () => {
    const over = [...counts.entries()].filter(([f, h]) => f in BASELINE && h.length > BASELINE[f]!).map(([f, h]) => `${f}  ${h.length} > ${BASELINE[f]}`)
    expect(over).toEqual([])
  })

  it('고친 화면 묶음(읽기 · 서가 · 단어장 허브)에는 없다', () => {
    const fixed = [...counts.keys()].filter((f) => /^components\/(workspace|wordvault\/hub)\//.test(f) || /^components\/library\/(LibraryGrid|shared\/NetflixDetailSheet|browse\/(BookFilterBar|BooksExplorer|BookGridCard))\.tsx$/.test(f))
    expect(fixed).toEqual([])
  })
})
