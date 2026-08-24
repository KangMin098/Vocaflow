// scripts/arcade/audit.mjs
//
// 아케이드 4축 실측 — 중복성 · 튜토리얼 도달률 · 자료별 게임 세트 · 랭킹.
// 매 사이클 재실행해 **같은 분모로** 진척을 잰다. 추정치를 근거로 쓰지 않기 위한 도구다.
//
//   node scripts/arcade/audit.mjs         사람이 읽는 표
//   node scripts/arcade/audit.mjs --json  기계가 읽는 JSON
//
// 파일을 문자열로 읽어 정규식으로 센다(타입 임포트 없이 CI 어디서나 돈다).
// 저장소가 CRLF 라 읽는 즉시 CR 을 털어 낸다 — 안 그러면 여러 줄 값이 통째로 안 잡힌다.

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const SRC = 'apps/web/src'
const CR = String.fromCharCode(13)
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8').split(CR).join('') : '')
const has = (p) => existsSync(join(SRC, p))

// ── 카탈로그에서 게임 목록 ────────────────────────────────────────
const catalog = read(join(SRC, 'lib/game/catalog.tsx'))
// 저장소 루트가 아닌 곳에서 돌면 전부 0 으로 나오고, 그건 '측정했더니 0' 과 구별되지 않는다.
// 0% 리포트를 진짜 후퇴로 오해하지 않도록 여기서 멈춘다.
if (!catalog) {
  console.error('카탈로그를 찾지 못했다 — 저장소 루트에서 실행할 것: node scripts/arcade/audit.mjs')
  process.exit(2)
}
const games = []
for (const block of catalog.split('slug: ').slice(1)) {
  const m = block.match(/^'([a-z-]+)'/)
  if (!m) continue
  const slug = m[1]
  if (games.some((g) => g.slug === slug)) continue
  const head = block.slice(0, 900)
  games.push({
    slug,
    family: (head.match(/family: '([a-z-]+)'/) || [])[1] ?? null,
    minWords: Number((head.match(/minWords: (\d+)/) || [])[1] ?? 0),
  })
}

// ── 브리핑(이미지 기반 튜토리얼) 파싱 ────────────────────────────
// 값이 다음 줄로 넘어가는 필드가 있다(prettier). 콜론 뒤 공백·개행을 모두 허용해야
// 그 게임이 "설명 없음"으로 잘못 집계되지 않는다.
const field = (src, name) => {
  const re = new RegExp(name + ":\\s*'([^']*)'")
  return (src.match(re) || [])[1] ?? ''
}
const briefSrc = ['recall', 'stake', 'assemble', 'rule', 'special']
  .map((f) => read(join(SRC, 'lib/game/brief', f + '.ts')))
  .join('\n')
const briefs = briefSrc.split("slug: '").slice(1).map((p) => {
  const slug = p.slice(0, p.indexOf("'"))
  const factsAt = p.indexOf('facts: {')
  const facts = factsAt >= 0 ? p.slice(factsAt) : ''
  return {
    slug,
    kind: (p.match(/kind: '(pick|group|assemble|judge|type)'/) || [])[1] ?? '?',
    promptKind: (p.match(/kind: '(text|audio|glyph|doc)'/) || [])[1] ?? 'text',
    // 판돈 통화 = HUD 게이지 라벨 집합. 설계자들이 게임을 가른 축이 바로 이것이다.
    gauges: [...p.slice(0, factsAt < 0 ? p.length : factsAt).matchAll(/label: '([^']+)'/g)]
      .map((m) => m[1])
      .filter((l) => l.length <= 8),
    run: field(facts, 'run'),
    input: field(facts, 'input'),
    figures: (p.match(/caption:/g) || []).length,
    steps: (p.match(/say:/g) || []).length,
  }
})
const briefBy = Object.fromEntries(briefs.map((b) => [b.slug, b]))

// ── 축 A · 중복성 ─────────────────────────────────────────────────
// 두 게임이 **손동작 · 문제 제시 채널 · 판돈 통화 · 한 판의 단위** 를 전부 공유하면
// 학습자에게 같은 게임이다. 같은 계열(family)로 접혀 있으면 허브에서 한 장이므로 해소로 본다.
const unit = (r) => (r.split(/[·(]/)[0] || '').trim().replace(/\d+(\.\d+)?/g, 'N')
const currency = (g) => {
  const b = briefBy[g.slug]
  if (!b || b.gauges.length === 0) return '무압력'
  return [...new Set(b.gauges)].sort().join('+')
}
const sigOf = (g) => {
  const b = briefBy[g.slug]
  if (!b) return 'NO-BRIEF:' + g.slug
  return [b.kind, b.promptKind, currency(g), unit(b.run)].join(' | ')
}
const bySig = new Map()
for (const g of games) bySig.set(sigOf(g), [...(bySig.get(sigOf(g)) ?? []), g])
const unresolvedDupes = []
for (const [sig, gs] of bySig) {
  if (gs.length < 2) continue
  const fams = new Set(gs.map((g) => g.family))
  if (fams.size === 1 && [...fams][0]) continue // 한 계열로 접힘 = 해소
  unresolvedDupes.push({ sig, slugs: gs.map((g) => g.slug) })
}
const dupedSlugs = new Set(unresolvedDupes.flatMap((d) => d.slugs))

// ── 축 B · 튜토리얼 도달률 ────────────────────────────────────────
// 브리핑 데이터가 있어도 **누를 자리가 없으면** 이해도에 기여하지 않는다.
// 학습자가 게임에 닿는 경로는 셋이다: 허브 카드 · 게임 안 · 첫 플레이 자동.
const arcade = read(join(SRC, 'app/(main)/arcade/page.tsx'))
const scaffold = read(join(SRC, 'lib/game/play-scaffold.tsx'))
// wordblitz 는 스캐폴드를 쓰지 않는 유일한 게임이라 따로 확인한다 —
// 여기를 빼먹으면 19종 중 하나만 규칙 없이 시작되는데 지표는 100% 로 보인다.
const standalone = read(join(SRC, 'app/(app)/play/wordblitz/page.tsx'))
const inGameBrief = read(join(SRC, 'components/game/brief/InGameBrief.tsx'))
const briefSeen = read(join(SRC, 'lib/game/brief-seen.ts'))
const wired = /useBriefGate/.test(scaffold) && /useBriefGate/.test(standalone)
const briefPaths = {
  hub: /BriefButton/.test(arcade),
  inGame: wired && /InGameBrief/.test(scaffold) && /InGameBrief/.test(standalone),
  // "첫 판 자동" 은 ① 본 적 있는지 기억하고 ② 안 봤으면 게임 마운트를 막아야 성립한다.
  // 둘 중 하나만 있으면 브리핑이 매번 뜨거나(성가심), 게임 뒤에서 시계가 돈다(판 소모).
  firstPlayAuto:
    wired &&
    /isBriefSeen|markBriefSeen/.test(inGameBrief) &&
    /localStorage/.test(briefSeen) &&
    /phase === 'ready'/.test(scaffold) &&
    /phase === 'ready'/.test(standalone),
}
const briefCoverage = games.filter((g) => briefBy[g.slug]).length
// 브리핑이 "그림"인지 — figure 3장 + trial 2스텝 이상이면 보드로 설명한다고 본다.
const visualEnough = games.filter((g) => (briefBy[g.slug]?.figures ?? 0) >= 3 && (briefBy[g.slug]?.steps ?? 0) >= 2).length
const pathScore = Object.values(briefPaths).filter(Boolean).length

// ── 축 C · 자료별 게임 세트 ───────────────────────────────────────
//
// "그 자료 화면에 링크가 있는가" 를 페이지 파일 하나로 재면 틀린다 — 이 앱의 자료 화면은
// 대부분 얇은 서버 페이지이고 실제 표면은 컴포넌트에 있다(도서 상세는 BookDetailClient,
// 단어장은 VocabSetPreviewModal). 그래서 **그 자료를 그리는 파일들**을 함께 본다.
const RESOURCES = [
  {
    key: 'book',
    label: '도서(챕터)',
    surfaces: [
      'app/(main)/library/books/[bookId]/page.tsx',
      'components/library/books/BookDetailClient.tsx',
    ],
  },
  {
    key: 'script',
    label: '스크립트',
    surfaces: ['app/(main)/text/[id]/page.tsx', 'components/workspace/ModePills.tsx'],
  },
  {
    key: 'wordset',
    label: '공용 단어장',
    surfaces: [
      'app/(main)/library/vocab/page.tsx',
      'components/library/vocab/VocabSetPreviewModal.tsx',
    ],
  },
]
const setsFile = read(join(SRC, 'lib/game/sets.ts'))
const resources = RESOURCES.map((r) => {
  const src = r.surfaces.map((f) => read(join(SRC, f))).join('\n')
  return {
    ...r,
    // 스코프를 실은 게임 진입이 있는가 — 스코프 없는 '/arcade' 는 자료 경로가 아니다.
    linksToArcade: /arcadeHref|CourseLauncher|\/arcade\?/.test(src),
    hasSetDesign: new RegExp("'" + r.key + "'").test(setsFile),
  }
})
const hubReadsBook = /sp\.book/.test(arcade)
const hubShowsCourse = /CourseBoard/.test(arcade)
const cDone =
  resources.filter((r) => r.linksToArcade && r.hasSetDesign).length +
  (hubReadsBook && hubShowsCourse ? 1 : 0)

// ── 축 D · 랭킹 ───────────────────────────────────────────────────
const rankingFiles = ['lib/game/ranking.ts', 'components/game/RankingBoard.tsx', 'app/(main)/arcade/ranking/page.tsx']
const rankingPresent = rankingFiles.filter(has)
const rankMigrations = existsSync('supabase/migrations')
  ? readdirSync('supabase/migrations').filter((f) => /game_rank|arcade_rank|leaderboard/i.test(f))
  : []
const dDone = rankingPresent.length + (rankMigrations.length ? 1 : 0)

// ── 집계 ──────────────────────────────────────────────────────────
const axis = (num, den) => ({ num, den, pct: den === 0 ? 0 : Math.round((num / den) * 1000) / 10 })
const A = { ...axis(games.length - dupedSlugs.size, games.length), unresolvedDupes }
const B = { ...axis(visualEnough * pathScore, games.length * 3), coverage: briefCoverage, visualEnough, paths: briefPaths }
const C = { ...axis(cDone, RESOURCES.length + 1), resources, hubReadsBook }
const D = { ...axis(dDone, rankingFiles.length + 1), present: rankingPresent, migrations: rankMigrations }
const overall = Math.round(((A.pct + B.pct + C.pct + D.pct) / 4) * 10) / 10

const report = { games: games.length, A, B, C, D, overall }

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2))
} else {
  const p = (x) => String(x.pct).padStart(5) + '%'
  console.log('\n게임 ' + games.length + '종\n')
  console.log('A 중복성 해소      ' + p(A) + '  (' + A.num + '/' + A.den + ')')
  for (const d of unresolvedDupes) console.log('   ⚠ ' + d.sig + '  →  ' + d.slugs.join(', '))
  if (!unresolvedDupes.length) console.log('   ✅ 같은 (손동작·채널·통화·단위) 를 공유하는 미접힘 쌍 없음')
  console.log('B 튜토리얼 도달률  ' + p(B) + '  (보드형 ' + visualEnough + '/' + games.length + ' × 진입 ' + pathScore + '/3)')
  for (const [k, v] of Object.entries(briefPaths)) console.log('   ' + (v ? '✅' : '❌') + ' ' + k)
  console.log('C 자료별 게임 세트 ' + p(C) + '  (' + C.num + '/' + C.den + ')')
  for (const r of resources) console.log('   ' + (r.linksToArcade ? '✅' : '❌') + ' 링크  ' + (r.hasSetDesign ? '✅' : '❌') + ' 세트   ' + r.label)
  console.log('   ' + (hubReadsBook ? '✅' : '❌') + ' 허브가 ?book= 스코프를 읽음')
  console.log('   ' + (hubShowsCourse ? '✅' : '❌') + ' 허브가 코스 보드를 그림')
  console.log('D 랭킹            ' + p(D) + '  (' + D.num + '/' + D.den + ')')
  for (const f of rankingFiles) console.log('   ' + (has(f) ? '✅' : '❌') + ' ' + f)
  console.log('   ' + (rankMigrations.length ? '✅' : '❌') + ' 랭킹 마이그레이션')
  console.log('\n종합 ' + overall + '%\n')
}
