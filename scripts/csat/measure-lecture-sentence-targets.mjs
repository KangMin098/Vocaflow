// scripts/csat/measure-lecture-sentence-targets.mjs
//
// 강의 큐의 문장 가리킴(`anchor:sentence:k`)이 학습자 문장 지도(skeleton-data, 0-기반)와 맞는지 전량 측정(2026-10-09 · 읽기 전용).
// 학습자는 강의가 「이 문장」이라 할 때 지도에서 그 문장이 켜지는 것을 보고 공개 문제지에서 같은 번호를 찾는다 —
// 번호가 어긋나면 엉뚱한 문장을 본다. 범위 밖(k ≥ 문장 수) · 정답 근거 큐가 정답 앵커 문장을 안 가리킴을 센다.
//   node scripts/csat/measure-lecture-sentence-targets.mjs [--json]
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../..')
const SK = path.join(ROOT, 'apps/web/src/lib/csat/skeleton-data')
const LE = path.join(ROOT, 'apps/web/src/lib/csat/lecture-data')

const skeleton = new Map()
for (const f of fs.readdirSync(SK).filter((x) => x.endsWith('.json'))) {
  for (const it of JSON.parse(fs.readFileSync(path.join(SK, f), 'utf8')).items ?? []) skeleton.set(it.id, it)
}

const out = { lectures: 0, cuesWithSentence: 0, outOfRange: [], answerCueMiss: [], noSkeleton: 0, byExam: {} }
for (const f of fs.readdirSync(LE).filter((x) => x.endsWith('.json'))) {
  const data = JSON.parse(fs.readFileSync(path.join(LE, f), 'utf8'))
  for (const lec of Object.values(data.lectures ?? {})) {
    out.lectures++
    const sk = skeleton.get(lec.item_id)
    if (!sk) { out.noSkeleton++; continue }
    const n = sk.sentences.length
    const answerSentences = new Set((sk.anchors ?? []).filter((a) => a.id === 'answer').flatMap((a) => a.sentences ?? []))
    const exam = String(lec.item_id).split('#')[0]
    const e = (out.byExam[exam] ??= { cues: 0, outOfRange: 0 })
    for (const c of lec.cues ?? []) {
      const ids = [c.target, ...(c.focus ?? []).map((k) => ({ kind: 'anchor', id: `sentence:${k}` }))].filter(Boolean)
      for (const t of ids) {
        const m = t.kind === 'anchor' ? /^sentence:(\d+)$/.exec(String(t.id)) : null
        if (!m) continue
        const k = Number(m[1])
        out.cuesWithSentence++
        e.cues++
        if (k >= n) { out.outOfRange.push(`${lec.item_id} ${c.id} sentence:${k} (문장 ${n}개)`); e.outOfRange++ }
        else if ((c.role === 'evidence' || c.role === 'answer') && answerSentences.size && !answerSentences.has(k)) out.answerCueMiss.push(`${lec.item_id} ${c.id} sentence:${k} (정답 앵커 ${[...answerSentences].join(',')})`)
      }
    }
  }
}
if (process.argv.includes('--json')) console.log(JSON.stringify(out, null, 2))
else {
  console.log(`강의 ${out.lectures} · 문장 가리킴 ${out.cuesWithSentence} · 골격 없음 ${out.noSkeleton}`)
  console.log(`범위 밖 ${out.outOfRange.length} · 정답 근거 큐가 정답 앵커를 안 가리킴 ${out.answerCueMiss.length}`)
  for (const x of out.outOfRange.slice(0, 15)) console.log('  범위 밖', x)
  for (const x of out.answerCueMiss.slice(0, 15)) console.log('  정답 어긋남', x)
}
