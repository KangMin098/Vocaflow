// Gate 0 산출물 작성: screens.json + screens.md. 사용: node gate0-write.mjs <SP> <auditDir> [capture-results.json]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
const [, , SP, AUDIT, CAP] = process.argv
mkdirSync(AUDIT, { recursive: true })
const raw = JSON.parse(readFileSync(join(SP, 'screens.raw.json'), 'utf8'))
const graph = JSON.parse(readFileSync(join(SP, 'graph.json'), 'utf8'))
const diff = JSON.parse(readFileSync(join(SP, 'routes-diff.json'), 'utf8'))
const cap = CAP && existsSync(CAP) ? JSON.parse(readFileSync(CAP, 'utf8')) : {}

const AREA = (r, surface) => {
  if (surface === 'admin') return 'admin'
  if (surface === 'public') return 'public'
  if (/^\/csat/.test(r)) return 'csat'
  if (/^\/(library|comics|my|video)/.test(r)) return 'library'
  if (/^\/text/.test(r)) return 'reading'
  if (/^\/(flashcard|pairflip|spellforge|scriptquiz|dictate|wordblitz|wordvault)/.test(r)) return 'modules'
  return 'home'
}
const ORDER = ['public', 'learner', 'session', 'admin', 'redirect', 'game', 'dev']
const sorted = [...raw].sort((a, b) => ORDER.indexOf(a.surface) - ORDER.indexOf(b.surface) || a.route.localeCompare(b.route))
const screens = sorted.map((s, i) => {
  const c = cap[s.route]
  const inScope = ['public', 'learner', 'session', 'admin'].includes(s.surface)
  return {
    id: 'S' + String(i + 1).padStart(3, '0'),
    route: s.route, file: s.file, surface: s.surface, area: inScope ? AREA(s.route, s.surface) : null,
    layer: s.layer, inScope,
    excludedBecause: inScope ? null : { redirect: 'redirect 전용 — 보여 주는 것이 없다', game: '아케이드 — 게임의 리듬은 학습 화면과 다른 축(DESIGN_SYSTEM §3.2)', dev: '개발 도구 — 학습자·관리자가 보지 않는다' }[s.surface],
    loginRequired: c?.loginRequired ?? (c?.fail ? null : 'pending'),
    sampleUrl: c?.sampleUrl ?? (s.dynamic.length ? 'pending' : s.route),
    dynamic: s.dynamic, form: s.form, inFormBaseline: s.inBaseline, stateFiles: s.states,
    ownFiles: graph[s.route]?.ownFiles ?? null,
  }
})
writeFileSync(join(AUDIT, 'screens.json'), JSON.stringify({
  generated: '2026-09-18 · Claude Code · node scratchpad/ux/inventory.mjs + screen-graph.mjs (메인 워크트리 apps/web/src/app/**/page.tsx 읽기 전용)',
  countingRules: 'A2 — 라우트 그룹 (…) 제거 · 동적 라우트 1개 · parallel/intercepting 0개(해당 없음) · loading/error/not-found 는 상태로 기록',
  total: screens.length,
  routesDocDiff: diff,
  screens,
}, null, 1) + '\n')

const count = (f) => screens.filter(f).length
const L = []
L.push('# 화면 전수 목록 (Gate 0)', '')
L.push('> 생성 2026-09-18 · Claude Code · 근거 `apps/web/src/app/**/page.tsx` 전수(api 제외, 메인 워크트리 읽기 전용) — 스크립트는 [PROGRESS.md](PROGRESS.md) 「재현」.', '')
L.push(`**${screens.length}화면** = 공개 ${count((s) => s.surface === 'public')} · 학습자 ${count((s) => s.surface === 'learner')} · 세션 ${count((s) => s.surface === 'session')} · 관리자 ${count((s) => s.surface === 'admin')} · redirect ${count((s) => s.surface === 'redirect')} · 게임 ${count((s) => s.surface === 'game')} · 개발 ${count((s) => s.surface === 'dev')}.`, '')
L.push(`이후 게이트 대상 **${count((s) => s.inScope)}** (카드 ${count((s) => s.inScope && s.surface !== 'admin')} + 관리자 압축 표 ${count((s) => s.surface === 'admin')}). 제외 ${count((s) => !s.inScope)} — redirect ${count((s) => s.surface === 'redirect')}(보여 주는 것 없음) · 게임 ${count((s) => s.surface === 'game')}(아케이드 예외) · 개발 ${count((s) => s.surface === 'dev')}(개발 도구).`, '')
L.push('셈법(A2): 라우트 그룹 `(…)` 은 경로에서 제거 · 동적 라우트는 1개 · parallel/intercepting route 는 **0개**(저장소에 없음) · `loading/error/not-found` 는 화면이 아니라 상태.', '')
L.push('`@form` = 골격 선언(form-declaration-ratchet). 선언이 있는 화면은 5개뿐이다.', '')
L.push('## ROUTES.md 와 코드의 차이', '')
L.push(`- 코드에만 있음 ${diff.notInDoc.length}: ${diff.notInDoc.map((r) => '`' + r + '`').join(' · ')}`)
L.push(`- 문서에만 있음 ${diff.notInCode.length}: ${diff.notInCode.map((r) => '`' + r + '`').join(' · ')} — \`/sitemap.xml\` 은 page 가 아닌 route 파일. 나머지는 지워졌다고 적은 문장인지 ROUTES.md 에서 확인 필요(이 감사는 문서를 고치지 않는다)`, '')
for (const area of ['public', 'home', 'reading', 'modules', 'library', 'csat', 'admin']) {
  const rows = screens.filter((s) => s.area === area)
  L.push(`## ${{ public: '공개', home: '허브·대시보드·계획·설정', reading: '읽기(텍스트)', modules: '학습 모듈', library: '라이브러리·만화·영상', csat: 'CSAT', admin: '관리자' }[area]} — ${rows.length}`, '')
  L.push('| ID | route | 표면 | 계층 | 로그인 | 샘플 | @form | 상태 파일 | 자기 트리 파일 |', '|---|---|---|---|---|---|---|---|---|')
  for (const s of rows) L.push(`| ${s.id} | \`${s.route}\` | ${s.surface} | ${s.layer ?? '—'} | ${s.loginRequired === true ? '필요' : s.loginRequired === false ? '불필요' : s.loginRequired === null ? 'FAIL' : '측정 중'} | ${s.dynamic.length ? (s.sampleUrl && s.sampleUrl !== 'pending' ? '`' + s.sampleUrl.slice(0, 48) + '`' : s.sampleUrl) : '—'} | ${s.form ? s.form.axis : '—'} | ${s.stateFiles.join('/') || '—'} | ${s.ownFiles ?? '—'} |`)
  L.push('')
}
L.push('## 제외', '', '| ID | route | 이유 |', '|---|---|---|')
for (const s of screens.filter((x) => !x.inScope)) L.push(`| ${s.id} | \`${s.route}\` | ${s.excludedBecause} |`)
writeFileSync(join(AUDIT, 'screens.md'), L.join('\n') + '\n')
console.log('screens', screens.length, 'inScope', count((s) => s.inScope))
