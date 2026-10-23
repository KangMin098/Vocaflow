// scripts/research/goal-data/d2-validate.check.mjs
//
// d2-validate 반례 검사 — 선택 이유 반복 검출(T-0107: 2행 완전 반복 · 템플릿 · 청크 간)이 실제로 잡는지 확인한다.
//   node scripts/research/goal-data/d2-validate.check.mjs   (실패 시 exit 1)
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { checkChunk, loadTrack, makeValidator, maskIds } from './d2-validate.mjs'

const input = { contract: 'v2.4', tasks: ['r.central_meaning'], rows: [] }
const V = makeValidator(input, [])
const cases = [
  { name: '2행 완전 반복', rows: [{ item_id: 'X#1', primary_reason: '빈칸 명제를 본문 결론 문장에서 바로 압축한다' }, { item_id: 'Y#2', primary_reason: '빈칸 명제를 본문 결론 문장에서 바로 압축한다' }], expect: true },
  { name: '템플릿 3행(영어 · 인용만 바꿈)', rows: [1, 2, 3].map((n) => ({ item_id: `Z#${n}`, primary_reason: `「word${n}」 를 본문 retell${n} 문장과 대조해 정답 ${n} 을 고른다` })), expect: true },
  { name: 'direct 단일(실제 direct 1 · primary 일치)은 템플릿 검사 제외', rows: [1, 2, 3].map((n) => ({ item_id: `S#${n}`, primary_task: 'r.central_meaning', links: [{ task_id: 'r.central_meaning', relevance: 'direct' }], primary_reason: `direct 단일 — 결정 지점 point${n} 문장` })), expect: false },
  { name: '허위 direct 단일(다중 direct) 거부(T-0108)', rows: [{ item_id: 'F#1', primary_task: 'r.central_meaning', links: [{ task_id: 'r.central_meaning', relevance: 'direct' }, { task_id: 'e.evidence_location', relevance: 'direct' }], primary_reason: 'direct 단일 — 결정 지점 끝 문장' }], expect: true },
  { name: 'direct 단일인데 primary 와 다른 TASK 거부', rows: [{ item_id: 'G#1', primary_task: 'e.task_demand', links: [{ task_id: 'r.central_meaning', relevance: 'direct' }], primary_reason: 'direct 단일 — 결정 지점 첫 문장' }], expect: true },
  { name: '서로 다른 이유', rows: [{ item_id: 'A#1', primary_reason: '중심 문장이 마지막 단락에 명시돼 압축만 필요하다' }, { item_id: 'B#1', primary_reason: '선지 셋이 본문 낱말을 재사용해 대조 없이는 둘이 남는다' }], expect: false },
]
// not_observable why 틀 반복(b14 B-01) — b14 부터만 검사, 이전 배치는 소급 배제하지 않는다
const nob = (n) => [1, 2, 3].map((k) => ({ item_id: `N#${k}`, primary_reason: `고유 이유 ${'가나다'[k - 1]} 문장의 중심을 압축한다`, not_observable: [{ task_id: 'r.inference', why: `선택 하나로는 N#${k} 에서 이 수행의 근거 지목을 확인할 수 없다` }] })).slice(0, n)
const V14 = makeValidator({ ...input, batch: 'b14-v24' }, [])
const V13 = makeValidator({ ...input, batch: 'b13-v24' }, [])
const nobCases = [
  { name: 'not_observable why 틀 3문항(b14) 거부', v: V14, rows: nob(3), expect: true },
  { name: 'not_observable why 틀 2문항(b14) 허용', v: V14, rows: nob(2), expect: false },
  { name: 'not_observable why 틀 3문항(b13) 소급 안 함', v: V13, rows: nob(3), expect: false },
  // T-0123: 설명 하나하나를 문항 단위로 센다 — 고유 줄을 덧붙여도 반복 줄이 3문항이면 거부(1+1 · 1+2)
  { name: '반복 1줄 + 고유 1줄 × 3문항 거부', v: V14, rows: [1, 2, 3].map((k) => ({ item_id: `M#${k}`, primary_reason: `고유 이유 ${'가나다'[k - 1]} 문장`, not_observable: [{ task_id: 'r.discourse_structure', why: '전개 복원은 선택만으로 확인되지 않는다' }, { task_id: 'r.inference', why: `문항 ${k} 의 결론 ${'가나다'[k - 1]} 연결은 남지 않는다` }] })), expect: true },
  { name: '반복 1줄 + 고유 2줄 × 3문항 거부(T-0123 우회)', v: V14, rows: [1, 2, 3].map((k) => ({ item_id: `M#${k}`, primary_reason: `고유 이유 ${'가나다'[k - 1]} 문장`, not_observable: [{ task_id: 'r.discourse_structure', why: '전개 복원은 선택만으로 확인되지 않는다' }, { task_id: 'r.inference', why: `문항 ${k} 의 결론 ${'가나다'[k - 1]} 연결은 남지 않는다` }, { task_id: 'e.task_demand', why: `발문 ${'가나다'[k - 1]} 방향 확인 흔적 없음` }] })), expect: true },
  { name: '삽입 E2 계약 고정 문구(정확 일치)는 제외', v: makeValidator({ ...input, batch: 'b14-v24', rows: [1, 2, 3].map((k) => ({ item_id: `I#${k}`, type_id: 'R-INSERT' })) }, []), rows: [1, 2, 3].map((k) => ({ item_id: `I#${k}`, primary_reason: `고유 이유 ${'가나다'[k - 1]} 문장`, not_observable: [{ task_id: 'e.evidence_location', why: '삽입 경계 판정은 R2 · R4 의 수행 — E2 분리 불가(v2.2 §3)' }] })), expect: false },
  { name: '삽입 E2 라도 계약 밖 같은 설명은 거부(RECHECK-P1-02)', v: makeValidator({ ...input, batch: 'b14-v24', rows: [1, 2, 3].map((k) => ({ item_id: `I#${k}`, type_id: 'R-INSERT' })) }, []), rows: [1, 2, 3].map((k) => ({ item_id: `I#${k}`, primary_reason: `고유 이유 ${'가나다'[k - 1]} 문장`, not_observable: [{ task_id: 'e.evidence_location', why: '아무 설명이나 같은 문장' }] })), expect: true },
]
// 관측 양쪽 중복(T-0122 P1-02) — b15 부터 거부, 그 전 배치는 기록만
const realIn = JSON.parse(fs.readFileSync(new URL('./local/b15-v24/input.json', import.meta.url)))
const dupRow = { item_id: realIn.rows[0].item_id, directly_observable: ['e.task_demand'], not_observable: [{ task_id: 'e.task_demand', why: '발문 방향 확인' }] }
const dupIn = (batch) => makeValidator({ ...realIn, batch }, realIn.tasks).row(dupRow).some((e) => e.includes('양쪽'))
const dupCases = [{ name: '관측 양쪽 중복(b15) 거부', got: dupIn('b15-v24'), expect: true }, { name: '관측 양쪽 중복(b14) 소급 안 함', got: dupIn('b14-v24'), expect: false }]
let bad = 0
for (const c of dupCases) {
  console.log(`${c.got === c.expect ? 'ok ' : 'FAIL'} ${c.name} → 검출 ${c.got}`)
  if (c.got !== c.expect) bad++
}
for (const c of nobCases) {
  const got = c.v.reasons(c.rows).some((e) => e.includes('not_observable'))
  console.log(`${got === c.expect ? 'ok ' : 'FAIL'} ${c.name} → 검출 ${got}`)
  if (got !== c.expect) bad++
}
for (const c of cases) {
  const got = V.reasons(c.rows).length > 0
  console.log(`${got === c.expect ? 'ok ' : 'FAIL'} ${c.name} → 검출 ${got}`)
  if (got !== c.expect) bad++
}
// 공용 로더(T-0115 RECHECK-P1-01): 청크 반복 검사 실패 → 그 청크 행 전부 배제 · 행 결함 → 그 행만 배제 · 트랙 이유 반복 → 전부 배제
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-loader-'))
const rows = (p) => Array.from({ length: 3 }, (_, k) => ({ item_id: `${p}#${k}` }))
fs.writeFileSync(path.join(dir, 'chunk-A-01.out.json'), JSON.stringify({ rows: rows('X') }))
fs.writeFileSync(path.join(dir, 'chunk-A-02.out.json'), JSON.stringify({ rows: rows('Y') }))
// 청크 입력(소유권) — 없으면 loadTrack 이 그 청크를 배제한다(fail-closed · T-0126 대비)
fs.writeFileSync(path.join(dir, 'chunk-A-01.json'), JSON.stringify({ items: rows('X') }))
fs.writeFileSync(path.join(dir, 'chunk-A-02.json'), JSON.stringify({ items: rows('Y') }))
const stub = (o) => ({ chunk: (r) => (o.chunkFail && r[0].item_id.startsWith('X') ? ['반복'] : []), row: (r) => (o.rowFail === r.item_id ? ['결함'] : []), reasons: () => (o.reasonFail ? ['이유 반복'] : []) })
const ids = [...rows('X'), ...rows('Y')].map((r) => r.item_id)
const loaderCases = [
  { name: '청크 반복 실패 → 그 청크 3행 배제', o: { chunkFail: true }, expect: 3 },
  { name: '행 결함 → 그 행만 배제', o: { rowFail: 'Y#1' }, expect: 5 },
  { name: '트랙 이유 반복 → 전부 배제', o: { reasonFail: true }, expect: 0 },
  { name: '결함 없음 → 6행', o: {}, expect: 6 },
]
for (const c of loaderCases) {
  const got = loadTrack(dir, 'A', 2, stub(c.o), ids).out.size
  console.log(`${got === c.expect ? 'ok ' : 'FAIL'} 로더: ${c.name} → 통과 ${got}`)
  if (got !== c.expect) bad++
}
fs.rmSync(path.join(dir, 'chunk-A-02.json'))
{
  const got = loadTrack(dir, 'A', 2, stub({}), ids).out.size
  console.log(`${got === 3 ? 'ok ' : 'FAIL'} 로더: 청크 입력 파일을 지우면 그 청크 배제(fail-closed) → 통과 ${got}`)
  if (got !== 3) bad++
}
fs.rmSync(dir, { recursive: true, force: true })
// prereg-compare 가 공용 로더를 쓰는지(정적 확인) — 자체 행 필터로 되돌아가면 청크 검사를 다시 빠뜨린다
const cmp = fs.readFileSync(new URL('./prereg-compare.mjs', import.meta.url), 'utf8')
const usesLoader = cmp.includes('loadTrack(') && !cmp.includes('V.row(r)')
console.log(`${usesLoader ? 'ok ' : 'FAIL'} prereg-compare 가 공용 로더만 쓴다`)
if (!usesLoader) bad++

// 청크 단위 검사(T-0124) — 자기 누락은 배제 탓으로 숨지 않고, 반복 그룹의 넷째 문항이 있는 청크도 결함으로 센다
{
  const ids = ['Q#1', 'Q#2', 'Q#3', 'Q#4', 'Q#5', 'Q#6']
  const real = makeValidator({ contract: 'v2.4', tasks: ['r.central_meaning'], batch: 'b17-v24', rows: ids.map((item_id) => ({ item_id })) }, [])
  // 행 · 청크 검사는 원문이 필요해 빈 함수로 — 트랙 반복(reasonsDetail)과 누락 집계만 실제 코드로 본다
  const Vc = { row: () => [], chunk: () => [], reasonsDetail: real.reasonsDetail }
  const why = '같은 틀 설명 문장이 반복된다'
  const RS = { "Q#1": "첫 단락 결론을 압축하면 정답만 남는다", "Q#2": "선지 셋이 본문 낱말을 재사용해 대조가 필요하다", "Q#3": "빈칸 뒤 예시를 묶어 일반화해야 한다", "Q#4": "부정 발문 방향을 놓치면 반대 선지로 간다", "Q#5": "흩어진 두 근거를 찾아 맞춰야 정답이 갈린다", "Q#6": "주어진 문장의 대명사가 앞 단락을 가리킨다" }
  const row = (id, rep) => ({ item_id: id, primary_reason: RS[id], not_observable: [{ task_id: 'r.inference', why: rep ? why : `고유 설명 ${{ "Q#1": "가", "Q#2": "나", "Q#3": "다", "Q#4": "라", "Q#5": "마", "Q#6": "바" }[id]} 연결` }] })
  const mk = (a, b) => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-chunk-'))
    fs.writeFileSync(path.join(d, 'chunk-A-01.json'), JSON.stringify({ items: ids.slice(0, 3).map((item_id) => ({ item_id })) }))
    fs.writeFileSync(path.join(d, 'chunk-A-02.json'), JSON.stringify({ items: ids.slice(3).map((item_id) => ({ item_id })) }))
    fs.writeFileSync(path.join(d, 'chunk-A-01.out.json'), JSON.stringify({ rows: a }))
    fs.writeFileSync(path.join(d, 'chunk-A-02.out.json'), JSON.stringify({ rows: b }))
    return d
  }
  const c1 = checkChunk(mk(ids.slice(0, 3).map((id) => row(id, true)), []), 'A', '02', 2, Vc)
  const c2 = checkChunk(mk(ids.slice(0, 3).map((id) => row(id, true)), [row('Q#4', true), row('Q#5', false), row('Q#6', false)]), 'A', '02', 2, Vc)
  const c3 = checkChunk(mk(ids.slice(0, 3).map((id) => row(id, true)), ids.slice(3).map((id) => row(id, false))), 'A', '02', 2, Vc)
  const cc = [
    { name: '청크: 다른 청크 반복으로 트랙 배제돼도 자기 출력 비면(rows=[]) 출력 없음 3 집계(P1-01)', got: c1.mine.filter((e) => e.endsWith('출력 없음')).length === 3 },
    { name: '청크: 반복 그룹 넷째 문항이 있는 청크도 트랙 결함 집계(P1-02)', got: c2.mine.some((e) => e.startsWith('트랙 not_observable') && e.includes('Q#4') && !e.includes('Q#1')) },
    { name: '청크: 자기 청크 무관한 반복은 상태만(결함에 안 섞이고 다른 청크 id 비노출)', got: c3.trackExcluded && !c3.mine.some((e) => e.startsWith('트랙') || e.includes('Q#1')) },
  ]
  for (const c of cc) { console.log(`${c.got ? 'ok ' : 'FAIL'} ${c.name}`); if (!c.got) bad++ }
}

// 청크 소유권 · id 가림(T-0125) — 두 경로(checkChunk · loadTrack)가 같은 결함 집합을 내고, 자유 서술 속 다른 청크 id 는 가린다
{
  const ids = ['2099#1', '2099#2', '2099#3', '2099#4']
  const real = makeValidator({ contract: 'v2.4', tasks: ['r.central_meaning'], batch: 'b17-v24', rows: ids.map((item_id) => ({ item_id })) }, [])
  const Vs = { row: () => [], chunk: () => [], reasons: real.reasons, reasonsDetail: real.reasonsDetail }
  const RS = { '2099#1': '첫 단락 결론을 압축하면 정답만 남는다', '2099#2': '선지 셋이 본문 낱말을 재사용해 대조가 필요하다', '2099#3': '빈칸 뒤 예시를 묶어 일반화해야 한다', '2099#4': '부정 발문 방향을 놓치면 반대 선지로 간다 — 2099#1 과 대비' }
  const row = (id) => ({ item_id: id, primary_reason: RS[id], not_observable: [] })
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-own-'))
  fs.writeFileSync(path.join(d, 'chunk-A-01.json'), JSON.stringify({ items: ids.slice(0, 2).map((item_id) => ({ item_id })) }))
  fs.writeFileSync(path.join(d, 'chunk-A-02.json'), JSON.stringify({ items: ids.slice(2).map((item_id) => ({ item_id })) }))
  // 첫 행을 서로 바꿈 — 문항은 각 1회 · 내용 불변
  fs.writeFileSync(path.join(d, 'chunk-A-01.out.json'), JSON.stringify({ rows: [row('2099#3'), row('2099#2')] }))
  fs.writeFileSync(path.join(d, 'chunk-A-02.out.json'), JSON.stringify({ rows: [row('2099#1'), row('2099#4')] }))
  const lt = loadTrack(d, 'A', 2, Vs, ids)
  const k1 = checkChunk(d, 'A', '01', 2, Vs), k2 = checkChunk(d, 'A', '02', 2, Vs)
  // 자유 서술 속 다른 청크 id: 01 청크에 2099#4 의 이유(2099#1 언급)를 넣고 02 에서 보면 2099#1 이 가려져야 한다
  const d2 = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-mask-'))
  fs.writeFileSync(path.join(d2, 'chunk-A-01.json'), JSON.stringify({ items: ids.slice(0, 2).map((item_id) => ({ item_id })) }))
  fs.writeFileSync(path.join(d2, 'chunk-A-02.json'), JSON.stringify({ items: ids.slice(2).map((item_id) => ({ item_id })) }))
  fs.writeFileSync(path.join(d2, 'chunk-A-01.out.json'), JSON.stringify({ rows: [row('2099#1'), row('2099#2')] }))
  fs.writeFileSync(path.join(d2, 'chunk-A-02.out.json'), JSON.stringify({ rows: [row('2099#3'), { ...row('2099#4'), primary_reason: 'x' }] }))
  const Vm = { ...Vs, row: (r) => (r.item_id === '2099#4' ? ['primary_reason 이 2099#1 과 같다고 적힘 · 붙여 쓴 x2099#2 · (2099#1)'] : []) }
  const m2 = checkChunk(d2, 'A', '02', 2, Vm)
  const oc = [
    { name: '소유권: 첫 행 맞바꿈 → loadTrack 결함 2 · 통과 2(RECHECK-P1-01)', got: lt.errors.filter((e) => e.includes('의 문항이 아니다')).length === 2 && lt.out.size === 2 },
    { name: '소유권: 같은 입력에서 checkChunk 도 01 · 02 각각 결함(두 경로 일치)', got: k1.mine.some((e) => e.includes('이 청크 문항이 아니다')) && k2.mine.some((e) => e.includes('이 청크 문항이 아니다')) },
    { name: 'id 가림: 자유 서술 속 다른 청크 id 는 (다른 문항) 으로(RECHECK-P1-02)', got: m2.mine.some((e) => e.includes('(다른 문항)')) && !m2.mine.some((e) => e.includes('2099#1') || e.includes('2099#2')) && m2.mine.some((e) => e.includes('2099#4')) },
  ]
  for (const c of oc) { console.log(`${c.got ? 'ok ' : 'FAIL'} ${c.name}`); if (!c.got) bad++ }
}


// id 가림 경계 · 깨진 JSON(T-0126 RECHECK2-P1-02)
{
  const own = new Set(['2099#3'])
  const m = maskIds('xM2306#21 · 2022#33_ · (2021#18) · m2306#22 · 2014A#20 · 2099#3', own)
  const ids = ['2099#1', '2099#2', '2099#3', '2099#4']
  const real = makeValidator({ contract: 'v2.4', tasks: ['r.central_meaning'], batch: 'b17-v24', rows: ids.map((item_id) => ({ item_id })) }, [])
  const Vs = { row: () => [], chunk: () => [], reasons: real.reasons, reasonsDetail: real.reasonsDetail }
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-broken-'))
  fs.writeFileSync(path.join(d, 'chunk-A-01.json'), JSON.stringify({ items: ids.slice(0, 2).map((item_id) => ({ item_id })) }))
  fs.writeFileSync(path.join(d, 'chunk-A-02.json'), JSON.stringify({ items: ids.slice(2).map((item_id) => ({ item_id })) }))
  fs.writeFileSync(path.join(d, 'chunk-A-01.out.json'), '{"rows":[{"item_id":"2099#1"} 2099#2 }}}')
  fs.writeFileSync(path.join(d, 'chunk-A-02.out.json'), JSON.stringify({ rows: [{ item_id: '2099#3', primary_reason: '첫 단락 결론을 압축하면 정답만 남는다' }, { item_id: '2099#4', primary_reason: '부정 발문 방향을 놓치면 반대 선지로 간다' }] }))
  const k2 = checkChunk(d, 'A', '02', 2, Vs)
  const k1 = checkChunk(d, 'A', '01', 2, Vs)
  let lt = null
  try { lt = loadTrack(d, 'A', 2, Vs, ids) } catch { lt = null }
  const bc = [
    { name: 'id 가림: 영문자 · 밑줄 · 괄호 · 소문자 · 2014A 는 가리고 자기 문항은 남김', got: !/M2306#21|2022#33|2021#18|2306#22|2014A#20/i.test(m) && m.includes('2099#3') },
    { name: '깨진 JSON: 다른 청크가 깨져도 자기 청크는 결함 0 · 상태만(내용 없음)', got: k2.otherUnreadable && k2.mine.length === 0 },
    { name: '깨진 JSON: 자기 청크가 깨지면 결함 1 · 다른 청크 id 비노출', got: k1.mine.length === 1 && k1.mine[0].includes('JSON 오류') && !k1.mine[0].includes('2099#3') },
    { name: '깨진 JSON: loadTrack 은 멈추지 않고 그 청크만 배제(통과 2)', got: lt !== null && lt.out.size === 2 },
  ]
  for (const c of bc) { console.log(`${c.got ? 'ok ' : 'FAIL'} ${c.name}`); if (!c.got) bad++ }
}

process.exit(bad ? 1 : 0)
