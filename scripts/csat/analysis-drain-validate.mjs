// scripts/csat/analysis-drain-validate.mjs
//
// **분석 드레인 검수 게이트 — import 앞에 선다.**
//
// 3인 검수는 사람(=Claude Code)이 하는 판단이고, 판단은 스스로를 봐주기 쉽다.
// 그래서 **기계로 확인할 수 있는 것은 기계가 확인한다.** 특히 이것:
//
//   **V4 인용 대조** — `answer_locus.quote` 가 지문에 **문자 그대로** 있는지 본다.
//   분석에서 가장 위험한 실패는 근거를 지어내는 것이다. 지어낸 근거는 그럴듯하고,
//   사람 검수는 그럴듯한 것을 통과시킨다. 문자열 대조는 안 봐준다.
//
// 실행: node scripts/csat/analysis-drain-validate.mjs [--chunk 1]
// 실패하면 exit 1.

import fs from 'node:fs'
import path from 'node:path'

const arg = (n, d = null) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : d
}

const DIR = path.resolve('scripts/csat/data')
const WORK = path.resolve('scripts/csat/analysis-drain')
const corpus = JSON.parse(fs.readFileSync(path.join(DIR, 'corpus.json'), 'utf8'))
const itemOf = new Map(corpus.items.map((it) => [it.id, it]))

const PERSONAS = ['setter', 'analyst', 'tutor']
// 순환논법·빈말. 이 표현이 절차에 들어가면 학습자는 무엇을 할지 모른다.
const BANNED = [
  '흐름을 파악하면',
  '내용을 이해하면',
  '정확히 해석한다',
  '꼼꼼히 읽는다',
  '전체를 읽고',
  '주제를 파악하면',
  '문맥을 파악한다',
  '어휘력이 필요',
]

/** 지문 대조용 정규화 — 따옴표·대시·공백만 통일한다. 낱말은 건드리지 않는다. */
function norm(s) {
  return String(s)
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/**
 * 회차 원문에서 **이 문항 언저리만** 잘라 낸 창 — 인용 대조의 안정된 건초더미.
 *
 * ⚠️ 처음에는 회차 파일 **전체**를 건초더미로 썼다. 파서 표류에는 강했지만 구멍이 났다 —
 *    **같은 회차의 다른 문항 본문에서 인용해도 통과한다.** 그런데 실제로 겪는 사고가 바로
 *    그것이다(단 나누기가 실패해 옆 문항 지문이 이 문항에 들어오는 것). 서브에이전트가
 *    "지금 게이트는 이 사고를 못 잡는다" 고 지적했고, 맞는 지적이다.
 *
 * 그래서 창으로 좁힌다 — 문항 번호가 나온 줄 앞뒤 60줄. 파서를 고쳐도 이 창은 그대로이므로
 * 표류에는 여전히 강하고, 옆 문항 본문은 대개 이 창 밖이라 구멍이 줄어든다.
 * (한 페이지가 안 갈린 회차에서는 옆 단이 창 안에 들어오지만, 그 문항은 이미 `body_suspect` 다.)
 */
const COL = path.resolve('scripts/csat/data/columns2')
const linesCache = new Map()
const windowCache = new Map()
function examWindow(exam, no) {
  const key = `${exam}#${no}`
  if (windowCache.has(key)) return windowCache.get(key)
  if (!linesCache.has(exam)) {
    const p = path.join(COL, `${exam}.txt`)
    linesCache.set(exam, fs.existsSync(p) ? fs.readFileSync(p, 'utf8').replace(/\r/g, '').split('\n') : [])
  }
  const ls = linesCache.get(exam)
  // 장문 세트(41~45)는 지문이 **세트 머리글 아래 한 번만** 있고 문항 번호는 그 한참 뒤에 온다.
  // 문항 번호에 창을 걸면 지문이 창 밖으로 나간다. 게다가 단이 안 갈린 페이지에서는 지문이
  // 머리글보다 **앞**에 오기도 한다(실측 M2006#45: 머리글 905줄인데 근거 문장은 875줄).
  // 그래서 세트 문항은 머리글을 중심으로 **앞뒤로 넓게** 잡는다.
  const anchors = []
  if (no >= 41) {
    ls.forEach((l, i) => {
      const m = l.match(/\[\s*(\d{2})\s*[~～∼〜–—-]\s*(\d{2})\s*\]/)
      if (m && no >= +m[1] && no <= +m[2]) anchors.push({ i, span: 140, back: 90 })
    })
  }
  const re = new RegExp(`(?:^|\\s)${no}\\s*[.．]`)
  const at = ls.findIndex((l) => re.test(l))
  // 창을 60줄로 잡았더니 안내문처럼 표가 긴 문항에서 근거가 창 밖으로 나갔다
  // (실측 M2506#28: 번호 370줄, 근거 458줄). 90줄이면 한 문항 분량을 덮는다.
  if (at >= 0) anchors.push({ i: at, span: 90 })
  if (!anchors.length) { windowCache.set(key, ''); return '' }
  const win = norm(
    anchors.map(({ i, span, back = 10 }) => ls.slice(Math.max(0, i - back), i + span).join(' ')).join(' '),
  )
  windowCache.set(key, win)
  return win
}

/**
 * 인용의 **양 끝 다섯 낱말**이 둘 다 건초더미에 있는가.
 *
 * 통째 대조가 실패하는 두 원인을 가른다:
 *   · **지문 손상** — 문장 한가운데 옆 단 조각이 끼어들었다. 양 끝은 그대로 남는다 → 통과(경고)
 *   · **지어낸 인용** — 양 끝 어느 쪽도 원문에 없다 → 실패
 * 낱말이 열 개 미만인 짧은 인용은 이 완화를 쓰지 않는다(양 끝이 곧 전체라 검사가 무의미해진다).
 */
function shingleHit(nq, hay, suspect = false) {
  const w = nq.split(' ').filter(Boolean)
  // 6낱말이 하한이다 — 4낱말 창이 셋은 나와야 «60% 적중» 이 뜻을 갖는다.
  // (처음 10으로 잡았더니 표 항목처럼 짧은 근거가 완화를 못 받았다: `Participation Fee: $70
  //  per person (lunch included)` 7낱말 — 복원본이 `ee: $70…` 로 잘려 통째 대조는 실패한다.)
  if (w.length < 6) return false
  // 양 끝만 보면 부족하다 — 옆 단이 **낱말 단위로 교대**하면 첫 낱말부터 어긋난다
  // (실측 M2006#33: `since the trainer tangible is replaced by intangibles` — `The` 자리에
  //  옆 단의 `trainer` 가 들어와 있다). 그래서 4낱말 창을 죽 밀며 **몇 %가 원문에 있는지** 센다.
  let hit = 0
  let total = 0
  for (let i = 0; i + 4 <= w.length; i += 1) {
    total += 1
    if (hay.includes(w.slice(i, i + 4).join(' '))) hit += 1
  }
  // 이미 `body_suspect` 로 표시된 문항은 코퍼스 자체가 못 미더우므로 문턱을 낮춘다.
  // 실측 M2506#28: 복원본이 `Participation F|ee:` 로 잘려 앞 두 창이 통째로 어긋난다(2/4).
  // 멀쩡한 문항에는 그대로 0.6 을 요구한다 — 딱지 없는 곳에서까지 낮추면 검사가 헐거워진다.
  return total > 0 && hit / total >= (suspect ? 0.5 : 0.6)
}

// 청크 이름은 첫 문항 id 에서 나온다(`chunk-R-BLANK-M2706-31`). 일련번호가 아니므로
// `--chunk` 는 **이름 조각**으로 받는다 — `--chunk R-BLANK` · `--chunk M2706-31` 둘 다 된다.
const all = fs.readdirSync(WORK).filter((f) => f.endsWith('.out.json')).sort()
const files = arg('chunk') ? all.filter((f) => f.includes(arg('chunk'))) : all

if (!files.length) {
  console.log('  검사할 .out.json 이 없다')
  process.exit(0)
}

let nItems = 0
const fails = []
const warns = []

for (const f of files) {
  const p = path.join(WORK, f)
  if (!fs.existsSync(p)) { fails.push(`${f} — 파일이 없다`); continue }
  let j
  try {
    j = JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch (e) {
    fails.push(`${f} — JSON 파싱 실패: ${e.message}`)
    continue
  }
  const bad = (id, msg) => fails.push(`${f} ${id} — ${msg}`)
  const warn = (id, msg) => warns.push(`${f} ${id} — ${msg}`)

  for (const a of j.analyses ?? []) {
    nItems += 1
    const id = a.item_id ?? '(item_id 없음)'
    const it = itemOf.get(a.item_id)
    if (!it) { bad(id, '코퍼스에 없는 item_id'); continue }

    // V1 필수 서술
    for (const k of ['measured_ability', 'design_intent']) {
      if (!a[k] || String(a[k]).trim().length < 20) bad(id, `${k} 가 비었거나 20자 미만`)
    }

    // V2 검수 3인 — 서로 다른 페르소나가 전부 pass
    const rv = a.reviews ?? []
    const personas = new Set(rv.map((r) => r.persona))
    if (personas.size !== 3 || !PERSONAS.every((x) => personas.has(x))) {
      bad(id, `검수 페르소나가 ${[...personas].join('/') || '없음'} — setter·analyst·tutor 셋이 필요하다`)
    }
    if (rv.some((r) => r.verdict !== 'pass')) {
      bad(id, `pass 아닌 검수가 남아 있다 (${rv.filter((r) => r.verdict !== 'pass').map((r) => `${r.persona}:${r.verdict}`).join(' ')}) — 고쳐서 재검수해야 한다`)
    }
    // 검수가 무엇을 했는지 안 적었으면 그건 검수가 아니라 도장이다
    for (const r of rv) {
      if (!(r.checked ?? []).length) bad(id, `${r.persona} 검수에 checked 가 비었다`)
    }

    // V3 선지 5개 · 정답 1개 · 정답표와 일치
    if (a.answer_unknown) {
      if (it.answer != null) bad(id, 'answer_unknown 인데 코퍼스에는 정답이 있다')
      // **경고가 아니라 오류다.** 실측(2026-09-02, M2409#34): 분석자가 정답표 없는 문항에
      // answer_locus 와 선지 5개 판정을 채워 넣었다. 검수에서 잡아 지웠지만, 안 잡혔다면
      // **추정을 정답으로 배운 학습자**가 나온다. 이 작업에서 가장 해로운 산출물이므로
      // 사람 판단에 맡기지 않고 기계가 막는다.
      if ((a.choices ?? []).length) bad(id, 'answer_unknown 인데 선지 판정이 있다 — 추정을 정답처럼 적지 않는다')
      if (a.answer_locus) bad(id, 'answer_unknown 인데 answer_locus 가 있다 — 정답을 모르면 정답 근거도 없다')
      // **자유서술로 새어 나가는 정답 전제.** 구조화된 자리를 막았더니 산문 쪽으로 갔다 —
      // `measured_ability` 에 선지 배제를 적거나 `difficulty.drivers` 에 "오답 ②·③" 을 지목한
      // 사례를 검수가 잡았다(2026-09-02, M2306#24 · M2109#24). 검수가 잡은 것은 다음에 안 잡힐 수
      // 있으므로 기계에 옮긴다. 선지 번호를 부르는 말이 산문에 있으면 정답을 안다는 뜻이다.
      {
        const prose = [
          a.measured_ability, a.design_intent,
          ...(a.difficulty?.drivers ?? []),
          ...(a.solve_procedure ?? []).flatMap((s) => [s.step, s.on_fail]),
        ].filter(Boolean).join(' ')
        // ⚠️ **선지 기호가 있다는 것만으로 걸면 안 된다.** 위치형(삽입·순서)은 선지가 지문에
        //    박힌 위치라 절차가 «①~⑤ 앞 문장만 읽어…» 처럼 정당하게 부른다. 결함 서술
        //    («선지 ③에 OCR 잔여») 도 정답 주장이 아니다. 처음 넓게 걸었더니 12건이 전부
        //    오탐이었다 — 오탐이 잦은 검사는 곧 무시당하고, 무시당하는 검사는 없는 것과 같다.
        //    그래서 **정답·오답을 명시적으로 지목하는 말**에만 건다.
        const hit =
          prose.match(/(?:정답|오답|답)\s*(?:은|는|이|가|을|를)?\s*[①②③④⑤]/) ??
          prose.match(/[①②③④⑤]\s*(?:이|가|은|는)\s*(?:정답|답|맞)/) ??
          prose.match(/(?:정답|오답)\s*(?:은|는|이|가)?\s*[1-5]\s*(?:번|이다|입니다)/)
        if (hit) bad(id, `answer_unknown 인데 서술이 정답을 지목한다 — "${hit[0]}"`)
      }
    } else {
      const ch = a.choices ?? []
      if (ch.length !== 5) bad(id, `선지 판정이 ${ch.length}개 — 5개여야 한다`)
      const ns = ch.map((c) => c.n).sort((x, y) => x - y)
      if (ns.join(',') !== '1,2,3,4,5') bad(id, `선지 번호가 ${ns.join(',')}`)
      const correct = ch.filter((c) => c.verdict === 'correct')
      if (correct.length !== 1) bad(id, `correct 가 ${correct.length}개 — 정확히 1개여야 한다`)
      else if (it.answer != null && correct[0].n !== it.answer) {
        bad(id, `정답 불일치 — 분석 ${correct[0].n} vs 평가원 정답표 ${it.answer}`)
      }
      // 오답 넷은 함정 서술을 갖춰야 한다
      for (const c of ch.filter((c) => c.verdict === 'distractor')) {
        if (!c.trap) bad(id, `선지 ${c.n} 에 trap 라벨이 없다`)
        if (!c.why_tempting || c.why_tempting.length < 10) bad(id, `선지 ${c.n} 의 why_tempting 이 부실하다`)
        if (!c.how_to_reject || c.how_to_reject.length < 10) bad(id, `선지 ${c.n} 의 how_to_reject 가 부실하다`)
      }
      // V3b 함정이 전부 같으면 "오답 4개가 서로 다른 함정" 이 아니다
      const traps = new Set(ch.filter((c) => c.verdict === 'distractor').map((c) => c.trap))
      if (traps.size < 2) bad(id, `오답 4개의 함정이 ${traps.size}종 — 최소 2종이어야 한다`)
      else if (traps.size < 3) warn(id, `오답 함정이 ${traps.size}종뿐 (${[...traps].join(' · ')})`)
    }

    // V4 인용 대조 — 지어낸 근거를 잡는 유일한 자동 수단
    if (!a.answer_unknown) {
      const q = a.answer_locus?.quote
      if (!q) bad(id, 'answer_locus.quote 가 없다')
      else {
        const hay = norm(`${it.passage ?? ''} ${it.raw_block ?? ''} ${(it.choices ?? []).join(' ')}`)
        if (!hay.includes(norm(q))) {
          // **건초더미가 움직이는 표적이면 안 된다.** 인용은 분석을 쓴 시점의 코퍼스에서 뽑는데,
          // 파서를 고치면 지문 문자열이 달라져 멀쩡한 인용 23건이 한꺼번에 "지어냈다" 로 뒤집힌다
          // (2026-09-02 실제로 겪었다). 검사가 물어야 하는 것은 "우리 파서의 현재 산출물과 같은가"
          // 가 아니라 **"이 회차 원문에 실제로 있는가"** 다. 그래서 회차 원문으로 한 번 더 본다.
          // 지어낸 인용은 회차 원문에도 없으므로 이 완화가 원래 목적을 깎지 않는다.
          const win = examWindow(it.exam, it.no)
          if (win.includes(norm(q))) {
            warn(id, `인용이 현재 지문 파싱과 안 맞는다(회차 원문 창에는 있다) — 파서가 바뀌었을 수 있다`)
          } else if (shingleHit(norm(q), `${hay} ${win}`, it.body_suspect === true)) {
            // **손상된 지문과 지어낸 인용을 갈라야 한다.** 단이 안 갈린 페이지에서는 지문 한가운데
            // 옆 단 조각(`35. 다음 글에서…`)이 끼어들어, 원문에 있는 문장도 통째로는 안 걸린다.
            // 그렇다고 대조를 포기하면 게이트의 존재 이유가 사라진다 — 그래서 **양 끝 다섯 낱말**이
            // 둘 다 있는지 본다. 지어낸 문장은 양 끝 어느 쪽도 안 걸리고, 손상된 문장은 둘 다 걸린다.
            warn(id, `인용이 조각으로만 확인된다(지문 손상) — "${String(q).slice(0, 50)}…"`)
          } else {
            bad(id, `인용이 이 문항 언저리에 없다 — "${String(q).slice(0, 60)}…"`)
          }
        }
        if (norm(q).length < 20) warn(id, '인용이 20자 미만 — 근거로 삼기엔 짧다')
      }
    }

    // V5 풀이 절차 — 단계마다 실패 시 처리가 있어야 한다
    const sp = a.solve_procedure ?? []
    if (sp.length < 3) bad(id, `풀이 절차가 ${sp.length}단계 — 3단계 이상이어야 한다`)
    for (const [k, s] of sp.entries()) {
      if (!s.step || s.step.length < 10) bad(id, `절차 ${k + 1}단계가 비었다`)
      if (!s.on_fail) bad(id, `절차 ${k + 1}단계에 on_fail 이 없다`)
      const hit = BANNED.find((b) => (s.step ?? '').includes(b))
      if (hit) bad(id, `절차 ${k + 1}단계에 순환논법 표현 "${hit}"`)
    }

    // V6 시간·난이도·어휘
    if (!(a.time_budget_sec > 0)) bad(id, 'time_budget_sec 이 없다')
    else if (a.time_budget_sec < 40 || a.time_budget_sec > 300) warn(id, `time_budget_sec ${a.time_budget_sec} 가 상식 범위 밖`)
    const d = a.difficulty?.predicted
    if (typeof d !== 'number' || d < 0 || d > 1) bad(id, 'difficulty.predicted 가 0~1 이 아니다')
    const rvb = a.required_vocab ?? []
    if (!rvb.length) bad(id, 'required_vocab 이 비었다')
    if (rvb.length > 10) warn(id, `required_vocab ${rvb.length}개 — 지문 어휘 나열이 아닌지 본다`)
  }

  // V7 청크의 모든 문항이 채워졌나
  // 청크 이름이 첫 문항 id 에서 나오므로 out 과 원본이 1:1 로 짝지어진다.
  // 원본이 이미 지워졌으면(= 다음 export 가 돌았으면) 짝 검사를 건너뛴다 — out 이 원장이다.
  const src = path.join(WORK, f.replace('.out.json', '.json'))
  if (fs.existsSync(src)) {
    const want = JSON.parse(fs.readFileSync(src, 'utf8')).items.map((i) => i.item_id)
    const got = new Set((j.analyses ?? []).map((a) => a.item_id))
    const miss = want.filter((x) => !got.has(x))
    if (miss.length) bad('(청크)', `분석이 빠진 문항 ${miss.length}: ${miss.slice(0, 5).join(' ')}`)
  }

  // V8 유형 리포트
  const tr = j.type_report
  if (!tr) warn(f, 'type_report 가 없다 — 유형별 분석 결과가 안 쌓인다')
  else {
    if (!(tr.procedure ?? []).length) fails.push(`${f} type_report.procedure 가 비었다`)
    if (!(tr.failure_modes ?? []).length) fails.push(`${f} type_report.failure_modes 가 비었다`)
    if (tr.n_analyzed !== (j.analyses ?? []).length) {
      fails.push(`${f} type_report.n_analyzed ${tr.n_analyzed} vs 분석 ${(j.analyses ?? []).length}`)
    }
  }
}

console.log('── 분석 드레인 검수 게이트 ──')
console.log(`  파일 ${files.length} · 문항 ${nItems}`)
for (const w of warns) console.log(`  ⚠ ${w}`)
for (const f of fails) console.log(`  ✗ ${f}`)
if (!fails.length && !warns.length) console.log('  ✓ 전부 통과')
console.log(`\n  ${fails.length === 0 ? 'PASS' : 'FAIL'} · 오류 ${fails.length} · 경고 ${warns.length}`)
process.exit(fails.length ? 1 : 0)
