// apps/web/scripts/csat-lecture/gate3-input.mts
//
// **Gate 3 · 강의 완결성 — 「이 대본만 듣고 설명할 수 있는가」를 재기 위한 입력.**
//
// 두 단계로 잰다(서로 다른 호출):
//   ① 학습자 역할 — 이 파일이 만든 것만 본다: **지문(학습자 손의 문제지) + 들리는 말 + 켜지는 자리**.
//      정답표도 분석 원고도 없다. 들은 것만으로 정답 근거·오답 배제·함정·첫 십 초 행동·공식을 적는다.
//   ② 심사 역할 — ①의 답을 정답표·분석·지문과 대조해 루브릭 항목별로 0~100.
//
// 출력(커밋 안 되는 작업 폴더 — 지문이 실린다): scripts/csat/lecture-drain/gate3-learner.json
//
//   npx tsx scripts/csat-lecture/gate3-input.mts

import fs from 'node:fs'
import path from 'node:path'

import type { Lecture, LectureExamFile } from '../../src/lib/csat/lecture/types'
import { DATA, readJson, WORK, writeJson } from './env.mts'

const CHUNK = 'pilot'
const chunk = readJson<{ items: any[] }>(path.join(WORK, `chunk-${CHUNK}.json`), { items: [] })

const CIRCLED = ['', '①', '②', '③', '④', '⑤']
const ORD = ['첫', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉', '열', '열한', '열두', '열세']

function screen(t: { kind: string; id: string }): string {
  if (t.kind === 'anchor') return `지문 ${ORD[Number(t.id.split(':')[1])] ?? '?'} 번째 문장 막대`
  if (t.id.startsWith('reject:')) return `${CIRCLED[Number(t.id.split(':')[1])]} 선지 설명 칸`
  return (
    {
      head: '문항 머리',
      ability: '「재는 것」 줄',
      intent: '「출제 의도」 칸',
      map: '지문 지도 전체',
      answer: '정답 설명 칸',
      procedure: '「다시 풀 때의 순서」 칸',
      vocab: '「요구 낱말」 칸',
    } as Record<string, string>
  )[t.id] ?? t.id
}

const items = chunk.items.map((it) => {
  const exam = it.id.split('#')[0]
  const file = readJson<LectureExamFile | null>(path.join(DATA, `${exam}.json`), null)
  const lec = file?.lectures[it.id] as Lecture | undefined
  if (!lec) throw new Error(`강의가 없다: ${it.id}`)
  return {
    id: it.id,
    type: it.type_name,
    stem: it.source.stem,
    choices: it.source.choices,
    passage: it.source.sentences.map((s: { k: number; text: string }) => ({ n: s.k + 1, text: s.text })),
    heard: lec.cues.map((c, i) => ({
      n: i + 1,
      screen: screen(c.target),
      speech: c.segments.map((g) => g.text).join(' '),
    })),
  }
})

const out = path.join(WORK, 'gate3-learner.json')
writeJson(out, {
  note: '학습자에게 주어지는 것: 문제지(지문·문두·선지) + 강의에서 들리는 말 + 그때 화면에서 켜지는 자리. 정답표·분석 원고는 없다.',
  items,
})
console.log(`${items.length}문항 → ${path.relative(process.cwd(), out)}`)
fs.existsSync(out)
