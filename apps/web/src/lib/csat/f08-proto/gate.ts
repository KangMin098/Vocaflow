// apps/web/src/lib/csat/f08-proto/gate.ts
// F08 프로토타입은 내부 비교용이다 — 프로덕션 빌드에서는 F08_PROTO=on 을 켠 경우에만 열린다(replica 와 같은 가드).

export function f08ProtoOpen(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV !== 'production' || env.F08_PROTO === 'on'
}

/** 오류 화면 비교용 가짜 고장 — 프로토타입 URL 의 ?fault= 로만 고른다. */
export const FAULTS = ['none', 'no-source', 'reveal-refused', 'reveal-error', 'lecture-fail'] as const
export type Fault = (typeof FAULTS)[number]

export function parseFault(v: string | null | undefined): Fault {
  return (FAULTS as readonly string[]).includes(v ?? '') ? (v as Fault) : 'none'
}
