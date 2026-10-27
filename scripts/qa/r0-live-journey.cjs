// scripts/qa/r0-live-journey.cjs
//
// R0 실제 개발 계정 종단 확인 — Lincoln 기사 읽기 → 같은 기사 발췌 연습(제목·주제) → 피드백·근거·대안 비교
// → 같은 글로 복귀 → 그 글의 단어 복습(WordVault 보기 + Flashcard 실제 평가) → 다음 글 고르기 화면.
//
// 재사용: output/platform-audit-20261025/evidence/continuous-execution-20261027/usgs-qualification/
//   flashcard-real-auth-readonly.cjs 의 계약(실제 /login 화면 · password grant 응답의 user.id 대조 ·
//   storageState/쿠키/토큰/자격 값 미출력 · 허용 목록 밖 쓰기 요청 abort)을 그대로 따른다.
//
// r2(Codex 검토 R0_LIVE_CANARY_PREPARATION_REVIEW R01·R02·R03 보정):
//   R01 최종 판정은 필수 점검마다 measured && ok 를 요구한다. 미측정·skip·false 는 FAIL. UI 가 다 통과해도
//       DB 행수 대조 전에는 UI_PASS_DB_VERIFICATION_PENDING(pass=false). 행수 대조는 --evaluate 모드(오프라인)에서만.
//       실행 전 결속(기사 본문 sha · 문항 payload/key sha · post-fix 세트 · RPC · 계정 사전 상태)은 --binding-evidence
//       파일과 PIN 을 **대조해 강제**한다. 파일이 없으면 DB_VERIFICATION_PENDING 이고 쓰기 모드는 거부한다.
//   R02 SRS 대기열(localStorage srs_pending) 관측을 평가 전에 init script 로 건다. 평가 성공 수 = 대기열 증가 수(키 입력 수 아님).
//       저장 확인 = 허용된 flushPendingSrsResults 액션 응답 200 + 대기열이 0 으로 비워짐(removeAckedResults 는 res.ok 의
//       acked 만 지운다 — 기존 ACK 신호). 대안 비교는 토글 → 견줄 선택지 → 근거 문장 → 결과 패널 확인까지 실제로 수행한다.
//   R03 preflight 는 config_ok 와 ready_for_write 를 가른다. pre-fix 세트는 --allow-pre-fix-nonacceptance 없이는 거부하고,
//       허용해도 acceptance=NON_ACCEPTANCE_PRE_FIX. Server Action 은 sha1(절대경로:export) id 허용 목록 + 페이지 경로 + 횟수
//       상한으로만 통과시키고, 불명 액션·불명 POST·불명 리다이렉트·라우터 prefetch 는 abort/기록한다. GET 도 서버 쓰기를
//       일으킨다(/library/scripts/[id] 리졸버 · /text/[id] layout markChapterStarted) — 허용 GET 은 쓰기 0 의 근거가 아니다.
//
// ── 모드 ─────────────────────────────────────────────────────────────────────────
//   node scripts/qa/r0-live-journey.cjs [--binding-evidence=<json>] [--server-root=<apps/web 절대경로>]
//        → preflight(기본). DB·네트워크·브라우저·dev 서버 없음. 쓰기 0.
//   node scripts/qa/r0-live-journey.cjs --write --wordset=post-fix --base=<url> --confirm=<TOKEN> --binding-evidence=<json>
//        [--server-root=<path>] [--allow-pre-fix-nonacceptance --wordset=pre-fix]
//        → 실제 앱 쓰기(사용자 승인 뒤에만). preflight.ready_for_write 가 false 면 거부.
//   node scripts/qa/r0-live-journey.cjs --evaluate=<write-proof.json> --row-counts=<json>
//        → 오프라인 최종 판정(파일만 읽는다). 행수는 출력된 읽기 전용 SELECT 결과를 운영자가 옮긴 것.
//
// WRITE_CONFIRM_TOKEN = R0-LIVE-WRITE-dcf55c35f-LINCOLN-267ef969-A1280-B1440-NOCLEANUP
//
// 정리(DELETE)는 하지 않는다. 결과 행은 user_id 로 A/B 를 가른다(출력은 A/B 라벨만, id 값 미출력).
'use strict'

const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
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
  rpcs: ['article_practice_items', 'submit_article_practice'],
  // WORDSET: subscribe_article_word_set 는 shared_words 를 vocabularies 로 **복사**한다(ON CONFLICT (user_id, word) DO NOTHING).
  //   pre-fix 로 돌리면 ground(verb 뜻)·slave(verb 뜻)·ford(고유명사 오추출)가 계정 단어장에 그대로 남고 이후 세트 보정은
  //   복사된 행을 고치지 않는다 → 수용 근거는 post-fix 만. pre-fix 원 입력·해시는 역사 증거로만 보존한다.
  wordset: {
    id: '404f4977-7d03-4955-8834-833a668f13af',
    ford_row_id: '4c29c1a1-c9c0-4726-acaf-9d12c58a7fd0',
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
      expect: { word_count: 8, actual_rows: 8, ground_pos: 'verb', slave_pos: 'verb', ford_present: true },
    },
    post_fix: {
      // r0-lincoln-wordset-fix.v2.proposal.sql(sha 4a6be46c…) 적용 뒤 기대. 행 해시는 적용 후 verify.sql 로 다시 고정한다.
      words: ['bullet', 'ground', 'historian', 'proclamation', 'rebellious', 'slave', 'unguarded'],
      fix_sql_sha256: '4a6be46c143176f2c6e5996c805fc89a9e1348570ccc83f0914028829b19cb02',
      expect: { word_count: 7, actual_rows: 7, ground_pos: 'noun', slave_pos: 'noun', ford_present: false },
    },
  },
}

const ENV_FILE = 'D:/workspace/Vocaflow-AI-Control/.env.lcp-story-dev-e2e.local'
const ACCOUNTS = { A: { prefix: 'VFC_STORY_DEV_LEARNER_A', width: 1280 }, B: { prefix: 'VFC_STORY_DEV_LEARNER_B', width: 1440 } }
const KEY_SUFFIXES = ['_EMAIL', '_PASSWORD', '_USER_ID']
const SUPABASE_HOST = 'jajenrevcbmrpaliomxv.supabase.co'
const WEB_REQUIRE_ROOT = 'D:/workspace/vocaflow-r0-complete/apps/web/package.json'
const DEFAULT_SERVER_ROOT = 'D:/workspace/vocaflow-r0-complete/apps/web'
const OUT_DIR = path.join(__dirname, 'out')
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

// 계정당 첫 실행 상한(post-fix). --evaluate 가 실제 행수와 대조한다. exact 는 정확히 그 값이어야 한다.
const MAX_ROWS_PER_ACCOUNT = {
  texts_insert: 1, texts_status_in_progress: 1, user_word_set_subscriptions_insert: 1,
  vocabularies_insert: 8, csat_item_attempts_insert: 2, vocabularies_fsrs_update: 8, learning_records_insert: 8,
  daily_activity_rows: 1, user_stats_rows: 1, funnel_events_insert: 12,
}
const EXACT_ROWS_PER_ACCOUNT = { texts_insert: 1, user_word_set_subscriptions_insert: 1, csat_item_attempts_insert: 2 }
const MAX_SHARED = { shared_word_sets_subscriber_count_delta: 2 }

// ── Server Action 허용 목록(dcf55c35f 실제 경로에서 호출되는 것만) ──────────────────────
// Next 14.2.35 id = sha1(<webpack 모듈 절대경로> + ':' + <export 이름>) — next/dist/build/webpack/loaders/utils.js generateActionId.
// 경로 표기(역슬래시/슬래시·드라이브 대소문자)를 바꿔 후보를 모두 계산한다. 서버 루트가 다르면 id 가 달라져 전부 abort 된다(안전 쪽).
const ACTION_ALLOWLIST = [
  { name: 'submitArticlePractice', file: 'src/lib/learner/article-practice-actions.ts', page: new RegExp(`^/practice/article/${'267ef969-2a3a-4dc9-b6b7-a85246df543f'}$`), max_per_account: 2, writes: 'csat_item_attempts +1/호출' },
  { name: 'flushPendingSrsResults', file: 'src/lib/srs/flush-actions.ts', page: /^\/flashcard\/play$/, max_per_account: 3, writes: 'vocabularies FSRS UPDATE · learning_records INSERT (멱등: duplicated ACK)' },
]
// 이 경로에서 **호출되면 안 되는** 같은 그래프의 액션(식별되면 unknown 으로 abort 하되 이름을 남긴다)
const ACTION_DENYLIST = [
  { name: 'recordDcpErrorCause', file: 'src/lib/learner/dcp-actions.ts' },
  { name: 'gradeDcpItem', file: 'src/lib/learner/dcp-actions.ts' },
  { name: 'loadArticlePractice', file: 'src/lib/learner/article-practice-actions.ts' },
  { name: 'startArticleLearning', file: 'src/lib/articles/start-learning.ts' },
  { name: 'completeChapter', file: 'src/lib/library/complete-chapter.ts' },
  { name: 'deleteUserTextAction', file: 'src/app/(main)/text/actions.ts' },
  { name: 'deleteUserBookGroupAction', file: 'src/app/(main)/text/actions.ts' },
  { name: 'unenrollBookAction', file: 'src/app/(main)/text/actions.ts' },
]
// 허용 비액션 POST(로컬)
const LOCAL_POST_ALLOW = { '/api/analytics/event': 'funnel_events +1', '/api/srs/flush': '떠날 때 beacon(서버 멱등)' }
// 예상 문서/RSC GET 경로 — 밖이면 기록(실패). 이 GET 들 중 일부는 서버 쓰기를 일으킨다(write_plan 참조).
const EXPECTED_GET = [
  /^\/login$/, new RegExp(`^/library/scripts/${'267ef969-2a3a-4dc9-b6b7-a85246df543f'}$`), new RegExp(`^/text/${UUID}$`),
  /^\/practice\/article\/267ef969-2a3a-4dc9-b6b7-a85246df543f$/, /^\/wordvault$/, /^\/flashcard\/play$/, /^\/library\/scripts$/, /^\/$/,
]
// 예상 리다이렉트(from → to). 밖이면 기록(실패).
const EXPECTED_REDIRECTS = [
  { from: new RegExp(`^/library/scripts/${'267ef969-2a3a-4dc9-b6b7-a85246df543f'}$`), to: new RegExp(`^/text/${UUID}$`) },
  { from: /^\/login$/, to: new RegExp(`^/library/scripts/${'267ef969-2a3a-4dc9-b6b7-a85246df543f'}$`) },
]

function actionIdCandidates(serverRoot, file, name) {
  const abs = path.resolve(serverRoot, file)
  const fwd = abs.replace(/\\/g, '/')
  const back = abs.replace(/\//g, '\\')
  const forms = new Set()
  for (const p of [fwd, back]) { forms.add(p); forms.add(p.charAt(0).toLowerCase() + p.slice(1)); forms.add(p.charAt(0).toUpperCase() + p.slice(1)) }
  return [...forms].map((p) => crypto.createHash('sha1').update(p + ':' + name).digest('hex'))
}
function buildActionMap(serverRoot) {
  const map = new Map()
  for (const a of ACTION_ALLOWLIST) for (const id of actionIdCandidates(serverRoot, a.file, a.name)) map.set(id, { ...a, allowed: true })
  for (const a of ACTION_DENYLIST) for (const id of actionIdCandidates(serverRoot, a.file, a.name)) if (!map.has(id)) map.set(id, { ...a, allowed: false })
  return map
}

function parseArgs(argv) {
  const a = { write: false, allowPreFix: false }
  for (const s of argv) {
    if (s === '--write') a.write = true
    else if (s === '--allow-pre-fix-nonacceptance') a.allowPreFix = true
    else if (s.startsWith('--confirm=')) a.confirm = s.slice(10)
    else if (s.startsWith('--wordset=')) a.wordset = s.slice(10)
    else if (s.startsWith('--base=')) a.base = s.slice(7)
    else if (s.startsWith('--choices=')) a.choices = s.slice(10).split(',').map(Number)
    else if (s.startsWith('--binding-evidence=')) a.bindingEvidence = s.slice(19)
    else if (s.startsWith('--server-root=')) a.serverRoot = s.slice(14)
    else if (s.startsWith('--evaluate=')) a.evaluate = s.slice(11)
    else if (s.startsWith('--row-counts=')) a.rowCounts = s.slice(13)
    else throw Error('UnknownArgument')
  }
  return a
}

function readEnvKeyNames(file) {
  // 값은 읽지 않고 키 이름 존재 여부만
  if (!fs.existsSync(file)) return { exists: false, keys: [] }
  const keys = fs.readFileSync(file, 'utf8').split(/\r?\n/).map((l) => /^([A-Z0-9_]+)\s*=\s*\S/.exec(l)).filter(Boolean).map((m) => m[1])
  return { exists: true, keys }
}
function git(cwd, args) {
  try { return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() } catch { return null }
}
const gitHas = (sha) => git(PIN.code.repo_worktree, ['cat-file', '-e', sha + '^{commit}']) !== null

// 실행 직전 읽기 전용 SELECT — 운영자가 SQL 도구에서 실행하고 결과를 binding-evidence JSON 으로 옮긴다(:uid 치환은 도구 안에서만).
const BINDING_SQL_READONLY = [
  `SELECT id, encode(sha256(convert_to(content,'UTF8')),'hex') AS body_sha256 FROM public.library_articles WHERE id='${PIN.article.id}';`,
  `SELECT id, type, encode(sha256(convert_to(payload::text,'UTF8')),'hex') AS payload_pg_sha256, encode(sha256(convert_to(answer_key::text,'UTF8')),'hex') AS key_pg_sha256 FROM public.csat_dcp_items WHERE id IN (${PIN.items.map((i) => `'${i.id}'`).join(',')}) ORDER BY id;`,
  `SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND proname IN (${PIN.rpcs.map((r) => `'${r}'`).join(',')});`,
  `SELECT s.word_count, s.subscriber_count, (SELECT count(*) FROM public.shared_words x WHERE x.set_id=s.id) AS actual_rows, EXISTS (SELECT 1 FROM public.shared_words WHERE id='${PIN.wordset.ford_row_id}') AS ford_present, (SELECT part_of_speech FROM public.shared_words WHERE set_id=s.id AND word='ground') AS ground_pos, (SELECT part_of_speech FROM public.shared_words WHERE set_id=s.id AND word='slave') AS slave_pos, (SELECT array_agg(word ORDER BY word) FROM public.shared_words WHERE set_id=s.id) AS words FROM public.shared_word_sets s WHERE s.id='${PIN.wordset.id}';`,
  `-- 계정 A·B 각각(:uid): 사전 상태는 모두 0 이어야 첫 실행 상한이 맞는다`,
  `SELECT (SELECT count(*) FROM public.texts WHERE user_id=:uid AND source_url='article:${PIN.article.id}') AS existing_lincoln_texts, (SELECT count(*) FROM public.user_word_set_subscriptions WHERE user_id=:uid AND set_id='${PIN.wordset.id}') AS existing_set_subscriptions, (SELECT count(*) FROM public.vocabularies WHERE user_id=:uid AND shared_set_id='${PIN.wordset.id}') AS existing_set_vocab;`,
]
const BINDING_EVIDENCE_SHAPE = {
  captured_at: 'ISO 시각', captured_by: 'SQL 도구 이름(값·id 미기재)',
  article: { id: PIN.article.id, body_sha256: '…' },
  items: [{ id: '…', payload_pg_sha256: '…', key_pg_sha256: '…' }],
  rpcs_present: ['article_practice_items', 'submit_article_practice'],
  wordset: { word_count: 7, actual_rows: 7, subscriber_count: 0, ford_present: false, ground_pos: 'noun', slave_pos: 'noun', words: ['…'] },
  accounts: { A: { existing_lincoln_texts: 0, existing_set_subscriptions: 0, existing_set_vocab: 0 }, B: { '…': 0 } },
}

function checkBinding(file, wordsetMode) {
  if (!file) return { status: 'DB_VERIFICATION_PENDING', ok: false, reason: 'binding-evidence 파일 없음 — 아래 읽기 전용 SELECT 를 실행해 결과를 파일로', checks: [] }
  if (!fs.existsSync(file)) return { status: 'BINDING_EVIDENCE_MISSING', ok: false, checks: [] }
  let ev
  try { ev = JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return { status: 'BINDING_EVIDENCE_UNPARSEABLE', ok: false, checks: [] } }
  const checks = []
  const c = (id, ok) => checks.push({ id, measured: true, ok: !!ok })
  const m = (id) => checks.push({ id, measured: false, ok: false })
  if (ev.article && ev.article.id === PIN.article.id && typeof ev.article.body_sha256 === 'string') c('article_body_sha', ev.article.body_sha256 === PIN.article.body_sha256); else m('article_body_sha')
  for (const it of PIN.items) {
    const got = Array.isArray(ev.items) ? ev.items.find((x) => x && x.id === it.id) : null
    if (got && got.payload_pg_sha256 && got.key_pg_sha256) { c(`item_${it.type}_payload_sha`, got.payload_pg_sha256 === it.payload_pg_sha256); c(`item_${it.type}_key_sha`, got.key_pg_sha256 === it.key_pg_sha256) } else { m(`item_${it.type}_payload_sha`); m(`item_${it.type}_key_sha`) }
  }
  if (Array.isArray(ev.rpcs_present)) c('rpcs_present', PIN.rpcs.every((r) => ev.rpcs_present.includes(r))); else m('rpcs_present')
  const exp = wordsetMode === 'pre-fix' ? PIN.wordset.pre_fix : PIN.wordset.post_fix
  const ws = ev.wordset
  if (ws && typeof ws.word_count === 'number') {
    for (const k of Object.keys(exp.expect)) c(`wordset_${k}`, ws[k] === exp.expect[k])
    if (Array.isArray(ws.words)) c('wordset_words', JSON.stringify([...ws.words].sort()) === JSON.stringify([...exp.words].sort())); else m('wordset_words')
    if (typeof ws.subscriber_count === 'number') c('wordset_subscriber_count_captured', true); else m('wordset_subscriber_count_captured')
  } else { for (const k of Object.keys(exp.expect)) m(`wordset_${k}`); m('wordset_words') }
  for (const label of Object.keys(ACCOUNTS)) {
    const a = ev.accounts && ev.accounts[label]
    for (const k of ['existing_lincoln_texts', 'existing_set_subscriptions', 'existing_set_vocab']) if (a && typeof a[k] === 'number') c(`account_${label}_${k}_zero`, a[k] === 0); else m(`account_${label}_${k}_zero`)
  }
  const ok = checks.length > 0 && checks.every((x) => x.measured && x.ok)
  return { status: ok ? 'BINDING_VERIFIED_FROM_EVIDENCE' : 'BINDING_MISMATCH_OR_INCOMPLETE', ok, captured_at: ev.captured_at ?? null, wordset_mode_checked: wordsetMode, subscriber_count_before: ws && typeof ws.subscriber_count === 'number' ? ws.subscriber_count : null, checks }
}

function serverSource(serverRoot) {
  const head = git(serverRoot, ['rev-parse', 'HEAD'])
  const dirty = git(serverRoot, ['status', '--porcelain', '--untracked-files=no'])
  const ok = head === PIN.code.head && dirty === ''
  return {
    server_root: serverRoot, head_matches_pin: head === PIN.code.head, head_short: head ? head.slice(0, 9) : null, tracked_clean: dirty === '',
    ok,
    limit: '작업 트리 HEAD·깨끗함만 본다. 그 트리에서 서버 프로세스를 띄웠다는 것은 운영자가 같은 경로로 next dev/start 한 사실로만 결속된다.',
  }
}

const WRITE_PLAN = [
  { step: '0 login', route: 'POST auth/v1/token?grant_type=password', writes: 'auth.sessions/refresh_tokens/audit (Supabase Auth 관리 테이블, 로그인 1회당 세션 1)', idempotent: false },
  { step: '1 start-learning', route: 'GET /library/scripts/{articleId} → 서버 컴포넌트가 startArticleLearning 직접 호출(Server Action POST 아님)', writes: 'texts +1; subscribe_article_word_set → user_word_set_subscriptions +1 (+trigger shared_word_sets.subscriber_count +1), vocabularies +7 post-fix', idempotent: 'texts·구독·vocab 재실행 0행(마커·ON CONFLICT)', get_causes_write: true },
  { step: '2 /text/[id] GET', route: 'layout: markChapterStarted + article_practice_items(read)', writes: 'texts UPDATE status not_started→in_progress 1행; ScreenViewTracker → funnel_events +1', idempotent: 'status 재실행 0행 · funnel 매 진입 +1', get_causes_write: true },
  { step: '3 /practice/article/[id] GET', route: 'loadArticlePractice (서버 컴포넌트 호출, 읽기)', writes: 'funnel_events +1', idempotent: 'funnel 매 진입 +1' },
  { step: '4 제출 ×2', route: 'Server Action submitArticlePractice(허용 id) → rpc submit_article_practice', writes: 'csat_item_attempts +1/문항 = +2', idempotent: false },
  { step: '4b 오답 원인 1-tap', route: 'recordDcpErrorCause — 누르지 않는다. 호출되면 거부 목록 id 로 abort', writes: '0', idempotent: true },
  { step: '5 근거·대안 비교', route: 'MeaningEvidence (client only) — 근거 문장 선택 · 견줄 선택지 → 근거 → 결과 패널', writes: '없음', idempotent: true },
  { step: '6 같은 글 복귀', route: 'GET /text/{textId}', writes: 'texts status 0행 · funnel_events +1', idempotent: 'funnel 제외 0', get_causes_write: true },
  { step: '7 WordVault 보기', route: 'GET /wordvault', writes: 'funnel_events +1 (보기만은 복습 완료가 아니다)', idempotent: 'funnel 제외 0' },
  { step: '8 Flashcard 실제 평가', route: 'GET /flashcard/play?set&text → 카드마다 Space·3 → 완주 시 Server Action flushPendingSrsResults(허용 id), 떠날 때 /api/srs/flush beacon', writes: 'vocabularies FSRS UPDATE ≤7 · learning_records +N · daily_activity · user_stats · funnel_events +1', idempotent: 'flush 재전송은 duplicated ACK' },
  { step: '9 다음 글 고르기', route: 'GET /library/scripts (다른 글은 클릭하지 않는다 · 라우터 prefetch 는 abort — prefetch GET 도 리졸버를 실행해 쓰기를 만들 수 있다)', writes: 'funnel_events +1', idempotent: 'funnel 제외 0' },
]

function preflight(args) {
  const env = readEnvKeyNames(ENV_FILE)
  const keyCheck = {}
  for (const [label, { prefix }] of Object.entries(ACCOUNTS)) keyCheck[label] = KEY_SUFFIXES.every((s) => env.keys.includes(prefix + s))
  let playwright = false
  try { createRequire(WEB_REQUIRE_ROOT).resolve('@playwright/test'); playwright = true } catch { playwright = false }
  const commits = Object.fromEntries(PIN.code.commits.map((c) => [c.slice(0, 9), gitHas(c)]))
  const branchHead = git(PIN.code.repo_worktree, ['rev-parse', PIN.code.branch])
  const serverRoot = args.serverRoot || DEFAULT_SERVER_ROOT
  const wordsetMode = args.wordset || 'post-fix'
  const config_ok = env.exists && keyCheck.A && keyCheck.B && playwright && Object.values(commits).every(Boolean) && branchHead === PIN.code.head
  const server = serverSource(serverRoot)
  const binding = checkBinding(args.bindingEvidence, wordsetMode)
  const preFixBlocked = wordsetMode === 'pre-fix' && !args.allowPreFix
  const actionMap = buildActionMap(serverRoot)
  const out = {
    mode: 'preflight',
    db_access: false, network: false, browser: false, dev_server: false, writes: 0,
    config: { env_file_exists: env.exists, account_keys_present: keyCheck, playwright_resolvable_from: WEB_REQUIRE_ROOT, playwright_resolvable: playwright, pinned_commits_present: commits, branch_head_matches_pin: branchHead === PIN.code.head },
    config_ok,
    server_source: server,
    db_binding: binding,
    wordset_mode: wordsetMode,
    wordset_acceptance: wordsetMode === 'post-fix' ? 'ACCEPTANCE_ELIGIBLE' : 'NON_ACCEPTANCE_PRE_FIX',
    pre_fix_refused: preFixBlocked,
    ready_for_write: config_ok && server.ok && binding.ok && !preFixBlocked,
    ready_for_write_requires: ['config_ok', 'server_source.ok (서버 작업 트리 HEAD=dcf55c35f · tracked clean)', 'db_binding.ok (--binding-evidence 가 PIN 과 전부 일치)', 'post-fix 세트(또는 --allow-pre-fix-nonacceptance — 이 경우도 수용 근거 아님)'],
    pin: { article: PIN.article, items: PIN.items.map((i) => ({ id: i.id, type: i.type })), wordset: { id: PIN.wordset.id, pre_fix: PIN.wordset.pre_fix.expect, post_fix: PIN.wordset.post_fix.expect, post_fix_sql_sha256: PIN.wordset.post_fix.fix_sql_sha256 } },
    server_action_allowlist: ACTION_ALLOWLIST.map((a) => ({ name: a.name, file: a.file, page: String(a.page), max_per_account: a.max_per_account, writes: a.writes, id_candidates: actionIdCandidates(serverRoot, a.file, a.name).length })),
    server_action_denylist: ACTION_DENYLIST.map((a) => a.name),
    action_id_map_size: actionMap.size,
    request_policy: {
      server_action: '허용 목록 id + 페이지 경로 + 계정당 횟수 상한 일치만 통과. 거부 목록 id·불명 id·경로 불일치·상한 초과는 abort + 기록 → FAIL',
      local_post: LOCAL_POST_ALLOW,
      supabase: 'auth/v1/token grant_type=password|refresh_token 만. 그 외 Supabase 비GET 은 abort',
      get: 'GET 은 통과시키되 문서/RSC 경로를 기록하고 예상 목록 밖이면 FAIL. next-router-prefetch GET 은 abort. 허용 GET 도 서버 쓰기를 일으키므로(/library/scripts/[id] 리졸버 · /text/[id] layout) GET 통과는 쓰기 0 의 근거가 아니다 — 실제 쓰기 수는 --evaluate 의 DB 행수로만 판정',
      redirects: '3xx·x-action-redirect 를 전부 기록, 예상 목록 밖이면 FAIL',
    },
    write_plan: WRITE_PLAN,
    max_rows_per_account: MAX_ROWS_PER_ACCOUNT, exact_rows_per_account: EXACT_ROWS_PER_ACCOUNT, max_shared: MAX_SHARED,
    binding_sql_readonly: BINDING_SQL_READONLY,
    binding_evidence_shape: BINDING_EVIDENCE_SHAPE,
    write_requires: `--write --wordset=post-fix --base=http://localhost:<port> --binding-evidence=<json> --confirm=${WRITE_CONFIRM_TOKEN}`,
  }
  return out
}

function rowCountSql() {
  return [
    '-- 계정 A·B 각각: :uid = VFC_STORY_DEV_LEARNER_{A,B}_USER_ID (SQL 도구 안에서만 치환, 출력 금지) · :t0/:t1 = write-proof 의 started_at/finished_at',
    `SELECT (SELECT count(*) FROM public.texts WHERE user_id=:uid AND source_url='article:${PIN.article.id}') AS texts_insert,`
    + ` (SELECT count(*) FROM public.texts WHERE user_id=:uid AND source_url='article:${PIN.article.id}' AND status='in_progress') AS texts_status_in_progress,`
    + ` (SELECT count(*) FROM public.user_word_set_subscriptions WHERE user_id=:uid AND set_id='${PIN.wordset.id}') AS user_word_set_subscriptions_insert,`
    + ` (SELECT count(*) FROM public.vocabularies WHERE user_id=:uid AND shared_set_id='${PIN.wordset.id}') AS vocabularies_insert,`
    + ` (SELECT count(*) FROM public.csat_item_attempts WHERE user_id=:uid AND dcp_item_id IN (${PIN.items.map((i) => `'${i.id}'`).join(',')}) AND responded_at BETWEEN :t0 AND :t1) AS csat_item_attempts_insert,`
    + ` (SELECT count(*) FROM public.vocabularies WHERE user_id=:uid AND shared_set_id='${PIN.wordset.id}' AND last_review_at BETWEEN :t0 AND :t1) AS vocabularies_fsrs_update,`
    + ` (SELECT count(*) FROM public.learning_records WHERE user_id=:uid AND attempted_at BETWEEN :t0 AND :t1) AS learning_records_insert,`
    + ' (SELECT count(*) FROM public.daily_activity WHERE user_id=:uid AND date BETWEEN (:t0)::date AND (:t1)::date) AS daily_activity_rows,'
    + ' (SELECT count(*) FROM public.user_stats WHERE user_id=:uid) AS user_stats_rows,'
    + ' (SELECT count(*) FROM public.funnel_events WHERE user_id=:uid AND occurred_at BETWEEN :t0 AND :t1) AS funnel_events_insert;',
    `SELECT subscriber_count FROM public.shared_word_sets WHERE id='${PIN.wordset.id}';  -- delta = 이 값 - binding 의 subscriber_count`,
    `SELECT word, part_of_speech FROM public.vocabularies WHERE user_id=:uid AND shared_set_id='${PIN.wordset.id}' ORDER BY word;  -- ford 없음 · ground/slave noun 확인용(행수 판정과 별개로 눈으로)`,
  ]
}

// ───────────────────────────── 쓰기 모드 ─────────────────────────────
async function writeMode(args) {
  if (args.confirm !== WRITE_CONFIRM_TOKEN) throw Error('ConfirmTokenMismatch')
  if (!['pre-fix', 'post-fix'].includes(args.wordset)) throw Error('WordsetExpectationRequired')
  if (args.wordset === 'pre-fix' && !args.allowPreFix) throw Error('PreFixWordsetRefused')
  if (!args.base || !/^http:\/\/localhost:\d+$/.test(args.base)) throw Error('LocalBaseUrlRequired')
  const pf = preflight(args)
  if (!pf.ready_for_write) throw Error('PreflightNotReady')
  const serverRoot = args.serverRoot || DEFAULT_SERVER_ROOT
  const actionMap = buildActionMap(serverRoot)
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
  const out = {
    mode: 'write', started_at: new Date().toISOString(), wordset_expectation: args.wordset,
    wordset_acceptance: args.wordset === 'post-fix' ? 'ACCEPTANCE_ELIGIBLE' : 'NON_ACCEPTANCE_PRE_FIX',
    base: args.base, code_pin: PIN.code.head, server_source: pf.server_source, db_binding: { status: pf.db_binding.status, captured_at: pf.db_binding.captured_at, subscriber_count_before: pf.db_binding.subscriber_count_before },
    runs: [], checks: [], ab_boundary: null,
    requests: { actions: [], local_posts: [], supabase_posts: [], gets: [], redirects: [], blocked: [], unknown: [] },
    get_write_note: 'GET 통과는 쓰기 0 의 근거가 아니다(/library/scripts/[id] · /text/[id] 가 서버에서 쓴다) — 실제 쓰기는 --evaluate 행수로만',
    credential_values_exported: false, storage_state_exported: false,
  }
  // 필수 점검 기록기 — measured=false 또는 ok=false 는 전부 FAIL 로 집계된다
  const check = (id, account, measured, ok, detail) => out.checks.push({ id, account, measured: !!measured, ok: !!(measured && ok), ...(detail ? { detail } : {}) })
  let currentLabel = null
  const actionCounts = {}
  const browser = await chromium.launch()
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    // R02: SRS 대기열 관측을 모든 문서에 미리 건다(평가 전에 시작). 값은 길이만 남긴다.
    await ctx.addInitScript(() => {
      const KEY = 'srs_pending'
      const log = []
      Object.defineProperty(window, '__r0SrsLog', { value: log, configurable: false })
      const len = (v) => { try { const a = JSON.parse(v ?? '[]'); return Array.isArray(a) ? a.length : -1 } catch { return -1 } }
      const set = Storage.prototype.setItem; const rem = Storage.prototype.removeItem
      Storage.prototype.setItem = function (k, v) { if (this === window.localStorage && k === KEY) log.push({ op: 'set', len: len(v), t: Date.now() }); return set.call(this, k, v) }
      Storage.prototype.removeItem = function (k) { if (this === window.localStorage && k === KEY) log.push({ op: 'remove', len: 0, t: Date.now() }); return rem.call(this, k) }
    })
    await ctx.route('**/*', async (route) => {
      const r = route.request(); const u = new URL(r.url()); const h = r.headers()
      const local = u.origin === args.base
      if (r.method() === 'GET' || r.method() === 'HEAD' || r.method() === 'OPTIONS') {
        if (local && (h['next-router-prefetch'] === '1' || h['purpose'] === 'prefetch')) { out.requests.blocked.push({ account: currentLabel, method: r.method(), path: u.pathname, why: 'router_prefetch' }); return route.abort() }
        const kind = r.resourceType()
        if (local && (kind === 'document' || h['rsc'] === '1') && !u.pathname.startsWith('/_next/')) {
          const expected = EXPECTED_GET.some((re) => re.test(u.pathname))
          out.requests.gets.push({ account: currentLabel, path: u.pathname.replace(new RegExp(UUID, 'g'), '{uuid}'), rsc: h['rsc'] === '1', expected })
          if (!expected) out.requests.unknown.push({ account: currentLabel, method: 'GET', path: u.pathname.replace(new RegExp(UUID, 'g'), '{uuid}') })
        }
        return route.continue()
      }
      if (u.hostname === SUPABASE_HOST && u.pathname === '/auth/v1/token' && ['password', 'refresh_token'].includes(u.searchParams.get('grant_type'))) {
        out.requests.supabase_posts.push({ account: currentLabel, grant: u.searchParams.get('grant_type') }); return route.continue()
      }
      if (local && h['next-action']) {
        const id = h['next-action']; const hit = actionMap.get(id)
        const key = `${currentLabel}:${hit ? hit.name : id}`
        if (hit && hit.allowed && hit.page.test(u.pathname) && (actionCounts[key] ?? 0) < hit.max_per_account) {
          actionCounts[key] = (actionCounts[key] ?? 0) + 1
          out.requests.actions.push({ account: currentLabel, name: hit.name, page: u.pathname.replace(new RegExp(UUID, 'g'), '{uuid}') })
          return route.continue()
        }
        const why = !hit ? 'unknown_action_id' : !hit.allowed ? 'denylisted_action' : !hit.page.test(u.pathname) ? 'page_mismatch' : 'over_cap'
        out.requests.unknown.push({ account: currentLabel, method: 'POST', action: hit ? hit.name : 'unidentified', why, page: u.pathname.replace(new RegExp(UUID, 'g'), '{uuid}') })
        out.requests.blocked.push({ account: currentLabel, method: 'POST', path: 'server-action', why })
        return route.abort()
      }
      if (local && LOCAL_POST_ALLOW[u.pathname]) { out.requests.local_posts.push({ account: currentLabel, path: u.pathname }); return route.continue() }
      out.requests.unknown.push({ account: currentLabel, method: r.method(), path: local ? u.pathname.replace(new RegExp(UUID, 'g'), '{uuid}') : u.hostname + u.pathname })
      out.requests.blocked.push({ account: currentLabel, method: r.method(), path: u.pathname, why: 'not_allowlisted' })
      return route.abort()
    })

    function watchResponses(page) {
      page.on('response', (resp) => {
        try {
          const u = new URL(resp.url()); if (u.origin !== args.base) return
          const st = resp.status(); const loc = resp.headers()['location']; const ar = resp.headers()['x-action-redirect']
          const to = loc || ar
          if ((st >= 300 && st < 400 && loc) || ar) {
            const toPath = new URL(to, args.base).pathname
            const expected = EXPECTED_REDIRECTS.some((e) => e.from.test(u.pathname) && e.to.test(toPath))
            const rec = { account: currentLabel, from: u.pathname.replace(new RegExp(UUID, 'g'), '{uuid}'), to: toPath.replace(new RegExp(UUID, 'g'), '{uuid}'), status: st, action_redirect: !!ar, expected }
            out.requests.redirects.push(rec)
            if (!expected) out.requests.unknown.push({ account: currentLabel, method: 'REDIRECT', path: `${rec.from}→${rec.to}` })
          }
        } catch { /* 기록 실패는 무시하지 않는다 — 아래 응답 감시가 따로 판정 */ }
      })
    }

    async function login(page, label, next) {
      const a = account(label)
      await page.goto(`${args.base}/login?next=${encodeURIComponent(next)}`, { waitUntil: 'load', timeout: 90000 })
      await page.locator('input[type="email"]').fill(a.email)
      await page.locator('input[type="password"]').fill(a.password)
      const resp = page.waitForResponse((r) => { const u = new URL(r.url()); return u.hostname === SUPABASE_HOST && u.pathname === '/auth/v1/token' && u.searchParams.get('grant_type') === 'password' }, { timeout: 45000 })
      await page.locator('button[type="submit"]').first().click()
      const r = await resp; const body = await r.json()
      if (!(r.status() === 200 && body.user && body.user.id === a.id)) throw Error('NormalAuthIdentityNotConfirmed')
      check('auth_identity_matches_account', label, true, true)
    }

    async function measure(locator) {
      const box = await locator.boundingBox()
      return { measured: !!box, w: box ? Math.round(box.width) : 0, h: box ? Math.round(box.height) : 0, ge44: !!box && box.width >= 44 && box.height >= 44 }
    }
    async function minHeight(locator) {
      const all = await locator.all(); if (!all.length) return { measured: false, min_h: null }
      const hs = await Promise.all(all.map(async (x) => (await x.boundingBox())?.height ?? 0))
      return { measured: true, min_h: Math.round(Math.min(...hs)), count: hs.length }
    }
    // 키보드 도달 + 보이는 focus — 쉬는 상태 스타일과 focus 상태 스타일을 비교한다(ring 은 box-shadow)
    async function tabTo(page, locator, max = 80) {
      const handle = await locator.elementHandle()
      if (!handle) return { measured: false, reached: false, focus_visible: false }
      const rest = await page.evaluate((el) => { const s = getComputedStyle(el); return { o: s.outlineStyle + s.outlineWidth, b: s.boxShadow } }, handle)
      for (let i = 0; i < max; i++) {
        await page.keyboard.press('Tab')
        const hit = await page.evaluate((el) => document.activeElement === el, handle)
        if (hit) {
          const now = await page.evaluate((el) => { const s = getComputedStyle(el); return { outline: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0, o: s.outlineStyle + s.outlineWidth, b: s.boxShadow, fv: el.matches(':focus-visible') } }, handle)
          const visible = now.fv && (now.outline || (now.b !== rest.b && now.b !== 'none'))
          return { measured: true, reached: true, tabs: i + 1, focus_visible: visible }
        }
      }
      return { measured: true, reached: false, tabs: max, focus_visible: false }
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
    const norm = (s) => s.replace(/\s+/g, ' ').trim()

    async function journey(page, label) {
      currentLabel = label
      watchResponses(page)
      const run = { account: label, steps: {} }
      await page.setViewportSize({ width: ACCOUNTS[label].width, height: 900 })
      // 1) start-learning — 기사 리졸버(GET)가 본인 글을 만들고 /text/[id]?mode=read 로 보낸다(쓰기)
      await login(page, label, `/library/scripts/${PIN.article.id}`)
      await page.waitForURL((u) => new RegExp(`^/text/${UUID}$`).test(u.pathname), { timeout: 90000 })
      const textId = new URL(page.url()).pathname.split('/')[2]
      check('start_learning_landed_on_text', label, true, true)
      // 2) reader — 연습 링크 · 키보드 · focus · 44px
      const link = page.locator('[data-testid="reader-article-practice"]')
      await link.waitFor({ timeout: 60000 })
      const readerText = norm(await page.locator('main').innerText())
      check('reader_body_captured', label, true, readerText.length > 200, { chars: readerText.length })
      const rSizes = await atWidths(page, async () => ({ link: await measure(link) }))
      for (const w of [1280, 1440]) { check(`reader_link_ge44_${w}`, label, rSizes[w].link.measured, rSizes[w].link.ge44, rSizes[w].link); check(`reader_no_hscroll_${w}`, label, true, rSizes[w].no_hscroll) }
      await page.setViewportSize({ width: ACCOUNTS[label].width, height: 900 })
      const rKb = await tabTo(page, link)
      check('reader_link_keyboard_reach', label, rKb.measured, rKb.reached, rKb)
      check('reader_link_focus_visible', label, rKb.measured && rKb.reached, rKb.focus_visible)
      if (rKb.reached) await page.keyboard.press('Enter'); else await link.click()
      // 3) practice
      await page.waitForURL((u) => u.pathname === `/practice/article/${PIN.article.id}`, { timeout: 60000 })
      if (await page.locator('[data-testid="article-practice-reason"]').count()) {
        run.steps.practice_unavailable = await page.locator('[data-testid="article-practice-reason"]').getAttribute('data-reason')
        throw Error('PracticeUnavailable')
      }
      await page.locator('section[aria-label="구문 연습"]').waitFor({ timeout: 60000 })
      for (let i = 0; i < 2; i++) {
        const tag = `item${i + 1}`
        const radios = page.locator('[role="radiogroup"][aria-label="선택지"] [role="radio"]')
        await radios.first().waitFor({ timeout: 30000 })
        const sz = await atWidths(page, async () => minHeight(radios))
        for (const w of [1280, 1440]) { check(`${tag}_choice_ge44_${w}`, label, sz[w].measured, sz[w].min_h >= 44, sz[w]); check(`${tag}_no_hscroll_${w}`, label, true, sz[w].no_hscroll) }
        await page.setViewportSize({ width: ACCOUNTS[label].width, height: 900 })
        const target = radios.nth(choices[i] - 1)
        const kb = await tabTo(page, target)
        check(`${tag}_choice_keyboard_reach`, label, kb.measured, kb.reached, kb)
        check(`${tag}_choice_focus_visible`, label, kb.measured && kb.reached, kb.focus_visible)
        if (kb.reached) await page.keyboard.press('Space'); else await target.click()
        check(`${tag}_choice_selected`, label, true, (await target.getAttribute('aria-checked')) === 'true')
        const submit = page.getByRole('button', { name: '제출' })
        const sb = await measure(submit)
        check(`${tag}_submit_ge44`, label, sb.measured, sb.ge44, sb)
        await submit.click()
        // 피드백 → 근거
        const evidence = page.locator('[data-testid="meaning-evidence"], [data-testid="meaning-evidence-skipped"]')
        await evidence.first().waitFor({ timeout: 30000 })
        check(`${tag}_no_grade_error_alert`, label, true, (await page.locator('[role="alert"]').count()) === 0)
        const evSection = page.locator('[data-testid="meaning-evidence"]')
        const evPresent = (await evSection.count()) === 1
        check(`${tag}_evidence_offered`, label, true, evPresent)
        if (evPresent) {
          const cands = evSection.locator('[role="group"][aria-label="근거 문장 후보"] button')
          const texts = (await cands.allInnerTexts()).map(norm).filter(Boolean)
          check(`${tag}_evidence_candidates_in_read_body`, label, texts.length > 0, texts.length > 0 && texts.every((t) => readerText.includes(t)), { candidates: texts.length, found: texts.filter((t) => readerText.includes(t)).length })
          const evH = await minHeight(cands); check(`${tag}_evidence_buttons_ge44`, label, evH.measured, evH.min_h >= 44, evH)
          if (texts.length) {
            await cands.first().click()
            const picked = norm(await cands.first().innerText())
            check(`${tag}_evidence_sentence_picked_in_read_body`, label, (await cands.first().getAttribute('aria-pressed')) === 'true', readerText.includes(picked))
          } else check(`${tag}_evidence_sentence_picked_in_read_body`, label, false, false)
          // 대안 비교: 토글 → 견줄 선택지 → 근거 문장 → 결과 패널
          const toggle = evSection.locator('[data-testid="meaning-compare-toggle"]')
          if (await toggle.count()) {
            await toggle.click()
            const others = evSection.locator('[role="group"][aria-label="견줄 선택지"] button')
            const nOthers = await others.count()
            if (nOthers) {
              await others.first().click()
              const targetPicked = (await others.first().getAttribute('aria-pressed')) === 'true'
              const task = evSection.locator('[data-testid="meaning-compare-task"]')
              const taskShown = (await task.count()) === 1
              const cmpCands = task.locator('[role="group"][aria-label="견주기 근거 문장 후보"] button')
              let resultOk = false; let sentPicked = false
              if (taskShown && (await cmpCands.count())) {
                await cmpCands.first().click()
                sentPicked = (await cmpCands.first().getAttribute('aria-pressed')) === 'true'
                const result = task.locator('[data-testid="meaning-compare-result"]')
                await result.waitFor({ timeout: 10000 }).catch(() => {})
                const rt = (await result.count()) ? norm(await result.innerText()) : ''
                resultOk = rt.length > 0 && rt.includes(norm(await cmpCands.first().innerText()))
              }
              check(`${tag}_compare_target_chosen`, label, true, targetPicked)
              check(`${tag}_compare_evidence_chosen`, label, taskShown, sentPicked)
              check(`${tag}_compare_result_panel_confirmed`, label, taskShown && sentPicked, resultOk)
            } else { check(`${tag}_compare_target_chosen`, label, false, false, { why: 'NO_OTHER_CHOICES' }); check(`${tag}_compare_evidence_chosen`, label, false, false); check(`${tag}_compare_result_panel_confirmed`, label, false, false) }
          } else { check(`${tag}_compare_target_chosen`, label, false, false, { why: 'NO_COMPARE_TOGGLE' }); check(`${tag}_compare_evidence_chosen`, label, false, false); check(`${tag}_compare_result_panel_confirmed`, label, false, false) }
        } else {
          for (const k of ['evidence_candidates_in_read_body', 'evidence_buttons_ge44', 'evidence_sentence_picked_in_read_body', 'compare_target_chosen', 'compare_evidence_chosen', 'compare_result_panel_confirmed']) check(`${tag}_${k}`, label, false, false, { why: 'EVIDENCE_SKIPPED_OR_ABSENT' })
        }
        // 오답 원인 버튼(누르지 않음) — 있으면 44px 필수(근거 버튼과 구분: meaning-evidence 밖 aria-pressed)
        const causeH = await page.evaluate(() => { const hs = [...document.querySelectorAll('section[aria-label="구문 연습"] button[aria-pressed]')].filter((b) => !b.closest('[data-testid="meaning-evidence"]')).map((b) => b.getBoundingClientRect().height); return hs.length ? Math.round(Math.min(...hs)) : null })
        if (causeH !== null) check(`${tag}_error_cause_buttons_ge44`, label, true, causeH >= 44, { min_h: causeH })
        await page.getByRole('button', { name: i === 1 ? '마치기' : '다음' }).click()
      }
      await page.locator('[data-testid="dcp-done-body"]').waitFor({ timeout: 30000 })
      check('practice_submitted_twice', label, true, (actionCounts[`${label}:submitArticlePractice`] ?? 0) === 2, { submits: actionCounts[`${label}:submitArticlePractice`] ?? 0 })
      // 4) 같은 글로 복귀
      await page.getByRole('link', { name: '읽던 글로' }).first().click()
      await page.waitForURL((u) => u.pathname === `/text/${textId}`, { timeout: 60000 })
      check('return_same_text', label, true, true)
      // 5) WordVault 보기(복습 완료가 아니다)
      await page.goto(`${args.base}/wordvault`, { waitUntil: 'load', timeout: 60000 })
      const vaultText = await page.locator('main').innerText()
      const shown = wsExpect.words.filter((w) => new RegExp(`\\b${w}\\b`, 'i').test(vaultText)).length
      check('wordvault_at_least_one_word_shown', label, true, shown >= 1, { shown, expected: wsExpect.words.length })
      if (args.wordset === 'post-fix') check('wordvault_ford_absent', label, true, !/\bford\b/i.test(vaultText))
      // 6) Flashcard 실제 평가 — 관측은 init script 로 이미 걸려 있다(R02)
      const flushResp = []
      const onResp = async (resp) => {
        const req = resp.request(); const id = req.headers()['next-action']
        const hit = id ? actionMap.get(id) : null
        if (hit && hit.name === 'flushPendingSrsResults') flushResp.push({ status: resp.status() })
      }
      page.on('response', onResp)
      await page.goto(`${args.base}/flashcard/play?set=${PIN.wordset.id}&text=${textId}&from=${encodeURIComponent('/text/' + textId)}`, { waitUntil: 'load', timeout: 60000 })
      const fc = page.locator('section[aria-label="플래시카드 학습"]')
      await fc.waitFor({ timeout: 60000 })
      const startLen = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('srs_pending') ?? '[]').length } catch { return -1 } })
      let keyPresses = 0
      for (let k = 0; k < wsExpect.words.length + 2; k++) {
        if (!(await fc.count())) break
        await page.keyboard.press('Space'); await page.waitForTimeout(300)
        await page.keyboard.press('3'); await page.waitForTimeout(400)
        keyPresses++
      }
      // 저장 확인: 대기열이 0 으로 비워질 때까지(ACK 된 항목만 지워진다) 최대 20s
      const drained = await page.waitForFunction(() => { try { return JSON.parse(localStorage.getItem('srs_pending') ?? '[]').length === 0 } catch { return false } }, null, { timeout: 20000 }).then(() => true).catch(() => false)
      const log = await page.evaluate(() => window.__r0SrsLog.slice())
      page.off('response', onResp)
      let rated = 0; let prev = startLen < 0 ? 0 : startLen; let peak = prev
      for (const e of log) { if (e.op === 'set' && e.len > prev) rated += e.len - prev; if (e.len >= 0) { prev = e.len; peak = Math.max(peak, e.len) } }
      run.steps.flashcard = { key_presses: keyPresses, queue_start_len: startLen, ratings_enqueued: rated, queue_peak: peak, queue_drained: drained, flush_action_responses: flushResp.map((r) => r.status) }
      check('flashcard_queue_observed_before_rating', label, startLen >= 0, startLen === 0, { start_len: startLen })
      check('flashcard_ratings_enqueued', label, true, rated >= 1, { rated, key_presses: keyPresses })
      check('flashcard_ratings_match_set', label, true, rated === wsExpect.words.length, { rated, expected: wsExpect.words.length })
      check('srs_flush_action_ok', label, flushResp.length > 0, flushResp.some((r) => r.status === 200))
      check('srs_save_acknowledged_queue_drained', label, true, drained && rated >= 1)
      // 7) 다음 글 고르기 — 목록 표시만, 클릭 없음
      await page.goto(`${args.base}/library/scripts`, { waitUntil: 'load', timeout: 60000 })
      const cards = await page.locator('a[href^="/library/scripts/"]').count()
      check('next_choice_list_shown', label, true, cards >= 1, { cards })
      run.text_id_captured = true // 값은 출력하지 않는다(검증 SQL 은 user_id·source_url 로 찾는다)
      return run
    }

    const aPage = await ctx.newPage()
    out.runs.push(await journey(aPage, 'A'))
    // A/B 경계: A 연습 화면을 다시 열어 둔 채 같은 브라우저에서 B 로그인 → A 화면이 문항을 숨기는가(제출 없음)
    currentLabel = 'A'
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
    check('ab_a_tab_items_hidden', 'AB', true, out.ab_boundary.a_tab_items_hidden)
    check('ab_a_tab_identity_notice', 'AB', true, out.ab_boundary.a_tab_identity_notice)
    await ctx.close()
  } catch (e) {
    out.error_type = e.name; out.error_code = /^[A-Za-z]+$/.test(e.message) ? e.message : 'UI_OPERATION_FAILED'; process.exitCode = 1
  } finally { await browser.close() }
  out.finished_at = new Date().toISOString()
  out.row_count_sql_readonly = rowCountSql()
  out.max_rows_per_account = MAX_ROWS_PER_ACCOUNT
  const failed = out.checks.filter((c) => !c.ok)
  out.summary = { checks: out.checks.length, failed: failed.length, unmeasured: out.checks.filter((c) => !c.measured).length, unknown_requests: out.requests.unknown.length, blocked: out.requests.blocked.length }
  const uiOk = !out.error_type && out.checks.length > 0 && failed.length === 0 && out.requests.unknown.length === 0 && out.requests.blocked.length === 0
  out.ui_status = uiOk ? 'UI_PASS' : 'FAIL'
  out.status = !uiOk ? 'FAIL' : 'UI_PASS_DB_VERIFICATION_PENDING'
  out.acceptance = out.wordset_acceptance
  out.pass = false // 최종 PASS 는 --evaluate 로 DB 행수를 대조한 뒤에만
  if (!uiOk) process.exitCode = 1
  return out
}

// ───────────────────────────── 오프라인 판정 ─────────────────────────────
function evaluate(args) {
  if (!args.evaluate || !args.rowCounts) throw Error('EvaluateNeedsProofAndRowCounts')
  const proof = JSON.parse(fs.readFileSync(args.evaluate, 'utf8'))
  const rc = JSON.parse(fs.readFileSync(args.rowCounts, 'utf8'))
  const checks = []
  const c = (id, measured, ok, detail) => checks.push({ id, measured: !!measured, ok: !!(measured && ok), ...(detail ? { detail } : {}) })
  c('proof_is_write_mode', true, proof.mode === 'write')
  c('proof_ui_pass', true, proof.ui_status === 'UI_PASS' && proof.status === 'UI_PASS_DB_VERIFICATION_PENDING')
  c('proof_binding_verified', true, proof.db_binding && proof.db_binding.status === 'BINDING_VERIFIED_FROM_EVIDENCE')
  c('proof_server_source_ok', true, proof.server_source && proof.server_source.ok === true)
  for (const label of Object.keys(ACCOUNTS)) {
    const a = rc[label] || {}
    for (const [k, cap] of Object.entries(MAX_ROWS_PER_ACCOUNT)) {
      const v = a[k]; const measured = typeof v === 'number'
      const ok = measured && v <= cap && (EXACT_ROWS_PER_ACCOUNT[k] === undefined || v === EXACT_ROWS_PER_ACCOUNT[k])
      c(`${label}_${k}`, measured, ok, measured ? { value: v, cap, exact: EXACT_ROWS_PER_ACCOUNT[k] } : { why: 'NOT_MEASURED' })
    }
    const run = (proof.runs || []).find((r) => r.account === label)
    const rated = run && run.steps && run.steps.flashcard ? run.steps.flashcard.ratings_enqueued : null
    c(`${label}_learning_records_cover_ratings`, typeof a.learning_records_insert === 'number' && typeof rated === 'number', a.learning_records_insert >= rated && rated >= 1, { learning_records: a.learning_records_insert, rated })
    c(`${label}_fsrs_updates_cover_ratings`, typeof a.vocabularies_fsrs_update === 'number' && typeof rated === 'number', a.vocabularies_fsrs_update >= 1 && a.vocabularies_fsrs_update <= rated, { fsrs_updates: a.vocabularies_fsrs_update, rated })
  }
  const before = proof.db_binding ? proof.db_binding.subscriber_count_before : null
  const after = rc.shared ? rc.shared.subscriber_count_after : undefined
  c('shared_word_sets_subscriber_count_delta', typeof before === 'number' && typeof after === 'number', after - before >= 0 && after - before <= MAX_SHARED.shared_word_sets_subscriber_count_delta, { delta: typeof before === 'number' && typeof after === 'number' ? after - before : null })
  const allOk = checks.every((x) => x.ok)
  const acceptance = proof.wordset_acceptance
  return {
    mode: 'evaluate', db_access: false, writes: 0, row_counts_source: rc.measured_by ?? null, row_counts_captured_at: rc.captured_at ?? null,
    checks, failed: checks.filter((x) => !x.ok).map((x) => x.id),
    status: !allOk ? 'FAIL' : acceptance === 'ACCEPTANCE_ELIGIBLE' ? 'PASS' : 'PASS_NON_ACCEPTANCE_PRE_FIX',
    pass: allOk && acceptance === 'ACCEPTANCE_ELIGIBLE',
    row_counts_shape: { measured_by: '…', captured_at: '…', A: Object.fromEntries(Object.keys(MAX_ROWS_PER_ACCOUNT).map((k) => [k, 0])), B: '같은 키', shared: { subscriber_count_after: 0 } },
  }
}

;(async () => {
  const args = parseArgs(process.argv.slice(2))
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const res = args.evaluate ? evaluate(args) : args.write ? await writeMode(args) : preflight(args)
  const name = args.evaluate ? 'r0-live-journey-evaluate.json' : args.write ? 'r0-live-journey-write-proof.json' : 'r0-live-journey-preflight.json'
  fs.writeFileSync(path.join(OUT_DIR, name), JSON.stringify(res, null, 2) + '\n')
  console.log(JSON.stringify(res, null, 2))
  if (args.evaluate && !res.pass) process.exitCode = 1
})().catch((e) => {
  console.error('r0-live-journey failed: ' + (/^[A-Za-z]+$/.test(e.message) ? e.message : 'error suppressed'))
  process.exitCode = 1
})
