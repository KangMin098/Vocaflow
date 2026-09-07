// scripts/lcp/quiz-drain/balance-answer-positions.mjs
//
// 배치 파일의 **아직 넣지 않은** 챕터에서 정답 위치를 재배치해 책 전체 분포를 고르게 만든다.
//
// 왜 필요한가: 화면이 보기를 섞지 않으므로 정답 위치가 곧 난이도다. 그런데 사람이 저술하면
//   자연히 한쪽으로 쏠린다 — 2026-08-30 실측으로 Oz 앞 6장이 13·10·7·3(앞쪽 쏠림)이었고,
//   그것을 의식하고 다음 3장을 쓰자 이번엔 index 2 로 몰렸다. 의식만으로는 안 된다.
//
// 방법: 목표 index 로 정답 옵션을 **이동**시킨다(다른 보기의 상대 순서는 유지).
//   보기가 2개뿐인 truefalse 는 건드리지 않는다 — 위치 쏠림 판정 대상이 아니다.
//
// 사용:
//   EXISTING_DIST=13,10,7,3 node scripts/lcp/quiz-drain/balance-answer-positions.mjs <batch.json> 7 8 9
//
//   EXISTING_DIST 은 **그 책에서 이미 DB 에 들어간** 4지선다 문항의 위치 분포다.
//   (SQL: select correct_index, count(*) from library_chapter_quiz
//         where library_book_id=… and jsonb_array_length(options)>=3 group by 1 order by 1)
//   생략하면 0,0,0,0 으로 보고 이번 배치 안에서만 고르게 만든다.
//   챕터 번호를 주지 않으면 questions 가 채워진 전부를 대상으로 한다.

import { readFileSync, writeFileSync } from 'node:fs'

const [, , path, ...chapterArgs] = process.argv
if (!path) {
  console.error('usage: EXISTING_DIST=a,b,c,d node balance-answer-positions.mjs <batch.json> [chapter_idx...]')
  process.exit(1)
}
const only = new Set(chapterArgs.map(Number))
const payload = JSON.parse(readFileSync(path, 'utf8'))

/** 이미 DB 에 들어간 책 전체 분포(호출부가 인자로 넘기기 번거로워 여기 적는다). */
const EXISTING = process.env['EXISTING_DIST']
  ? process.env['EXISTING_DIST'].split(',').map(Number)
  : [0, 0, 0, 0]

const targets = []
for (const ch of payload.chapters) {
  if (!(ch.questions ?? []).length) continue
  if (only.size && !only.has(ch.chapter_idx)) continue
  for (const q of ch.questions) if (q.options.length >= 3) targets.push(q)
}
if (targets.length === 0) {
  console.log('대상 문항 없음')
  process.exit(0)
}

// 목표: 기존 + 신규를 합쳐 네 위치가 최대한 고르게. 부족한 위치부터 채운다.
const dist = [...EXISTING]
const total = dist.reduce((a, b) => a + b, 0) + targets.length
const want = Math.ceil(total / 4)
const queue = []
for (let round = 0; queue.length < targets.length; round++) {
  for (let i = 0; i < 4; i++) {
    if (queue.length >= targets.length) break
    if (dist[i] + queue.filter((x) => x === i).length < want) queue.push(i)
  }
  if (round > 10) break
}
while (queue.length < targets.length) queue.push(queue.length % 4)

targets.forEach((q, n) => {
  const target = Math.min(queue[n], q.options.length - 1)
  if (target === q.correctIndex) return
  const correct = q.options[q.correctIndex]
  const rest = q.options.filter((_, i) => i !== q.correctIndex)
  rest.splice(target, 0, correct)
  q.options = rest
  q.correctIndex = target
})

writeFileSync(path, JSON.stringify(payload, null, 2))
const after = [0, 0, 0, 0]
for (const q of targets) after[q.correctIndex]++
console.log(`재배치 ${targets.length}문항 · 이번 배치 분포 ${after.join('·')} · 기존 ${EXISTING.join('·')}`)
