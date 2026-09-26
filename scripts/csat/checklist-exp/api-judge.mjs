// scripts/csat/checklist-exp/api-judge.mjs
//
// **실험 4 — 체크리스트 답을 에이전트 없이 API 직접 호출로 받는다(Opus 5.5 · Haiku 4.5 비교).**
//
// 왜: 에이전트 경로는 입력의 절반 이상이 에이전트 고정 비용이고(첫 요청 55k), 요청마다 컨텍스트를 다시 읽는다
// (docs/reports/checklist-exp-20260926.md). 글 하나 = 요청 하나로 보내고, 공통 접두(지시 + checklist-draft.md +
// criteria.md)를 1시간 캐시에 두면 글마다 본문과 출력만 새로 든다.
//
// 기준을 여기 다시 쓰지 않는다 — 두 문서를 그대로 system 에 싣는다. 출력은 구조화 출력(필요한 필드만: answers · note).
// 보관·보류·폐기는 여기서 정하지 않는다 — `decide.mjs` 가 정하고 `compare.mjs --suffix api<Model>` 로 채점한다.
//
// 단계 (모두 재실행 안전 — 이미 답이 있는 id 는 건너뛴다):
//   --mode dry-run                 요청을 만들어 크기만 센다. 키가 없어도 된다.
//   --mode pilot --n 10            동기 호출 n편 — 실제 입력·출력·캐시 토큰을 잰다(1시간 캐시를 데운다).
//   --mode batch-submit            남은 편을 Message Batches 로 제출(50% 할인 · 같은 1시간 캐시 접두). 배치 id 를 기록한다.
//   --mode batch-collect           배치가 끝났으면 결과를 받아 답과 usage 를 기록한다. 안 끝났으면 상태만 출력.
//   --mode report                  usage 기록으로 글당 평균 토큰·캐시 적중률·비용(목록가)을 낸다.
//
// 공통: --model opus|haiku  [--max-usd 5]  — 누적 비용(목록가 추정)이 한도를 넘으면 동기 호출을 멈추고,
//   배치는 제출 전 추정이 한도를 넘으면 제출하지 않는다. 콘솔 지출 한도는 별개로 사람이 확인한다.
//
// 키: `node --env-file=<gitignored env 파일>` 로만 읽는다. 키를 출력·기록하지 않는다.
// 실행 예: node --env-file=apps/web/.env.local scripts/csat/checklist-exp/api-judge.mjs --model opus --mode pilot --n 10

import fs from 'node:fs'
import path from 'node:path'

import { HARMFUL, UNFIT } from '../gate-rules.mjs'
import { QUESTIONS_V2, LINKAGE, missingAnswers } from './decide.mjs'

const argOf = (k, d) => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d
}
const MODE = argOf('mode', 'dry-run')
const MODEL_KEY = argOf('model', 'opus')
const N = Number(argOf('n', 10))
const MAX_USD = Number(argOf('max-usd', 5))
const WORK = path.resolve(argOf('work', 'scripts/csat/checklist-exp/work-v2'))

// 목록가 $/1M 토큰 — claude-api 참고 자료(2026-06-24 캐시) 기준. 1시간 캐시 쓰기 = 입력 ×2 · 배치 = 전부 50%.
const MODELS = {
  opus: { id: 'claude-opus-5-5', suffix: 'apiOpus', maxTokens: 4000, price: { in: 4, out: 20, cacheRead: 0.2, cacheWrite1h: 8 } },
  haiku: { id: 'claude-haiku-4-5', suffix: 'apiHaiku', maxTokens: 1500, price: { in: 1, out: 5, cacheRead: 0.1, cacheWrite1h: 2 } },
}
const M = MODELS[MODEL_KEY]
if (!M) throw new Error(`--model opus|haiku (받은 값: ${MODEL_KEY})`)

const OUT = path.join(WORK, `chunk-00.${M.suffix}.out.json`)
const USAGE = path.join(WORK, `api-usage-${MODEL_KEY}.jsonl`)
const BATCH = path.join(WORK, `api-batch-${MODEL_KEY}.json`)

// ── 입력 ────────────────────────────────────────────────────────────────
const items = fs
  .readdirSync(WORK)
  .filter((f) => /^chunk-\d+\.json$/.test(f))
  .sort()
  .flatMap((f) => JSON.parse(fs.readFileSync(path.join(WORK, f), 'utf8')))
const byId = new Map(items.map((it) => [it.id, it]))
const done = new Map(fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')).map((o) => [o.id, o]) : [])
const todo = items.filter((it) => !done.has(it.id))

// ── 프롬프트 — 공통 접두는 바이트 단위로 고정(캐시는 접두 일치) ───────────
const INSTRUCTION = [
  '당신은 원문 보관 판정 체크리스트에 답한다. 아래 두 문서 — 체크리스트(질문·답하는 법)와 판정 기준 정본 — 를 따른다.',
  '보관·보류·폐기는 판단하지 않는다. 질문에만 답한다.',
  '사용자 메시지로 오는 글의 content 전문을 처음부터 끝까지 읽는다. 제목으로 답하지 않는다.',
  '질문은 체크리스트의 순서(Q1→Q15)대로 답한다. 가공 질문(Q9–Q11)은 문단 하나를 골라 실제로 해 본다.',
  '출력은 지정된 JSON 형식뿐이다. note 는 이 글에 고유한 근거를 한국어 한 문장, 60자 이내로 쓴다.',
].join('\n')
const SYSTEM = [
  { type: 'text', text: INSTRUCTION },
  { type: 'text', text: `# docs/source-check/checklist-draft.md\n\n${fs.readFileSync('docs/source-check/checklist-draft.md', 'utf8')}` },
  {
    type: 'text',
    text: `# docs/source-check/criteria.md\n\n${fs.readFileSync('docs/source-check/criteria.md', 'utf8')}`,
    cache_control: { type: 'ephemeral', ttl: '1h' },
  },
]

// 구조화 출력 — 필요한 필드만. 차단 장르 목록은 gate-rules 가 정본.
const BLOCKED = [...HARMFUL, ...UNFIT, 'poetry-drama']
const answerProps = Object.fromEntries(
  QUESTIONS_V2.map((k) => [
    k,
    k === 'blocked'
      ? { anyOf: [{ type: 'string', enum: BLOCKED }, { type: 'null' }] }
      : k === 'linkage'
        ? { type: 'string', enum: LINKAGE }
        : { type: 'boolean' },
  ])
)
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['answers', 'note'],
  properties: {
    answers: { type: 'object', additionalProperties: false, required: QUESTIONS_V2, properties: answerProps },
    note: { type: 'string', description: '한국어 한 문장 · 60자 이내 · 이 글에 고유한 근거' },
  },
}

function params(it) {
  const article = { id: it.id, title: it.title, source: it.source, words: it.words, v_level: it.v_level, content: it.content }
  return {
    model: M.id,
    max_tokens: M.maxTokens,
    system: SYSTEM,
    ...(MODEL_KEY === 'opus' ? { output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } } } : { output_config: { format: { type: 'json_schema', schema: SCHEMA } } }),
    messages: [{ role: 'user', content: JSON.stringify(article) }],
  }
}

// ── 기록 ────────────────────────────────────────────────────────────────
function costOf(u, batch) {
  const p = M.price
  const usd =
    ((u.input_tokens ?? 0) * p.in +
      (u.cache_creation_input_tokens ?? 0) * p.cacheWrite1h +
      (u.cache_read_input_tokens ?? 0) * p.cacheRead +
      (u.output_tokens ?? 0) * p.out) /
    1e6
  return batch ? usd / 2 : usd
}
function spentSoFar() {
  if (!fs.existsSync(USAGE)) return 0
  return fs
    .readFileSync(USAGE, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l))
    .reduce((s, r) => s + r.usd, 0)
}
function record(id, message, mode) {
  const text = message.content.find((b) => b.type === 'text')?.text
  let parsed = null
  try {
    parsed = JSON.parse(text)
  } catch {}
  const u = message.usage
  const usd = costOf(u, mode === 'batch')
  fs.appendFileSync(
    USAGE,
    JSON.stringify({
      id,
      mode,
      stop: message.stop_reason,
      input: u.input_tokens ?? 0,
      cacheWrite: u.cache_creation_input_tokens ?? 0,
      cacheRead: u.cache_read_input_tokens ?? 0,
      output: u.output_tokens ?? 0,
      contentChars: String(byId.get(id)?.content ?? '').length,
      usd,
    }) + '\n'
  )
  if (!parsed || missingAnswers(parsed.answers).length) {
    console.log(`  ⚠️ ${id.slice(0, 8)} 답이 형식에 안 맞는다(stop=${message.stop_reason}) — 기록하지 않았다(재실행하면 다시 묻는다)`)
    return false
  }
  done.set(id, { id, answers: parsed.answers, note: parsed.note })
  // 입력 순서로 저장 — validate.mjs 와 같은 순서 규칙
  fs.writeFileSync(OUT, JSON.stringify(items.filter((x) => done.has(x.id)).map((x) => done.get(x.id)), null, 1) + '\n')
  return true
}

async function client() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY 가 없다 — gitignore 된 env 파일에 넣고 node --env-file=<파일> 로 실행한다')
  const { default: Anthropic } = await import(path.resolve('apps/web/node_modules/@anthropic-ai/sdk/index.mjs'))
  return new Anthropic()
}

// ── 실행 ────────────────────────────────────────────────────────────────
console.log(`  모델 ${M.id} · 표본 ${items.length} · 답 있음 ${done.size} · 남음 ${todo.length} · 지금까지 ${spentSoFar().toFixed(3)} USD (한도 ${MAX_USD})`)

if (MODE === 'dry-run') {
  const sysChars = SYSTEM.reduce((s, b) => s + b.text.length, 0)
  const bodyChars = todo.reduce((s, it) => s + String(it.content).length, 0)
  console.log(`  공통 접두 ${sysChars.toLocaleString()}자 · 남은 본문 ${bodyChars.toLocaleString()}자 · 요청 ${todo.length}건`)
  console.log(`  스키마 질문 ${QUESTIONS_V2.length}개 · 차단 장르 ${BLOCKED.length}종 · 요청 예시 키: ${Object.keys(params(todo[0] ?? items[0])).join(', ')}`)
} else if (MODE === 'pilot') {
  const api = await client()
  for (const it of todo.slice(0, N)) {
    if (spentSoFar() > MAX_USD) {
      console.log(`  ⛔ 한도 ${MAX_USD} USD 를 넘었다 — 멈춘다`)
      break
    }
    const msg = await api.messages.create(params(it))
    const ok = record(it.id, msg, 'pilot')
    const u = msg.usage
    console.log(`  ${it.id.slice(0, 8)} ${ok ? '✓' : '✗'} 입력 ${u.input_tokens} · 캐시쓰기 ${u.cache_creation_input_tokens ?? 0} · 캐시읽기 ${u.cache_read_input_tokens ?? 0} · 출력 ${u.output_tokens}`)
  }
} else if (MODE === 'batch-submit') {
  if (fs.existsSync(BATCH)) throw new Error(`이미 제출한 배치가 있다: ${BATCH} — batch-collect 로 받거나 파일을 치운 뒤 다시`)
  // 제출 전 추정 — pilot 의 글당 평균(배치 50%)으로 남은 편수를 곱한다.
  const rows = fs.existsSync(USAGE) ? fs.readFileSync(USAGE, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []
  if (!rows.length) throw new Error('pilot 기록이 없다 — 먼저 --mode pilot 으로 실측한다')
  const est = (rows.reduce((s, r) => s + r.usd, 0) / rows.length / 2) * todo.length
  console.log(`  제출 전 추정 ${est.toFixed(3)} USD (${todo.length}건 · pilot 평균 × 배치 50%)`)
  if (spentSoFar() + est > MAX_USD) throw new Error(`추정 합계가 한도 ${MAX_USD} USD 를 넘는다 — 제출하지 않았다`)
  const api = await client()
  const batch = await api.messages.batches.create({ requests: todo.map((it) => ({ custom_id: it.id, params: params(it) })) })
  fs.writeFileSync(BATCH, JSON.stringify({ id: batch.id, model: M.id, count: todo.length, submitted: batch.created_at }, null, 1) + '\n')
  console.log(`  배치 제출 ${batch.id} · ${todo.length}건 · 상태 ${batch.processing_status}`)
} else if (MODE === 'batch-collect') {
  if (!fs.existsSync(BATCH)) throw new Error('제출한 배치가 없다')
  const { id } = JSON.parse(fs.readFileSync(BATCH, 'utf8'))
  const api = await client()
  const b = await api.messages.batches.retrieve(id)
  console.log(`  배치 ${id} · ${b.processing_status} · ${JSON.stringify(b.request_counts)}`)
  if (b.processing_status === 'ended') {
    let ok = 0
    const failed = []
    for await (const r of await api.messages.batches.results(id)) {
      if (r.result.type === 'succeeded') {
        if (!done.has(r.custom_id) && record(r.custom_id, r.result.message, 'batch')) ok++
      } else failed.push(`${r.custom_id.slice(0, 8)}:${r.result.type}`)
    }
    console.log(`  받음 ${ok} · 실패 ${failed.length}${failed.length ? ` (${failed.join(' ')}) — 배치 파일을 치우고 batch-submit 을 다시 돌리면 남은 것만 낸다` : ''}`)
  }
} else if (MODE === 'report') {
  const rows = fs.existsSync(USAGE) ? fs.readFileSync(USAGE, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []
  for (const mode of ['pilot', 'batch']) {
    const rs = rows.filter((r) => r.mode === mode)
    if (!rs.length) continue
    const avg = (k) => rs.reduce((s, r) => s + r[k], 0) / rs.length
    const hitReq = rs.filter((r) => r.cacheRead > 0).length / rs.length
    const hitTok = rs.reduce((s, r) => s + r.cacheRead, 0) / Math.max(1, rs.reduce((s, r) => s + r.cacheRead + r.cacheWrite, 0))
    const charsPerTok = rs.reduce((s, r) => s + r.contentChars, 0) / Math.max(1, rs.reduce((s, r) => s + r.input, 0))
    console.log(`  [${mode}] ${rs.length}건 · 글당 평균 입력 ${avg('input').toFixed(0)} · 캐시쓰기 ${avg('cacheWrite').toFixed(0)} · 캐시읽기 ${avg('cacheRead').toFixed(0)} · 출력 ${avg('output').toFixed(0)}`)
    console.log(`           캐시 적중(요청 기준) ${(hitReq * 100).toFixed(1)}% · (접두 토큰 기준) ${(hitTok * 100).toFixed(1)}% · 본문 ${charsPerTok.toFixed(2)}자/토큰 · 글당 ${(avg('usd')).toFixed(4)} USD · 합계 ${rs.reduce((s, r) => s + r.usd, 0).toFixed(3)} USD`)
  }
}
