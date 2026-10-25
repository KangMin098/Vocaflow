// apps/web/src/components/library/story/use-story-auth-guard.ts
//
// LCP Story 학습자 화면의 클라이언트 인증 경계.
// - 서버가 그린 첫 개인 상태(본문 · 목차 · 진도)는 `viewerId`(서버가 쿠키 세션으로 확인한 본인 uid)의 것이다.
//   브라우저 인증 상태가 다른 uid 이거나 로그아웃이면 그 상태는 더 이상 이 화면의 사용자 것이 아니다.
// - 인증 변화 구독을 **먼저** 걸고 그 다음에 현재 신원(기준선)을 읽는다 — 기준선을 기다리는 사이 온 이벤트가 이긴다.
// - 바뀌면 동기적으로 인증 세대를 올리고 'changed' 로 고정한다. 그 전에 출발한 저장 · 읽기 결과는 모두 낡은 것이 된다.
// - uid 는 비교에만 쓴다 — 서버로 보내지 않고, DOM · URL · 이벤트 · 저장소에 싣지 않는다.
// - 구독 원천은 주입할 수 있다(prop 또는 `StoryAuthSourceContext`) — 시험 · 하네스가 네트워크 없이 로그아웃 · 계정 전환을 만든다.

import { createContext, useContext, useEffect, useRef, useSyncExternalStore } from 'react'

import { createClient } from '@/lib/supabase/client'

/** 인증 변화 하나. userId = 그 시점 세션의 uid(없으면 null). */
export interface StoryAuthChange {
  event: string
  userId: string | null
}

/** 인증 구독 원천 — subscribe 가 먼저 불리고, 그 다음 currentUserId 가 불린다. */
export interface StoryAuthSource {
  subscribe(listener: (change: StoryAuthChange) => void): () => void
  currentUserId(): Promise<string | null>
  /**
   * (선택 · **시험 · 하네스 전용**) 주입 원천이 이미 동기적으로 아는 신원. undefined = 모름.
   * 실제 브라우저 원천(browserStoryAuthSource)은 구현하지 않는다 — 실제 화면은 구독 → 기준선(비동기) 순서로만 판정한다.
   * 경계를 만들 때 한 번 읽어 판정하고, 이후 판정은 구독 · 기준선이 한다.
   */
  testOnlyKnownUserId?(): string | null | undefined
}

/** checking = 아직 브라우저 신원 확인 전(서버 첫 상태를 그대로 보인다) · same = 같은 사람 · changed = 바뀜(개인 상태 폐기). */
export type StoryAuthStatus = 'checking' | 'same' | 'changed'

export class StoryAuthGuard {
  private gen = 0
  private st: StoryAuthStatus = 'checking'
  private eventSeq = 0
  private readonly listeners = new Set<() => void>()

  /** expectedOwner = 서버가 그린 개인 상태의 주인(로그인 전 화면이면 null). */
  constructor(readonly expectedOwner: string | null) {}

  get generation(): number {
    return this.gen
  }

  get status(): StoryAuthStatus {
    return this.st
  }

  readonly getStatus = (): StoryAuthStatus => this.st

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** 인증 변화 관찰. 주인과 다른 uid · 로그아웃이면 즉시 바뀜으로 고정한다. */
  observe(change: StoryAuthChange): void {
    this.eventSeq += 1
    const userId = change.event === 'SIGNED_OUT' ? null : change.userId
    if (userId !== this.expectedOwner) this.invalidate()
    else if (this.st === 'checking') this.set('same')
  }

  /** 바뀜으로 고정(동기). 서버 응답이 다른 주인을 말하거나 로그인이 풀렸다고 할 때도 부른다. */
  invalidate(): void {
    if (this.st === 'changed') return
    this.gen += 1
    this.set('changed')
  }

  /** 요청을 보낼 때 잡아 두는 세대. */
  token(): number {
    return this.gen
  }

  /** 긍정 확인됐고(same) 그 뒤 인증이 바뀌지 않았는가. checking(확인 전)은 거짓 — 확인 전에는 보내지도 받지도 않는다. */
  isCurrent(token: number): boolean {
    return this.st === 'same' && token === this.gen
  }

  /** 결과를 받아도 되는가 — 세대가 같고, 결과의 주인이 이 화면의 주인과 같다. */
  accepts(token: number, resultOwner: string): boolean {
    return this.isCurrent(token) && this.expectedOwner !== null && resultOwner === this.expectedOwner
  }

  /** 구독을 먼저 걸고 기준선을 읽는다. 기준선을 기다리는 사이 이벤트가 왔으면 기준선은 버린다. 돌려준 함수로 해제. */
  connect(source: StoryAuthSource): () => void {
    let live = true
    const unsubscribe = source.subscribe((change) => {
      if (live) this.observe(change)
    })
    const seq = this.eventSeq
    source.currentUserId().then(
      (userId) => {
        if (live && this.eventSeq === seq) this.observe({ event: 'BASELINE', userId })
      },
      () => {
        // 기준선을 못 읽으면 판정하지 않는다(서버 첫 상태 유지) — 이후 인증 이벤트가 판정한다.
      },
    )
    return () => {
      live = false
      unsubscribe()
    }
  }

  private set(next: StoryAuthStatus): void {
    this.st = next
    for (const listener of [...this.listeners]) listener()
  }
}

/** 브라우저 Supabase 세션 원천(쿠키 · 로컬 세션 — getSession 은 인증 서버를 부르지 않는다). */
export function browserStoryAuthSource(): StoryAuthSource {
  let auth: ReturnType<typeof createClient>['auth'] | null = null
  const getAuth = () => (auth ??= createClient().auth)
  return {
    subscribe(listener) {
      const { data } = getAuth().onAuthStateChange((event, session) => {
        listener({ event, userId: session?.user?.id ?? null })
      })
      return () => data.subscription.unsubscribe()
    },
    async currentUserId() {
      const { data } = await getAuth().getSession()
      return data.session?.user?.id ?? null
    },
  }
}

/** 하네스 · 시험이 페이지 전체에 원천을 주입하는 자리(prop 이 있으면 prop 이 이긴다). */
export const StoryAuthSourceContext = createContext<StoryAuthSource | null>(null)

/**
 * 화면의 인증 경계. expectedOwner(서버 viewerId)가 바뀌면 새 경계를 만든다.
 * 반환 status 가 'changed' 이면 화면은 개인 내용을 그리지 않는다.
 */
export function useStoryAuthGuard(
  expectedOwner: string | null,
  source?: StoryAuthSource,
): { guard: StoryAuthGuard; status: StoryAuthStatus } {
  const fromContext = useContext(StoryAuthSourceContext)
  const ref = useRef<StoryAuthGuard | null>(null)
  const injected = source ?? fromContext
  if (ref.current === null || ref.current.expectedOwner !== expectedOwner) {
    ref.current = new StoryAuthGuard(expectedOwner)
    const known = injected?.testOnlyKnownUserId?.()
    if (known !== undefined) ref.current.observe({ event: 'KNOWN', userId: known })
  }
  const guard = ref.current

  useEffect(() => guard.connect(injected ?? browserStoryAuthSource()), [guard, injected])

  // 서버 렌더 · 첫 수화도 같은 경계 값을 읽는다(브라우저 원천이면 둘 다 checking).
  const status = useSyncExternalStore(guard.subscribe, guard.getStatus, guard.getStatus)
  return { guard, status }
}
