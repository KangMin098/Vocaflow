// apps/web/scripts/csat-lecture/backfill-focus.mts
//
// **적재된 강의에 `focus`(말한 문장 번호)를 채운다.** `focus` 가 생기기 전에 적재된 강의가 대상이다.
// 이후 적재는 drain-import 가 같은 함수(`withFocus`)로 채우므로, 이 스크립트는 한 번이면 되지만
// **몇 번 돌려도 결과가 같다**(값을 다시 계산해 덮는다 — 재실행 안전).
//
// 막대 수는 적재·최종 검사(`final-checks.mts`)와 **같은 규칙**으로 정한다 — 골격에 위치가 잡힌 앵커가
// 있고, 골격의 문장 수가 지금 지문을 자른 수와 같을 때만 지도가 강의 대상이 된다. 규칙이 다르면
// 검사의 `focus` 항목이 어긋난다. 그래서 지문을 DB 에서 읽는다(읽기만 한다).
//
// 대본 문장은 한 글자도 바꾸지 않는다. 버전·점수도 그대로 둔다(말은 그대로이고 화면만 맞춘다).
//
//   npx tsx scripts/csat-lecture/backfill-focus.mts            (검사만 — 바뀔 큐 수)
//   npx tsx scripts/csat-lecture/backfill-focus.mts --commit   (파일에 쓴다)

import fs from 'node:fs'
import path from 'node:path'

import { litForCue, withFocus } from '../../src/lib/csat/lecture/focus'
import type { LectureExamFile } from '../../src/lib/csat/lecture/types'
import { splitSentences } from '../../src/lib/csat/passage-skeleton'
import { loadItemSkeleton } from '../../src/lib/csat/skeleton'
import { DATA, flag, readJson, serviceDb, writeJson } from './env.mts'

const COMMIT = flag('commit')
const db = await serviceDb()

const fileNames = fs.readdirSync(DATA).filter((x) => x.endsWith('.json') && x !== 'index.json').sort()
const exams = fileNames.map((f) => ({ p: path.join(DATA, f), file: readJson<LectureExamFile>(path.join(DATA, f), { exam_id: '', built: '', lectures: {} }) }))
const ids = exams.flatMap((e) => Object.keys(e.file.lectures))

const passage = new Map<string, string | null>()
for (let i = 0; i < ids.length; i += 200) {
  const { data, error } = await db.from('csat_items').select('id, passage').in('id', ids.slice(i, i + 200))
  if (error) throw new Error(error.message)
  for (const r of data ?? []) passage.set(r.id as string, (r.passage as string | null) ?? null)
}

let changedCues = 0
let relit = 0
let files = 0
for (const { p, file } of exams) {
  let dirty = false
  for (const [id, lec] of Object.entries(file.lectures)) {
    const sk = loadItemSkeleton(id)
    const text = passage.get(id)
    const spans = text ? splitSentences(text) : []
    const placed = sk ? sk.anchors.some((a) => a.sentences.length > 0) : false
    const count = sk && placed && sk.sentences.length === spans.length ? sk.sentences.length : 0
    const next = withFocus(lec.cues, count)
    next.forEach((c, i) => {
      if (JSON.stringify(c.focus ?? null) === JSON.stringify(lec.cues[i].focus ?? null)) return
      changedCues += 1
      const anchorLit = sk?.anchors.find((a) => a.id === c.target.id)?.sentences ?? []
      if (JSON.stringify(litForCue(anchorLit, c.focus)) !== JSON.stringify(anchorLit)) relit += 1
      dirty = true
    })
    lec.cues = next
  }
  if (dirty) {
    files += 1
    if (COMMIT) writeJson(p, file)
  }
}
console.log(`강의 ${ids.length} · focus 가 바뀌는 큐 ${changedCues} · 그중 켜지는 막대가 달라지는 큐 ${relit} · 파일 ${files}${COMMIT ? ' (적용)' : ' (검사만)'}`)
