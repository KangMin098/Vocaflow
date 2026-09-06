// scripts/vocab/brand-drain-export.mts
//
// **브랜드 드레인 1/3 — Claude Design 이 그릴 몫을 청크로 뽑는다.**
//
// ── 무엇을 브랜딩하나 ──────────────────────────────────────────────
// 단위는 **계열(family) 다섯**이다. 세트 하나하나가 아니라 계열이 브랜드를 갖는 이유는
// 서가가 계열로 읽히기 때문이다 — 표지 듀오톤이 계열 색이고, 학습자는 "저건 원서 계열" 을
// 색으로 안다(`covers/design.ts`). 세트마다 브랜드를 만들면 서가가 잡지 스크랩북이 된다.
//
// ── 3단 구조 (CLAUDE.md §🤖) ────────────────────────────────────────
//   ① 이 스크립트            — 계열별 청크를 `scripts/vocab/brand-drain/chunk-NN.json` 으로
//   ② Claude Code + Claude Design — 아트보드를 그려 규격을 확정하고 `chunk-NN.out.json` 으로
//   ③ `brand-drain-import.mjs --commit` — `curation_query.brand` 에 키를 **더한다**
//
// ── 재실행 안전 ────────────────────────────────────────────────────
// **이미 브랜드가 각인된 계열은 건너뛴다.** 몇 번을 돌려도 결과가 같다. 다시 그리려면
// `--force` 를 주거나 그 계열의 `.out.json` 을 지우고 import 를 다시 돌린다.
//
// ⚠️ `.mts` 인 이유: 규격을 `@vocaflow/library-pipeline` 에서 **읽어야** 하는데(색을 사본으로
//    적지 않기 위해) 그 패키지는 TS 소스를 그대로 내보내므로 순수 node 로는 풀리지 않는다.
// 실행: npx tsx --tsconfig apps/web/tsconfig.json scripts/vocab/brand-drain-export.mts [--force] [--out <디렉터리>]

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const { createClient } = await import('@supabase/supabase-js')
const { FAMILY_DUOTONE } = await import('@vocaflow/library-pipeline/vocab-brand')

const argOf = (flag, fallback = null) => {
  const i = process.argv.indexOf(flag)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const FORCE = process.argv.includes('--force')
const OUT_DIR = path.resolve(argOf('--out', 'scripts/vocab/brand-drain'))

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)

/** 카탈로그에서 빼는 칸 — 소스 종속 자동생성이라 학습자의 공용 서가에 안 뜬다. */
const HIDDEN_CATEGORIES = ['library_book', 'library_article']

/**
 * blueprint → 계열. `compose/blueprints.ts` 의 `family` 와 **같은 눈금**이어야 한다.
 *
 * ⚠️ 여기에 사본을 두는 것이 마음에 걸리지만 그 파일은 `apps/web` 안이라 스크립트에서
 *    가져오지 못한다. 그래서 **모르는 blueprint 는 조용히 넘기지 않고 세어서 보고한다** —
 *    표가 낡으면 그 계열이 통째로 비는데, 조용하면 알 방법이 없다.
 */
const FAMILY_OF = {
  'freq-tier': 'list', 'exam-list': 'list', 'curriculum-grade': 'list', 'academic-awl': 'list',
  'level-band': 'list', 'domain-specialty': 'list', 'exam-items': 'list',
  'root-etymology': 'structure', 'word-family': 'structure', 'pos-focus': 'structure',
  'topic-field': 'structure', 'synonym-cluster': 'structure', 'antonym-pair': 'structure',
  confusable: 'structure', collocation: 'structure', 'phrasal-idiom': 'structure',
  polysemy: 'structure', 'rhyme-phonics': 'structure',
  'book-companion': 'corpus', 'chapter-companion': 'corpus', 'news-article': 'corpus',
  'script-media': 'corpus',
  'day-pacing': 'delivery', 'mnemonic-story': 'delivery', 'picture-dict': 'delivery',
  'audio-only': 'delivery',
  unlock: 'unique', recycle: 'unique', 'facet-ladder': 'unique', 'confusion-log': 'unique',
  uncovered: 'unique',
}

const { data: sets, error } = await supabase
  .from('shared_word_sets')
  .select('id, title, category, curation_query, cover_image_url, word_count')
  .eq('is_published', true)
  .not('category', 'in', `(${HIDDEN_CATEGORIES.join(',')})`)
  .order('id')
if (error) throw new Error(`shared_word_sets: ${error.message}`)

const byFamily = new Map()
let unknownBlueprints = new Map()
for (const s of sets) {
  const bp = s.curation_query?.blueprint ?? null
  const fam = bp ? FAMILY_OF[bp] : null
  if (bp && !fam) unknownBlueprints.set(bp, (unknownBlueprints.get(bp) ?? 0) + 1)
  const key = fam ?? 'list' // 계열을 모르면 목록 계열로 — 서가에서 빠지는 것보다 낫다
  if (!byFamily.has(key)) byFamily.set(key, [])
  byFamily.get(key).push({
    id: s.id,
    title: s.title,
    blueprint: bp,
    words: s.word_count ?? 0,
    hasCover: !!s.cover_image_url,
    /** 이미 각인된 브랜드가 있나 — 재실행 안전의 근거. */
    branded: !!s.curation_query?.brand,
  })
}

fs.mkdirSync(OUT_DIR, { recursive: true })
const families = Object.keys(FAMILY_DUOTONE.light)
let written = 0
let skipped = 0

families.forEach((family, i) => {
  const members = byFamily.get(family) ?? []
  const allBranded = members.length > 0 && members.every((m) => m.branded)
  if (allBranded && !FORCE) { skipped += 1; return }

  const chunk = {
    $schema: 'vocab-brand-drain/1',
    family,
    /**
     * Claude Design 에게 주는 **사실만**. 무엇을 그릴지는 지시하지 않는다 —
     * 지시하면 결과가 지시의 반복이 되고, 그건 디자인이 아니라 받아쓰기다.
     */
    facts: {
      setCount: members.length,
      wordCount: members.reduce((n, m) => n + m.words, 0),
      coversPresent: members.filter((m) => m.hasCover).length,
      blueprints: [...new Set(members.map((m) => m.blueprint).filter(Boolean))].sort(),
      titles: members.map((m) => m.title).slice(0, 12),
      /** 색은 **읽어서** 보여 준다 — 캔버스는 이 값을 담을 수 없고 역할 이름만 담는다. */
      duotoneNow: {
        light: FAMILY_DUOTONE.light[family],
        dark: FAMILY_DUOTONE.dark[family],
      },
    },
    setIds: members.map((m) => m.id),
    alreadyBranded: members.filter((m) => m.branded).length,
    instructions:
      'Claude Design 캔버스로 이 계열의 표지 규격을 확정한 뒤 `chunk-NN.out.json` 에 '
      + 'VocabBrandCanvas 한 개를 쓴다. **색 값(hex/rgb)을 담으면 import 가 거절한다** — '
      + '역할 이름(ink·paper·accent)만 쓴다. 값은 디자인 토큰이 정본이다.',
  }
  const file = path.join(OUT_DIR, `chunk-${String(i + 1).padStart(2, '0')}.json`)
  fs.writeFileSync(file, `${JSON.stringify(chunk, null, 2)}\n`, 'utf8')
  written += 1
})

console.log(`브랜드 드레인 export — 계열 ${families.length} · 발행 세트 ${sets.length}`)
console.log(`  청크 ${written}개 → ${OUT_DIR}`)
console.log(`  건너뜀 ${skipped}개 (이미 전권 각인 — 다시 그리려면 --force)`)
if (unknownBlueprints.size > 0) {
  console.log(`  ⚠️ 계열을 모르는 blueprint ${unknownBlueprints.size}종 (목록 계열로 넣었다):`)
  for (const [bp, n] of unknownBlueprints) console.log(`     ${bp} × ${n}`)
  console.log('     → FAMILY_OF 표를 blueprints.ts 와 맞출 것.')
}
