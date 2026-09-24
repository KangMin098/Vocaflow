// apps/web/src/lib/textbook/source-rounds.ts
//
// **원문 점검 회차 기록을 원천별로 읽는다** — `docs/source-check/round-*.md`(생성: `source-round-report.mjs`).
//
// 회차 결과(원천별 보관 비율 · 이중 판정 κ)는 저장소 문서에만 있어서, 화면은 「이 원천을 지금 대량 판정해도 되나」를
// 말하지 못했다. 이 모듈은 문서의 두 표(§1 판정 분포 · §3 이중 판정 일치도)만 읽는다 — 새로 계산하지 않는다.
//
// ⚠️ 못 읽으면 빈 결과다(0 이 아니라 「기록 없음」으로 화면에 나간다). 표 모양이 바뀌면 회귀가 떨어진다.

import 'server-only'

import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import type { SourceRounds } from './source-pipeline'

/** cwd 가 `apps/web`(next · vitest)이든 뿌리든 같은 폴더를 찾는다. */
function roundsDir(): string | null {
  let dir = process.cwd()
  for (let i = 0; i < 6; i += 1) {
    const cand = resolve(dir, 'docs/source-check')
    try {
      readdirSync(cand)
      return cand
    } catch {
      const up = resolve(dir, '..')
      if (up === dir) break
      dir = up
    }
  }
  return null
}

/** 표 한 절(`## N. …` 부터 다음 `## ` 전까지)의 행을 칸 배열로. */
function tableRows(md: string, heading: RegExp): string[][] {
  const lines = md.split(/\r?\n/)
  const start = lines.findIndex((l) => heading.test(l))
  if (start < 0) return []
  const out: string[][] = []
  for (let i = start + 1; i < lines.length; i += 1) {
    const l = lines[i]!
    if (/^## /.test(l)) break
    if (!l.startsWith('|') || /^\|\s*-/.test(l)) continue
    out.push(l.split('|').slice(1, -1).map((c) => c.trim()))
  }
  return out.slice(1) // 머리글 줄
}

/** 순수 함수 — 회차 문서들(이름 → 본문)을 원천별로 접는다. 테스트가 파일 없이 잰다. */
export function foldRounds(files: { name: string; md: string }[]): Record<string, SourceRounds> {
  const out: Record<string, SourceRounds> = {}
  const get = (s: string) => (out[s] ??= { kappas: [], keepPct: null, keepRound: null })
  // round-1 · round-1-v2 · round-2 … 이름 순서가 곧 회차 순서다.
  const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }))
  for (const f of sorted) {
    const round = f.name.replace(/\.md$/, '')
    for (const c of tableRows(f.md, /^## 1\. 판정 분포/)) {
      const [source, , , , , keepPct] = c
      const p = Number.parseFloat(keepPct ?? '')
      if (source && Number.isFinite(p)) {
        const r = get(source)
        r.keepPct = p
        r.keepRound = round
      }
    }
    for (const c of tableRows(f.md, /^## 3\. 이중 판정 일치도/)) {
      const [source, n, , kappa] = c
      const k = Number.parseFloat(kappa ?? '')
      if (source && Number.isFinite(k)) get(source).kappas.push({ round, n: Number(n) || 0, kappa: k })
    }
  }
  return out
}

export function loadSourceRounds(): { bySource: Record<string, SourceRounds>; nextRound: number } {
  const dir = roundsDir()
  if (!dir) return { bySource: {}, nextRound: 1 }
  const names = readdirSync(dir).filter((n) => /^round-\d+(-[\w]+)?\.md$/.test(n))
  const files = names.map((name) => ({ name, md: readFileSync(resolve(dir, name), 'utf8') }))
  const maxRound = names.reduce((m, n) => Math.max(m, Number(n.match(/^round-(\d+)/)?.[1] ?? 0)), 0)
  return { bySource: foldRounds(files), nextRound: maxRound + 1 }
}
