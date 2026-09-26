// scripts/csat/near-dup.mjs
//
// **본문 근사 중복 — MinHash + LSH.** 판정 전에 같은 글의 판본·재게재본을 가려, 판정할 글 수를 줄인다.
//
// 왜 `body_sha256` · `content_hash` 로는 안 되나: 재게재본은 머리말·꼬리말·공백 한 줄만 달라도 해시가 다르다.
// 그래서 **낱말 5개 연속열(shingle)의 집합**을 비교한다(자카드). 9만 편을 둘씩 다 대면 40억 쌍이라
// MinHash 서명(128개)으로 자카드를 추정하고, LSH 띠(32띠 × 4행)로 비교할 쌍만 고른다.
//
// 띠 설정의 뜻: 자카드 s 인 쌍이 후보로 걸릴 확률 = 1 − (1 − s⁴)³². s=0.5 → 87% · s=0.7 → 99.99% · s=0.3 → 23%.
// 후보가 된 뒤에는 서명 전체로 자카드를 추정한다(128개 → 표준오차 ≈ 0.044). 보고 임계값은 호출자가 정한다.
//
// 순수 함수만 둔다 — DB·파일을 만지지 않는다(`__tests__/near-dup.test.mjs`).

export const SHINGLE = 5
export const PERMS = 128
export const BANDS = 32
export const ROWS = PERMS / BANDS

/** 소문자 낱말열. 숫자·아포스트로피는 낱말의 일부로 둔다(연도·축약형이 같은 글을 가르는 단서다). */
export function words(text) {
  return String(text ?? '').toLowerCase().match(/[a-z0-9]+(?:'[a-z]+)?/g) ?? []
}

/** FNV-1a 32비트 — 낱말 k 개 연속열 하나의 해시. */
function fnv(ws, i, k) {
  let h = 0x811c9dc5
  for (let j = i; j < i + k; j++) {
    const w = ws[j]
    for (let c = 0; c < w.length; c++) {
      h ^= w.charCodeAt(c)
      h = Math.imul(h, 0x01000193) >>> 0
    }
    h ^= 32
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h
}

/** shingle 해시 집합. 낱말이 k 개보다 적으면 빈 집합(비교 대상이 아니다). */
export function shingles(ws, k = SHINGLE) {
  const out = new Set()
  for (let i = 0; i + k <= ws.length; i++) out.add(fnv(ws, i, k))
  return out
}

// 순열 계수 — 고정 시드(mulberry32)라 실행마다 같은 서명이 나온다(재실행 안전 · 결과 비교 가능).
const COEF = (() => {
  let s = 0x9e3779b9
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0)
  }
  const a = new Uint32Array(PERMS)
  const b = new Uint32Array(PERMS)
  for (let i = 0; i < PERMS; i++) { a[i] = rnd() | 1; b[i] = rnd() }
  return { a, b }
})()

/** MinHash 서명. 빈 집합이면 null. h_i(x) = (a_i·x + b_i) mod 2³² 의 최소값. */
export function signature(set) {
  if (!set.size) return null
  const sig = new Uint32Array(PERMS).fill(0xffffffff)
  for (const x of set) {
    for (let i = 0; i < PERMS; i++) {
      const v = (Math.imul(COEF.a[i], x) + COEF.b[i]) >>> 0
      if (v < sig[i]) sig[i] = v
    }
  }
  return sig
}

/** 서명 두 개로 추정한 자카드. */
export function estimate(s1, s2) {
  let eq = 0
  for (let i = 0; i < PERMS; i++) if (s1[i] === s2[i]) eq++
  return eq / PERMS
}

/** 띠 열쇠 — 띠 번호를 앞에 붙여 서로 다른 띠의 우연한 충돌을 막는다. */
export function bandKeys(sig) {
  const keys = []
  for (let b = 0; b < BANDS; b++) {
    let k = `${b}:`
    for (let r = 0; r < ROWS; r++) k += sig[b * ROWS + r].toString(36) + '.'
    keys.push(k)
  }
  return keys
}

/**
 * 후보 쌍을 찾아 추정 자카드와 함께 돌려준다.
 * @param {Array<{id:string, sig:Uint32Array}>} docs
 * @param {number} min 이 값 미만 쌍은 버린다
 * @param {number} maxBucket 한 띠 칸에 이보다 많이 몰리면(상용구 본문) 그 칸은 쌍을 만들지 않고 따로 센다
 */
export function nearPairs(docs, { min = 0.5, maxBucket = 200 } = {}) {
  const buckets = new Map()
  docs.forEach((d, idx) => {
    for (const k of bandKeys(d.sig)) {
      const arr = buckets.get(k)
      if (arr) arr.push(idx)
      else buckets.set(k, [idx])
    }
  })
  const seen = new Set()
  const pairs = []
  let crowded = 0
  for (const arr of buckets.values()) {
    if (arr.length < 2) continue
    if (arr.length > maxBucket) { crowded++; continue }
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const [x, y] = arr[i] < arr[j] ? [arr[i], arr[j]] : [arr[j], arr[i]]
        const key = x * 1_000_003 + y
        if (seen.has(key)) continue
        seen.add(key)
        const jac = estimate(docs[x].sig, docs[y].sig)
        if (jac >= min) pairs.push({ a: x, b: y, jaccard: jac })
      }
    }
  }
  return { pairs, crowded }
}

/** 쌍 → 묶음(union-find). 묶음마다 구성원 색인 목록. 크기 1 은 빼고 돌려준다. */
export function clusters(n, pairs) {
  const p = Int32Array.from({ length: n }, (_, i) => i)
  const find = (x) => { while (p[x] !== x) { p[x] = p[p[x]]; x = p[x] } return x }
  for (const { a, b } of pairs) {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) p[Math.max(ra, rb)] = Math.min(ra, rb)
  }
  const groups = new Map()
  for (let i = 0; i < n; i++) {
    const r = find(i)
    if (!groups.has(r)) groups.set(r, [])
    groups.get(r).push(i)
  }
  return [...groups.values()].filter((g) => g.length > 1)
}
