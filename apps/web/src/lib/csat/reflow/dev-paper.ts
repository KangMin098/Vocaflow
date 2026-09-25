// apps/web/src/lib/csat/reflow/dev-paper.ts
//
// **개발 기간 전용 — 로컬 기출 문제지 PDF 를 회차 id 로 찾는다.** (서버 전용 · 2026-09-25 사용자 지시)
//
// 개발 중에는 `/csat/item/*` 왼쪽 열(기출문제 원본)을 매번 손으로 놓지 않게, 이 PC 에 있는
// 문제지를 기본으로 읽어 온다. 배포(학습자)에서는 **꺼진다** — 학습자는 본인이 받은 PDF 를 놓는다
// (저작권 경계 · DECISIONS D15). 켜지는 조건은 `devPaperEnabled()` 하나다.
//
// 폴더는 `CSAT_LOCAL_PAPER_DIRS`(`;` 로 구분)로 바꿀 수 있다. 기본값은 저장소 주인 PC 의 위치다.
// 파일은 저장소에 들어가지 않는다 — 경로만 안다.

import fs from 'node:fs'
import path from 'node:path'

const DEFAULT_DIRS = [
  'C:/Users/Administrator/Documents/영어/수능영어기출/수능기출',
  'C:/Users/Administrator/Documents/영어/모의평가',
]

/** 개발 서버에서만 켠다. 프로덕션 빌드에서는 어떤 경우에도 false. */
export function devPaperEnabled(): boolean {
  return process.env.NODE_ENV === 'development' && process.env.CSAT_LOCAL_PAPERS !== 'off'
}

function dirs(): string[] {
  const env = process.env.CSAT_LOCAL_PAPER_DIRS
  return (env ? env.split(';') : DEFAULT_DIRS).map((d) => d.trim()).filter(Boolean)
}

/**
 * 회차 id → 파일 이름 판정. 정답표는 뺀다.
 *   수능 `2026` → `2026_…영어…pdf` · `2014A`/`2014B` → `2014_영어A…` / `2014_영어B…`
 *   모의평가 `M2706` → `202706_영어영역_문제지.pdf`
 */
export function matchesExam(examId: string, file: string): boolean {
  if (!file.toLowerCase().endsWith('.pdf') || file.includes('정답')) return false
  const mock = examId.match(/^M(\d{2})(\d{2})$/)
  if (mock) return file.startsWith(`20${mock[1]}${mock[2]}_`)
  const ab = examId.match(/^(\d{4})([AB])$/)
  if (ab) return file.startsWith(`${ab[1]}_`) && file.includes(`영어${ab[2]}`)
  return /^\d{4}$/.test(examId) && file.startsWith(`${examId}_`) && file.includes('영어')
}

/** 그 회차의 로컬 문제지 경로 — 없거나 개발 모드가 아니면 null */
export function localPaperPath(examId: string): string | null {
  if (!devPaperEnabled() || !/^(M\d{4}|\d{4}[AB]?)$/.test(examId)) return null
  for (const dir of dirs()) {
    let files: string[]
    try {
      files = fs.readdirSync(dir)
    } catch {
      continue
    }
    const hit = files.find((f) => matchesExam(examId, f))
    if (hit) return path.join(dir, hit)
  }
  return null
}
