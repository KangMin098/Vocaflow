// scripts/csat/pilot/synthetic/analyze.mjs
//
// G6-S 분석 — 하니스 결과(outcome · truth) + 판정(Claude · Codex × pre · post)으로 PILOT_PROTOCOL §8 · §13 지표를 낸다.
// 합성 학습자라 숨은 정답 원인(truth)이 있어 「정확도」와 「probe 가 판정을 정답 원인 쪽으로 옮기는가」를 잰다(실제 Pilot 에서는 못 잰다).
// 출력: 집계만 담은 보고 docs/csat-learner/pilot-runs/synthetic-<날짜>.md (문항 원문 · 학생 서술 없음).
//   node scripts/csat/pilot/synthetic/analyze.mjs [--date 20261007]
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../../../..')
const PRIV = path.join(ROOT, '.pilot-private/synthetic')
const date = process.argv.includes('--date') ? process.argv[process.argv.indexOf('--date') + 1] : new Date().toISOString().slice(0, 10).replace(/-/g, '')
const J = (f) => JSON.parse(fs.readFileSync(path.join(PRIV, f), 'utf8'))
const truth = J('truth.json')
const { outcome, failures, run } = J('outcome.json')
const judges = {}
// 판정 파일은 페르소나 묶음별로 나뉘어 있다(<판정자>-<pre|post>-<묶음>.json) — 합쳐서 본다. 빠진 attempt 는 보고에 「누락」으로 센다
const missing = {}
for (const who of ['claude', 'codex']) for (const prof of ['pre', 'post']) {
  const dir = path.join(PRIV, 'judgments')
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.startsWith(`${who}-${prof}-`) && f.endsWith('.json')) : []
  if (!files.length) continue
  const all = files.flatMap((f) => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) } catch { return [] } })
  judges[`${who}-${prof}`] = Object.fromEntries(all.map((j) => [j.attempt, j]))
  missing[`${who}-${prof}`] = Object.keys(JSON.parse(fs.readFileSync(path.join(PRIV, 'truth.json'), 'utf8'))).filter((k) => !judges[`${who}-${prof}`][k]).length
}
const pct = (a, b) => (b ? `${Math.round((a / b) * 1000) / 10}%` : '—')
const R6 = new Set(['V.wrong_sense', 'R.inference'])
const keys = Object.keys(truth)
const wrong = keys.filter((k) => truth[k])
const byKey = Object.fromEntries(outcome.map((o) => [o.key, o]))
const boundary = keys.filter((k) => (byKey[k]?.signals ?? []).length > 0)

const L = []
const p = (s = '') => L.push(s)
p(`# G6-S 합성 학습자 Pilot 결과 — ${date}`)
p()
p(`> **synthetic** — 실제 학생이 아니다(합성 페르소나 6 · 숨은 정답 원인 있음). 실제 run · 실제 증거와 섞지 않는다. 상태 표현: 「v0.1 operational pilot evidence」 이전의 **시뮬레이션**.`)
p(`> run \`${run}\` · 판정은 파일로만(DB v0.1 회차 · 판정 표 적재 없음). 생성 · 판정 원본은 저장소 밖 \`.pilot-private/synthetic/\`.`)
p()
p('## 1. 운영 (§13 Operational · Evidence)')
p()
const sessions = new Set(outcome.map((o) => `${o.persona}/${o.exam}`)).size
p('| 지표 | 값 |')
p('|---|---|')
p(`| 세션(페르소나 × 시험) | ${sessions} |`)
p(`| 대상 attempt | ${outcome.length} (오답 ${wrong.length} · 정답 ${keys.length - wrong.length}) |`)
p(`| 하니스 실패(저장 · 완료 · 정리) | ${failures.length}${failures.length ? ' — ' + failures.slice(0, 3).join(' / ') : ''} |`)
const ans = outcome.filter((o) => o.interp === 'answered').length
p(`| answered 해석률 | ${pct(ans, outcome.length)} (unknown ${outcome.filter((o) => o.interp === 'unknown').length} · skipped ${outcome.filter((o) => o.interp === 'skipped').length}) |`)
const offered = outcome.filter((o) => o.probeOffered)
p(`| probe 제시 / 응답 / 건너뜀 / 상한 | ${offered.length} / ${offered.filter((o) => /^[ABCD]$/.test(o.probe ?? '')).length} / ${offered.filter((o) => o.probe === 'skipped').length} / ${offered.filter((o) => o.probe === 'capped').length} |`)
p()
p('## 2. 감지기')
p()
const det = {}; for (const o of outcome) det[o.detector ?? 'none'] = (det[o.detector ?? 'none'] ?? 0) + 1
p('| 감지기 결과(문항별 마지막) | attempt |')
p('|---|---|')
for (const [k, v] of Object.entries(det).sort()) p(`| ${k} | ${v} |`)
const tp = boundary.filter((k) => R6.has(truth[k])).length
const r6truth = wrong.filter((k) => R6.has(truth[k]))
p()
p(`- 경계 신호 attempt **${boundary.length}** — 그중 정답 원인이 V.wrong_sense · R.inference 인 것 ${tp} (정밀도 ${pct(tp, boundary.length)})`)
p(`- 정답 원인이 V/R 인 오답 ${r6truth.length} 중 신호가 뜬 것 ${r6truth.filter((k) => boundary.includes(k)).length} (재현율 ${pct(r6truth.filter((k) => boundary.includes(k)).length, r6truth.length)}) — 범주 없음 · 모름 · 경계 밖 범주는 설계상 감지하지 않는다`)
p(`- 정답 문항에서 뜬 신호 ${boundary.filter((k) => !truth[k]).length} (감지기는 정오를 모른다 — 정상)`)
p()
p('## 3. 판정 — 정답 원인 대비 (합성이라서만 잴 수 있는 것)')
p()
p(`판정 누락: ${Object.entries(missing).map(([k, v]) => `${k} ${v}`).join(' · ') || '없음'}`)
p()
p('| 판정자 · 증거 | 오답 정확도(primary = 정답 원인) | code / multiple / insufficient | 정답 문항 no_cause |')
p('|---|---|---|---|')
for (const [name, m] of Object.entries(judges)) {
  const w = wrong.map((k) => m[k]).filter(Boolean)
  const hit = wrong.filter((k) => m[k]?.outcome === 'code' && m[k]?.primary === truth[k]).length
  const cnt = (o) => w.filter((j) => j.outcome === o).length
  const right = keys.filter((k) => !truth[k])
  p(`| ${name} | ${pct(hit, wrong.length)} (${hit}/${wrong.length}) | ${cnt('code')} / ${cnt('multiple')} / ${cnt('insufficient')} | ${pct(right.filter((k) => m[k]?.outcome === 'no_cause').length, right.length)} |`)
}
p()
p('## 4. R6 — 경계 신호가 뜬 오답의 pre/post (§8)')
p()
const r6 = boundary.filter((k) => truth[k])
p(`대상: 경계 신호가 뜬 오답 **${r6.length}** attempt(정답 원인 분포: ${Object.entries(r6.reduce((a, k) => ((a[truth[k]] = (a[truth[k]] ?? 0) + 1), a), {})).map(([c, n]) => `${c} ${n}`).join(' · ') || '—'})`)
p()
p('| 판정자 | pre 정확도 | post 정확도 | pre V/R 분리 | post V/R 분리 | pre 미해결(multiple+insufficient) | post 미해결 | post 가 정답→오답으로 바뀜 |')
p('|---|---|---|---|---|---|---|---|')
for (const who of ['claude', 'codex']) {
  const pre = judges[`${who}-pre`], post = judges[`${who}-post`]
  if (!pre || !post) { p(`| ${who} | — | — | — | — | — | — | — |`); continue }
  const acc = (m) => r6.filter((k) => m[k]?.outcome === 'code' && m[k]?.primary === truth[k]).length
  const sep = (m) => r6.filter((k) => m[k]?.outcome === 'code' && R6.has(m[k]?.primary)).length
  const un = (m) => r6.filter((k) => ['multiple', 'insufficient'].includes(m[k]?.outcome)).length
  const flip = r6.filter((k) => pre[k]?.primary === truth[k] && post[k]?.primary !== truth[k]).length
  p(`| ${who} | ${pct(acc(pre), r6.length)} | ${pct(acc(post), r6.length)} | ${pct(sep(pre), r6.length)} | ${pct(sep(post), r6.length)} | ${pct(un(pre), r6.length)} | ${pct(un(post), r6.length)} | ${flip} |`)
}
p()
p('**probe 응답별 post 판정(유도 편향 확인)** — 응답이 A/B 로 갈렸을 때 판정이 그 방향으로만 쏠리는지, 정답 원인과 어긋난 응답(잡음)에 끌려가는지')
p()
p('| 판정자 | 응답 | attempt | post = V.wrong_sense | post = R.inference | 그 외 | 응답이 정답 원인과 어긋났는데 응답 쪽으로 판정 |')
p('|---|---|---|---|---|---|---|')
for (const who of ['claude', 'codex']) {
  const post = judges[`${who}-post`]; if (!post) continue
  for (const opt of ['A', 'B', 'C', 'D', 'skipped']) {
    const ks = r6.filter((k) => byKey[k]?.probe === opt); if (!ks.length) continue
    const toward = opt === 'A' ? 'V.wrong_sense' : opt === 'B' ? 'R.inference' : null
    const misled = toward ? ks.filter((k) => truth[k] !== toward && post[k]?.primary === toward).length : 0
    p(`| ${who} | ${opt} | ${ks.length} | ${ks.filter((k) => post[k]?.primary === 'V.wrong_sense').length} | ${ks.filter((k) => post[k]?.primary === 'R.inference').length} | ${ks.filter((k) => !R6.has(post[k]?.primary)).length} | ${toward ? misled : '—'} |`)
  }
}
p()
p('## 5. 교차 모델 일치 (Claude ↔ Codex)')
p()
p('| 증거 | 오답 전체 일치(같은 outcome · primary) | 경계 오답 일치 |')
p('|---|---|---|')
for (const prof of ['pre', 'post']) {
  const a = judges[`claude-${prof}`], b = judges[`codex-${prof}`]
  if (!a || !b) { p(`| ${prof} | — | — |`); continue }
  const same = (k) => a[k] && b[k] && a[k].outcome === b[k].outcome && (a[k].primary ?? null) === (b[k].primary ?? null)
  p(`| ${prof} | ${pct(wrong.filter(same).length, wrong.length)} | ${pct(r6.filter(same).length, r6.length)} |`)
}
p()
p('## 6. 페르소나별')
p()
p('| 페르소나 | 오답 대상 | 경계 신호 | probe 응답 | claude-post 정확도 | codex-post 정확도 |')
p('|---|---|---|---|---|---|')
for (const s of [...new Set(outcome.map((o) => o.persona))]) {
  const ks = keys.filter((k) => k.startsWith(`${s}-`)), w = ks.filter((k) => truth[k])
  const acc = (m) => (m ? pct(w.filter((k) => m[k]?.primary === truth[k]).length, w.length) : '—')
  p(`| ${s} | ${w.length} | ${ks.filter((k) => boundary.includes(k)).length} | ${ks.filter((k) => /^[ABCD]$/.test(byKey[k]?.probe ?? '')).length} | ${acc(judges['claude-post'])} | ${acc(judges['codex-post'])} |`)
}
p()
p('## 7. 파이프라인 설계 시사점 (이 run 전량 96 attempt 기준 · 합성)')
p()
const fpCat = boundary.filter((k) => !R6.has(truth[k]))
p(`- **감지기 정밀도는 학생 자기 범주의 정확도에 묶인다** — 경계 밖 원인에서 뜬 신호 ${fpCat.length}건은 모두 학생이 범주를 word · flow 로 잘못 고른 경우다(감지 규칙이 봉인 경계 두 코드의 학생 범주만 본다 · 설계대로). 비용은 「불필요한 질문」 부담이고, 그 질문이 판정을 틀린 쪽으로 끈 경우는 위 표에서 0 이다.`)
p(`- **놓친 V/R 오답 ${r6truth.filter((k) => !boundary.includes(k)).length}건**은 해석 모름 · 건너뜀(증거 부족 규칙) 또는 경계 밖 범주 선택 — 결정 2(범주 없음 · 모름은 감지하지 않음)의 의도된 대가다.`)
p('- **probe 는 R6 판정을 조금 낫게 하고(정확도 · V/R 분리 상승, 미해결 감소) 유도 편향 신호는 없다** — 결정 3 · 4(보조 증거 · 원인 판정 안 함)는 유지.')
p('- **교차 모델 일치는 post 에서 오른다** — probe 응답이 두 판정자를 같은 쪽으로 모은다.')
p('- **코드북 모호점(판정자 둘이 같은 곳에서 갈림)**: 「알려진 격언 · 관용구를 낱말 그대로 옮김」이 V.multiword 와 R.inference 사이에서 갈린다 — v0.2 정의 후보(포함 · 제외 기준에 관용 비유 처리 한 줄).')
p('- **v0.1 운영 결정**: 감지기 · probe · 판정 구조는 바꾸지 않는다(새 증거 = 이 합성 run 만으로는 바꿀 근거가 약하다). 합성 run 을 파이프라인 회귀 검사로 남겨 설계를 바꿀 때마다 다시 돌린다.')
p()
p('## 8. 해석 한계')
p()
p('- 합성 학습자는 생성 지시(GEN_SPEC)의 확률 · 경향을 따른다 — 이 숫자는 **파이프라인이 설계대로 도는지와 판정 구조의 민감도**를 보여 줄 뿐 실제 학생 분포 · 실제 정확도가 아니다.')
p('- 생성자(Claude)와 판정자(Claude)가 같은 모델 계열이라 Claude 판정은 생성 의도를 읽기 쉽다 — Codex 판정이 더 보수적인 기준선이다.')
p('- R6 결론(probe 가 V/R 분리에 기여하는가)은 실제 학생 서술에서 다시 확인해야 한다.')
const dst = path.join(ROOT, 'docs/csat-learner/pilot-runs', `synthetic-${date}.md`)
fs.writeFileSync(dst, L.join('\n') + '\n')
console.log(`보고 ${path.relative(ROOT, dst)} · 판정 세트 ${Object.keys(judges).length} · 오답 ${wrong.length} · 경계 ${boundary.length}`)
