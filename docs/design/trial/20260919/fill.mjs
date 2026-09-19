// docs/design/trial/20260919/fill.mjs
//
// 이미지 체계 드레인 2단 — **에이전트가 채운다.** 청크의 각 항목을 방향 A 「원고지」 그리기 함수(build.mjs 의 NEW · REUSE)로 그려
// chunk-NN.out.json 에 { id, svg } 로 쓴다. 실행: node docs/design/trial/20260919/fill.mjs <chunk-NN.json>
// 그릴 함수가 없는 항목은 **쓰지 않고** 이름을 출력한다 — 빈 svg 를 내보내지 않는다(import 가 거부하지만 여기서도 막는다).

import { readFileSync, writeFileSync } from 'node:fs'

import { NEW, REUSE } from './build.mjs'

const chunkPath = process.argv[2]
if (!chunkPath) { console.error('사용: node docs/design/trial/20260919/fill.mjs <chunk-NN.json>'); process.exit(2) }
const chunk = JSON.parse(readFileSync(chunkPath, 'utf8'))
const out = [], missing = []
for (const it of chunk.items) {
  const fn = REUSE[it.id] ?? NEW[it.id]
  if (!fn) { missing.push(it.id); continue }
  const svg = (REUSE[it.id] ? fn() : fn(`${it.concept} — ${it.verb}`)).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ').replace(/ width="\d+" height="\d+"/, '')
  out.push({ id: it.id, svg })
}
writeFileSync(chunkPath.replace(/\.json$/, '.out.json'), JSON.stringify(out, null, 2) + '\n')
console.log(`채움 ${out.length} · 그릴 함수 없음 ${missing.length}${missing.length ? ' — ' + missing.join(', ') : ''}`)
