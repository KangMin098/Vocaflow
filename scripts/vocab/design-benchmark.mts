// scripts/vocab/design-benchmark.mts
//
// **지면 지수 — 학습자가 단어장을 *펼쳤을 때* 만나는 장치를 시중 단어장과 같은 자로 잰다.**
//
// ── 왜 세 번째 자가 필요한가 (실측 2026-09-06) ───────────────────────
// 단어장에는 이미 자가 둘 있고 둘 다 이기고 있었다:
//
//   · `market-benchmark.mjs`  내용 지수 **1.635** — 표제어 칸에 무엇이 들어 있나 (DB 값)
//   · `choice-benchmark.mts`  선택 지수 **1.288** — 한 권을 고를 근거가 있나 (책 앞뒤 정보)
//
// 그런데 둘 다 **"펼친 지면"** 을 재지 않는다. 시중 단어장의 디자인은 색·서체 이전에
// **매 쪽 같은 자리에 같은 장치가 있다는 것**이다 — 표제어 통번호, DAY 러닝헤드, 품사 약물,
// 뜻 번호, 파생어 줄, 예문 짝, 어법 박스, DAY 끝 테스트, 누적 복습, PART 도비라, 색인.
// 능률VOCA 4권은 한 권당 **14.75개**를 싣는다(`market-spec.json` `pageApparatus`).
//
// 우리 쪽은 DB 에 그 재료가 다 있다(내용 지수 1.635 가 그 증거다). 문제는 **지면이 없다**는
// 것 — 학습자가 세트를 열면 낱말과 뜻만 나온다. 이 자는 그 격차를 숫자로 만든다.
//
// ── 규칙 ────────────────────────────────────────────────────────────
// ① **렌더된 DOM 에만 묻는다.** 코드에 컴포넌트가 있어도 그 라우트에서 열리지 않으면 0 이다.
//    (이 자를 만들면서 실제로 그런 것을 찾았다 — `VocabSetPreviewModal` 은 카테고리를 고른
//     뒤에만 열리고, 기본 화면의 카드는 `NetflixDetailSheet` 라는 **다른 얇은 시트**를 연다.)
// ② **학습자가 닿을 수 있는 가장 좋은 지면**을 그 세트의 값으로 삼는다 — 경로가 둘이면
//    합집합이 아니라 **더 나은 쪽**이다. 합치면 "두 화면을 오가야 보이는 것" 을 한 지면이
//    준 것처럼 세게 된다.
// ③ 판정 규칙은 시장 쪽과 **같은 모양**(추출된 글자에 정규식)이다. 우리 쪽만 DOM 속성으로
//    정밀하게 세면 같은 자가 아니다.
// ④ 시장 값은 미리보기본에서 잰 **하한**이다 — 우리 지수는 그만큼 후하게 나온다.
//
//   지면 지수 = (우리 한 권당 장치 수) / (시중 한 권당 장치 수 14.75)
//
// 재실행 안전: 읽기만 한다(HTTP GET + 클릭). DB 를 고치지 않는다.
// 실행: npx tsx --tsconfig apps/web/tsconfig.json scripts/vocab/design-benchmark.mts \
//         [--base http://localhost:3000] [--samples 6] [--json] [--out <경로>]

import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Page } from 'playwright'

// ⚠️ `playwright` 는 워크스페이스 루트에 링크돼 있지 않다 — `@playwright/test` 가 `apps/web` 의
//    devDependency 라서 거기서만 풀린다. 스크립트 위치 기준으로 그 package.json 에서 해석한다
//    (`scripts/textbook/shelf-ux-probe.mjs` 와 같은 방법 — cwd 에 기대면 조용히 실패한다).
const HERE = path.dirname(fileURLToPath(import.meta.url))
const req = createRequire(path.join(HERE, '..', '..', 'apps', 'web', 'package.json'))
const { chromium } = req('@playwright/test') as typeof import('playwright')

const SPEC_PATH = path.resolve('packages/library-pipeline/src/vocab/market-spec.json')
const spec = JSON.parse(fs.readFileSync(SPEC_PATH, 'utf8'))
if (!spec.pageApparatus) {
  console.error(
    'market-spec.json 에 pageApparatus 가 없다 — 먼저 `node scripts/textbook-corpus/vocab-market-spec.mjs` 를 돌릴 것.',
  )
  process.exit(1)
}

const argv = process.argv.slice(2)
const flag = (name: string, fallback: string): string => {
  const i = argv.indexOf(name)
  return i >= 0 && argv[i + 1] ? argv[i + 1]! : fallback
}
const BASE = flag('--base', 'http://localhost:3000')
const SAMPLES = Number(flag('--samples', '6'))
const OUT = argv.indexOf('--out') >= 0 ? argv[argv.indexOf('--out') + 1] : null
const AS_JSON = argv.includes('--json')

// ── 우리 쪽 지면 장치 판정 ──────────────────────────────────────────
//
// 시장 쪽 `APPARATUS_PROBES` 와 **1:1로 짝**을 이룬다. 짝이 없는 축을 우리만 더하면
// 지수가 공짜로 오르므로 더하지 않는다 — 우리만 있는 것은 이미 내용·선택 지수의
// `beyondMarket` 이 세고 있다.
type ApparatusId =
  | 'entryNumber' | 'runningHead' | 'posLabel' | 'senseNumber' | 'derivedRow'
  | 'exampleEn' | 'exampleKo' | 'usageNote' | 'dailyTest' | 'cumulativeReview'
  | 'partDivider' | 'studyPlanGrid' | 'index' | 'crossRef' | 'inflection'
  | 'rootHeader' | 'checkbox'

interface OurProbe {
  id: ApparatusId
  /** 시중 지면에서 이 장치가 하는 일 — 우리 화면에서 같은 일을 하는 것을 찾는다. */
  says: string
  test: (text: string, html: string) => boolean
}

/**
 * **시트의 껍데기 — 판정 전에 지운다.**
 *
 * ⚠️ 첫 실행에서 이것 때문에 우리 점수가 부풀었다(실측 2026-09-06). 시트 바닥의 안내문
 * 「추가 후 Flashcard · Dictation 등 모든 학습 모듈에서 사용할 수 있어요.」한 줄이
 * `exampleEn`(대문자로 시작하는 15자 이상 영문 + 마침표)과 `exampleKo`(…어요.)에 **둘 다**
 * 걸렸다. 통계 칸의 「챕터 / 66」은 `entryNumber`(숫자 줄 다음 영문 줄)에 걸렸다.
 * 셋 다 **표제어 지면이 아니라 시트의 껍데기**다 — 지우고 나서 잰다.
 *
 * 지우는 것을 늘릴 때는 반드시 "그것이 표제어 지면의 일부가 아닌가" 를 먼저 물을 것.
 * 지면의 일부를 지우면 이번엔 우리 점수가 부당하게 내려간다.
 */
const SHEET_CHROME: RegExp[] = [
  /추가 후[^\n]*모든 학습 모듈에서[^\n]*/g,
  /내 단어장에 (추가|서 제외)/g,
  /단어 미리보기[^\n]*/g,
  /(단어 수|챕터|CEFR|카테고리)\s*\n\s*[^\n]*/g,
  /(닫기|상세|담기|구독 해지)/g,
]

function stripChrome(text: string): string {
  let t = text
  for (const re of SHEET_CHROME) t = t.replace(re, '\n')
  return t
}

const OUR_PROBES: OurProbe[] = [
  {
    id: 'entryNumber',
    says: '표제어마다 번호가 붙어 "몇 번째 낱말인가" 를 늘 보여 준다',
    /*
      한 번 걸리는 것으로는 인정하지 않는다 — 통계 칸의 「챕터 / 66」 같은 것이 걸린다.
      **세 번 이상 반복**되어야 지면의 장치다(시중 지면은 표제어마다 붙는다).
      그리고 번호 다음 줄은 영문 표제어여야 한다(20자 이하 · 한글 없음).
    */
    test: (t) => (t.match(/(^|\n)\s*\d{1,4}\s*[.)]?\s*\n\s*[A-Za-z][A-Za-z '-]{0,19}\s*(\n|$)/g) ?? []).length >= 3,
  },
  {
    id: 'runningHead',
    says: '펼친 자리를 잃지 않게 지금 어느 묶음인지 늘 머리에 있다',
    /*
      ⚠️ 이 축만 판정 근거가 시장과 다르다 — 시장은 쪽마다 찍힌 글자를 세지만 모달에는
      "쪽" 이 없다. 같은 일을 하는 것은 **스크롤해도 남는 머리**다. 그래서 DOM 에서
      `position: sticky|fixed` 인 조상 안에 제목이 있는지를 본다. 이 기준은 "h2 가 있으면
      인정" 보다 **엄격**하므로 우리 점수를 부풀리지 않는다(첫 실행에서는 그렇게 재서
      4/4 만점이 나왔고, 그것은 지면 장치가 아니라 그냥 제목이었다).
    */
    test: (_t, h) => /"__stickyTitle":true/.test(h),
  },
  {
    id: 'posLabel',
    says: '뜻 앞에 품사가 늘 같은 자리로 온다',
    test: (t) => /(^|[\s(])(명|동|형|부|전|접|대)([\s.)]|$)/m.test(t) || /\b(n|v|adj|adv|prep)\./.test(t),
  },
  {
    id: 'senseNumber',
    says: '한 낱말의 뜻이 갈릴 때 번호로 갈라 준다',
    test: (t) => /\s2[.)]\s/.test(t),
  },
  {
    id: 'derivedRow',
    says: '표제어 아래 갈라져 나온 말이 품사와 함께 붙는다',
    test: (t) => /파생|derived/i.test(t) || /\n\s*[a-z]{3,}\s+(명|동|형|부)\s/.test(t),
  },
  {
    id: 'exampleEn',
    says: '그 낱말이 실제로 쓰인 문장이 붙는다',
    /*
      영어 **문장**이어야 한다 — 낱말 넷 이상이고 그 안에 한글이 섞이지 않아야 한다.
      「Flashcard · Dictation 등 모든 학습 모듈에서 사용할 수 있어요.」같은 안내문이
      대문자로 시작한다는 이유만으로 예문이 되던 것을 막는다.
    */
    test: (t) => /(^|\n)[^\n가-힣]*\b[A-Z][a-z]+\b(?:[^\n.가-힣]*\b[a-z]{2,}\b){3,}[^\n가-힣]*[.!?]/.test(t),
  },
  {
    id: 'exampleKo',
    says: '예문 바로 아래 한국어역이 같은 자리로 온다',
    /*
      **영문 예문과 짝을 이룰 때만** 인정한다. 시중 지면에서 이 칸은 예문 아래 붙는
      번역이지 화면 안내문이 아니다 — 짝을 요구하지 않으면 시트 바닥의 팁 한 줄이 걸린다.
    */
    test: (t) =>
      /\b[A-Z][a-z]+\b(?:[^\n.가-힣]*\b[a-z]{2,}\b){3,}[^\n가-힣]*[.!?]\s*\n\s*[가-힣][^\n]{5,}(다|요)\./.test(t),
  },
  {
    id: 'usageNote',
    says: '낱말 하나를 더 깊이 파는 칸이 있다',
    test: (t) => /(문해력|어법|팁|TIP|참고|헷갈|주의)/i.test(t),
  },
  {
    id: 'dailyTest',
    says: '그날치를 바로 확인하는 자리가 지면 안에 있다',
    test: (t) => /(테스트|퀴즈|확인 문제|TEST|QUIZ)/i.test(t),
  },
  {
    id: 'cumulativeReview',
    says: '앞의 묶음을 다시 묻는 누적 복습 지면이 있다',
    test: (t) => /(누적|복습|다시 보기|재등장)/.test(t),
  },
  {
    id: 'partDivider',
    says: '묶음 원리가 바뀌는 자리를 지면이 알린다',
    /*
      **도비라가 지면에 실제로 나뉘어 있어야** 한다 — 「챕터 66」처럼 개수를 세어 적은
      통계 칸은 구분자가 아니다. 번호가 붙은 구분 머리가 **둘 이상** 있어야 인정한다.
    */
    test: (t) => (t.match(/(^|\n)\s*(챕터|CHAPTER|PART|DAY|Chapter)\s*0?\d{1,3}\b/gi) ?? []).length >= 2,
  },
  {
    id: 'studyPlanGrid',
    says: '며칠에 끝나는지 계획이 지면에 있다',
    test: (t) => /(학습 계획|하루 \d|일 완성|STUDY PLAN|약 \d+일)/i.test(t),
  },
  {
    id: 'index',
    says: '낱말로 되찾을 수 있는 전체 목록이 있다',
    test: (t) => /(전체 \d+개|색인|찾아보기|INDEX)/i.test(t),
  },
  {
    id: 'crossRef',
    says: '지면끼리 이어 주는 상호참조가 있다',
    test: (t) => /(→\s*[A-Za-z]|참조|같이 보기|\(p\.\s*\d+\))/.test(t),
  },
  {
    id: 'inflection',
    says: '불규칙 변화형을 표제어 옆에 적는다',
    test: (t) => /\([a-z]{3,}[–—-][a-z]{3,}/.test(t) || /(과거형|복수형|활용)/.test(t),
  },
  {
    id: 'rootHeader',
    says: '묶음의 원리를 지면 머리에 적는다',
    /*
      「기준」·「선정」 같은 낱말이 설명 어딘가에 있는 것으로는 인정하지 않는다 —
      시중 지면의 이 장치는 **묶음 머리에 그 묶음의 원리가 적혀 있는 것**이다.
    */
    test: (t) => /(어근|접두사|접미사|묶음 원리|표제어 선정)/.test(t),
  },
  {
    id: 'checkbox',
    says: '몇 번 봤는지 표시하는 자리가 있다',
    test: (t, h) => /(회독|체크|진도)/.test(t) || /aria-label="학습 진도/.test(h),
  },
]

const MARKET_MEAN: number = spec.pageApparatus.meanApparatusPerBook
const MARKET_RATES: Record<string, number> = spec.pageApparatus.rates
const SIGNAL_COUNT: number = spec.pageApparatus.signalCount

// ── 지면 열기 ───────────────────────────────────────────────────────

interface Sheet {
  /** 어떤 경로로 열렸나 — 리포트가 "어느 화면을 잰 것인가" 를 말할 수 있어야 한다. */
  path: 'grid-modal' | 'carousel-sheet'
  title: string
  text: string
  html: string
}

/**
 * 열린 다이얼로그를 읽는다. 없으면 null.
 *
 * `__stickyTitle` 은 브라우저에서 계산한 사실을 html 꼬리에 붙인 것이다 — 제목이
 * `position: sticky|fixed` 안에 들어 있는가(= 스크롤해도 머리에 남는가). 정규식으로는
 * 알 수 없어 여기서만 DOM 에 묻는다(`runningHead` 축 주석 참조).
 */
async function readDialog(page: Page): Promise<{ text: string; html: string } | null> {
  const dlg = page.locator('[role="dialog"]').first()
  if ((await dlg.count()) === 0) return null
  const stickyTitle = await dlg.evaluate((el) => {
    const title = el.querySelector('h1, h2, [id$="-title"]')
    for (let n: Element | null = title; n && n !== el.parentElement; n = n.parentElement) {
      const pos = getComputedStyle(n as Element).position
      if (pos === 'sticky' || pos === 'fixed') return true
    }
    return false
  })
  const html = `${await dlg.innerHTML()}\n<!--{"__stickyTitle":${stickyTitle}}-->`
  return { text: await dlg.innerText(), html }
}

async function closeDialog(page: Page): Promise<void> {
  await page.keyboard.press('Escape').catch(() => {})
  await page.waitForTimeout(400)
}

/**
 * 한 세트의 지면을 **두 경로로** 열어 더 나은 쪽을 돌려준다.
 *
 * · 기본 화면(카테고리 `all`)의 카드 → `NetflixDetailSheet`
 * · 카테고리를 고른 뒤의 카드 → `VocabSetPreviewModal`(판권면이 붙는 쪽)
 */
async function openSheets(page: Page, categoryChip: string | null, nth: number): Promise<Sheet[]> {
  const out: Sheet[] = []
  await page.goto(`${BASE}/library/vocab`, { waitUntil: 'domcontentloaded' })
  /*
    ⚠️ 고정 대기(`waitForTimeout`)로는 표본이 들쭉날쭉해진다 — 같은 명령이 8개 중 6개를
    열었다가 2개만 열었다(실측 2026-09-06, 개발 서버 컴파일 지연). **카드가 나타날 때까지**
    기다린다. 표본 수가 흔들리면 지수도 흔들려서 무엇이 바뀐 것인지 알 수 없다.
  */
  await page
    .locator('main button')
    .filter({ hasText: /\d+\s*단어/ })
    .first()
    .waitFor({ state: 'visible', timeout: 45_000 })

  if (categoryChip) {
    /*
      ⚠️ **카테고리 칩과 세트 카드를 글자로만 가르면 안 된다.** `hasText: '어원'` 은
      「📜 어원 2」칩과 「어원으로 익히는 1,500 · 1,500 단어」카드에 **둘 다** 걸리고,
      카드가 먼저 잡히면 칩을 누른 적이 없는데 누른 줄 알게 된다 — 첫 실행에서 실제로
      그랬고, 표본 넷이 전부 기본 화면 시트가 되어 격자 경로를 한 번도 재지 못했다.
      카드에는 낱말 수(`N 단어`)가 붙으므로 그것으로 가른다.
    */
    const chip = page
      .locator('main button')
      .filter({ hasText: categoryChip })
      .filter({ hasNotText: /\d+\s*단어/ })
      .first()
    if ((await chip.count()) === 0) return out
    await chip.click()
    await page.waitForTimeout(1800)
  }

  const cards = page.locator('main button').filter({ hasText: /\d+\s*단어/ })
  const n = await cards.count()
  if (n === 0) return out
  const card = cards.nth(Math.min(nth, n - 1))
  const title = (await card.innerText()).replace(/\s+/g, ' ').trim().slice(0, 60)
  await card.click()
  // 시트가 뜰 때까지 기다린다 — 낱말 목록은 뒤늦게 채워지므로 그 뒤 한 번 더 짧게 준다.
  await page.locator('[role="dialog"]').first().waitFor({ state: 'visible', timeout: 20_000 })
  await page.waitForTimeout(1800)

  const d = await readDialog(page)
  if (d) {
    const isRich = d.html.includes('vocab-preview-title')
    out.push({ path: isRich ? 'grid-modal' : 'carousel-sheet', title, ...d })
  }
  await closeDialog(page)
  return out
}

// ── 측정 ────────────────────────────────────────────────────────────

interface SetResult {
  title: string
  path: Sheet['path']
  found: ApparatusId[]
  missing: ApparatusId[]
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 2200 } })

/**
 * 표본 — 카테고리를 갈아 가며 뽑는다. 한 카테고리만 재면 그 카테고리의 지면만 재게 된다.
 * `null` 은 기본 화면(카테고리 `all`)이다 — 학습자가 **가장 먼저 만나는** 지면이라 반드시 넣는다.
 */
const SAMPLE_PLAN: Array<{ chip: string | null; nth: number }> = [
  { chip: null, nth: 0 },
  { chip: null, nth: 1 },
  { chip: '어원', nth: 0 },
  { chip: '테마별', nth: 0 },
  { chip: '고등', nth: 0 },
  { chip: '초등', nth: 0 },
  { chip: '공인영어', nth: 0 },
  { chip: '중등', nth: 0 },
]

const results: SetResult[] = []
for (const planItem of SAMPLE_PLAN.slice(0, SAMPLES)) {
  // 한 번 실패했다고 표본에서 빼면 표본 수가 실행마다 달라진다 — 두 번까지 다시 해 본다.
  let sheets: Sheet[] = []
  for (let attempt = 1; attempt <= 2 && sheets.length === 0; attempt += 1) {
    try {
      sheets = await openSheets(page, planItem.chip, planItem.nth)
    } catch (err) {
      console.error(
        `  ! ${planItem.chip ?? '기본'} #${planItem.nth} 열기 실패(${attempt}/2): ${(err as Error).message.split('\n')[0]}`,
      )
    }
  }
  if (sheets.length === 0) continue

  // 경로가 여럿이면 **더 나은 쪽**만 센다 (합집합이 아니다 — 위 규칙 ②).
  let best: SetResult | null = null
  for (const sheet of sheets) {
    const body = stripChrome(sheet.text)
    const found = OUR_PROBES.filter((p) => p.test(body, sheet.html)).map((p) => p.id)
    const r: SetResult = {
      title: sheet.title,
      path: sheet.path,
      found,
      missing: OUR_PROBES.filter((p) => !found.includes(p.id)).map((p) => p.id),
    }
    if (!best || r.found.length > best.found.length) best = r
  }
  if (best) results.push(best)
}

await browser.close()

if (results.length === 0) {
  console.error(`지면을 하나도 열지 못했다 — ${BASE} 가 떠 있는지 확인할 것.`)
  process.exit(1)
}

const oursMean = Number(
  (results.reduce((n, r) => n + r.found.length, 0) / results.length).toFixed(3),
)
const designIndex = Number((oursMean / MARKET_MEAN).toFixed(3))

const oursRates = Object.fromEntries(
  OUR_PROBES.map((p) => [
    p.id,
    Number((results.filter((r) => r.found.includes(p.id)).length / results.length).toFixed(3)),
  ]),
) as Record<ApparatusId, number>

const report = {
  $schema: 'vocab-design-benchmark/1',
  generatedAt: new Date().toISOString(),
  base: BASE,
  specGeneratedAt: spec.generatedAt,
  market: {
    booksMeasured: spec.pageApparatus.booksMeasured,
    meanApparatusPerBook: MARKET_MEAN,
    signalCount: SIGNAL_COUNT,
    rates: MARKET_RATES,
    undetectable: spec.pageApparatus.undetectable,
    limitation: spec.pageApparatus.note,
  },
  ours: {
    sheetsMeasured: results.length,
    meanApparatusPerSheet: oursMean,
    rates: oursRates,
    perSheet: results.map((r) => ({
      title: r.title,
      path: r.path,
      count: r.found.length,
      found: r.found,
      missing: r.missing,
    })),
  },
  designIndex,
  /**
   * **어느 지면을 재었나.** 이 줄이 없으면 다음 사람이 "격자 모달도 쟀겠지" 라고 읽는다.
   *
   * 실측 2026-09-06: 표본 전부가 `carousel-sheet` 였다. 카테고리를 골라 격자를 띄운 뒤
   * 카드를 눌러도 열리는 것은 같은 시트다 — `VocabSetPreviewModal`(판권면·목차가 붙는 쪽)은
   * `/library/vocab` 에서 **열리지 않는다**. `VocabSetGrid` 가 그것을 렌더하고 카드가
   * `onPreview` 를 부르는데도 그렇다. 선택 지수(`choice-benchmark.mts`)는 그 열리지 않는
   * 컴포넌트의 조건으로 우리 값을 세고 있으므로 **그만큼 부풀어 있다.**
   */
  reachability: {
    paths: Object.fromEntries(
      (['grid-modal', 'carousel-sheet'] as const).map((k) => [k, results.filter((r) => r.path === k).length]),
    ),
    richModalReached: results.some((r) => r.path === 'grid-modal'),
    note:
      'grid-modal 이 0 이면 판권면·목차·학습계획을 담은 시트가 학습자에게 닿지 않는다는 뜻이다 — '
      + '선택 지수가 그 컴포넌트를 근거로 세고 있으므로 함께 다시 봐야 한다.',
  },
  /** 시장이 100% 인데 우리가 못 주는 장치 — 여기가 지면 재설계의 작업 목록이다. */
  gaps: OUR_PROBES.filter((p) => (MARKET_RATES[p.id] ?? 0) > (oursRates[p.id] ?? 0)).map((p) => ({
    id: p.id,
    says: p.says,
    market: MARKET_RATES[p.id] ?? 0,
    ours: oursRates[p.id] ?? 0,
  })),
  method:
    '렌더된 DOM 에만 묻는다. 경로가 둘이면 더 나은 쪽만 센다. 판정 규칙은 시장 쪽과 같은 모양'
    + '(추출 글자 + 정규식)이라 같은 자다. 시장 값은 미리보기본 하한이므로 이 지수는 후하다.',
}

if (OUT) {
  fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true })
  fs.writeFileSync(path.resolve(OUT), JSON.stringify(report, null, 2), 'utf8')
}
if (AS_JSON) {
  console.log(JSON.stringify(report, null, 2))
} else {
  console.log(`\n지면 지수 — 우리 지면 ${results.length}개 vs 시중 ${report.market.booksMeasured}종\n`)
  for (const p of OUR_PROBES) {
    const m = MARKET_RATES[p.id] ?? 0
    const o = oursRates[p.id] ?? 0
    const mark = o > m ? '▲' : o === m ? '=' : '▼'
    console.log(
      `  ${p.id.padEnd(17)} 우리 ${(o * 100).toFixed(0).padStart(3)}%  시장 ${(m * 100).toFixed(0).padStart(3)}%  ${mark}`,
    )
  }
  console.log(`\n  한 권당 지면 장치   우리 ${oursMean}개  ·  시중 ${MARKET_MEAN}개`)
  console.log(`  **지면 지수 = ${designIndex}**  (목표 1.20 → 한 권당 ${(MARKET_MEAN * 1.2).toFixed(2)}개)`)
  if (report.gaps.length > 0) {
    console.log(`\n  시중이 주는데 우리가 못 주는 장치 ${report.gaps.length}종:`)
    for (const g of report.gaps) console.log(`    · ${g.id} — ${g.says}`)
  }
  if (OUT) console.log(`\n리포트 → ${OUT}`)
}
