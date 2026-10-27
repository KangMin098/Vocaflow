// scripts/qa/r0-live-journey.cjs
//
// R0 실제 개발 계정 종단 확인 — Lincoln 기사 읽기 → 같은 기사 발췌 연습(제목·주제) → 피드백·근거·대안 비교
// → 같은 글로 복귀 → 그 글의 단어 복습(WordVault 보기 + Flashcard 실제 평가) → 다음 글 고르기 화면.
//
// 재사용: output/platform-audit-20261025/evidence/continuous-execution-20261027/usgs-qualification/
//   flashcard-real-auth-readonly.cjs 의 계약(실제 /login 화면 · password grant 응답의 user.id 대조 ·
//   storageState/쿠키/토큰/자격 값 미출력 · 허용 목록 밖 쓰기 요청 abort)을 그대로 따른다. qa-login.mjs 는
//   다른 자격 파일(.env.qa-learner.local)과 storageState 파일 저장을 쓰므로 이 계약에 맞지 않아 쓰지 않는다.
//
// ── 모드 ─────────────────────────────────────────────────────────────────────────
//   node scripts/qa/r0-live-journey.cjs                 → preflight(기본). DB·네트워크·브라우저·dev 서버 없음.
//        git 객체 존재 · 고정 SHA · 자격 키 **이름** 존재 · Playwright 해석 가능 여부 · 쓰기 계획만 출력한다.
//   node scripts/qa/r0-live-journey.cjs --write --wordset=<pre-fix|post-fix> --base=<url> --confirm=<TOKEN>
//        → 실제 앱 쓰기. TOKEN 은 아래 WRITE_CONFIRM_TOKEN 과 글자 그대로 같아야 한다(새 티켓 체계 없음 —
//          사용자가 대화에서 승인한 범위를 이 한 줄로 고정할 뿐이다). post-fix 권장(아래 WORDSET 주석).
//
// WRITE_CONFIRM_TOKEN = R0-LIVE-WRITE-dcf55c35f-LINCOLN-267ef969-A1280-B1440-NOCLEANUP
//
// ── 실행 전제(쓰기 모드) ─────────────────────────────────────────────────────────
//   · --base 의 Next 서버는 feat/r0-article-bridge = dcf55c35f 로 띄운 것(R0 UI 는 아직 main 에 없다).
//   · DB 에 20261027201035 · 20261027201103 이 적용돼 있어야 한다(조회 article_practice_items · 제출 submit_article_practice).
//   · 계정 A/B 에 이 기사 글(texts.source_url='article:267ef969-…')이 아직 없어야 첫 실행 예상치가 맞는다.
//   · 정리(DELETE)는 하지 않는다. 결과 행은 user_id 로 A/B 를 가른다(출력은 A/B 라벨만, id 값 미출력).
'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { createRequire } = require('node:module')

const WRITE_CONFIRM_TOKEN = 'R0-LIVE-WRITE-dcf55c35f-LINCOLN-267ef969-A1280-B1440-NOCLEANUP'

const PIN = {
  code: {
    repo_worktree: 'D:/workspace/vocaflow-r0-complete',
    branch: 'feat/r0-article-bridge',
    head: 'dcf55c35ffb03f4ca35ec02e846708eb8f3b3c08',
    commits: [
      '312f5079f3158657f00d39098d395eb193e4a15d',
      '56241cee02f7c64f10ced55269cb38e0d75d0054',
      '22f4719c6d707c19c9d9452f30e3573a7021c3a4',
      'dcf55c35ffb03f4ca35ec02e846708eb8f3b3c08',
    ],
    qa_base_main: '7a15596e668516c89476d2a6d6a6784932c613f8',
  },
  article: {
    id: '267ef969-2a3a-4dc9-b6b7-a85246df543f',
    body_sha256: 'f6fce3159b15c2c0cb8c6795d5e6e51f02240eb3725d14f40601b119c195f1df',
  },
  items: [
    { id: 'b69f287f-7d20-4770-8b88-8dfe0050ad0f', type: 'title', payload_pg_sha256: 'f00480d38a3a5042d7a70823886f193817d9d58114973b78b4cb3b89ccf9044d', key_pg_sha256: '78594a08b016ccb1c269b79f6d01f8b2be856474379b0a3befa38fc85805cdb1' },
    { id: 'b72011b0-91e1-46bc-bf35-d2ef20f1aaea', type: 'topic', payload_pg_sha256: '13c5414752828db377842a92afbd76674b5135e6df2fe18c91b56499b6aff4e2', key_pg_sha256: '2b58349b5f86fbdd8466e71a6970ca4d7e63241aaeba0978bdd0cf1750e13817' },
  ],
  // WORDSET: subscribe_article_word_set 는 shared_words 를 vocabularies 로 **복사**한다(ON CONFLICT (user_id, word) DO NOTHING).
  //   pre-fix 로 돌리면 ground(verb 뜻)·slave(verb 뜻)·ford(고유명사 오추출)가 계정 단어장에 그대로 남고,
  //   이후 세트 보정은 이미 복사된 행을 고치지 않는다 → post-fix 실행 권장. pre-fix 는 승인 시 명시해야만 허용.
  wordset: {
    id: '404f4977-7d03-4955-8834-833a668f13af',
    pre_fix: {
      words: ['bullet', 'ford', 'ground', 'historian', 'proclamation', 'rebellious', 'slave', 'unguarded'],
      row_pg_sha256: {
        bullet: '086f82651b8df324cc6be18a1c72d98daa850a1b9de3b4278b0f486d2073c068',
        ford: '041c8ca822423130bfb817f09888d00bf34b50d21ace7c87c76a61d7bec021b1',
        ground: '7dc8c169ad0b9e8791310898e68e32e0c0afd2590ab99386a950cb51b568cea0',
        historian: '3945f2302dc95e9b687d67df9445d8abe8394e0cdecdc6bb3b3a50553f4b978a',
        proclamation: 'f4b767eb14d977f808bcebcb2ec8c651fb263f588379d3ea2dc233e0d060589e',
        rebellious: 'ffd626c8220582e969d0120ca769c8aa1dd9e227cb47712e36fe695093eacdd4',
        slave: 'd420119a97559fcd39db45ffe9d00d4037646142440ad9f0fd422258a9fa6ae3',
        unguarded: 'ffa96a6453915dac3347de0c6f47777cbb73c5ceffa5ca48a1a7730060e01d5b',
      },
      expect: { word_count: 8, ground_pos: 'verb', slave_pos: 'verb', ford_present: true },
    },
    post_fix: {
      // r0-lincoln-wordset-fix.proposal.sql(sha 41a5dad7…) 적용 뒤 기대. 행 해시는 적용 후 verify.sql 로 다시 고정한다.
      words: ['bullet', 'ground', 'historian', 'proclamation', 'rebellious', 'slave', 'unguarded'],
      expect: { word_count: 7, ground_pos: 'noun', slave_pos: 'noun', ford_present: false },
    },
  },
}

const ENV_FILE = 'D:/workspace/Vocaflow-AI-Control/.env.lcp-story-dev-e2e.local'
const ACCOUNTS = { A: { prefix: 'VFC_STORY_DEV_LEARNER_A', width: 1280 }, B: { prefix: 'VFC_STORY_DEV_LEARNER_B', width: 1440 } }
const KEY_SUFFIXES = ['_EMAIL', '_PASSWORD', '_USER_ID']
const SUPABASE_HOST = 'jajenrevcbmrpaliomxv.supabase.co'
const WEB_REQUIRE_ROOT = 'D:/workspace/vocaflow-r0-complete/apps/web/package.json'
const OUT_DIR = path.join(__dirname, 'out')

// 계정당 첫 실행 상한(post-fix). 실제 수가 넘으면 실패로 기록한다.
const MAX_ROWS_PER_ACCOUNT = {
  texts_insert: 1, texts_status_update: 1, user_word_set_subscriptions_insert: 1, shared_word_sets_subscriber_count_update: 1,
  vocabularies_insert: 8, csat_item_attempts_insert: 2, vocabularies_fsrs_update: 8, learning_records_insert: 8,
  daily_activity_upsert: 1, user_stats_upsert: 1, funnel_events_insert: 12,
}

function parseArgs(argv) {
  const a = { write: false }
  for (const s of argv) {
    if (s === '--write') a.write = true
    else if (s.startsWith('--confirm=')) a.confirm = s.slice(10)
    else if (s.startsWith('--wordset=')) a.wordset = s.slice(10)
    else if (s.startsWith('--base=')) a.base = s.slice(7)
    else if (s.startsWith('--choices=')) a.choices = s.slice(10).split(',').map(Number)
    else throw Error('UnknownArgument')
  }
  return a
}

function readEnvKeyNames(file) {
  // 값은 읽어도 메모리에만 — 출력은 키 이름 존재 여부뿐
  if (!fs.existsSync(file)) return { exists: false, keys: [] }
  const keys = fs.readFileSync(file, 'utf8').split(/\r?\n/).map((l) => /^([A-Z0-9_]+)\s*=\s*\S/.exec(l)).filter(Boolean).map((m) => m[1])
  return { exists: true, keys }
}

function gitHas(sha) {
  try {
    execFileSync('git', ['-C', PIN.code.repo_worktree, 'cat-file', '-e', sha + '^{commit}'], { stdio: 'ignore' })
    return true
  } catch { return false }
}
function gitRev(ref) {
  try { return execFileSync('git', ['-C', PIN.code.repo_worktree, 'rev-parse', ref], { encoding: 'utf8' }).trim() } catch { return null }
}

const WRITE_PLAN = [
  { step: '0 login', route: 'POST auth/v1/token?grant_type=password', writes: 'auth.sessions/refresh_tokens/audit (Supabase Auth 관리 테이블, 로그인 1회당 세션 1)', idempotent: false },
  { step: '1 start-learning', route: 'GET /library/scripts/{articleId} → startArticleLearning (server)', writes: 'texts +1 (source_url=article:{id}); subscribe_article_word_set → user_word_set_subscriptions +1 (+trigger shared_word_sets.subscriber_count +1), vocabularies +≤8 pre-fix / ≤7 post-fix (이미 같은 word 가 있으면 그만큼 적음)', idempotent: 'texts·구독·vocab 재실행 0행(마커·ON CONFLICT)' },
  { step: '2 /text/[id] GET', route: 'layout: markChapterStarted + article_practice_items(read)', writes: 'texts UPDATE status not_started→in_progress 1행(+updated_at 트리거); library_book 아님 → reading_sessions/adaptiveExtract 없음; ScreenViewTracker → funnel_events +1', idempotent: 'status 재실행 0행 · funnel 매 진입 +1' },
  { step: '3 /practice/article/[id] GET', route: 'loadArticlePractice (read only)', writes: 'funnel_events +1', idempotent: 'funnel 매 진입 +1' },
  { step: '4 제출 ×2', route: 'server action submitArticlePractice → rpc submit_article_practice → grade_dcp_item', writes: "csat_item_attempts +1/문항 (user_id, dcp_item_id, text_id=item.ref_id, item_role='practice') = +2", idempotent: false },
  { step: '4b 오답 원인 1-tap(스크립트는 누르지 않음)', route: 'recordDcpErrorCause', writes: 'csat_item_attempts.error_cause UPDATE (0, 누르지 않음)', idempotent: true },
  { step: '5 근거·대안 비교', route: 'MeaningEvidence (client only)', writes: '없음', idempotent: true },
  { step: '6 같은 글 복귀', route: 'GET /text/{textId}', writes: 'texts status 0행(이미 in_progress) · funnel_events +1', idempotent: 'funnel 제외 0' },
  { step: '7 WordVault 보기', route: 'GET /wordvault', writes: 'funnel_events +1 (보기만은 복습 완료가 아니다)', idempotent: 'funnel 제외 0' },
  { step: '8 Flashcard 실제 평가', route: 'GET /flashcard/play?set={set}&text={textId} → 키 3(good) → /api/srs/flush', writes: 'vocabularies FSRS UPDATE 평가 카드 수(≤8/7) · learning_records +N · trigger daily_activity upsert 1 · refresh_user_known_word_count → user_stats upsert 1 · funnel_events +1', idempotent: false },
  { step: '9 다음 글 고르기', route: 'GET /library/scripts (다른 글은 클릭하지 않는다 — 클릭 시 texts/구독/vocab 추가)', writes: 'funnel_events +1', idempotent: 'funnel 제외 0' },
]

function preflight(args) {
  const env = readEnvKeyNames(ENV_FILE)
  const keyCheck = {}
  for (const [label, { prefix }] of Object.entries(ACCOUNTS)) keyCheck[label] = KEY_SUFFIXES.every((s) => env.keys.includes(prefix + s))
  let playwright = false
  try { createRequire(WEB_REQUIRE_ROOT).resolve('@playwright/test'); playwright = true } catch { playwright = false }
  const commits = Object.fromEntries(PIN.code.commits.map((c) => [c.slice(0, 9), gitHas(c)]))
  const branchHead = gitRev(PIN.code.branch)
  const out = {
    mode: 'preflight',
    db_access: false, network: false, browser: false, dev_server: false, writes: 0,
    env_file_exists: env.exists, account_keys_present: keyCheck,
    playwright_resolvable_from: WEB_REQUIRE_ROOT, playwright_resolvable: playwright,
    pinned_commits_present: commits,
    branch_head_matches_pin: branchHead === PIN.code.head,
    pin: { article: PIN.article, items: PIN.items.map((i) => ({ id: i.id, type: i.type })), wordset: { id: PIN.wordset.id, pre_fix: PIN.wordset.pre_fix.expect, post_fix: PIN.wordset.post_fix.expect } },
    write_plan: WRITE_PLAN,
    max_rows_per_account: MAX_ROWS_PER_ACCOUNT,
    write_requires: `--write --wordset=post-fix|pre-fix --base=<dcf55c35f 서버 URL> --confirm=${WRITE_CONFIRM_TOKEN}`,
    not_verified_here: ['DB 의 기사 본문 sha · 문항 payload/key sha · 세트 상태 — 이 스크립트는 쓰기 모드에서도 자동 대조하지 않는다. 실행 직전 읽기 전용 SELECT(문항 migration 의 sha 식 · r0-lincoln-wordset-fix.verify.sql)로 따로 확인', '서버가 dcf55c35f 로 떴는지', '계정 A/B 의 기존 Lincoln 글 유무'],
  }
  out.ready_for_write = env.exists && keyCheck.A && keyCheck.B && playwright && Object.values(commits).every(Boolean) && out.branch_head_matches_pin
  return out
}

// ───────────────────────────── 쓰기 모드 ─────────────────────────────
async function writeMode(args) {
  if (args.confirm !== WRITE_CONFIRM_TOKEN) throw Error('ConfirmTokenMismatch')
  if (!['pre-fix', 'post-fix'].includes(args.wordset)) throw Error('WordsetExpectationRequired')
  if (!args.base || !/^http:\/\/localhost:\d+$/.test(args.base)) throw Error('LocalBaseUrlRequired')
  const pf = preflight(args)
  if (!pf.ready_for_write) throw Error('PreflightNotReady')
  const wsExpect = args.wordset === 'post-fix' ? PIN.wordset.post_fix : PIN.wordset.pre_fix
  const choices = args.choices && args.choices.length === 2 && args.choices.every((c) => c >= 1 && c <= 5) ? args.choices : [1, 1]

  const requireWeb = createRequire(WEB_REQUIRE_ROOT)
  const { chromium } = requireWeb('@playwright/test')
  const dotenv = requireWeb('dotenv')
  const config = dotenv.parse(fs.readFileSync(ENV_FILE))
  const account = (label) => {
    const p = ACCOUNTS[label].prefix
    const a = { email: config[p + '_EMAIL'], password: config[p + '_PASSWORD'], id: config[p + '_USER_ID'] }
    if (!a.email || !a.password || !a.id) throw Error('DevelopmentAccountConfigurationMissing')
    return a
  }
  const out = { mode: 'write', started_at: new Date().toISOString(), wordset_expectation: args.wordset, base: args.base, code_pin: PIN.code.head, runs: [], ab_boundary: null, requests: { allowed: [], blocked: [] }, credential_values_exported: false, storage_state_exported: false }
  const browser = await chromium.launch()
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    // 허용 목록 밖 비GET 요청은 abort 하고 기록(경로만). 쿼리·본문은 남기지 않는다.
    await ctx.route('**/*', async (route) => {
      const r = route.request(); const u = new URL(r.url())
      if (r.method() === 'GET' || r.method() === 'HEAD' || r.method() === 'OPTIONS') return route.continue()
      const local = u.origin === args.base
      const ok = (u.hostname === SUPABASE_HOST && u.pathname === '/auth/v1/token' && ['password', 'refresh_token'].includes(u.searchParams.get('grant_type')))
        || (local && r.headers()['next-action'])
        || (local && (u.pathname === '/api/analytics/event' || u.pathname === '/api/srs/flush'))
      if (ok) { out.requests.allowed.push({ method: r.method(), path: local && r.headers()['next-action'] ? 'server-action' : u.pathname }); return route.continue() }
      out.requests.blocked.push({ method: r.method(), path: u.pathname }); return route.abort()
    })

    async function login(page, label, next) {
      const a = account(label)
      await page.goto(`${args.base}/login?next=${encodeURIComponent(next)}`, { waitUntil: 'load', timeout: 90000 })
      await page.locator('input[type="email"]').fill(a.email)
      await page.locator('input[type="password"]').fill(a.password)
      const resp = page.waitForResponse((r) => { const u = new URL(r.url()); return u.hostname === SUPABASE_HOST && u.pathname === '/auth/v1/token' && u.searchParams.get('grant_type') === 'password' }, { timeout: 45000 })
      await page.locator('button[type="submit"]').first().click()
      const r = await resp; const body = await r.json()
      if (!(r.status() === 200 && body.user && body.user.id === a.id)) throw Error('NormalAuthIdentityNotConfirmed')
    }

    async function measure(page, locator) {
      const box = await locator.boundingBox()
      return { w: box ? Math.round(box.width) : 0, h: box ? Math.round(box.height) : 0, ge44: !!box && box.width >= 44 && box.height >= 44 }
    }
    async function tabTo(page, locator, max = 80) {
      const handle = await locator.elementHandle()
      for (let i = 0; i < max; i++) {
        await page.keyboard.press('Tab')
        const hit = await page.evaluate((el) => document.activeElement === el, handle)
        if (hit) {
          const ring = await page.evaluate((el) => { const s = getComputedStyle(el); return (s.outlineStyle !== 'none' && s.outlineWidth !== '0px') || (s.boxShadow && s.boxShadow !== 'none') }, handle)
          return { reached: true, tabs: i + 1, focus_visible: ring }
        }
      }
      return { reached: false, tabs: max, focus_visible: false }
    }
    async function atWidths(page, fn) {
      const res = {}
      for (const w of [1280, 1440]) {
        await page.setViewportSize({ width: w, height: 900 })
        res[w] = await fn()
        res[w].no_hscroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
      }
      return res
    }

    async function journey(page, label) {
      const run = { account: label, steps: {} }
      await page.setViewportSize({ width: ACCOUNTS[label].width, height: 900 })
      // 1) start-learning — 기사 리졸버가 본인 글을 만들고 /text/[id]?mode=read 로 보낸다(쓰기)
      await login(page, label, `/library/scripts/${PIN.article.id}`)
      await page.waitForURL((u) => /^\/text\/[0-9a-f-]{36}$/.test(u.pathname), { timeout: 90000 })
      const textId = new URL(page.url()).pathname.split('/')[2]
      run.steps.start_learning = { landed_on_text: true }
      // 2) reader — 연습 링크 · 키보드 · 44px
      const link = page.locator('[data-testid="reader-article-practice"]')
      await link.waitFor({ timeout: 60000 })
      const readerText = (await page.locator('main').innerText()).replace(/\s+/g, ' ')
      run.steps.reader = await atWidths(page, async () => ({ link: await measure(page, link) }))
      run.steps.reader.keyboard = await tabTo(page, link)
      await page.keyboard.press('Enter')
      // 3) practice
      await page.waitForURL((u) => u.pathname === `/practice/article/${PIN.article.id}`, { timeout: 60000 })
      if (await page.locator('[data-testid="article-practice-reason"]').count()) {
        run.steps.practice = { reason: await page.locator('[data-testid="article-practice-reason"]').getAttribute('data-reason') }
        throw Error('PracticeUnavailable')
      }
      await page.locator('section[aria-label="구문 연습"]').waitFor({ timeout: 60000 })
      run.steps.practice = { items: [] }
      for (let i = 0; i < 2; i++) {
        const radios = page.locator('[role="radiogroup"][aria-label="선택지"] [role="radio"]')
        await radios.first().waitFor({ timeout: 30000 })
        const sizes = await atWidths(page, async () => ({ radio_min_h: Math.min(...(await Promise.all((await radios.all()).map(async (r) => (await r.boundingBox())?.height ?? 0)))) }))
        const target = radios.nth(choices[i] - 1)
        const kb = await tabTo(page, target)
        await page.keyboard.press(kb.reached ? 'Space' : 'Tab')
        if (!kb.reached) await target.click()
        const submit = page.getByRole('button', { name: '제출' })
        const submitBox = await measure(page, submit)
        await submit.click()
        // 피드백 → 근거 → 대안 비교
        const evidence = page.locator('[data-testid="meaning-evidence"], [data-testid="meaning-evidence-skipped"]')
        await evidence.first().waitFor({ timeout: 30000 })
        const alert = await page.locator('[role="alert"]').count()
        const evSentences = await page.locator('[data-testid="meaning-evidence"] li, [data-testid="meaning-evidence"] button').allInnerTexts().catch(() => [])
        const bound = evSentences.filter((s) => s.trim().length > 20).map((s) => readerText.includes(s.replace(/\s+/g, ' ').trim()))
        const toggle = page.locator('[data-testid="meaning-compare-toggle"]')
        let compare = false
        if (await toggle.count()) { await toggle.click(); compare = (await page.locator('[data-testid="meaning-compare-task"]').count()) > 0 }
        const causeBtns = page.locator('button[aria-pressed]')
        const causeMinH = (await causeBtns.count()) ? Math.min(...(await Promise.all((await causeBtns.all()).map(async (b) => (await b.boundingBox())?.height ?? 0)))) : null
        run.steps.practice.items.push({ index: i, sizes, keyboard: kb, submit: submitBox, grade_error_alert: alert > 0, evidence_bound_to_reader: bound.length ? bound.every(Boolean) : 'NO_SENTENCES_FOUND', compare_opened: compare, error_cause_button_min_h: causeMinH })
        await page.getByRole('button', { name: i === 1 ? '마치기' : '다음' }).click()
      }
      await page.locator('[data-testid="dcp-done-body"]').waitFor({ timeout: 30000 })
      // 4) 같은 글로 복귀
      await page.getByRole('link', { name: '읽던 글로' }).first().click()
      await page.waitForURL((u) => u.pathname === `/text/${textId}`, { timeout: 60000 })
      run.steps.return_same_text = true
      // 5) WordVault 보기(복습 완료가 아니다)
      await page.goto(`${args.base}/wordvault`, { waitUntil: 'load', timeout: 60000 })
      const vaultText = await page.locator('main').innerText()
      run.steps.wordvault_view = { words_visible: wsExpect.words.filter((w) => new RegExp(`\\b${w}\\b`, 'i').test(vaultText)).length, ford_visible: /\bford\b/i.test(vaultText) }
      // 6) Flashcard 실제 평가 — 세트·글 범위, 카드마다 Space(뒤집기) → 3(good)
      await page.goto(`${args.base}/flashcard/play?set=${PIN.wordset.id}&text=${textId}&from=${encodeURIComponent('/text/' + textId)}`, { waitUntil: 'load', timeout: 60000 })
      await page.locator('section[aria-label="플래시카드 학습"]').waitFor({ timeout: 60000 })
      let rated = 0
      for (let k = 0; k < wsExpect.words.length + 1; k++) {
        if (!(await page.locator('section[aria-label="플래시카드 학습"]').count())) break
        await page.keyboard.press('Space'); await page.waitForTimeout(250)
        await page.keyboard.press('3'); await page.waitForTimeout(350)
        rated++
      }
      const flush = page.waitForRequest((r) => new URL(r.url()).pathname === '/api/srs/flush', { timeout: 15000 }).then(() => true).catch(() => false)
      const flushed = await flush
      const pending = await page.evaluate(() => JSON.parse(localStorage.getItem('srs_pending') ?? '[]').length)
      run.steps.flashcard = { key_presses: rated, flush_request_seen: flushed, local_pending_after: pending }
      // 7) 다음 글 고르기 — 목록 표시만, 클릭 없음
      await page.goto(`${args.base}/library/scripts`, { waitUntil: 'load', timeout: 60000 })
      run.steps.next_choice = { list_cards: await page.locator('a[href^="/library/scripts/"]').count() }
      run.text_id_captured = true // 값은 출력하지 않는다(검증 SQL 은 user_id·source_url 로 찾는다)
      run.practice_href_for_boundary = `/practice/article/${PIN.article.id}`
      return run
    }

    const aPage = await ctx.newPage()
    out.runs.push(await journey(aPage, 'A'))
    // A/B 경계: A 연습 화면을 다시 열어 둔 채 같은 브라우저에서 B 로그인 → A 화면이 문항을 숨기는가(제출 없음)
    await aPage.goto(`${args.base}/practice/article/${PIN.article.id}`, { waitUntil: 'load' })
    await aPage.locator('section[aria-label="구문 연습"]').waitFor({ timeout: 60000 })
    const bPage = await ctx.newPage()
    out.runs.push(await journey(bPage, 'B'))
    await aPage.bringToFront()
    await aPage.locator('[data-testid="article-practice-identity"]').waitFor({ timeout: 45000 }).catch(() => {})
    out.ab_boundary = {
      a_tab_items_hidden: (await aPage.locator('section[aria-label="구문 연습"]').count()) === 0,
      a_tab_identity_notice: (await aPage.locator('[data-testid="article-practice-identity"]').count()) === 1,
    }
    await ctx.close()
  } catch (e) {
    out.error_type = e.name; out.error_code = /^[A-Za-z]+$/.test(e.message) ? e.message : 'UI_OPERATION_FAILED'; process.exitCode = 1
  } finally { await browser.close() }
  out.finished_at = new Date().toISOString()
  out.verification_sql_readonly = [
    "-- :uid 는 VFC_STORY_DEV_LEARNER_{A,B}_USER_ID (실행자가 SQL 도구 안에서만 치환, 출력 금지) · 기간 [started_at, finished_at]",
    "SELECT count(*) FROM texts WHERE user_id=:uid AND source_url='article:267ef969-2a3a-4dc9-b6b7-a85246df543f';",
    "SELECT count(*) FROM user_word_set_subscriptions WHERE user_id=:uid AND set_id='404f4977-7d03-4955-8834-833a668f13af';",
    "SELECT word, pos FROM vocabularies WHERE user_id=:uid AND shared_set_id='404f4977-7d03-4955-8834-833a668f13af' ORDER BY word;",
    "SELECT dcp_item_id, is_correct, item_role FROM csat_item_attempts WHERE user_id=:uid AND dcp_item_id IN ('b69f287f-7d20-4770-8b88-8dfe0050ad0f','b72011b0-91e1-46bc-bf35-d2ef20f1aaea') AND created_at BETWEEN :t0 AND :t1;",
    "SELECT count(*) FROM learning_records WHERE user_id=:uid AND created_at BETWEEN :t0 AND :t1;",
    "SELECT count(*) FROM funnel_events WHERE user_id=:uid AND created_at BETWEEN :t0 AND :t1;",
  ]
  out.max_rows_per_account = MAX_ROWS_PER_ACCOUNT
  out.pass = !out.error_type && out.requests.blocked.length === 0 && out.ab_boundary && out.ab_boundary.a_tab_items_hidden && out.ab_boundary.a_tab_identity_notice
  return out
}

;(async () => {
  const args = parseArgs(process.argv.slice(2))
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const res = args.write ? await writeMode(args) : preflight(args)
  const file = path.join(OUT_DIR, args.write ? 'r0-live-journey-write-proof.json' : 'r0-live-journey-preflight.json')
  fs.writeFileSync(file, JSON.stringify(res, null, 2) + '\n')
  console.log(JSON.stringify(res, null, 2))
})().catch((e) => {
  console.error('r0-live-journey failed: ' + (/^[A-Za-z]+$/.test(e.message) ? e.message : 'error suppressed'))
  process.exitCode = 1
})
