#!/usr/bin/env node
// scripts/csat/lecture-ordinal-fix.mjs
//
// 강의 낭독 서수 ↔ cue target 불일치(F4b) 교정 **후보** 생성기. 원본 lecture-data 는 읽기만 한다.
//
//   node scripts/csat/lecture-ordinal-fix.mjs --out <폴더> [--data <lecture-data 폴더>] [--skeleton <skeleton-data 폴더>]
//
// 출력(--out 폴더에만 쓴다 — 저장소 안 lecture-data 경로는 거부):
//   ordinal-fix.candidates.json — 자동 교정 후보(B: 「여기 N」 = target k, 곧 낭독이 1 작음) cue 별 before/after
//   ordinal-fix.manual.json     — 수동 대조 대상(A: 문장 분할 차이 의심 회차 · 차이 ≠ −1 · 서수 여럿 · 범위 밖 등)
//   ordinal-fix.summary.md      — 회차별 집계 + diff 요약
//
// 규칙: anchor cue(`sentence:k`, 0부터)의 ko-KR 낭독에서 「여기 N(번째)? 문장」을 찾는다(N 은 1부터, 1~49).
//   N ≠ k+1 인 cue 만 대상. N === k(차이 −1)이고 「여기」 서수가 하나뿐이며 분할 의심 문항이 아니고
//   k 가 문지도 범위 안이면 자동 후보 — 낭독 수사를 k+1 로 바꾼다(target 은 건드리지 않는다).
//   「여기」 없는 서수는 보조 언급(오탐)이 많아 세지 않는다(F4b §3-3).
// anchor cue 는 `focus` 를 싣지 않으므로(focus.ts cueFocus: analysis 타깃만) 교정 뒤 focus 재계산 대상이 없다.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const UNIT = { 한: 1, 두: 2, 세: 3, 네: 4, 다섯: 5, 여섯: 6, 일곱: 7, 여덟: 8, 아홉: 9 }
export const ORDINALS = (() => {
  const out = { 첫: 1, 두: 2, 세: 3, 네: 4, 다섯: 5, 여섯: 6, 일곱: 7, 여덟: 8, 아홉: 9, 열: 10, 스무: 20, 서른: 30, 마흔: 40 }
  for (const [tens, base] of [['열', 10], ['스물', 20], ['서른', 30], ['마흔', 40]])
    for (const [u, n] of Object.entries(UNIT)) out[`${tens}${u}`] = base + n
  return out
})()
const WORD_OF = Object.fromEntries(Object.entries(ORDINALS).map(([w, n]) => [n, w]))
const ALT = Object.keys(ORDINALS).sort((a, b) => b.length - a.length).join('|')
const HERE = new RegExp(`(여기[,\\s]*)(${ALT})(\\s*번째)?(\\s*문장)`, 'g')

/** F4b §3-2 — 문지도 분할이 지문과 어긋난 것으로 의심되는 문항(자동 교정 금지, 수동 대조). */
export const SPLIT_SUSPECT = new Set(['2015#34', '2019#28', 'M2106#27', 'M2109#28'])
/** 낡은 분할을 전제로 한 설명 문장 — 서수만 고치면 내용이 틀린 채 남는다(F4b §3-1). */
const STALE = /(한 칸에 붙|뒷부분|한 막대에)/

export function ordinalWord(n) {
  return WORD_OF[n] ?? null
}

/** 「여기 N 문장」 전부 → [{ n, index, text }] */
export function hereOrdinals(ko) {
  return [...ko.matchAll(HERE)].map((m) => ({ n: ORDINALS[m[2]], index: m.index, text: m[0] }))
}

/** 낭독 한 덩이에서 「여기 from」 을 「여기 to」 로. 「첫 문장」 처럼 번째가 없던 곳은 「두 번째 문장」 으로(「두 문장」은 개수로 들린다). */
export function rewriteHere(text, from, to) {
  const w = ordinalWord(to)
  if (!w) return null
  let hits = 0
  const out = text.replace(HERE, (all, here, word, nth, tail) => {
    if (ORDINALS[word] !== from) return all
    hits += 1
    return `${here}${w}${nth ?? ' 번째'}${tail}`
  })
  return hits ? out : null
}

/**
 * cue 하나 판정. 반환 null = 대상 아님.
 * { kind: 'auto' | 'manual', reason, k, spoken, after? }
 */
export function judgeCue(itemId, cue, sentenceCount) {
  if (cue?.target?.kind !== 'anchor') return null
  const k = Number(String(cue.target.id).split(':')[1])
  if (!Number.isInteger(k)) return null
  const ko = (cue.segments ?? []).filter((g) => g.lang === 'ko-KR').map((g) => g.text).join(' ')
  const spoken = [...new Set(hereOrdinals(ko).map((h) => h.n))]
  if (!spoken.length || spoken.includes(k + 1)) return null
  const base = { k, spoken }
  if (SPLIT_SUSPECT.has(itemId)) return { kind: 'manual', reason: 'split-suspect', ...base }
  if (spoken.length > 1) return { kind: 'manual', reason: 'multi-ordinal', ...base }
  if (spoken[0] !== k) return { kind: 'manual', reason: `diff ${spoken[0] - (k + 1)}`, ...base }
  if (sentenceCount == null) return { kind: 'manual', reason: 'no-skeleton', ...base }
  if (k >= sentenceCount) return { kind: 'manual', reason: 'target-out-of-range', ...base }
  const segments = cue.segments.map((g) => (g.lang === 'ko-KR' ? { ...g, text: rewriteHere(g.text, k, k + 1) ?? g.text } : g))
  const stale = STALE.test(ko)
  return { kind: 'auto', reason: stale ? 'ordinal+stale-text-review' : 'ordinal', ...base, after: segments }
}

export function scan(lectureFiles, skeletonCounts) {
  const auto = []
  const manual = []
  let anchorCues = 0
  for (const { file, data } of lectureFiles) {
    for (const [id, lec] of Object.entries(data.lectures ?? {})) {
      for (const cue of lec.cues ?? []) {
        if (cue?.target?.kind === 'anchor') anchorCues += 1
        const j = judgeCue(id, cue, skeletonCounts.get(id) ?? null)
        if (!j) continue
        const row = { file, item_id: id, version: lec.version ?? null, cue: cue.id, target: `${cue.target.kind}:${cue.target.id}`, ...j }
        if (j.kind === 'auto') {
          row.before = cue.segments.filter((g) => g.lang === 'ko-KR').map((g) => g.text)
          row.after = j.after.filter((g) => g.lang === 'ko-KR').map((g) => g.text)
          row.segments_after = j.after
          delete row.kind
          auto.push(row)
        } else {
          delete row.kind
          manual.push(row)
        }
      }
    }
  }
  return { anchorCues, auto, manual }
}

function loadDir(dir) {
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'index.json').sort()
    .map((f) => ({ file: f, data: JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) }))
}

function skeletonCounts(dir) {
  const m = new Map()
  if (!fs.existsSync(dir)) return m
  for (const { data } of loadDir(dir)) for (const it of data.items ?? []) m.set(it.id, (it.sentences ?? []).length)
  return m
}

function main(argv) {
  const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined }
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
  const data = path.resolve(arg('--data') ?? path.join(root, 'apps/web/src/lib/csat/lecture-data'))
  const skel = path.resolve(arg('--skeleton') ?? path.join(root, 'apps/web/src/lib/csat/skeleton-data'))
  const out = arg('--out')
  if (!out) { console.error('사용: node scripts/csat/lecture-ordinal-fix.mjs --out <폴더> [--data <dir>] [--skeleton <dir>]'); process.exit(2) }
  const outDir = path.resolve(out)
  if (outDir === data || outDir.startsWith(data + path.sep) || outDir.includes(`${path.sep}lecture-data`)) {
    console.error('거부: --out 이 강의 원본 폴더 안이다 — 원본은 덮어쓰지 않는다'); process.exit(2)
  }
  const res = scan(loadDir(data), skeletonCounts(skel))
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, 'ordinal-fix.candidates.json'), JSON.stringify({ schema: 'csat-lecture-ordinal-fix/v1', source: data, rule: '여기 N = target k → 여기 k+1', candidates: res.auto }, null, 1) + '\n')
  fs.writeFileSync(path.join(outDir, 'ordinal-fix.manual.json'), JSON.stringify({ schema: 'csat-lecture-ordinal-fix/v1', manual: res.manual }, null, 1) + '\n')
  const byFile = {}
  for (const r of res.auto) byFile[r.file] = (byFile[r.file] ?? 0) + 1
  const reasons = {}
  for (const r of res.manual) reasons[r.reason] = (reasons[r.reason] ?? 0) + 1
  const stale = res.auto.filter((r) => r.reason !== 'ordinal').length
  const md = [
    `# 강의 서수 교정 후보 (dry-run)`, '',
    `- anchor cue ${res.anchorCues} · 자동 후보 ${res.auto.length}(설명 문장 재검토 표시 ${stale}) · 수동 ${res.manual.length} · 강의 ${new Set(res.auto.map((r) => r.item_id)).size}편`,
    `- 수동 사유: ${Object.entries(reasons).map(([k, v]) => `${k} ${v}`).join(' · ') || '없음'}`, '',
    '| 회차 | 자동 후보 |', '|---|---|', ...Object.entries(byFile).map(([f, n]) => `| ${f} | ${n} |`), '',
    '## diff (낭독만, target 불변)', '',
    ...res.auto.map((r) => `- ${r.item_id} ${r.cue} ${r.target}: 「여기 ${r.spoken[0]}」→「여기 ${r.k + 1}」${r.reason !== 'ordinal' ? ' ⚠ 설명 문장 재검토' : ''}`),
  ].join('\n') + '\n'
  fs.writeFileSync(path.join(outDir, 'ordinal-fix.summary.md'), md)
  console.log(JSON.stringify({ anchorCues: res.anchorCues, auto: res.auto.length, staleReview: stale, manual: res.manual.length, manualReasons: reasons, out: outDir }))
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2))
