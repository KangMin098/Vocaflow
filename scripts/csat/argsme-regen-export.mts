// scripts/csat/argsme-regen-export.mts
//
// **재생성 작업 파일 내보내기** — 게이트에 걸린 항목만 원문과 함께 묶는다.
//
// ── 왜 따로 내보내는가 ────────────────────────────────────────────────
// `chunk-NNN.out.json` 은 산출물만 담고 원문을 안 담는다(원문은 87개 입력 청크에 흩어져
// 있고, export 가 두 번 다른 경계로 돌아 out-NNN ↔ in-NNN 이 짝이 아니다).
// 재생성하는 쪽이 87개 파일을 뒤지게 두면 **엉뚱한 원문을 읽고 쓰는 사고**가 난다 —
// 이 저장소에서 배열 밀림이 6번 났던 것과 같은 자리다.
// 그래서 id → 원문을 **여기서 한 번만** 붙이고, 짝은 sha256 으로 묶는다.
//
// 재실행 안전: 입력을 읽고 작업 파일만 새로 쓴다. `.out.json` 은 건드리지 않는다.
//
// 사용:
//   pnpm exec tsx scripts/csat/argsme-regen-export.mts
//   pnpm exec tsx scripts/csat/argsme-regen-export.mts --all   # 통과한 것까지 전부

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

const DIR = 'scripts/csat/argsme-drain'
const OUT = join(DIR, 'regen')
const ALL = process.argv.includes('--all')

mkdirSync(OUT, { recursive: true })

// 게이트를 직접 돌려 판정을 받는다 — 판정 로직을 여기서 복제하면 두 자가 갈린다.
const gate = JSON.parse(
  (() => {
    const tmp = join(OUT, '.gate.json')
    execFileSync('pnpm', ['exec', 'tsx', 'scripts/csat/argsme-gate.mts', '--json', tmp], {
      stdio: ['ignore', 'ignore', 'inherit'], shell: process.platform === 'win32',
    })
    return readFileSync(tmp, 'utf8')
  })(),
) as { rows: { chunk: string; id: string; verdict: string; fails: string[] }[] }

const failByChunk = new Map<string, Set<string>>()
for (const r of gate.rows) {
  if (r.verdict !== 'write') continue
  if (!ALL && !r.fails.length) continue
  if (!failByChunk.has(r.chunk)) failByChunk.set(r.chunk, new Set())
  failByChunk.get(r.chunk)!.add(r.id)
}

/** id → 원문. 입력 청크 전체를 한 번 훑는다. */
const SRC = new Map<string, { sha: string; text: string; topic: string; url: string }>()
for (const f of readdirSync(DIR).filter((x) => /^chunk-\d+\.json$/.test(x)).sort()) {
  const j = JSON.parse(readFileSync(join(DIR, f), 'utf8'))
  for (const it of j.items ?? []) {
    SRC.set(String(it.id), {
      sha: String(it.sha256),
      text: String(it.text ?? ''),
      topic: String(it.topic ?? ''),
      url: String(it.source_url ?? ''),
    })
  }
}

let total = 0
const written: string[] = []
for (const f of readdirSync(DIR).filter((x) => x.endsWith('.out.json')).sort()) {
  const chunk = f.slice(6, 9)
  const want = failByChunk.get(chunk)
  if (!want?.size) continue
  const out = JSON.parse(readFileSync(join(DIR, f), 'utf8'))

  const tasks: Record<string, unknown>[] = []
  for (const it of out.items ?? []) {
    if (!want.has(String(it.id))) continue
    const src = SRC.get(String(it.id))
    if (!src) throw new Error(`원문을 못 찾았다: ${it.id}`)
    // ⚠️ sha256 이 어긋나면 **멈춘다.** 조용히 넘기면 엉뚱한 원문으로 다시 쓴다.
    if (src.sha !== String(it.sha256)) throw new Error(`sha256 불일치: ${it.id}`)
    tasks.push({
      id: it.id,
      sha256: it.sha256,
      source_topic: src.topic,
      source_url: src.url,
      source_text: src.text,
      previous_passage: it.passage ?? '',
      previous_topic_ko: it.topic_ko ?? '',
    })
  }

  const path = join(OUT, `chunk-${chunk}.task.json`)
  writeFileSync(
    path,
    JSON.stringify({ contract: 'argsme-textbook/v1.regen', chunk, count: tasks.length, items: tasks }, null, 2),
  )
  written.push(`${path}  ${tasks.length}편`)
  total += tasks.length
}

console.log(`\n재생성 작업 파일 ${written.length}개 · 합계 ${total}편`)
for (const w of written) console.log('  ' + w)
