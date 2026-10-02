// scripts/csat/lib-drain-select.mjs
//
// **분석 드레인 — 적재·검사할 `.out.json` 고르기.** 적재기와 검수 게이트가 이 함수 하나로 목록을 만든다.
//
// 왜 한 곳인가: 적재기는 폴더 전체를 읽고, 게이트는 `--chunk` 조각으로 골라 보면 **검사한 것과 올린 것이
// 달라진다.** 2026-09-28 교정 4건을 올리려는데 폴더에 남은 wave-2(틀로 찍어 적재 안 하기로 한) 결과가
// 게이트를 막았다 — 그걸 피하려고 게이트만 좁히면, 좁힌 게이트를 통과한 뒤 적재기가 wave-2 까지 올린다.
//
// 두 가지 모드:
//   · strict(적재용) — `--chunk a,b` 는 **정확한 이름**만. 없는 청크·빈 선택·경로 조각은 오류로 끝낸다.
//     폴더 전체로 넘어가지 않는다(선택이 조용히 "전부" 가 되면 이 옵션을 만든 이유가 사라진다).
//   · loose(분석 에이전트의 자기 점검용) — 예전처럼 파일 이름 조각으로 고른다. 게이트 판정에는 안 쓴다.
//
// 이름 형태는 셋 다 받는다: `revise-20260928` · `chunk-revise-20260928` · `chunk-revise-20260928.out.json`.

import fs from 'node:fs'
import path from 'node:path'

/** Missing work may only be supplied by a successor, never by an older result. */
export function replacesOutput(workDir, successor, previous) {
  if (!successor || !previous || successor === previous) return false
  const links = (file) => {
    const inputPath = path.join(workDir, file.replace(/\.out\.json$/, '.json'))
    if (!fs.existsSync(inputPath)) return null
    const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'))
    return Array.isArray(input.supersedes) ? input.supersedes : null
  }
  const next = links(successor)
  const old = links(previous)
  if (old?.includes(successor)) return false
  if (next !== null) return next.includes(previous)
  return old === null && successor > previous
}

/** Choose once, before content filtering, using explicit replacement links when available. */
export function analysisWinners(workDir, files) {
  const parsed = new Map()
  const replaces = new Map()
  for (const file of files) {
    try { parsed.set(file, JSON.parse(fs.readFileSync(path.join(workDir, file), 'utf8'))) } catch { continue }
    const inputPath = path.join(workDir, file.replace(/\.out\.json$/, '.json'))
    if (!fs.existsSync(inputPath)) continue
    const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'))
    replaces.set(file, new Set(Array.isArray(input.supersedes) ? input.supersedes : []))
  }
  const winner = new Map()
  for (const file of files) for (const a of parsed.get(file)?.analyses ?? []) {
    if (!a.item_id) continue
    const previous = winner.get(a.item_id)
    if (previous && replaces.get(previous)?.has(file) && !replaces.get(file)?.has(previous)) continue
    winner.set(a.item_id, file)
  }
  return winner
}

export class DrainSelectError extends Error {}

/** argv 에서 `--chunk` 값들을 모은다(여러 번 · 쉼표 목록 둘 다). 없으면 null. */
export function chunkArgs(argv) {
  const out = []
  let seen = false
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] !== '--chunk') continue
    seen = true
    const v = argv[i + 1]
    if (v === undefined || v.startsWith('--')) throw new DrainSelectError('--chunk 뒤에 청크 이름이 없다')
    out.push(...v.split(',').map((s) => s.trim()))
  }
  return seen ? out : null
}

const fileNameOf = (name) => {
  const base = name.replace(/\.out\.json$/, '').replace(/^chunk-/, '')
  return `chunk-${base}.out.json`
}

/**
 * @param {string} workDir
 * @param {string[] | null} chunks  chunkArgs() 결과. null 이면 폴더 전체.
 * @param {{ loose?: boolean }} [opts]
 * @returns {string[]} 정렬된 파일 이름(디렉터리 없이)
 */
export function selectOutFiles(workDir, chunks, opts = {}) {
  const all = fs.readdirSync(workDir).filter((f) => f.endsWith('.out.json')).sort()
  if (chunks === null) return all
  if (!chunks.length || chunks.some((c) => !c)) throw new DrainSelectError('--chunk 선택이 비었다')
  if (opts.loose) return all.filter((f) => chunks.some((c) => f.includes(c)))

  const picked = new Set()
  for (const c of chunks) {
    // 작업 폴더 밖을 가리키는 이름은 받지 않는다 — 이름만 받고, 경로는 이 함수가 붙인다
    if (/[\\/]|\.\./.test(c) || c.includes(':')) throw new DrainSelectError(`--chunk 는 청크 이름만 받는다(경로 불가): ${c}`)
    const f = fileNameOf(c)
    if (!all.includes(f)) throw new DrainSelectError(`없는 청크: ${c} (${f})`)
    picked.add(f)
  }
  return [...picked].sort()
}
