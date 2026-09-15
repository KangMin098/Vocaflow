// scripts/csat/render-blueprints.mjs
//
// **레지스트리에서 설계도 문서를 찍어 낸다.**
//
// 문서를 손으로 쓰면 코드와 어긋난다(이 저장소가 여러 번 겪었다). 그래서 `docs/CSAT_TYPE_BLUEPRINTS.md`
// 는 **손으로 고치지 않는다** — `data/blueprint-registry.json` 을 고치고 이 자를 다시 돌린다.
// 수치는 전부 계측 산출물에서 읽어 온다:
//   type-inventory.json · type-bands-all.json · type-constraints.json ·
//   blueprint-items.json · blueprint-items-score.json · blueprint-coverage.json · exam-assembly.json
//
// 실행: node scripts/csat/render-blueprints.mjs

import fs from 'node:fs'
import path from 'node:path'

const DIR = path.resolve('scripts/csat/data')
const rd = (f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))

const inv = rd('type-inventory.json')
const bandsAll = rd('type-bands-all.json')
const cons = rd('type-constraints.json')
const reg = rd('blueprint-registry.json')
const items = rd('blueprint-items.json')
const score = rd('blueprint-items-score.json')
const cov = rd('blueprint-coverage.json')
const asm = rd('exam-assembly.json')

const cur = inv.rows.filter((r) => r.current)
const B = bandsAll.bands
const f2 = (x) => (typeof x === 'number' ? (Number.isInteger(x) ? String(x) : x.toFixed(2)) : '—')
const sec = { 듣기: '듣기', 독해: '독해', 장문: '장문' }

const L = []
const w = (s = '') => L.push(s)

w('# 수능 영어 출제 설계도 — 유형별 출제자의 사고')
w()
w('> **이 문서는 손으로 고치지 않는다.** `scripts/csat/data/blueprint-registry.json` 을 고치고')
w('> `node scripts/csat/render-blueprints.mjs` 를 다시 돌린다. 아래 수치는 전부 계측 산출물에서 읽어 온 것이다.')
w('>')
w(`> 분모 **${cov.denominator} 유형** — 2023~2026 4개년 중 1회 이상 출제된 유형(상시 ${inv.always} + 3번 자리 교대 2).`)
w(`> 대조 기준 **수능 14개년 630문항**(2014B·2014A·2015~2026). 듣기 대역만 **대본 7개년**(2017~2023)이다.`)
w()
w('## 0. ⚠️ 이 설계도가 말하는 것과 말하지 않는 것')
w()
w('| | |')
w('|---|---|')
w('| **말한다** | 기출과 **같은 양식**으로 쓸 수 있다 — 계측 5축이 유형별 기출 10~90 분위 안에 들고, 형식·가족 제약을 어기지 않는다 |')
w('| **말하지 않는다** | **정답성**. 이 저장소의 어휘 유사도는 정답을 모른다 — 기출 88문항에서 지문과 가장 닮은 선지를 고르면 적중 **27.3%**, 기저 20%, Wilson 95% 구간이 기저를 포함한다 |')
w()
w('두 축을 곱해 "몇 % 부합" 이라고 적으면 거짓말이 된다. 이 문서가 셋을 갈라 적는 이유다.')
w()
w('## 1. 달성 현황')
w()
w(`| 요건 | 무엇을 확인하나 | 충족 |`)
w('|---|---|---|')
const REQD = {
  R1: '능력 정의 · 출제 명제 · 출제자 사고 ≥3단계 · 오답 생성 원리 ≥3종',
  R2: '14개년 검정 통과 제약 ≥2개, 그중 HARD ≥1',
  R3: '계측 대역 (n≥7)',
  R4: '생성 절차 ≥4단계, 각 단계에 실패 시 처리',
  R5: '그 절차로 만든 문항이 계측 5축 전부 대역 안 + 제약 위반 0',
}
for (const k of cov.requirements) w(`| **${k}** | ${REQD[k]} | ${cov.perReq[k]}/${cov.denominator} |`)
w(`| | **합계** | **${cov.done}/${cov.cells} = ${cov.pct}%** |`)
w()
w(`유형 완성 **${cov.fullTypes}/${cov.denominator}**. 채점 코드 `
  + '`scripts/csat/test-blueprint-coverage.mjs` · 문항 채점 `scripts/csat/verify-blueprint-items.mjs`')
w()
w('### 1.1 회차 조립 검사')
w()
w('문항 하나씩 옳아도 회차로 모으면 틀릴 수 있다. `scripts/csat/test-exam-assembly.mjs` 가 그것을 본다.')
w()
w(`| 관문 | 결과 |`)
w('|---|---|')
w(`| A1 정답 번호 균형 (허용 ${asm.allow.lo}~${asm.allow.hi}) | ①~⑤ = ${asm.dist.join(' / ')} · ${asm.a1.every((x) => x.ok) ? 'PASS' : 'FAIL'} |`)
w(`| A2 유형별 금지 자리 (14개년 0회) | ${asm.a2.length ? `FAIL ${asm.a2.length}건` : 'PASS'} |`)
w(`| A3 3점 비율 | ${asm.high}문항 (기대 ${asm.wantHigh}) · ${asm.a3 ? 'PASS' : 'FAIL'} |`)
w(`| A4 한글 선지 3점 | ${asm.a4.length ? 'FAIL' : 'PASS'} |`)
w()
w('## 2. 가족 제약 — 유형을 가로질러 걸린다')
w()
w('유형 하나의 표본은 13~15문항이라 Holm 보정을 못 견딘다. **같은 설계 원리를 공유하는 유형을 묶으면 살아난다.**')
w('묶음은 자료를 보기 전에 선언한다.')
w()
w('| # | 묶음 | 관측 | 보정 p | 판정 | 주장 |')
w('|---|---|---|---|---|---|')
for (const g of cons.families) {
  w(`| **${g.id}** | ${g.name} (${g.members.length}유형) | ${g.hit}/${g.n} · 기저 ${g.base} | ${g.holm.toExponential(1)} | **${g.kind}** | ${g.claim} |`)
}
w()
for (const g of cons.families) w(`- **${g.id} 왜** — ${g.why}`)
w()
w('## 3. 유형별 설계도')
w()

const byS = { 듣기: [], 독해: [], 장문: [] }
for (const r of cur) byS[sec[r.sec] ?? '독해'].push(r)

for (const [s, list] of Object.entries(byS)) {
  if (!list.length) continue
  w(`### ${s}`)
  w()
  for (const r of list) {
    const e = reg.types[r.type] ?? {}
    const b = B[r.type] ?? {}
    const c = cons.types[r.type] ?? {}
    const it = items.types[r.type] ?? {}
    const sc = score.rows.find((x) => x.type === r.type) ?? {}
    w(`#### ${r.type} · ${e.name ?? r.name} (${r.nos.join('·')}번 · 14개년 ${r.n14}문항 · 3점 ${r.highScore})`)
    w()
    w(`**평가원이 재려는 능력** — ${e.ability ?? '—'}`)
    w()
    w(`**출제 명제** — ${e.proposition ?? '—'}`)
    w()
    w('**출제자의 사고**')
    w()
    ;(e.thought ?? []).forEach((t, i) => w(`${i + 1}. ${t}`))
    w()
    w('**오답 생성 원리**')
    w()
    w('| 원리 | 어떻게 만드나 |')
    w('|---|---|')
    for (const d of e.distractors ?? []) w(`| ${d.name} | ${d.how} |`)
    w()
    w('**제약**')
    w()
    w('| 층 | id | 판정 | 내용 |')
    w('|---|---|---|---|')
    for (const x of (c.format ?? []).filter((x) => x.kind === 'HARD')) w(`| 형식 | ${x.id} | HARD | ${x.claim} |`)
    for (const x of (c.family ?? []).filter((x) => x.kind !== 'REJECT')) w(`| 가족 | ${x.id} | ${x.kind} | ${x.claim} |`)
    for (const x of (c.content ?? []).filter((x) => x.kind !== 'REJECT')) w(`| 내용 | ${x.id} | ${x.kind} | ${x.claim} (Holm ${x.holm.toFixed(4)}) |`)
    for (const x of e.constraints ?? []) w(`| 등록 | ${x.id} | ${x.kind} | ${x.claim} — ${x.stat} |`)
    w()
    if (b.ok) {
      w(`**계측 대역** (${b.source} · ${b.years?.length ?? 0}개년 · n=${b.n}${b.proxy ? ` · ⚠️ **대리 대역 ← ${b.proxy}** (자기 표본 ${b.ownN}편) — ${b.proxyWhy}` : ''})`)
      w()
      w('| 글자수 | 낱말수 | 문장당 낱말 | 낱말 길이 | 어휘 다양도 |' + (b.nTurns ? ' 발화 수 | 화자 수 |' : ''))
      w('|---|---|---|---|---|' + (b.nTurns ? '---|---|' : ''))
      w(`| ${f2(b.chars.lo)}~${f2(b.chars.hi)} | ${f2(b.words.lo)}~${f2(b.words.hi)} | ${f2(b.sentLen.lo)}~${f2(b.sentLen.hi)} | ${f2(b.wordLen.lo)}~${f2(b.wordLen.hi)} | ${f2(b.ttr.lo)}~${f2(b.ttr.hi)} |`
        + (b.nTurns ? ` ${f2(b.nTurns.lo)}~${f2(b.nTurns.hi)} | ${f2(b.speakers.mid)} |` : ''))
      w()
    }
    w('**생성 절차**')
    w()
    w('| # | 단계 | 실패 시 |')
    w('|---|---|---|')
    ;(e.procedure ?? []).forEach((p, i) => w(`| ${i + 1} | ${p.step} | ${p.check} |`))
    w()
    if (sc.has) {
      w(`**검증** — 이 절차로 만든 ${it.no}번 문항(${it.points}점 · 정답 ${it.answer} · ${sc.words}낱말): `
        + `계측 **${sc.inBand}/${sc.axisN}축 대역 안** · 제약 위반 ${sc.viol.length}건`)
      w()
    }
  }
}

w('---')
w()
w('*생성: `scripts/csat/render-blueprints.mjs`. 관련 — '
  + '[CSAT_TYPE_DESIGN.md](./CSAT_TYPE_DESIGN.md) 유형군 사고 · '
  + '[CSAT_DESIGN_SPEC.md](./CSAT_DESIGN_SPEC.md) 형식 기준 · '
  + '[CSAT_BLUEPRINT_V1.md](./CSAT_BLUEPRINT_V1.md) 가설 검증 · '
  + '[CSAT_DESIGNER_MODEL.md](./CSAT_DESIGNER_MODEL.md) 사이클 기록*')

const OUT = path.resolve('docs/CSAT_TYPE_BLUEPRINTS.md')
fs.writeFileSync(OUT, L.join('\n') + '\n')
console.log(`${cov.denominator} 유형 · ${L.length} 줄 → ${OUT}`)
