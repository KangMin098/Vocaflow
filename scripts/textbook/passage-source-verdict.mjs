// scripts/textbook/passage-source-verdict.mjs
//
// **재검증 판정 — 프로브 실측을 "무엇부터 붙일 것인가" 로 바꾼다.**
//
// ── 무엇이 순위를 정하는가 ───────────────────────────────────────────
// 사용자 표의 순위는 **채택 추정 편수**로 매겨져 있다. 그 축만 보면 1위가
// The Conversation(6,000편)인데, 이 저장소에서 그 소스는 **문항 0개**를 만든다
// (CC BY-ND → `display_only` → 문항 생성기가 통째로 건너뛴다. 2026-08-21 실측).
// 즉 편수는 상한이지 공급량이 아니다. 판정은 세 축을 **곱한다**:
//
//   ① 열거   맨 GET 으로 전수를 셀 수 있는가        (프로브 verdict)
//   ② 변형   본문을 잘라 문항으로 바꿀 수 있는가     (license → open / display)
//   ③ 적합   교재가 요구하는 장르·학령인가          (register · band)
//
// 하나라도 0 이면 곱이 0 이다. **PD 인지 아닌지는 ②의 한 값일 뿐**이고 순위를 정하지 않는다 —
// PD 가 아닌 CC BY(MDPI·Futurity·eLife·Global Voices)가 PD 인 Gutenberg 보다 위에 오는 이유다.
//
// ── 등급 ─────────────────────────────────────────────────────────────
//   A 즉시 착수      열거 ⭕ · 변형 ⭕ — 어댑터만 쓰면 문항이 나온다
//   B 편당 판정 필요  열거 ⭕ · 변형 항목별 — 라이선스 필터를 먼저 만들어야 한다
//   C 비개방 파이프라인 열거 ⭕ · 변형 ❌ — 원문 열람·출처 표시용. 문항은 못 만든다
//   D 열거 수단 개발  페이지는 살아 있으나 피드가 없다 — 목록 파서가 필요하다
//   E 지금은 불가     차단(403/429) · 죽음 · 제외 · 색인 전용
//
// 재실행 안전: 프로브 JSON 만 읽는다. 네트워크·DB 를 건드리지 않는다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/passage-source-verdict.mjs
//   pnpm dlx tsx scripts/textbook/passage-source-verdict.mjs --md docs/reports/<이름>.md

import fs from 'node:fs'
import path from 'node:path'

const PROBE = path.resolve('scripts/textbook/passage-source-probe.json')
const OUT_JSON = path.resolve('scripts/textbook/passage-source-verdict.json')

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const mdOut = arg('md')

const probe = JSON.parse(fs.readFileSync(PROBE, 'utf8'))

/** ① 열거 — 이 판정들만 "맨 GET 으로 전수를 셀 수 있다". */
const ENUMERABLE = new Set(['rss', 'oai', 'api', 'list'])
/** 페이지는 살아 있으나 피드가 없다 — 목록 파서를 만들면 열거가 된다. */
const NEEDS_PARSER = new Set(['html'])

/** ② 변형 — `derivClaim` 을 파이프라인 이름으로 바꾼다. */
const ROUTE = { yes: 'open', no: 'display', mixed: 'per-item', unknown: 'verify' }
const ROUTE_LABEL = {
  open: '개방 파이프라인 (문항 변형 가능)',
  display: '비개방 파이프라인 (표시 전용 · 문항 0)',
  'per-item': '개방 파이프라인 + 편당 라이선스 필터',
  verify: '라이선스 확인 후 결정',
}

function grade(r) {
  if (!ENUMERABLE.has(r.verdict)) return NEEDS_PARSER.has(r.verdict) ? 'D' : 'E'
  const route = ROUTE[r.derivClaim] ?? 'verify'
  if (route === 'open') return 'A'
  if (route === 'per-item') return 'B'
  if (route === 'display') return 'C'
  return 'B'
}

/**
 * **실측 상류** — 소스가 스스로 말한 수. `total` 이 있으면 그것, 없으면 한 번 GET 에 잡힌 항목 수.
 * ⚠️ 교재에 실을 수 있는 수가 아니다. 감쇠는 `source-eligibility-scan.mjs` 소관.
 */
const upstream = (r) => (r.total != null ? r.total : (r.items ?? 0))

/**
 * **상류 수가 무엇을 센 것인가.** 이 구분이 없으면 표가 거짓말을 한다 —
 * MDPI 2,035,254 는 소스가 공표한 **총량**이고 Futurity 10 은 RSS **한 페이지** 분량이다.
 * 둘을 같은 열에 놓고 내림차순하면 Futurity 가 바닥에 오는데, 실제 보유량은 수만 편이다.
 *   total 소스가 공표한 전체 건수 (api·oai 의 total)
 *   page  한 번 GET 에 잡힌 수 — **하한**이다. 실제 보유량은 이보다 크다
 */
 const upstreamKind = (r) => (r.total != null ? 'total' : 'page')

const rows = probe.results.map((r) => ({
  ...r,
  grade: grade(r),
  route: ROUTE[r.derivClaim] ?? 'verify',
  enumerable: ENUMERABLE.has(r.verdict),
  upstream: upstream(r),
  upstreamKind: upstreamKind(r),
}))

const GRADE_ORDER = { A: 0, B: 1, C: 2, D: 3, E: 4 }
rows.sort(
  (a, b) =>
    GRADE_ORDER[a.grade] - GRADE_ORDER[b.grade] ||
    (a.upstreamKind === b.upstreamKind ? 0 : a.upstreamKind === 'total' ? -1 : 1) ||
    b.upstream - a.upstream ||
    a.rank - b.rank,
)

const tally = {}
for (const r of rows) tally[r.grade] = (tally[r.grade] ?? 0) + 1

/** 등급별 상류 합. **A 등급의 합이 이 작업의 실질 상한**이다. */
const upstreamBy = {}
for (const r of rows)
  if (r.upstreamKind === 'total')
    upstreamBy[r.grade] = (upstreamBy[r.grade] ?? 0) + r.upstream

const wiredIn = (g) => rows.filter((r) => r.grade === g && r.wired).length

console.log('등급     소스  상류 합        그중 이미 배선')
for (const g of ['A', 'B', 'C', 'D', 'E']) {
  console.log(
    `${g}  ${String(tally[g] ?? 0).padStart(8)}  ${(upstreamBy[g] ?? 0).toLocaleString().padStart(14)}  ${String(wiredIn(g)).padStart(8)}`,
  )
}

console.log('\n── A 등급 (즉시 착수 — 열거 ⭕ 변형 ⭕) ─────────────────────')
for (const r of rows.filter((x) => x.grade === 'A')) {
  console.log(
    `${(r.wired ? '●' : '○')} ${r.id.padEnd(22)} ${String(r.upstream).padStart(11)}${r.upstreamKind === 'total' ? ' ' : '↑'} ` +
      `${r.register.padEnd(14)} ${r.band.padEnd(7)} ${r.licenseClaim}`,
  )
}

console.log('\n── B 등급 (편당 라이선스 필터가 먼저) ───────────────────────')
for (const r of rows.filter((x) => x.grade === 'B')) {
  console.log(`${(r.wired ? '●' : '○')} ${r.id.padEnd(22)} ${String(r.upstream).padStart(11)}  ${r.licenseClaim}`)
}

fs.writeFileSync(
  OUT_JSON,
  JSON.stringify(
    {
      measured_at: probe.measured_at,
      verdict_at: new Date().toISOString(),
      tally,
      upstream_by_grade: upstreamBy,
      rows: rows.map((r) => ({
        grade: r.grade,
        id: r.id,
        label: r.label,
        rank: r.rank,
        est: r.est,
        upstream: r.upstream,
        upstreamKind: r.upstreamKind,
        verdict: r.verdict,
        route: r.route,
        wired: r.wired,
        register: r.register,
        band: r.band,
        licenseClaim: r.licenseClaim,
        licenseHits: r.licenseHits ?? [],
        licensePageHits: r.licensePage?.hits ?? [],
        note: r.note,
      })),
    },
    null,
    2,
  ),
)
console.log(`\n→ ${path.relative(process.cwd(), OUT_JSON)}`)

// ── 마크다운 리포트 ─────────────────────────────────────────────────
if (mdOut) {
  const esc = (s) => String(s ?? '').replace(/\|/g, '\\|')
  const table = (list) =>
    [
      '| 등급 | 소스 | 실측 상류 | 센 것 | 열거 | 파이프라인 | register | 밴드 | 라이선스 주장 | 근거(실측) |',
      '|---|---|---:|---|---|---|---|---|---|---|',
      ...list.map(
        (r) =>
          `| ${r.grade} | ${r.wired ? '● ' : ''}${esc(r.id)} | ${r.upstream.toLocaleString()} | ${r.upstreamKind === 'total' ? '총량' : '1페이지(하한)'} | ${r.verdict} | ${ROUTE_LABEL[r.route]} | ${r.register} | ${r.band} | ${esc(r.licenseClaim)} | ${esc([...(r.licenseHits ?? []), ...(r.licensePage?.hits ?? []).map((h) => `약관:${h}`)].join(' · ') || '—')} |`,
      ),
    ].join('\n')

  const md = `# 교재 지문 원문 소스 재검증 — 실측 판정

측정 ${probe.measured_at.slice(0, 10)} · 후보 **${rows.length}항목** 전수 프로브 · 판정 스크립트
\`scripts/textbook/passage-source-verdict.mjs\` · 원자료 \`scripts/textbook/passage-source-probe.json\`

**● = 이미 배선된 소스**(\`library_articles_source_check\`). 실측 상류는 **소스가 스스로 말한 수**이고
교재에 실을 수 있는 수가 아니다 — 감쇠는 \`source-eligibility-scan.mjs\` 소관.

## 등급 요약

| 등급 | 뜻 | 소스 | 상류 합 (총량 공표분만) | 그중 배선됨 |
|---|---|---:|---:|---:|
| A | 즉시 착수 — 열거 ⭕ 변형 ⭕ | ${tally.A ?? 0} | ${(upstreamBy.A ?? 0).toLocaleString()} | ${wiredIn('A')} |
| B | 편당 라이선스 필터가 먼저 | ${tally.B ?? 0} | ${(upstreamBy.B ?? 0).toLocaleString()} | ${wiredIn('B')} |
| C | 비개방 파이프라인 (표시 전용) | ${tally.C ?? 0} | ${(upstreamBy.C ?? 0).toLocaleString()} | ${wiredIn('C')} |
| D | 열거 수단 개발 필요 (피드 없음) | ${tally.D ?? 0} | ${(upstreamBy.D ?? 0).toLocaleString()} | ${wiredIn('D')} |
| E | 지금은 불가 (차단·죽음·제외·색인) | ${tally.E ?? 0} | ${(upstreamBy.E ?? 0).toLocaleString()} | ${wiredIn('E')} |

## 핵심 발견 — 사용자 표와 어긋나는 곳

1. **표 1위가 이 플랫폼에서는 문항 0이다.** The Conversation(채택추정 6,000)은 CC BY-ND →
   \`display_only\` → 문항 생성기가 통째로 건너뛴다. 실측 2026-08-21 에 논증문 신규 46편이
   전부 이 이유로 문항 0이 됐다. **원문은 확보하되(비개방 파이프라인) 문항 공급선으로 세지 않는다.**

2. **논증문 구멍은 A 등급으로 안 메워진다.** A 등급 ${tally.A} 곳 중 register 가 argumentative 인 것은
   **${rows.filter((r) => r.grade === 'A' && r.register === 'argumentative').map((r) => r.id).join(' · ')}** 뿐이다.
   현재 DB 의 변형 가능 논증문은 **1,485편 · 소스 2곳**(plos 1,476 · owid 9)이고, A 등급을 다 붙여도
   이 축은 거의 늘지 않는다 — 늘어나는 것은 설명문이다.

3. **가장 큰 지렛대는 B 등급의 DOAB 다.** 127,677권 중 전 구간 균등 표본 1,500건 실측에서
   **CC BY·BY-SA·CC0 가 33.6%** → 전체 환산 약 **42,899권**(\`scripts/textbook/oai-license-tally.mjs\`).
   장르가 학술 단행본이라 논증문이고 밴드가 C1–C2 다. 다만 **편당 라이선스 필터가 먼저** 필요하다 —
   ND·NC 가 56.0%, 표기 없음이 10.4% 로 같이 섞여 있어 통째로 적재하면 위법이 조용히 들어온다.

4. **설명문 상류는 이미 남아돈다.** MDPI 2,035,254(CC BY) · PMC OA 8,219,033 · Wikipedia 7,239,051.
   즉 이 작업의 병목은 **수량이 아니라 장르와 라이선스**다.

5. **표가 0점을 준 StoryWeaver 는 이 저장소가 의도적으로 붙인 것이다** — 초·중 창 154편의 register 를
   세니 narrative 0 이었고, 편수로는 해결되지 않는 결핍이었다(2026-09-02). 다만 오늘 실측에서
   목록 페이지가 JS 껍데기(링크 0)라 **맨 GET 으로는 열거되지 않는다**.

6. **배선됐는데 흐르지 않는 곳이 있다.** frontiers 1,961편이 전부 \`queued\`(ready 0) · voa \`queued\` 10,397편 ·
   worldbank·cdc·nih·wikinews 는 배선만 있고 적재 0편. **새 소스를 붙이기 전에 이 적체가 먼저다** —
   상류를 늘려도 큐가 막혀 있으면 교재 재고는 그대로다.

7. **죽은 것으로 적을 뻔한 것들.** 이 프로브는 처음에 배선된 소스 9곳을 「죽음」으로 냈다. 원인은 소스가
   아니라 ① 내가 짐작한 주소 ② 이 머신의 node TLS(gutenberg.org 는 curl 200 · node ECONNRESET)였다.
   지금은 배선표의 주소를 쓰고 curl 로 한 번 더 묻는다. **실측 도구가 틀리면 근거가 통째로 거짓이 된다.**

8. **진짜로 못 쓰는 것.** Wikinews 는 최근 30일 항목 **0건**(사실상 정지) · Census 보도자료 피드는
   \`<link/>\`·\`<guid/>\` 가 전부 비어 기사 주소가 없다 · OpenStax·StoryWeaver·CK-12 는 JS 껍데기다.

## A — 즉시 착수

${table(rows.filter((r) => r.grade === 'A'))}

## B — 편당 라이선스 판정이 먼저

${table(rows.filter((r) => r.grade === 'B'))}

## C — 비개방 파이프라인 (원문은 확보하되 문항은 못 만든다)

${table(rows.filter((r) => r.grade === 'C'))}

## D — 페이지는 살아 있고 피드가 없다 (목록 파서 필요)

${table(rows.filter((r) => r.grade === 'D'))}

## E — 지금은 불가

${table(rows.filter((r) => r.grade === 'E'))}
`
  fs.writeFileSync(path.resolve(mdOut), md)
  console.log(`→ ${mdOut}`)
}
