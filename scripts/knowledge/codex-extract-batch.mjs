// scripts/knowledge/codex-extract-batch.mjs
// 강사 영상 주장 추출을 Codex 에 **묶음 단위**로 맡긴다 — 토큰 효율 · 중단해도 잃지 않기 (2026-10-01).
//
// 왜: 145편을 한 번에 맡긴 실행(2026-10-01)은 약 20만 토큰을 쓰고 사용량 한도에 걸려, 결과를 끝에 몰아 쓰려다
//     형식 없는 중간 판정만 남겼다. 자막을 통째로 출력하며 읽어 로그가 1.2MB 였다.
// 그래서:
//   · 묶음(기본 10편)마다 codex exec 한 번 · 결과는 묶음 파일(claims-chunk-NN.jsonl)로 즉시 남긴다
//   · 묶음이 정상 종료하고 맡긴 영상을 **전부** 판정했을 때만 완료 표시(claims-chunk-NN.done)를 남긴다.
//     완료 표시 없는 묶음은 「판정됨」으로 세지 않고 합치지도 않는다 — 한 영상의 첫 주장만 쓰고 끊긴 묶음이
//     그 영상을 영영 건너뛰게 만들던 문제(Codex 리뷰 2026-10-01)
//   · 판정된 영상(claims.partial.jsonl · 완료된 묶음)은 건너뛴다 — 다시 돌리면 남은 영상부터
//   · 지시문은 짧게: 규칙은 CONTRACT.md 를 가리키기만, 자막은 필요한 구간만 읽고 통째 출력 금지
//   · 사용량 한도 · 일일 예산(CODEX_DAILY_TOKEN_BUDGET, ~/.claude/codex-review/usage.jsonl 공용)에 닿으면 멈춘다
//   · --dry 는 아무 파일도 쓰지 않는다(계획만 출력)
// 사용: node scripts/knowledge/codex-extract-batch.mjs <claims-review 폴더> [--chunk 10] [--effort low] [--dry]
// 회귀: node --test scripts/knowledge/__tests__/codex-extract-batch.test.mjs
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { validateClaim } from './claims-lib.mjs'

const NL = String.fromCharCode(10)

// ── 순수 함수(회귀 대상) ──────────────────────────────────────────

/** 줄 나누기 — CRLF 파일의 끝 \r 이 ID 에 남으면 판정된 영상을 못 알아보고 다시 추출한다. */
export const splitLines = (text) => String(text ?? '').split(/\r?\n/).filter((l) => l.trim() !== '')

/** target-videos.txt → 영상 ID 목록(줄의 첫 탭 앞). */
export const parseTargets = (text) => splitLines(text).map((l) => l.split('\t')[0].trim())

/** jsonl 텍스트 → 객체 목록(깨진 줄은 버린다). */
export const parseJsonl = (text) =>
  splitLines(text).flatMap((l) => {
    try {
      const v = JSON.parse(l)
      return v && typeof v === 'object' ? [v] : []
    } catch {
      return []
    }
  })

/** 깨진 줄(파싱 실패 · 객체 아님)의 수 — 묶음 완료 판정에 쓴다. */
export const countMalformed = (text) =>
  splitLines(text).filter((l) => {
    try {
      const v = JSON.parse(l)
      return !(v && typeof v === 'object' && !Array.isArray(v))
    } catch {
      return true
    }
  }).length

/**
 * 계약 검증(claims-lib.validateClaim)을 통과 못 한 줄의 수. 실행기는 DB 를 읽지 않으니 분류 id 는 **접두사로만**
 * 차원을 정한다(skill: age: proficiency: exam: process: question:) — 존재 확인은 적재기가 DB 분류 축으로 다시 한다.
 * 형식만 맞는 JSON(예: videoId 만 있는 줄)을 완료로 세면 적재기가 거부한 그 영상이 영영 다시 안 뽑힌다(Codex 리뷰).
 */
const PREFIX_DIM = ['skill', 'age', 'proficiency', 'exam', 'process', 'question']
export function countInvalid(claims) {
  const ids = new Set()
  for (const c of claims) for (const k of ['skill', 'audience', 'conditions']) if (Array.isArray(c?.[k])) for (const id of c[k]) ids.add(id)
  const taxonomy = new Map([...ids].flatMap((id) => {
    const dim = String(id).split(':')[0]
    return PREFIX_DIM.includes(dim) ? [[id, dim]] : []
  }))
  return claims.filter((c) => !validateClaim(c, taxonomy).ok).length
}

/** 묶음 크기 — 1 이상의 정수만. 0·음수·숫자 아님이면 null(반복이 끝나지 않거나 잘못 자른다). */
export const parseChunkSize = (v) => {
  const n = Number(v)
  return Number.isInteger(n) && n >= 1 ? n : null
}

/**
 * 판정된 영상 = 중간 판정(partial) + **완료 표시가 있는** 묶음의 영상. 완료 표시 없는 묶음은 무시한다.
 * chunks: [{ name, claims, done }]
 */
export function decidedVideos(partialClaims, chunks) {
  const ids = new Set(partialClaims.map((c) => c.videoId))
  for (const ch of chunks) if (ch.done) for (const c of ch.claims) ids.add(c.videoId)
  return ids
}

/** 묶음이 완료인가 — 정상 종료 + 한도 아님 + 맡긴 영상 전부가 결과에 있다. */
export function chunkComplete({ status, limitHit, ids, claims, malformed = 0, invalid = 0 }) {
  // 계약 검증 실패 줄이 있으면 미완료 — 적재기가 거부할 줄로 영상을 「판정됨」 처리하지 않는다
  if (invalid > 0) return false
  if (status !== 0 || limitHit) return false
  // 영상 0편 묶음은 완료가 아니다(빈 목록이면 「전부 판정」이 공허하게 참이 된다)
  if (!Array.isArray(ids) || ids.length === 0) return false
  // 깨진 줄이 하나라도 있으면 미완료 — 그 줄의 주장을 버린 채 완료 표시하면 다시 뽑히지 않는다
  if (malformed > 0) return false
  const covered = new Set(claims.map((c) => c.videoId))
  return ids.every((v) => covered.has(v))
}

// ── 실행 ──────────────────────────────────────────────────────────

function findCodex() {
  if (process.env.CODEX_BIN && fs.existsSync(process.env.CODEX_BIN)) return process.env.CODEX_BIN
  // VS Code 확장이 없는 환경(독립 CLI 설치)에서도 PATH 의 codex 로 떨어지게 — 폴더가 없으면 readdirSync 가 던진다
  try {
    const ext = path.join(os.homedir(), '.vscode', 'extensions')
    const hits = fs
      .readdirSync(ext)
      .filter((d) => d.startsWith('openai.chatgpt-'))
      .map((d) => path.join(ext, d, 'bin', 'windows-x86_64', 'codex.exe'))
      .filter((p) => fs.existsSync(p))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
    if (hits[0]) return hits[0]
  } catch {}
  return 'codex'
}

function main() {
  const args = process.argv.slice(2)
  const dir = path.resolve(args.find((a) => !a.startsWith('--')) ?? '')
  const opt = (k, d) => {
    const i = args.indexOf(`--${k}`)
    return i >= 0 && args[i + 1] ? args[i + 1] : d
  }
  const CHUNK = parseChunkSize(opt('chunk', 10))
  if (CHUNK === null) {
    console.error(`--chunk 는 1 이상의 정수여야 한다(받은 값: ${opt('chunk', 10)})`)
    process.exit(2)
  }
  const EFFORT = opt('effort', 'low')
  const DRY = args.includes('--dry')
  if (!fs.existsSync(path.join(dir, 'target-videos.txt'))) {
    console.error('사용: node scripts/knowledge/codex-extract-batch.mjs <claims-review 폴더(target-videos.txt · CONTRACT.md)> [--chunk 10] [--effort low] [--dry]')
    process.exit(2)
  }

  const CACHE = path.join(os.tmpdir(), 'methodology-caption-analysis-20260927')
  const USAGE = path.join(os.homedir(), '.claude', 'codex-review', 'usage.jsonl')
  const BUDGET = Number(process.env.CODEX_DAILY_TOKEN_BUDGET ?? 250_000)
  const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '')
  const todayTokens = () => {
    const today = new Date().toLocaleDateString('sv')
    let sum = 0
    for (const r of parseJsonl(read(USAGE))) {
      if (new Date(r.at).toLocaleDateString('sv') === today && Number.isFinite(r.tokens)) sum += r.tokens
    }
    return sum
  }
  const loadChunks = () =>
    fs
      .readdirSync(dir)
      .filter((f) => /^claims-chunk-\d+\.jsonl$/.test(f))
      .sort()
      .map((f) => ({ name: f, claims: parseJsonl(read(path.join(dir, f))), done: fs.existsSync(path.join(dir, f.replace('.jsonl', '.done'))) }))

  const target = parseTargets(read(path.join(dir, 'target-videos.txt')))
  const partial = parseJsonl(read(path.join(dir, 'claims.partial.jsonl')))
  let chunks = loadChunks()
  const decided = decidedVideos(partial, chunks)
  const remaining = target.filter((v) => !decided.has(v))
  const unfinished = chunks.filter((c) => !c.done).map((c) => c.name)
  console.log(
    `대상 ${target.length} · 판정됨 ${target.length - remaining.length} · 남음 ${remaining.length} · 묶음 ${Math.ceil(remaining.length / CHUNK)}(${CHUNK}편) · effort ${EFFORT}` +
      (unfinished.length ? ` · 완료 표시 없는 묶음(세지 않음) ${unfinished.join(' ')}` : '')
  )

  let next = chunks.length ? Math.max(...chunks.map((c) => Number(c.name.match(/\d+/)[0]))) + 1 : 1
  for (let i = 0; i < remaining.length; i += CHUNK) {
    const ids = remaining.slice(i, i + CHUNK)
    const out = `claims-chunk-${String(next).padStart(2, '0')}.jsonl`
    // 짧은 지시 — 규칙은 계약 문서에 있다. 반복하지 않는 만큼 토큰이 준다.
    const prompt = [
      `영상 ${ids.length}편의 학습 방법 주장을 CONTRACT.md 형식 jsonl 로 ${out} 에 써라(이 폴더). 예시: ../claims-review-20261001/claims.jsonl.`,
      `영상 ID: ${ids.join(' ')}`,
      `자막: 로컬 캐시 ${CACHE} 만(네트워크 없음). 캐시 없으면 그 영상은 verdict hold · reason "캐시 없음".`,
      '토큰 절약: 자막을 통째로 출력하지 말고, 학습 방법이 나오는 구간만 찾아 읽어라. 확인·요약 출력도 최소로.',
      '지킬 것: CONTRACT.md 의 원칙 전부(원문 대조한 것만 import · 권고/관찰/추론 구분 · 재서술만 · A 는 대조 초 구간 · 합친 문장 1,500자 이하 · reviewer "codex").',
      `모든 영상이 최소 한 줄. 다 쓰면 마지막 메시지로 "${out}: import N · hold N · exclude N" 한 줄만.`,
    ].join(NL)
    if (DRY) {
      console.log(`[dry] ${out} · ${ids.length}편 · 지시문 ${prompt.length}자`)
      next += 1
      continue
    }
    if (todayTokens() >= BUDGET) {
      console.log(`멈춤: 오늘 ${todayTokens().toLocaleString()} 토큰 ≥ 예산 ${BUDGET.toLocaleString()} — 다시 돌리면 이어서`)
      break
    }
    const t0 = Date.now()
    const r = spawnSync(
      findCodex(),
      ['exec', '-C', dir, '-s', 'workspace-write', '--skip-git-repo-check', '-c', `model_reasoning_effort="${EFFORT}"`, prompt],
      { encoding: 'utf8', timeout: 1_800_000, maxBuffer: 64 << 20, windowsHide: true }
    )
    const secs = Math.round((Date.now() - t0) / 1000)
    const both = `${r.stdout ?? ''}${NL}${r.stderr ?? ''}`
    const tm = both.match(/tokens used\s*[:\n]?\s*([\d,]+)/i)
    const tokens = tm ? Number(tm[1].replace(/,/g, '')) : null
    const limitHit = /usage limit/i.test(both)
    try {
      fs.mkdirSync(path.dirname(USAGE), { recursive: true })
      fs.appendFileSync(USAGE, JSON.stringify({ at: new Date().toISOString(), kind: 'extract', tokens, secs, chunk: out }) + NL)
    } catch {}
    fs.writeFileSync(path.join(dir, out.replace('.jsonl', '.log')), both.slice(-20_000)) // 로그는 끝부분만 — 자막 구간을 쌓아 두지 않는다
    const outText = read(path.join(dir, out))
    const wrote = parseJsonl(outText)
    const malformed = countMalformed(outText)
    const invalid = countInvalid(wrote)
    if (malformed) console.log(`  깨진 줄 ${malformed} — 이 묶음은 미완료로 둔다`)
    if (invalid) console.log(`  계약 검증 실패 줄 ${invalid} — 이 묶음은 미완료로 둔다`)
    const complete = chunkComplete({ status: r.error ? -1 : r.status, limitHit, ids, claims: wrote, malformed, invalid })
    if (complete) fs.writeFileSync(path.join(dir, out.replace('.jsonl', '.done')), JSON.stringify({ ids, lines: wrote.length, tokens, at: new Date().toISOString() }) + NL)
    const covered = new Set(wrote.map((c) => c.videoId))
    console.log(`${out} · ${secs}s · 토큰 ${tokens?.toLocaleString() ?? '?'} · 줄 ${wrote.length} · 영상 ${ids.filter((v) => covered.has(v)).length}/${ids.length} · ${complete ? '완료' : '미완료(다음 실행에서 다시)'}`)
    if (limitHit) {
      console.log('멈춤: Codex 사용량 한도 — 한도가 풀린 뒤 다시 돌리면 남은 영상부터')
      break
    }
    if (!complete) {
      console.log(`멈춤: 묶음 미완료(종료 코드 ${r.status}) — 로그 ${out.replace('.jsonl', '.log')}`)
      break
    }
    next += 1
  }

  if (DRY) {
    console.log('[dry] 파일을 쓰지 않았다')
    return
  }
  // 합치기 — 중간 판정 + **완료된** 묶음만. claimId 중복은 claims-import 가 쓰기 전에 가른다.
  chunks = loadChunks()
  const merged = [...partial, ...chunks.filter((c) => c.done).flatMap((c) => c.claims)]
  fs.writeFileSync(path.join(dir, 'claims.jsonl'), merged.map((c) => JSON.stringify(c)).join(NL) + (merged.length ? NL : ''))
  const have = new Set(merged.map((c) => c.videoId))
  console.log(`합침 → claims.jsonl ${merged.length}줄 · 아직 판정 없는 대상 ${target.filter((v) => !have.has(v)).length}편 · 오늘 Codex 토큰 ${todayTokens().toLocaleString()}`)
}

// 불러오기만 할 때(회귀 테스트)는 실행하지 않는다
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main()
