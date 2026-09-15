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

/**
 * **주장은 레지스트리에서, 측정은 프로브에서.** 프로브 결과에 주장을 복사해 두면 축을 하나
 * 더할 때마다 프로브를 다시 돌려야 하고, 잊으면 **새 축이 전부 undefined 로 떨어진다** —
 * 실측 2026-09-13: 재배포 축을 더한 직후 C 등급이 0, F 가 24 로 나왔다(전부 판정 불가로 접혔다).
 * 그래서 여기서 id 로 이어 붙인다. 프로브는 잰 것만 나른다.
 */
const REGISTRY = JSON.parse(
  fs.readFileSync(path.resolve('scripts/textbook/passage-source-candidates.json'), 'utf8'),
)
const CLAIM = new Map(REGISTRY.candidates.map((c) => [c.id, c]))

/** ① 열거 — 이 판정들만 "맨 GET 으로 전수를 셀 수 있다". */
const ENUMERABLE = new Set(['rss', 'oai', 'api', 'list'])
/** 페이지는 살아 있으나 피드가 없다 — 목록 파서를 만들면 열거가 된다. */
const NEEDS_PARSER = new Set(['html'])

/**
 * ② 권리 — **두 축이다.** 한 축으로 두면 법적으로 정반대인 둘이 같은 칸에 들어간다:
 *
 *   derive      본문을 잘라 문항으로 바꿀 수 있는가 (파생)
 *   redistribute 원문을 그대로 실을 수 있는가 (재배포)
 *
 * CC BY-ND 는 재배포 ⭕ 파생 ❌ 다 — 원문은 확보할 수 있고 문항만 못 만든다.
 * © 전부유보는 **재배포부터 ❌** 라 본문을 저장하는 것 자체가 안 된다. 실측 2026-09-13 에
 * 이 둘이 `derivClaim: 'no'` 한 칸에 38곳이 섞여 있었고(재배포 가능 18 · 불가 20),
 * 그 상태로 「비개방 파이프라인」을 만들면 **© 본문을 DB 에 담는 코드**를 짜게 된다.
 */
function routeOf(derive, redistribute, commercial) {
  if (derive === 'yes') return 'open'
  if (derive === 'mixed') return 'per-item'
  if (derive === 'unknown') return 'verify'
  // derive === 'no'
  if (redistribute !== 'yes') return 'link-only'
  // **세 번째 축 — NC 는 ND 와 다르다.** ND 는 상업적 재배포가 되고(변형만 막힌다) NC 는
  //   상업적 이용 자체를 막아 **표시조차** 안 된다. 이 플랫폼은 유료 결제를 향하고 있으므로
  //   NC 는 비개방 파이프라인에도 들어갈 수 없다. 실측 2026-09-13: RSS 에 전문을 싣는 4곳
  //   (propublica · nieman_lab · ideas_ted · mit_news)이 전부 NC 였다 — 이 축이 없으면
  //   그 넷을 「원문 확보 가능」으로 읽고 배선하게 된다.
  if (commercial === 'yes') return 'display'
  return 'noncommercial'
}
const ROUTE_LABEL = {
  open: '개방 파이프라인 (문항 변형 가능)',
  display: '비개방 파이프라인 (원문 확보 ⭕ · 문항 0)',
  noncommercial: '비상업 전용 · 라이선스 미확인 — 유료 플랫폼에서는 쓰지 않는다',
  'link-only': '본문 저장 불가 — 제목·URL·출처만',
  'per-item': '개방 파이프라인 + 편당 라이선스 필터',
  verify: '라이선스 확인 후 결정',
}

function grade(r) {
  if (!ENUMERABLE.has(r.verdict)) return NEEDS_PARSER.has(r.verdict) ? 'D' : 'E'
  const route = routeOf(r.derivClaim, r.redistributeClaim, r.commercialClaim)
  if (route === 'open') return 'A'
  if (route === 'per-item') return 'B'
  if (route === 'display') return 'C'
  // **F 는 C 의 일부가 아니다.** 여기 있는 소스는 원문을 담을 수 없다 — 소재 참고용
  //   메타데이터(제목·URL·출처)만 남긴다. C 와 섞으면 담아도 되는 것으로 읽힌다.
  if (route === 'noncommercial') return 'N'
  if (route === 'link-only') return 'F'
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
  // 주장 3종은 레지스트리가 정본이다 — 프로브가 옛 값을 들고 있어도 여기서 맞춰진다.
  derivClaim: CLAIM.get(r.id)?.derivClaim ?? r.derivClaim,
  redistributeClaim: CLAIM.get(r.id)?.redistributeClaim ?? 'unknown',
  commercialClaim: CLAIM.get(r.id)?.commercialClaim ?? 'unknown',
  commercialWhy: CLAIM.get(r.id)?.commercialWhy ?? null,
  feedBody: CLAIM.get(r.id)?.feedBody ?? 'unknown',
  redistributeWhy: CLAIM.get(r.id)?.redistributeWhy ?? null,
  licenseClaim: CLAIM.get(r.id)?.licenseClaim ?? r.licenseClaim,
  // 배선 여부도 레지스트리가 정본이다 — 프로브 스냅샷은 배선 전에 찍혔을 수 있다.
  wired: CLAIM.get(r.id)?.wired ?? r.wired,
  grade: grade({
    ...r,
    derivClaim: CLAIM.get(r.id)?.derivClaim ?? r.derivClaim,
    redistributeClaim: CLAIM.get(r.id)?.redistributeClaim ?? 'unknown',
    commercialClaim: CLAIM.get(r.id)?.commercialClaim ?? 'unknown',
  }),
  route: routeOf(
    CLAIM.get(r.id)?.derivClaim ?? r.derivClaim,
    CLAIM.get(r.id)?.redistributeClaim ?? 'unknown',
    CLAIM.get(r.id)?.commercialClaim ?? 'unknown',
  ),
  enumerable: ENUMERABLE.has(r.verdict),
  upstream: upstream(r),
  upstreamKind: upstreamKind(r),
}))

const GRADE_ORDER = { A: 0, B: 1, C: 2, N: 3, F: 4, D: 5, E: 6 }
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
for (const g of ['A', 'B', 'C', 'N', 'F', 'D', 'E']) {
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
        derivClaim: r.derivClaim,
        redistributeClaim: r.redistributeClaim,
        redistributeWhy: r.redistributeWhy,
        commercialClaim: r.commercialClaim,
        commercialWhy: r.commercialWhy,
        feedBody: r.feedBody,
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
      '| 등급 | 소스 | 실측 상류 | 센 것 | 열거 | 파이프라인 | 파생 | 재배포 | 상업 | 피드 본문 | register | 밴드 | 라이선스 주장 | 근거(실측) |',
      '|---|---|---:|---|---|---|---|---|---|---|---|---|---|---|',
      ...list.map(
        (r) =>
          `| ${r.grade} | ${r.wired ? '● ' : ''}${esc(r.id)} | ${r.upstream.toLocaleString()} | ${r.upstreamKind === 'total' ? '총량' : '1페이지(하한)'} | ${r.verdict} | ${ROUTE_LABEL[r.route]} | ${r.derivClaim} | ${r.redistributeClaim} | ${r.commercialClaim} | ${r.feedBody} | ${r.register} | ${r.band} | ${esc(r.licenseClaim)} | ${esc([...(r.licenseHits ?? []), ...(r.licensePage?.hits ?? []).map((h) => `약관:${h}`)].join(' · ') || '—')} |`,
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
| C | 비개방 파이프라인 — 원문 확보 ⭕ 문항 0 | ${tally.C ?? 0} | ${(upstreamBy.C ?? 0).toLocaleString()} | ${wiredIn('C')} |
| N | **비상업 전용(NC)·미확인** — 유료 플랫폼 사용 불가 | ${tally.N ?? 0} | ${(upstreamBy.N ?? 0).toLocaleString()} | ${wiredIn('N')} |
| F | **본문 저장 불가** — 제목·URL·출처만 | ${tally.F ?? 0} | ${(upstreamBy.F ?? 0).toLocaleString()} | ${wiredIn('F')} |
| D | 열거 수단 개발 필요 (피드 없음) | ${tally.D ?? 0} | ${(upstreamBy.D ?? 0).toLocaleString()} | ${wiredIn('D')} |
| E | 지금은 불가 (차단·죽음·제외·색인) | ${tally.E ?? 0} | ${(upstreamBy.E ?? 0).toLocaleString()} | ${wiredIn('E')} |

## 핵심 발견 — 사용자 표와 어긋나는 곳

0. **「논증문이 부족하다」가 이 목표의 전제였는데, 그것이 라벨링의 결과였다.**
   \`register\` 는 \`resolveArticleRegister(source, feedId)\` → 조회표에서 나온다 — **본문을 한 글자도
   보지 않는다.** 그래서 frontiers 1,958편이 내용과 무관하게 전부 expository 로 들어갔다.
   평가원 기출 **796편**을 담화 표지로 재서 눈금을 잡고(중앙 **5.33**/1,000어) 같은 자로 재고를 재니:

   | | 값 |
   |---|---|
   | 선언 argumentative (변형 가능 행) | **1,485편** |
   | 측정 기준 기출 중앙 이상 (변형 가능 행) | **≈ 23,405편** |
   | 배수 | **≈ 15.8배** |

   소스별 통과율: plos **72%** · frontiers **70%** · elife 53% · gutenberg 43% —
   그런데 **선언이 argumentative 인 owid 는 0%**, the_conversation 은 33% 였다.
   선언 expository 행 중 **38%** 가 선언 argumentative 의 중앙값을 넘었다(무작위면 50%).
   → **선언은 측정을 갈라 주지 않는다.** 새 소스를 붙이는 일보다 **이미 가진 것을 재는 일**이 먼저였다.
   자 \`packages/library-pipeline/src/textbook/register-signal.ts\` · 계측 \`scripts/textbook/register-measure-probe.mjs\`.

   ⚠️ 이 자는 논증의 **형태**를 재며 **질**을 재지 않는다. 후보 선별용이고 최종 판정은 사람·LLM 몫이다.

0-2. **「pd 외 별도 파이프라인」에 새로 붙일 수 있는 소스가 없다 — 그것이 이 사이클의 답이다.**
   비개방(원문 확보 O · 문항 0) 파이프라인은 이미 있고 실제로 소비된다 —
   \`lib/articles/source-map.ts\` 가 \`derivation=display_only\` 를 **\`read_nd\` 학습 경로**로 보내고,
   \`/library/scripts/[bookId]\` 에 ND 25편이 라이선스 표기와 함께 살아 있다. 문제는 공급이었다:

   | 축 | 실측 |
   |---|---|
   | 재배포 가능(ND·NC) | 18곳 |
   | 그중 **상업 이용 가능** | **2곳** (the_conversation · knowable) |
   | 그중 열거 가능 + 미배선 | **0곳** |

   **NC 는 ND 와 다르다.** ND 는 상업적 재배포가 되고(변형만 막힌다) NC 는 상업적 이용 자체를
   막아 **표시조차** 안 된다. 이 플랫폼은 유료 결제를 향하므로 NC 는 비개방 파이프라인에도
   들어갈 수 없다. 그런데 실측해 보니 **RSS 에 전문을 싣는 4곳이 전부 NC** 였다 —
   propublica 5,366어 · nieman_lab 3,564 · ideas_ted 1,583 · mit_news 1,175.
   축을 쪼개지 않았다면 그 넷을 그대로 배선했을 것이다.
   나머지는 RSS 에 본문이 없다(quanta 63어 · undark 51 · rand 39 · inside_climate 77).
   mongabay·undark 는 CC BY-ND 로 주장되지만 **자기 약관 페이지에서 CC 링크를 찾지 못했다** —
   Aeon 을 'cc' 로 적었던 2026-08-19 과 같은 일을 반복하지 않으려고 \`unknown\` 으로 남긴다.

   → 남은 길은 코드가 아니다: **발행사에 직접 라이선스를 확인**하거나, ND 가 확인된 뒤
     사이트별 본문 추출기를 만드는 것. 어댑터를 9개 짜는 일은 필요하지 않았다.
1. **표 1위가 이 플랫폼에서는 문항 0이다.** The Conversation(채택추정 6,000)은 CC BY-ND →
   \`display_only\` → 문항 생성기가 통째로 건너뛴다. 실측 2026-08-21 에 논증문 신규 46편이
   전부 이 이유로 문항 0이 됐다. **원문은 확보하되(비개방 파이프라인) 문항 공급선으로 세지 않는다.**

2. **표가 0점을 준 Europe PMC 가 실제로는 최대 공급선이다.** 표는 「색인·집계용, 원문 아님」으로
   뺐지만 실측은 반대다:
   - \`LICENSE:"cc by" AND LANG:"eng" AND IN_EPMC:y\` → **5,218,944편** · 그중 \`PUB_TYPE:"review"\` **618,178편**
   - **라이선스 필터가 질의 파라미터**다 — DOAB 처럼 편당 판정을 만들 필요가 없다
   - 본문이 PDF 가 아니라 \`/{PMCID}/fullTextXML\` 로 바로 나온다 (표본 40편 전부 200)
   - 서론 발췌 **규격 수확률 97.5%** → 약 **602,724편 지문 후보**
   - 생의학 전용도 아니다: Frontiers in Psychology **4,951** · language/learning **6,319** ·
     social/cultural **3,575** · climate/environment **3,183** · education **2,583**
   어댑터 \`packages/library-pipeline/src/ingest-article/europe-pmc.ts\`(라이선스 관문 3겹).

3. **DOAB 수치를 정정한다.** Cycle 1 의 「변형 가능 42,899권」은 **언어 축을 빼고 센 수**다.
   전 구간 균등 표본 1,500건 실측: 변형 가능 33.6% · **영어는 51.1% 뿐** →
   「변형 가능 × 영어」 **22.7%(약 28,983권)** · 단위 book **81.5%** / chapter 8.1% →
   대부분 **OAPEN 의 PDF 를 장으로 쪼개야** 지문이 된다. 그래도 **인문·사회 단행본은
   Europe PMC 로 대체되지 않아** 가치는 남는다. 다만 획득 비용이 가장 높다.

4. **권리는 한 축이 아니라 두 축이었다.** 직전 판까지 \`derivClaim: 'no'\` 한 칸에 38곳이 섞여 있었다:
   - **CC BY-ND·NC (18곳)** — 원문을 **그대로 실을 수 있다**(출처 표시). 파생만 불가 → **C 등급**
   - **© 전부유보 (20곳)** — **본문 저장 자체가 불가**. 제목·URL·출처만 → **F 등급(신설)**
   이 상태로 「비개방 파이프라인」을 만들면 **© 본문을 DB 에 담는 코드**가 된다.
   실제로 규칙을 처음 쓸 때 「CC 아님」이라는 문구를 CC 로 읽어 Aeon·SEP 이 재배포 허용으로
   넘어갔다 — 회귀가 그 둘을 이름으로 못 박는다.

5. **설명문 상류는 이미 남아돈다.** MDPI 2,035,254(CC BY) · PMC OA 8,219,033 · Wikipedia 7,239,062.
   병목은 **수량이 아니라 라벨과 라이선스**였다.

6. **표가 0점을 준 StoryWeaver 는 이 저장소가 의도적으로 붙인 것이다** — 초·중 창 154편의 register 를
   세니 narrative 0 이었고, 편수로는 해결되지 않는 결핍이었다(2026-09-02). 다만 목록 페이지가
   JS 껍데기(링크 0)라 **맨 GET 으로는 열거되지 않는다**.

7. **적체가 새 소스보다 먼저였다 — 그리고 막힌 게 아니라 아무도 안 돌린 것이었다.**
   큐 47,486편이 전부 **본문은 있고 분석만 없는** 상태였다. \`ANTHROPIC_API_KEY\` 없이도 degraded 로
   돈다(CEFR 신뢰도 0.732 → 0.725). 처리량 약 **1.2초/편**.
   VOA 4갈래 전량 드레인 \`ready\` **230 → 10,445편**(+10,215) · frontiers 3갈래 **0 → 1,958편**.
   드레인 전 얇던 칸(V2 1,512 · V3 1,560 · V4 3,116)으로 들어갔다 — **새 소스 0개로 얻은 재고다.**

8. **죽은 것으로 적을 뻔한 것들.** 이 프로브는 처음에 배선된 소스 9곳을 「죽음」으로 냈다. 원인은 소스가
   아니라 ① 내가 짐작한 주소 ② 이 머신의 node TLS(gutenberg.org 는 curl 200 · node ECONNRESET)였다.
   같은 종류의 실수를 세 번 더 했다 — 서론 파서가 중첩 \`<sec>\` 에서 끊겨 Introduction 이 있는 논문을
   「없음」으로 셌고(깊이 세기로 교체), \`<sec>\` 없는 문서 15% 를 버렸고(본문 앞머리로 보정),
   논증 표지 임계값을 기출 **p25** 로 뒀더니 0 이라 **21개 소스가 전부 100% 통과**했다(중앙값으로 교체).
   **실측 도구가 틀리면 근거가 통째로 거짓이 된다.**

9. **진짜로 못 쓰는 것.** Wikinews 는 최근 30일 항목 **0건**(사실상 정지) · Census 보도자료 피드는
   \`<link/>\`·\`<guid/>\` 가 전부 비어 기사 주소가 없다 · OpenStax·StoryWeaver·CK-12 는 JS 껍데기다.

## A — 즉시 착수

${table(rows.filter((r) => r.grade === 'A'))}

## B — 편당 라이선스 판정이 먼저

${table(rows.filter((r) => r.grade === 'B'))}

## C — 비개방 파이프라인 (원문은 확보하되 문항은 못 만든다)

CC BY-ND·NC 계열. **원문을 그대로 실을 수 있고**(출처 표시) 문항 변형만 못 한다.

${table(rows.filter((r) => r.grade === 'C'))}

## N — 비상업 전용(NC) · 라이선스 미확인

ND 는 상업적 재배포가 되지만 **NC 는 상업적 이용 자체를 막는다** — 파생이 아니라 표시조차 안 된다.
이 플랫폼은 유료 결제를 향하므로 비개방 파이프라인에도 넣을 수 없다.
⚠️ 실측 2026-09-13: RSS 에 **전문을 싣는 4곳이 전부 여기 있다**(propublica 5,366어 ·
nieman_lab 3,564 · ideas_ted 1,583 · mit_news 1,175). 축이 없었다면 그대로 배선했을 것이다.

${table(rows.filter((r) => r.grade === 'N'))}

## F — 본문 저장 불가 (제목·URL·출처만)

© 전부유보 · 협약 재게시 · 가입 필요. **본문을 DB 에 담지 않는다.** 소재 참고용 메타데이터만 남긴다.
직전 판까지 이 ${tally.F ?? 0}곳이 C 와 같은 칸에 있었다 — 그 상태로 파이프라인을 만들면
© 본문을 저장하는 코드가 된다.

${table(rows.filter((r) => r.grade === 'F'))}

## D — 페이지는 살아 있고 피드가 없다 (목록 파서 필요)

${table(rows.filter((r) => r.grade === 'D'))}

## E — 지금은 불가

${table(rows.filter((r) => r.grade === 'E'))}
`
  fs.writeFileSync(path.resolve(mdOut), md)
  console.log(`→ ${mdOut}`)
}
