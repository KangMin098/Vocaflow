// scripts/docs/gen-db-stats.mjs
//
// **CLAUDE.md 의 DB 통계 블록을 DB 에서 다시 만든다.** (PLATFORM_AUDIT.md 상시 결함 F7 해소)
//
// 왜 스크립트인가 — 손으로 적은 수치는 성실함으로 못 막는다. 실제로 이렇게 벌어졌다:
//   2026-08-16 진단에서 `library_books 20`(실제 401) · `vocabularies 5,896`(실제 2,205),
//   2026-08-29 진단에서 다시 `shared_dictionary 45,292`(실제 48,962) ·
//   `library_chapter_quiz 1,292`(실제 1,019).
//   한 번은 그 낡은 목록을 믿고 멀쩡한 `/hub` 블록을 "완료 관측 불가" 로 빼는 코드까지 들어갔다.
//   CLAUDE.md 는 **항상 첨부되는** 문서라, 틀린 수치가 곧바로 잘못된 판단이 된다.
//
// 규칙은 공개 화면에 이미 쓰고 있는 것과 같다
// (`marketing/__tests__/no-hardcoded-stats`): **숫자는 기계가 써넣거나, 아예 없거나 둘 중 하나다.**
//
// 그래서 세지 않기로 한 것도 있다 — 테이블·뷰·함수·migration 개수와 DB 용량이다.
//   PostgREST 로는 `information_schema`·`pg_class` 를 읽을 수 없어 전용 RPC(=마이그레이션)가
//   필요한데, 그 수치들은 **아무 결정도 바꾸지 않는다**(스키마 규모를 보고 하는 일이 없다).
//   유지 장치를 붙일 값이 아니라 지울 값이었다. 용량·최대 테이블처럼 실제로 의미가 있는 것은
//   분기 진단이 날짜와 함께 기록한다(docs/PLATFORM_AUDIT.md §6-2).
//
// 실행:
//   node scripts/docs/gen-db-stats.mjs            # CLAUDE.md 블록 갱신
//   node scripts/docs/gen-db-stats.mjs --check    # 낡았으면 exit 1 (CI·훅용, 파일 안 고침)
//   node scripts/docs/gen-db-stats.mjs --print    # stdout 에만 출력
//
// 재실행 안전: 같은 DB 상태면 같은 결과다. 마커 밖은 건드리지 않는다.

import fs from 'node:fs'
import path from 'node:path'

const DOC = path.resolve('CLAUDE.md')
const START = '<!-- db-stats:start -->'
const END = '<!-- db-stats:end -->'

const MODE = process.argv.includes('--check')
  ? 'check'
  : process.argv.includes('--print')
    ? 'print'
    : 'write'

// --- 접속 (저장소 관례: apps/web/.env.local 을 직접 읽는다) ---
const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').replace(/\r/g, '')
  }
}
const URL_ = process.env['NEXT_PUBLIC_SUPABASE_URL']
const KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']
if (!URL_ || !KEY) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 없다 (apps/web/.env.local).')
  process.exit(2)
}
const { createClient } = await import('@supabase/supabase-js')
const db = createClient(URL_, KEY, { auth: { persistSession: false } })

const fmt = (n) => (n === null ? '?' : n.toLocaleString('en-US'))

/** 정확 카운트 1건. 추정치(n_live_tup)를 쓰지 않는 이유는 파일 머리 주석 참조. */
async function count(table, apply) {
  let q = db.from(table).select('*', { count: 'exact', head: true })
  if (apply) q = apply(q)
  const { count: n, error } = await q
  if (error) throw new Error(`${table}: ${error.message}`)
  // head 요청은 없는 테이블에도 count=null 을 돌려준다 — 0 으로 뭉개면 구멍이 안 보인다.
  return n === null ? null : n
}

/**
 * status 별 집계.
 *
 * ⚠️ 한 번에 통째로 받으면 안 된다 — PostgREST 는 응답을 **1,000행에서 말없이 자른다**.
 *    2026-08-31 에 이 함수가 `library_articles` 를 `queued 838 · published 160 · analyzing 2`
 *    (= 정확히 1,000) 로 적어 두고 있었다. 실제 queued 는 5,315 였다. 오류가 아니라 잘림이라
 *    아무 신호도 없었고, CLAUDE.md 는 항상 첨부되는 문서라 그 틀린 수치가 곧 판단 근거가 된다.
 *    같은 줄의 총계(`count()` = head 요청)는 맞았기 때문에 눈으로도 안 걸렸다.
 *
 * 그래서 세 겹으로 막는다: (1) range 로 끝까지 넘기고 (2) **정렬을 고정하며**
 * (3) 합이 정확 카운트와 다르면 **던진다**.
 * (2)를 빼면 페이지 사이 순서가 보장되지 않아 행이 중복·누락된다 — 정렬 없는 range 는
 * 페이지네이션이 아니라 표본 추출이다. (3)이 마지막 그물이다: 나중에 또 어긋나도
 * 조용히 틀린 문서가 나오는 대신 갱신 자체가 멈춘다.
 */
async function byStatus(table, column = 'status', orderBy = 'id') {
  const PAGE = 1000
  const out = new Map()
  let seen = 0
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from(table)
      .select(column)
      .order(orderBy, { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`${table}.${column}: ${error.message}`)
    for (const row of data) {
      const k = row[column] ?? '(null)'
      out.set(k, (out.get(k) ?? 0) + 1)
    }
    seen += data.length
    if (data.length < PAGE) break
  }
  const total = await count(table)
  if (total !== null && seen !== total) {
    throw new Error(`${table}.${column}: ${seen}행만 셌는데 총계는 ${total}행이다 (잘림 의심 — 문서를 갱신하지 않는다).`)
  }
  return out
}

/** status 맵을 "published 13 · ready 303" 꼴로. 많은 것부터. */
const statusLine = (m) =>
  [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${fmt(v)}`).join(' · ')

async function collect() {
  const [
    dictTotal, dictKo,
    books, bookStatus,
    articles, articleStatus,
    sets, setsPub,
    quiz, texts, vocabularies,
    comicIssues, comicSeries, comicBooksPub,
    records, sessions, daily, scores,
    classes, classMembers, assignments, funnel, profiles,
  ] = await Promise.all([
    count('shared_dictionary'),
    count('shared_dictionary', (q) => q.not('meaning_ko', 'is', null).neq('meaning_ko', '')),
    count('library_books'),
    byStatus('library_books'),
    count('library_articles'),
    byStatus('library_articles'),
    count('shared_word_sets'),
    count('shared_word_sets', (q) => q.eq('is_published', true)),
    count('library_chapter_quiz'),
    count('texts'),
    count('vocabularies'),
    count('pd_comic_issues'),
    count('pd_comic_series'),
    count('comic_books', (q) => q.eq('status', 'published')),
    count('learning_records'),
    count('reading_sessions'),
    count('daily_activity'),
    count('scores'),
    count('classes'),
    count('class_members'),
    count('class_assignments'),
    count('funnel_events'),
    count('user_profiles'),
  ])

  // auth.users 는 PostgREST 로 안 보인다 — service_role 의 admin API 로 센다.
  let users = null
  let usersCapped = false
  try {
    const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (!error && data?.users) {
      users = data.users.length
      usersCapped = data.users.length === 1000
    }
  } catch {
    users = null
  }

  const koPct = dictTotal ? Math.round((dictKo / dictTotal) * 1000) / 10 : null

  return {
    dictTotal, koPct,
    books, bookStatus, articles, articleStatus,
    sets, setsPub, quiz, texts, vocabularies,
    comicIssues, comicSeries, comicBooksPub,
    users, usersCapped, profiles,
    records, sessions, daily, scores,
    classes, classMembers, assignments, funnel,
  }
}

function render(s) {
  // UTC 로 찍으면 한국 시간 자정~오전 9시에 하루 전 날짜가 박힌다 —
  // "언제 잰 값인가" 가 이 블록의 유일한 신뢰 근거라 로컬 날짜로 쓴다. sv-SE 가 YYYY-MM-DD.
  const today = new Date().toLocaleDateString('sv-SE')
  const usersStr = s.users === null ? '?' : `${fmt(s.users)}${s.usersCapped ? '+' : ''}`
  const L = []
  L.push(START)
  L.push('')
  L.push(`> 이 블록은 \`node scripts/docs/gen-db-stats.mjs\` 가 DB 에서 생성한다 — **손으로 고치지 말 것.**`)
  L.push(`> 고쳐도 다음 실행에 덮어써지고, 그 사이에는 틀린 값이 근거로 쓰인다.`)
  L.push(`> 마지막 생성 **${today}**. 낡았는지 확인만 하려면 \`--check\` (파일을 안 고치고 exit 1).`)
  L.push('')
  L.push('**수요 측** — 이 줄이 이 문서에서 가장 중요하다. 공급이 아무리 늘어도 여기가 안 늘면 진단은 `risk` 다.')
  L.push('')
  L.push(`- 가입자 **${usersStr}** (프로필 ${fmt(s.profiles)}) · 학습기록 **${fmt(s.records)}** · 읽기 세션 ${fmt(s.sessions)} · 일별 활동 ${fmt(s.daily)} · 점수 ${fmt(s.scores)}`)
  L.push(`- 교사 채널: 학급 **${fmt(s.classes)}** · 학급 구성원 ${fmt(s.classMembers)} · 학급 과제 **${fmt(s.assignments)}** · 퍼널 이벤트 ${fmt(s.funnel)}`)
  L.push('')
  L.push('**공급 측**')
  L.push('')
  L.push(`- \`shared_dictionary\` **${fmt(s.dictTotal)}** row · meaning_ko ${s.koPct}%`)
  L.push(`- \`library_books\` **${fmt(s.books)}** — ${statusLine(s.bookStatus)}`)
  L.push(`- \`library_articles\` **${fmt(s.articles)}** — ${statusLine(s.articleStatus)}`)
  L.push(`- \`shared_word_sets\` ${fmt(s.sets)} (published ${fmt(s.setsPub)}) · \`library_chapter_quiz\` ${fmt(s.quiz)}`)
  L.push(`- \`texts\` ${fmt(s.texts)} · \`vocabularies\` ${fmt(s.vocabularies)}`)
  L.push(`- 만화: \`pd_comic_issues\` ${fmt(s.comicIssues)} · 시리즈 ${fmt(s.comicSeries)} · 발행 \`comic_books\` ${fmt(s.comicBooksPub)}`)
  L.push('')
  L.push('> **여기 없는 수치는 일부러 안 센다** — 테이블·함수·migration 개수와 DB 용량은 전용 RPC 가 있어야')
  L.push('> 읽히는데, 그 값들로 바뀌는 결정이 없다. 용량처럼 실제로 의미 있는 것은 분기 진단이 날짜와 함께')
  L.push('> 기록한다([PLATFORM_AUDIT.md](./docs/PLATFORM_AUDIT.md) §6-2). 스키마 자체는 [DB_SCHEMA.md](./docs/DB_SCHEMA.md).')
  L.push('')
  L.push(END)
  return L.join('\n')
}

// --- 적용 ---
const stats = await collect()
const block = render(stats)

if (MODE === 'print') {
  console.log(block)
  process.exit(0)
}

const raw = fs.readFileSync(DOC, 'utf8')
const eol = raw.includes('\r\n') ? '\r\n' : '\n'
const i = raw.indexOf(START)
const j = raw.indexOf(END)
if (i === -1 || j === -1 || j < i) {
  console.error(`CLAUDE.md 에 마커가 없다 — ${START} … ${END} 를 먼저 넣을 것.`)
  process.exit(2)
}

const before = raw.slice(0, i)
const after = raw.slice(j + END.length)
const next = before + block.split('\n').join(eol) + after

if (next === raw) {
  console.log('CLAUDE.md DB 통계 — 변경 없음 (최신).')
  process.exit(0)
}

if (MODE === 'check') {
  console.error('CLAUDE.md DB 통계가 낡았다. `node scripts/docs/gen-db-stats.mjs` 로 갱신할 것.')
  process.exit(1)
}

fs.writeFileSync(DOC, next)
console.log(`CLAUDE.md DB 통계 갱신 — 가입 ${stats.users} · 학습기록 ${stats.records} · 발행 도서 ${stats.bookStatus.get('published') ?? 0}/${stats.books}`)
