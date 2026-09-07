// apps/web/src/lib/textfit/rate-limit.ts
//
// 토큰 버킷 — 공개 API 의 남용 방어. 순수 함수라 시계를 주입해 테스트한다.
//
// ⚠️ **프로세스 메모리다.** 인스턴스가 여러 개면 한도도 인스턴스 수만큼 곱해진다.
//    이걸 숨기지 않는 이유: 지금 이 방어의 목적은 "분산 공격 차단" 이 아니라
//    **실수·스크립트 한 대가 비용을 태우는 것**을 막는 것이다. 그 수준에는 충분하고,
//    그 이상이 필요해지면(=트래픽이 그만큼 붙으면) Redis 로 옮길 근거가 그때 생긴다.
//    지금 Redis 를 넣으면 사용자 3명인 제품에 운영 부담만 는다.

/** 한 클라이언트의 버킷 상태. */
interface Bucket {
  /** 남은 토큰 (소수 허용 — 시간에 비례해 채워진다) */
  tokens: number
  /** 마지막 보충 시각 (ms) */
  lastRefill: number
}

export interface RateLimitConfig {
  /** 버킷 용량 = 순간 최대 연속 허용 횟수 */
  capacity: number
  /** 초당 보충량 */
  refillPerSecond: number
  /** 이 시간 동안 안 쓰이면 버킷을 버린다 (ms) — 메모리 누수 방지 */
  idleTtlMs: number
  /** 동시에 추적할 최대 키 수 — 넘으면 가장 오래된 것부터 버린다 */
  maxKeys: number
}

/**
 * `/fit` 기본값 — 사람의 사용을 막지 않으면서 스크립트를 조인다.
 *
 * 화면은 700ms 디바운스 뒤 한 번 호출하므로, 쉬지 않고 타이핑해도 분당 최대 ~85회다.
 * 용량 20 · 초당 0.5 보충(=분당 30)이면 **연속 20회를 즉시 허용**하고 그 뒤로는
 * 2초에 한 번 꼴로 흐른다 — 붙여넣고 고치는 실제 사용에는 걸리지 않는다.
 */
export const FIT_RATE_LIMIT: RateLimitConfig = {
  capacity: 20,
  refillPerSecond: 0.5,
  idleTtlMs: 10 * 60_000,
  maxKeys: 5_000,
}

export interface RateLimitResult {
  allowed: boolean
  /** 남은 토큰 (내림) */
  remaining: number
  /** 거부됐을 때 다음 토큰까지 남은 초 (올림). 허용이면 0 */
  retryAfterSeconds: number
}

/**
 * 토큰 버킷 한 벌. 라우트 모듈이 하나를 만들어 모듈 스코프에 둔다.
 *
 * `Map` 은 삽입 순서를 보존하므로 오래된 키를 앞에서부터 버릴 수 있다(간이 LRU).
 */
export class TokenBucketLimiter {
  private readonly buckets = new Map<string, Bucket>()

  constructor(private readonly config: RateLimitConfig) {}

  /** 현재 추적 중인 키 수 — 테스트·진단용. */
  get size(): number {
    return this.buckets.size
  }

  /**
   * 한 요청을 소비한다.
   *
   * @param key 클라이언트 식별자(IP 등). 빈 문자열이면 공용 버킷으로 묶인다 —
   *            식별 불가를 무제한 허용으로 바꾸지 않는다.
   * @param now 현재 시각(ms). 테스트에서 주입한다.
   */
  take(key: string, now: number): RateLimitResult {
    this.evictStale(now)

    let id = key || '(unknown)'
    let existing = this.buckets.get(id)

    // ⚠️ 키를 매 요청 바꾸면 이 방어가 **통째로 사라진다.**
    //    새 키마다 용량이 가득 찬 새 버킷을 받으므로 한도가 아무 의미가 없고, 게다가 아래
    //    LRU 축출이 **멀쩡한 버킷을 대신 밀어낸다** — 방어가 없어지는 것을 넘어 남을
    //    쫓아낸다. `x-forwarded-for` 는 위조 가능하므로 이건 이론이 아니다.
    //
    //    그래서 **가득 찬 상태에서 처음 보는 키**는 새 버킷을 주지 않고 공용 버킷으로 묶는다.
    //    키 무작위화는 이제 "무제한 허용" 이 아니라 "전원이 한 버킷을 나눠 쓰는" 쪽으로
    //    무너진다 — 정상 사용자에게는 영향이 없고(이미 자기 버킷을 갖고 있다),
    //    남용자만 스스로를 좁힌다.
    if (!existing && this.buckets.size >= this.config.maxKeys) {
      id = '(overflow)'
      existing = this.buckets.get(id)
    }

    const bucket: Bucket = existing ?? { tokens: this.config.capacity, lastRefill: now }

    // 경과 시간만큼 보충 (용량 상한). 시계 역행에도 음수가 되지 않게 클램프.
    const elapsedSec = Math.max(0, (now - bucket.lastRefill) / 1000)
    bucket.tokens = Math.min(
      this.config.capacity,
      bucket.tokens + elapsedSec * this.config.refillPerSecond,
    )
    bucket.lastRefill = now

    let result: RateLimitResult
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1
      result = { allowed: true, remaining: Math.floor(bucket.tokens), retryAfterSeconds: 0 }
    } else {
      const need = 1 - bucket.tokens
      result = {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil(need / this.config.refillPerSecond)),
      }
    }

    // 재삽입으로 최근 사용 순서를 갱신한다(간이 LRU).
    this.buckets.delete(id)
    this.buckets.set(id, bucket)

    // 축출은 공용 버킷을 건드리지 않는다 — 그것을 밀어내면 다음 남용 요청이 다시
    // 가득 찬 버킷을 받아 위 방어가 무의미해진다.
    if (this.buckets.size > this.config.maxKeys) {
      for (const candidate of this.buckets.keys()) {
        if (candidate === '(overflow)') continue
        this.buckets.delete(candidate)
        break
      }
    }

    return result
  }

  /** 오래 안 쓰인 버킷 정리 — 앞쪽(오래된 것)만 훑고 멈춘다. */
  private evictStale(now: number): void {
    for (const [id, bucket] of this.buckets) {
      if (now - bucket.lastRefill <= this.config.idleTtlMs) break
      this.buckets.delete(id)
    }
  }
}

/**
 * 요청에서 클라이언트 키를 뽑는다.
 *
 * 프록시 뒤라 `x-forwarded-for` 가 정본이다(첫 번째가 원 클라이언트).
 * 헤더는 위조 가능하지만, 이 방어의 목적이 "실수·스크립트 한 대" 라 그 수준에는 유효하다.
 * 헤더가 없으면 빈 문자열을 돌려주고 호출부가 공용 버킷으로 묶는다.
 */
export function clientKeyFromHeaders(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  return headers.get('x-real-ip')?.trim() ?? ''
}
