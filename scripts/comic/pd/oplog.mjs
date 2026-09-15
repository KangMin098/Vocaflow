// scripts/comic/pd/oplog.mjs
//
// 자기발전 타임라인(오퍼레이터 루프 로그) — PDCP 의 "시도 → 단계별 평가 → 평가 기반 자기발전" 흐름을
// 하나의 append-only 로그(work/_oplog.jsonl)에 쌓는다. Claude Code 오퍼레이터가 각 실험/판정 때마다
// 한 줄을 append → Admin 모니터가 콘텐츠별 타임라인으로 한눈에 렌더(모니터링).
//
// 스텝 스키마(한 줄 = 한 자기발전 이벤트):
//   { ts, slug, content, phase, action, title, detail, verdict, next }
//   action: 'evaluate' | 'adopt' | 'reject' | 'improve' | 'pivot' | 'note'
//
// 사용(CLI):
//   node scripts/comic/pd/oplog.mjs --slug whiz --content "Whiz Comics #2" \
//     --phase webtoon --action improve --title "화이트포인트 정규화 추가" \
//     --detail "크림 종이 잔존 → colorlevels 로 순백" --verdict "확연히 개선" --next "레터링 현대화"
//
// 프로그램:  import { appendStep } from './oplog.mjs'; appendStep({...})

import fs from 'node:fs'
import path from 'node:path'

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const REPO = path.resolve(HERE, '..', '..', '..')
export const OPLOG = path.join(REPO, 'work', '_oplog.jsonl')

const ACTIONS = new Set(['evaluate', 'adopt', 'reject', 'improve', 'pivot', 'note'])

// ts 는 호출자가 넘기거나(결정론), 없으면 파일 mtime 기반 단조 증가값을 쓴다(스크립트 환경 Date 제약 회피).
export function appendStep(step) {
  if (!step || !step.slug || !step.action) throw new Error('appendStep: slug·action 필수')
  if (!ACTIONS.has(step.action)) throw new Error(`appendStep: action 은 ${[...ACTIONS].join('|')} 중 하나`)
  fs.mkdirSync(path.dirname(OPLOG), { recursive: true })
  const seq = fs.existsSync(OPLOG) ? fs.readFileSync(OPLOG, 'utf8').split('\n').filter(Boolean).length : 0
  const entry = {
    seq,
    ts: step.ts ?? null, // ISO 문자열(있으면). 없으면 순번(seq)으로 정렬.
    slug: step.slug,
    content: step.content ?? step.slug,
    phase: step.phase ?? 'general',
    action: step.action,
    title: step.title ?? '',
    detail: step.detail ?? '',
    verdict: step.verdict ?? null,
    next: step.next ?? null,
  }
  fs.appendFileSync(OPLOG, JSON.stringify(entry) + '\n', 'utf8')
  return entry
}

export function readSteps(slug = null) {
  if (!fs.existsSync(OPLOG)) return []
  const all = fs.readFileSync(OPLOG, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
  return slug ? all.filter((s) => s.slug === slug) : all
}

// CLI
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(HERE, 'oplog.mjs')
if (isMain) {
  const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? d : process.argv[i + 1] }
  if (process.argv.includes('--list')) {
    const rows = readSteps(arg('slug', null))
    for (const r of rows) console.log(`#${r.seq} [${r.slug}/${r.phase}] ${r.action.toUpperCase()} — ${r.title}${r.verdict ? ` · ${r.verdict}` : ''}`)
    console.log(`\n총 ${rows.length} 스텝 · ${OPLOG}`)
  } else {
    const e = appendStep({
      slug: arg('slug'), content: arg('content'), phase: arg('phase'), action: arg('action'),
      title: arg('title'), detail: arg('detail'), verdict: arg('verdict', null), next: arg('next', null), ts: arg('ts', null),
    })
    console.log(`✓ oplog #${e.seq} [${e.slug}/${e.phase}] ${e.action}: ${e.title}`)
  }
}
