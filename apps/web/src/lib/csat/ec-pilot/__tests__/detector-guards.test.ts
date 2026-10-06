// apps/web/src/lib/csat/ec-pilot/__tests__/detector-guards.test.ts
//
// G4 경계 감지기 정적 가드 — 아래 중 하나라도 생기면 실패한다. 가드마다 일부러 깬 입력에서 실제로 실패하는지(무력하지 않은지)도 함께 본다.
//   ① 경계 쌍 · probe 키 하드코딩(앱 코드 · 감지기 SQL — 정의 파일 probes.ts · 테스트 · seed 제외)
//   ② 감지기 함수 본문이 정오 · 정답 · 채점 · 판정 · AI 표를 읽음
//   ③ 감지기 본문이 실행 기록 · 신호 · 취소 표 밖에 씀(판정 · 원인 claim · 학습 지도 · 숙달)
//   ④ 감지기 본문에 학생 범주 · 원인 코드 리터럴(범주 집합은 csat_ec_code.student_group 에서만 온다)
//   ⑤ 클라이언트(브라우저) 코드가 감지 로직 · 서버 모듈을 값으로 import 하거나 감지 RPC · 표 이름을 씀
//   ⑥ probe 경로(대기 · 응답 · 증거 저장 라우트 · 서버 모듈)가 정오에 조건
//   ⑦ 봉인 seed 의 provisional 경계 probe_key 마다 저장소 probe 정의가 있다
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { PROBE_DEFINITIONS } from '../probes'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '../../../../../../..')
const WEB_SRC = path.join(REPO, 'apps/web/src')
const MIGRATION = path.join(REPO, 'supabase/migrations/20261006120000_csat_ec_boundary_detector.sql')
const SEED = path.join(REPO, 'docs/csat-learner/codebook/data/seed-v0.1-rows.json')
const DETECTOR_FNS = ['csat_ec_detect_boundaries', 'csat_ec_process_evidence_detect', 'csat_ec_detect_boundaries_rerun']

const read = (p: string) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n')
const sqlNoComments = (s: string) => s.split('\n').map((l) => l.replace(/--.*$/, '')).join('\n')
const tsNoComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/(^|\s)\/\/.*$/, '')).join('\n')

/** 마이그레이션에서 이름이 맞는 함수 정의 본문($$ … $$)만 */
function functionBodies(sql: string, names: readonly string[]): string {
  const out: string[] = []
  for (const n of names) {
    const re = new RegExp(`create or replace function public\\.${n}\\([\\s\\S]*?\\$\\$([\\s\\S]*?)\\$\\$`, 'g')
    for (const m of sql.matchAll(re)) out.push(m[1])
  }
  return sqlNoComments(out.join('\n'))
}

const PAIR = /\b[a-z]\.[a-z_]+__[a-z]\.[a-z_]+\b/
function hardcodedPairs(src: string, probeKeys: readonly string[]): string[] {
  const hits: string[] = []
  const m = src.match(PAIR)
  if (m) hits.push(m[0])
  for (const k of probeKeys) if (src.includes(k)) hits.push(k)
  return hits
}

const FORBIDDEN_READ = [/\bis_correct\b/, /\bchosen_option\b/, /\banswer\b/, /\bcsat_items\b/, /\bcsat_dx_response\b/, /\bcsat_dx_snapshot\b/, /\bcsat_dx_answer_key\b/,
  /\bcsat_ec_judgment\b/, /\bcsat_ec_ai_run\b/, /\bcsat_ec_claim\b/, /\bcsat_ec_item_input_hash\b/, /\bcsat_learner_state\b/, /\bcsat_items_public\b/]
function forbiddenReads(body: string): string[] {
  return FORBIDDEN_READ.filter((re) => re.test(body)).map(String)
}

const ALLOWED_WRITES = new Set(['csat_ec_detector_run', 'csat_ec_boundary_signal', 'csat_ec_boundary_signal_retraction'])
function badWrites(body: string): string[] {
  return [...body.matchAll(/\b(?:insert\s+into|update|delete\s+from|truncate)\s+(?:public\.)?(\w+)/gi)].map((m) => m[1]).filter((t) => !ALLOWED_WRITES.has(t))
}

function codeLiterals(body: string): string[] {
  return [...body.matchAll(/'(?:word|sentence|flow|evidence|choice|time)'|'[VSREBX]\.[a-z_]+'/g)].map((m) => m[0])
}

const CLIENT_FORBIDDEN = [/csat_ec_detect/, /csat_ec_add_detector_signal/, /csat_ec_detector_run/, /csat_ec_boundary_signal/, /csat_ec_my_pending_probes/]
function clientViolations(src: string): string[] {
  const hits = CLIENT_FORBIDDEN.filter((re) => re.test(src)).map(String)
  // 서버 모듈은 타입만 가져올 수 있다(값 import 는 감지 · 정오 경로를 번들에 싣는다)
  for (const m of src.matchAll(/import\s+(type\s+)?[^;]*?from\s+['"]([^'"]+)['"]/g)) {
    if (!m[1] && /ec-pilot\/(server|probes|config)$|csat\/diagnosis\/server$/.test(m[2])) hits.push(`value import ${m[2]}`)
  }
  return hits
}

const CORRECTNESS = [/is_correct/, /isCorrect/, /csat_dx_answer_key/, /scoreAnswers/, /\bcorrectControls\b/, /select\([^)]*\banswer\b/]
function correctnessRefs(src: string): string[] {
  return CORRECTNESS.filter((re) => re.test(src)).map(String)
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== '__tests__') walk(p, acc) }
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) acc.push(p)
  }
  return acc
}

const migration = read(MIGRATION)
const body = functionBodies(migration, DETECTOR_FNS)
const probeKeys = PROBE_DEFINITIONS.map((d) => d.key)

describe('G4 감지기 — 정적 가드', () => {
  it('감지기 함수 본문 3개를 찾는다(가드가 빈 문자열을 검사하지 않게)', () => {
    for (const n of DETECTOR_FNS) expect(migration).toContain(`create or replace function public.${n}(`)
    expect(body.length).toBeGreaterThan(2000)
  })

  it('① 감지기 SQL 에 경계 쌍 · probe 키 하드코딩 없음', () => {
    expect(hardcodedPairs(sqlNoComments(migration), probeKeys)).toEqual([])
  })

  it('① 앱 코드(probes.ts · 테스트 제외)에 경계 쌍 · probe 키 하드코딩 없음', () => {
    const hits = walk(WEB_SRC).filter((f) => !f.endsWith(path.join('ec-pilot', 'probes.ts')))
      .flatMap((f) => hardcodedPairs(tsNoComments(read(f)), probeKeys).map((h) => `${path.relative(REPO, f)}: ${h}`))
    expect(hits).toEqual([])
  })

  it('② 감지기 본문이 정오 · 정답 · 채점 · 판정 · AI · 숙달 표를 읽지 않는다', () => {
    expect(forbiddenReads(body)).toEqual([])
  })

  it('③ 감지기 본문은 실행 기록 · 신호 · 취소 표에만 쓴다', () => {
    expect(badWrites(body)).toEqual([])
  })

  it('④ 감지기 본문에 학생 범주 · 원인 코드 리터럴 없음', () => {
    expect(codeLiterals(body)).toEqual([])
  })

  it('⑤ 클라이언트 코드가 감지 로직 · 서버 모듈을 값으로 쓰지 않는다', () => {
    const client = walk(WEB_SRC).filter((f) => /^\s*['"]use client['"]/m.test(read(f).slice(0, 300)) || f.includes(`${path.sep}components${path.sep}`))
    expect(client.length).toBeGreaterThan(10)
    const hits = client.flatMap((f) => clientViolations(tsNoComments(read(f))).map((h) => `${path.relative(REPO, f)}: ${h}`))
    expect(hits).toEqual([])
  })

  it('⑥ probe 경로(대기 · 응답 · 증거 라우트 · 서버 모듈 · probe 정의)가 정오를 보지 않는다', () => {
    const files = ['app/api/csat/ec/probes/route.ts', 'app/api/csat/ec/probe/route.ts', 'app/api/csat/ec/evidence/route.ts', 'lib/csat/ec-pilot/server.ts', 'lib/csat/ec-pilot/probes.ts']
    const hits = files.flatMap((f) => correctnessRefs(tsNoComments(read(path.join(WEB_SRC, f)))).map((h) => `${f}: ${h}`))
    expect(hits).toEqual([])
  })

  it('⑦ 봉인 seed 의 provisional 경계 probe 마다 저장소 정의가 있다', () => {
    const seed = JSON.parse(read(SEED)) as { boundaries: { status: string; probe_key: string | null }[] }
    const need = seed.boundaries.filter((b) => b.status === 'provisional' && b.probe_key).map((b) => b.probe_key as string)
    expect(need.length).toBeGreaterThan(0)
    expect(need.filter((k) => !probeKeys.includes(k))).toEqual([])
  })
})

describe('G4 감지기 — 가드가 무력하지 않다(일부러 깬 입력에서 실패)', () => {
  it('① 쌍 · probe 키 리터럴을 넣으면 걸린다', () => {
    expect(hardcodedPairs(`${body}\n if x = 'r.inference__v.wrong_sense' then`, probeKeys)).not.toEqual([])
    expect(hardcodedPairs(`const k = '${probeKeys[0]}'`, probeKeys)).not.toEqual([])
  })
  it('② 정오 · 정답을 읽으면 걸린다', () => {
    expect(forbiddenReads(`${body}\n select r.is_correct from public.csat_dx_response r;`)).not.toEqual([])
    expect(forbiddenReads(`${body}\n select i.answer from public.csat_items i;`)).not.toEqual([])
  })
  it('②/⑥ probe 요구가 정오에 조건이면 걸린다', () => {
    expect(forbiddenReads(body.replace('coalesce(k = v_probe, false)', 'coalesce(k = v_probe and not r.is_correct, false)'))).not.toEqual([])
    expect(correctnessRefs(`if (!row.is_correct) probes.push(p)`)).not.toEqual([])
  })
  it('③ 판정 · claim · 숙달 표에 쓰면 걸린다', () => {
    expect(badWrites(`${body}\n insert into public.csat_ec_judgment (x) values (1);`)).toEqual(['csat_ec_judgment'])
    expect(badWrites(`update public.csat_learner_state set record = '{}'`)).toEqual(['csat_learner_state'])
    expect(badWrites(`insert into public.csat_ec_claim (code) values ('V.x')`)).toEqual(['csat_ec_claim'])
  })
  it('④ 범주 · 코드 리터럴을 넣으면 걸린다', () => {
    expect(codeLiterals(`${body}\n if v_group = 'word' then`)).not.toEqual([])
    expect(codeLiterals(`where code = 'V.wrong_sense'`)).not.toEqual([])
  })
  it('⑤ 클라이언트가 서버 모듈 값 import · 감지 RPC 를 쓰면 걸린다', () => {
    expect(clientViolations(`import { pendingProbes } from '@/lib/csat/ec-pilot/server'`)).not.toEqual([])
    expect(clientViolations(`supabase.rpc('csat_ec_detect_boundaries_rerun', {})`)).not.toEqual([])
    expect(clientViolations(`import type { PendingProbe } from '@/lib/csat/ec-pilot/server'`)).toEqual([])
  })
})
