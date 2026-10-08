// scripts/csat/map/extract-learning-map.mjs
//
// 첨부 학습 지도 아티팩트(HTML)의 초기 데이터 → source/learning-map.json.
// 지도에 쓰는 것만 옮긴다: AXES · TRACKS · PRINCIPLES · LINES · ROUTES · TASKS.
// (RATIOS · PERIODS · ROUTINES 는 제외한 탭 전용이라 옮기지 않는다. C_FIRST 는 C 라인 과제를 만드는 입력으로만 쓴다.)
//
//   node scripts/csat/map/extract-learning-map.mjs <아티팩트.html>

import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'source', 'learning-map.json')

const src = process.argv[2]
if (!src) {
  console.error('사용: node scripts/csat/map/extract-learning-map.mjs <아티팩트.html>')
  process.exit(1)
}

const html = fs.readFileSync(src, 'utf8').replace(/\r\n/g, '\n')
const names = ['AXES', 'TRACKS', 'PRINCIPLES', 'LINES', 'ROUTES', 'TASKS', 'C_FIRST']

/** `const NAME = ...;` 선언 한 덩어리를 잘라 낸다(다음 줄이 `const ` 로 시작하는 곳까지) */
function block(name) {
  const start = html.indexOf(`const ${name} =`)
  if (start < 0) throw new Error(`${name} 선언을 찾지 못했다`)
  const rest = html.slice(start)
  const m = /\nconst |\n\/\/ /.exec(rest.slice(10))
  return m ? rest.slice(0, m.index + 10) : rest
}

const ctx = vm.createContext({})
vm.runInContext(names.map((n) => block(n)).join('\n') + '\nglobalThis.__out = { AXES, TRACKS, PRINCIPLES, LINES, ROUTES, TASKS, C_FIRST }', ctx)
const d = ctx.__out

// C1–C8 의 과제는 아티팩트가 C_FIRST 로 코드에서 만든다(원본 규칙 그대로):
//   ① 첫 과제(C_FIRST) ② 「<라인> 모음 풀이」 ③ C8 은 어휘 폭 병행(A4), 나머지는 끌린 이유 한 줄(I3)
for (const [id, [title, how]] of Object.entries(d.C_FIRST)) {
  const nm = d.LINES.find((l) => l.id === id).name
  d.TASKS[id] = [
    [title, how, '풀이마다', '표시 습관 고정', 'x'],
    [`${nm} 모음 풀이`, '이 함정 선지가 있는 기출 문항만 모아 풉니다.', '주 10문항', '노출 대비 선택률 30% 이하', 'x'],
    id === 'C8'
      ? ['어휘 폭 병행', '재진술 라인의 바꿔 쓰기 과제를 함께 합니다.', '4~12주', '비유 선지 선택률 감소', 'f', 'A4']
      : ['끌린 이유 한 줄', '걸렸을 때 왜 끌렸는지 한 줄로 기록합니다.', '오답마다', '같은 이유 반복 0', 'x', 'I3'],
  ]
}

// 과제 배열 → 객체 (title · how · cadence · doneWhen · material · methodLine)
const tasks = {}
for (const [line, rows] of Object.entries(d.TASKS)) {
  tasks[line] = rows.map(([title, how, cadence, doneWhen, material, methodLine], i) => ({
    ord: i + 1,
    title,
    how,
    cadence,
    doneWhen,
    material: material === 'x' ? 'past' : 'core',
    methodLine: methodLine ?? null,
  }))
}

const out = {
  axes: d.AXES,
  tracks: d.TRACKS.map(({ id, name, sub, horizon, eval: ev, material, desc }) => ({ id, name, sub, horizon, eval: ev, material, desc })),
  principles: d.PRINCIPLES,
  lines: d.LINES.map(({ id, ax, name, tr, why, ev, p }) => ({ id, axis: ax, name, track: tr, why, signal: ev, principles: p.map(([pid, basis]) => ({ principle: pid, basisClaimed: basis === 'd' ? 'direct' : basis === 'i' ? 'inferred' : 'pending' })) })),
  routes: d.ROUTES.map(([principle, track, basis]) => ({ principle, track, basisClaimed: basis === 'd' ? 'direct' : basis === 'i' ? 'inferred' : 'pending' })),
  tasks,
}

const taskCount = Object.values(tasks).reduce((n, r) => n + r.length, 0)
fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n')
console.log(`영역 ${out.axes.length} · 라인 ${out.lines.length} · 원리 ${out.principles.length} · 트랙 ${out.tracks.length} · 경로 ${out.routes.length} · 과제 ${taskCount}`)
console.log(`라인 연결(reason) ${out.lines.reduce((n, l) => n + l.principles.length, 0)} → ${path.relative(process.cwd(), OUT)}`)
