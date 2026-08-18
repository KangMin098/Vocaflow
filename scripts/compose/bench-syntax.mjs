// scripts/compose/bench-syntax.mjs
//
// ACP §20 — **구문 복잡도 후보 지표 탐색.**
//
// 왜: 고등 밴드에는 천장만 있고 하한이 없다. 그래서 CSAT 지문을 쉽게 만들수록 점수가
// 좋아진다 — 실제로 V8 발주 지문에서 어려운 단어 둘을 빼자 밴드 초과가 2.3%→0.0% 로
// "좋아졌다". 수능 대비 지문에서 그게 개선일 리 없다.
//
// 어휘로는 이 방향을 잡을 수 없다고 보고 구문을 재려 하는데, **어떤 지표가 실제로 레벨을
// 가르는지 모르는 채 고르면 또 짐작**이다. 그래서 후보를 여럿 놓고 같은 텍스트들에 돌려
// 레벨 순으로 단조인 것만 골라 쓴다.
//
// 후보 (파서 없이 계산 가능한 것만):
//   L  평균 문장 길이 (기준선)
//   S  종속·관계 표지 / 100어   — 내포절 밀도의 대리지표
//   C  문장당 쉼표              — 절 경계의 대리지표
//   W  평균 낱말 길이(문자)      — 라틴계·명사화 경향의 대리지표
//   V  문장당 finite verb 후보   — 절 수의 거친 대리지표
//
// 실행: pnpm dlx tsx scripts/compose/bench-syntax.mjs <파일...>

import fs from 'node:fs'
import path from 'node:path'

const SUBORDINATORS = new Set([
  'that', 'which', 'who', 'whom', 'whose', 'where', 'when', 'while', 'whereas',
  'because', 'since', 'although', 'though', 'unless', 'if', 'whether', 'until',
  'after', 'before', 'as', 'so', 'thus', 'therefore', 'however',
])

// finite verb 의 거친 대리지표 — 조동사·be동사·과거형 어미. 파서가 없으니 과대·과소 둘 다 난다.
const AUX = new Set([
  'is', 'are', 'was', 'were', 'be', 'been', 'am', 'has', 'have', 'had', 'do', 'does', 'did',
  'can', 'could', 'will', 'would', 'may', 'might', 'must', 'should', 'shall',
])

function metrics(text) {
  const body = text.trim()
  const sentences = body
    .split(/\n\s*\n+/)
    .flatMap((p) => p.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/))
    .map((s) => s.trim())
    .filter(Boolean)
  const words = body.split(/\s+/).filter(Boolean)
  const lower = words.map((w) => w.toLowerCase().replace(/[^a-z']/g, '')).filter(Boolean)

  const sub = lower.filter((w) => SUBORDINATORS.has(w)).length
  const aux = lower.filter((w) => AUX.has(w)).length
  const commas = (body.match(/,/g) ?? []).length
  const chars = lower.reduce((s, w) => s + w.length, 0)

  return {
    n: sentences.length,
    L: sentences.length ? words.length / sentences.length : 0,
    S: lower.length ? (100 * sub) / lower.length : 0,
    C: sentences.length ? commas / sentences.length : 0,
    W: lower.length ? chars / lower.length : 0,
    V: sentences.length ? aux / sentences.length : 0,
  }
}

const files = process.argv.slice(2).filter((a) => !a.startsWith('--'))
if (files.length === 0) throw new Error('파일을 하나 이상 주세요')

console.log(
  ['파일'.padEnd(20), 'L(문장길이)', 'S(종속/100어)', 'C(쉼표/문장)', 'W(낱말길이)', 'V(aux/문장)'].join('  '),
)
for (const f of files) {
  const m = metrics(fs.readFileSync(path.resolve(f), 'utf8'))
  console.log(
    [
      path.basename(f, '.txt').padEnd(20),
      m.L.toFixed(1).padStart(11),
      m.S.toFixed(2).padStart(13),
      m.C.toFixed(2).padStart(12),
      m.W.toFixed(2).padStart(11),
      m.V.toFixed(2).padStart(12),
    ].join('  '),
  )
}
