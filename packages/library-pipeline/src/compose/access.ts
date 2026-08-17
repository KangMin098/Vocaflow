// packages/library-pipeline/src/compose/access.ts
//
// ACP §20 재저작 — 접근 규율(robots · 요청 간격 · 본문 비보관).
//
// 왜 이 파일이 있는가:
//   상업 뉴스를 **사실의 증인**으로 읽는 것은 저작권 문제가 아니다 — 사실에는 저작권이
//   없다(§102(b)·Feist / 한국 저작권법 제7조 5호). 그러나 남의 서버에서 읽어 오는 행위에는
//   저작권과 **다른 축**의 규율이 붙는다: robots.txt · 이용약관 · 요청 부하.
//
//   이 둘을 한 칸에 적으면 "약관이 걸리니 상업 뉴스는 못 쓴다" 같은 잘못된 결론이 나온다.
//   실제로는 축이 둘이고, 두 번째 축은 **배제 사유가 아니라 지켜야 할 절차**다.
//
// 이 모듈이 강제하는 세 가지:
//   ① robots.txt 를 실제로 파싱해 경로가 허용되는지 판정. 미확인 상태에서는 fetch 금지.
//   ② 호스트별 최소 요청 간격 — Crawl-delay 가 있으면 그것을 우선한다.
//   ③ **본문 비보관** — readForFacts() 는 본문을 반환하지 않는다. 지문과 콜백 산출물만
//      나온다. "저장하지 말자"는 규칙이 아니라 함수 시그니처로 못 박는다.

import { buildFingerprint, DEFAULT_SHINGLE_N, type Fingerprint } from './fingerprint'

// ── robots.txt ───────────────────────────────────────────────────────

export interface RobotsRule {
  allow: boolean
  /** 원문 경로 패턴 (`*` 와일드카드 · `$` 끝 고정) */
  pattern: string
}

export interface RobotsGroup {
  agents: string[]
  rules: RobotsRule[]
  /** 초 단위. 없으면 null. */
  crawlDelay: number | null
}

export interface Robots {
  groups: RobotsGroup[]
}

/**
 * robots.txt 파싱. 빈 문자열/404 본문은 "규칙 없음"(= 전부 허용)으로 해석되지만,
 * **가져오지 못한 것과 빈 것은 다르다** — 가져오기 실패는 호출부에서 차단으로 처리한다.
 */
export function parseRobots(text: string): Robots {
  const groups: RobotsGroup[] = []
  let current: RobotsGroup | null = null
  let lastWasAgent = false

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim()
    if (!line) continue
    const idx = line.indexOf(':')
    if (idx < 0) continue
    const field = line.slice(0, idx).trim().toLowerCase()
    const value = line.slice(idx + 1).trim()

    if (field === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [], crawlDelay: null }
        groups.push(current)
      }
      current.agents.push(value.toLowerCase())
      lastWasAgent = true
      continue
    }
    if (!current) continue
    lastWasAgent = false

    if (field === 'allow' || field === 'disallow') {
      // 빈 Disallow 는 "제한 없음" — 규칙으로 넣지 않는다.
      if (field === 'disallow' && value === '') continue
      current.rules.push({ allow: field === 'allow', pattern: value })
    } else if (field === 'crawl-delay') {
      const n = Number(value)
      if (Number.isFinite(n) && n >= 0) current.crawlDelay = n
    }
  }
  return { groups }
}

/** 우리 UA 에 적용되는 그룹. 정확 일치 우선, 없으면 `*`. */
export function groupFor(robots: Robots, userAgent: string): RobotsGroup | null {
  const ua = userAgent.toLowerCase()
  let star: RobotsGroup | null = null
  let best: { g: RobotsGroup; len: number } | null = null

  for (const g of robots.groups) {
    for (const a of g.agents) {
      if (a === '*') {
        star = star ?? g
        continue
      }
      if (ua.includes(a) && (!best || a.length > best.len)) best = { g, len: a.length }
    }
  }
  return best?.g ?? star
}

/** robots 경로 패턴 → 정규식. `*` = 임의 문자열, `$` = 끝 고정. */
function patternToRegex(pattern: string): RegExp {
  let out = '^'
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]!
    if (c === '*') out += '.*'
    else if (c === '$' && i === pattern.length - 1) out += '$'
    else out += c.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(out)
}

/**
 * 경로 허용 판정. 최장 패턴 우선, 길이가 같으면 Allow 우선 (robots 관례).
 * 적용 그룹이 없으면 허용.
 */
export function isPathAllowed(robots: Robots, userAgent: string, path: string): boolean {
  const g = groupFor(robots, userAgent)
  if (!g || g.rules.length === 0) return true

  let winner: RobotsRule | null = null
  for (const r of g.rules) {
    if (!patternToRegex(r.pattern).test(path)) continue
    if (
      !winner ||
      r.pattern.length > winner.pattern.length ||
      (r.pattern.length === winner.pattern.length && r.allow && !winner.allow)
    ) {
      winner = r
    }
  }
  return winner ? winner.allow : true
}

// ── 수집 규율 ────────────────────────────────────────────────────────

/** 우리를 밝히는 UA. 익명 크롤러로 위장하지 않는다 — 차단하고 싶은 쪽이 차단할 수 있어야 한다. */
export const COMPOSE_USER_AGENT =
  'VocaflowFactBot/1.0 (+https://vocaflow.app/factbot; English-learning fact extraction)'

/** 호스트별 기본 최소 간격. Crawl-delay 가 더 크면 그쪽을 따른다. */
export const DEFAULT_MIN_INTERVAL_MS = 2_000

export interface AccessDecision {
  allowed: boolean
  /** 이 요청 전에 기다려야 하는 시간(ms) */
  waitMs: number
  /** 차단 사유 (allowed=false 일 때) */
  reason: string | null
  /** 적용된 간격 — robots Crawl-delay 반영 후 */
  intervalMs: number
}

/**
 * 호스트별 요청 간격을 기억하는 게이트.
 *
 * 상태를 들고 있으므로 수집 작업 1회당 인스턴스 1개를 쓴다. 프로세스 전역 싱글턴으로
 * 두면 동시 실행되는 작업들이 서로의 간격을 잡아먹는다.
 */
export class CrawlGate {
  private lastAt = new Map<string, number>()
  private robotsByHost = new Map<string, Robots | null>()

  constructor(
    private readonly userAgent: string = COMPOSE_USER_AGENT,
    private readonly defaultIntervalMs: number = DEFAULT_MIN_INTERVAL_MS,
  ) {}

  /**
   * robots.txt 등록. `null` 은 **가져오기 실패**를 뜻하며 이후 모든 경로가 차단된다
   * (확인하지 못한 것을 허용으로 해석하지 않는다).
   */
  setRobots(host: string, robots: Robots | null): void {
    this.robotsByHost.set(host.toLowerCase(), robots)
  }

  /** 이 URL 을 지금 읽어도 되는가. now 는 테스트 주입용. */
  check(url: string, now: number = Date.now()): AccessDecision {
    let u: URL
    try {
      u = new URL(url)
    } catch {
      return { allowed: false, waitMs: 0, reason: `URL 형식 오류: ${url}`, intervalMs: 0 }
    }
    const host = u.host.toLowerCase()

    if (!this.robotsByHost.has(host)) {
      return {
        allowed: false,
        waitMs: 0,
        reason: `${host} robots.txt 미확인 — 확인 전 수집 금지`,
        intervalMs: 0,
      }
    }
    const robots = this.robotsByHost.get(host)!
    if (robots === null) {
      return {
        allowed: false,
        waitMs: 0,
        reason: `${host} robots.txt 를 가져오지 못했다 — 미확인을 허용으로 해석하지 않는다`,
        intervalMs: 0,
      }
    }
    if (!isPathAllowed(robots, this.userAgent, u.pathname + u.search)) {
      return {
        allowed: false,
        waitMs: 0,
        reason: `robots.txt 가 ${u.pathname} 를 막는다`,
        intervalMs: 0,
      }
    }

    const delay = groupFor(robots, this.userAgent)?.crawlDelay
    const intervalMs = Math.max(this.defaultIntervalMs, (delay ?? 0) * 1000)
    const last = this.lastAt.get(host)
    const waitMs = last === undefined ? 0 : Math.max(0, last + intervalMs - now)

    return { allowed: true, waitMs, reason: null, intervalMs }
  }

  /** 요청을 실제로 보냈다고 기록. check() 통과 후 fetch 직전에 호출한다. */
  markFetched(url: string, now: number = Date.now()): void {
    try {
      this.lastAt.set(new URL(url).host.toLowerCase(), now)
    } catch {
      /* URL 오류는 check() 에서 이미 걸린다 */
    }
  }
}

// ── 본문 비보관 계약 ─────────────────────────────────────────────────

export interface FactRead<T> {
  /** 대조 계측기 — 원문 복원 불가 */
  fingerprint: Fingerprint
  /** 본문을 보고 뽑아낸 것 (사실 카드 등). 본문 자체는 여기 담지 않는다. */
  extracted: T
  /** 지문 생성 시각 */
  readAt: Date
}

/**
 * 본문을 **반환하지 않는** 읽기.
 *
 * 본문은 이 함수 안에서만 살아 있다가 지문과 추출 결과만 남기고 스코프를 벗어난다.
 * 호출부는 본문에 접근할 방법이 없으므로 "저장하지 말자"는 규칙이 코드로 강제된다.
 *
 * ⚠ extract 콜백이 본문을 밖으로 흘리면 이 계약은 깨진다 — 콜백은 사실 카드처럼
 *   **원문 표현이 아닌 산출물**만 돌려줘야 한다. 그 위반은 I13(표현 독립성)이 잡는다.
 */
export async function readForFacts<T>(
  fetchBody: () => Promise<string>,
  extract: (body: string) => T | Promise<T>,
  shingleN: number = DEFAULT_SHINGLE_N,
): Promise<FactRead<T>> {
  const body = await fetchBody()
  const fingerprint = buildFingerprint(body, shingleN)
  const extracted = await extract(body)
  return { fingerprint, extracted, readAt: new Date() }
}
